<script lang="ts">
	/**
	 * HU02 · El modal "Nuevo registro" (Figma `226:2344` y sus variantes).
	 *
	 * Un solo formulario con tres bloques, como el diseño —no un wizard—:
	 * la organización, su administrador, y los datos de recuperación en un
	 * desplegable. "Crear organización" se enciende cuando están los cinco
	 * campos obligatorios.
	 *
	 * **Coincidencias**: mientras se escribe el nombre se le pregunta al
	 * servidor si ya hay una organización que se llame igual. Si la hay, sale
	 * el aviso del diseño con los dos chips (ID encontrado / ID asignado). No
	 * bloquea nada: el nombre puede repetirse, el ID no.
	 *
	 * **Sin correo** (decisión del 2026-10-07): al crear, el servidor devuelve
	 * la contraseña temporal del administrador y esta pantalla la muestra UNA
	 * vez, para que el super admin la entregue por donde pueda. Por eso se
	 * reusa `SecretUnaVez`, el mismo componente de las API Keys y del secret de
	 * los webhooks.
	 */
	import { tick } from 'svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Clock from '@lucide/svelte/icons/clock';
	import Network from '@lucide/svelte/icons/network';

	import CampoTelefono from './CampoTelefono.svelte';
	import SecretUnaVez from '$lib/components/config/SecretUnaVez.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ConfirmarAccion from '$lib/components/ui/confirmar/ConfirmarAccion.svelte';

	let {
		open = $bindable(false),
		recientes = [],
		alCrear
	}: {
		open?: boolean;
		/** Las últimas organizaciones, para el desplegable "Ultimos registros". */
		recientes?: { nombre: string; slug: string }[];
		/** Se llama cuando el alta terminó bien, para recargar el listado. */
		alCrear: () => Promise<void> | void;
	} = $props();

	type Creada = { organizacion: { nombre: string; slug: string }; admin: { email: string }; contrasenaTemporal: string };

	let nombre = $state('');
	let adminNombre = $state('');
	let adminTelefono = $state('');
	let adminEmail = $state('');
	let recTelefono = $state('');
	let recEmail = $state('');
	let recuperacionAbierta = $state(true);
	let sugerenciasAbiertas = $state(false);
	let enviando = $state(false);
	let errorEmail = $state('');
	let errorGeneral = $state('');
	let coincidencias = $state<{ nombre: string; slug: string }[]>([]);
	let slugPropuesto = $state('');
	let creada = $state<Creada | null>(null);
	let confirmarSalida = $state(false);

	/** El texto del diálogo de salida, literal del diseño (frame `243:2647`). */
	const MENSAJE_SALIR = [
		'Los cambios realizados no se guardarán. Si continúas, deberás iniciar nuevamente el proceso de registro.',
		'¿Estas seguro de cancelar el registro?'
	].join('\n\n');

	const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
	/** La recuperación sirve si se pierde el acceso al dato principal: repetirlo
	 *  no recupera nada. Se comparan sin espacios ni mayúsculas. */
	const soloDigitos = (v: string) => v.replace(/\D/g, '');
	const recTelRepetido = $derived(
		soloDigitos(recTelefono).length > 0 && soloDigitos(recTelefono) === soloDigitos(adminTelefono)
	);
	const recEmailRepetido = $derived(
		recEmail.trim().length > 0 && recEmail.trim().toLowerCase() === adminEmail.trim().toLowerCase()
	);
	const completo = $derived(
		nombre.trim().length > 0 &&
			adminNombre.trim().length > 0 &&
			adminTelefono.trim().length > 0 &&
			RE_CORREO.test(adminEmail.trim()) &&
			!recTelRepetido &&
			!recEmailRepetido
	);
	const hayCambios = $derived(
		[nombre, adminNombre, adminTelefono, adminEmail, recTelefono, recEmail].some((v) => v.trim().length > 0)
	);

	/** Pregunta por coincidencias un momento después de dejar de escribir: una
	 *  llamada por tecla sería ruido para el servidor y parpadeo para quien ve. */
	let temporizador: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const texto = nombre.trim();
		clearTimeout(temporizador);
		if (!texto) {
			coincidencias = [];
			slugPropuesto = '';
			return;
		}
		temporizador = setTimeout(async () => {
			const r = await fetch(`/api/organizaciones/coincidencias?nombre=${encodeURIComponent(texto)}`).catch(
				() => null
			);
			if (!r?.ok) return;
			const datos = await r.json().catch(() => null);
			coincidencias = datos?.coincidencias ?? [];
			slugPropuesto = datos?.slugPropuesto ?? '';
		}, 350);
		return () => clearTimeout(temporizador);
	});

	function limpiar() {
		nombre = adminNombre = adminTelefono = adminEmail = recTelefono = recEmail = '';
		errorEmail = errorGeneral = '';
		coincidencias = [];
		slugPropuesto = '';
		creada = null;
		recuperacionAbierta = true;
		sugerenciasAbiertas = false;
	}

	function intentarCerrar() {
		if (creada || !hayCambios) {
			open = false;
			limpiar();
			return;
		}
		confirmarSalida = true;
	}

	async function crear() {
		if (!completo || enviando) return;
		enviando = true;
		errorEmail = errorGeneral = '';
		try {
			const r = await fetch('/api/organizaciones', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nombre: nombre.trim(),
					adminNombre: adminNombre.trim(),
					adminApellidos: '',
					adminTelefono: adminTelefono.trim() ? `+52 ${adminTelefono.trim()}` : null,
					adminEmail: adminEmail.trim(),
					recuperacion: {
						telefono: recTelefono.trim() ? `+52 ${recTelefono.trim()}` : null,
						email: recEmail.trim() || null
					}
				})
			});
			const cuerpo = await r.json().catch(() => null);
			if (!r.ok) {
				if (cuerpo?.codigo === 'correo_registrado') errorEmail = cuerpo.mensaje;
				else errorGeneral = cuerpo?.mensaje ?? 'No se pudo crear la organización. Intenta de nuevo.';
				return;
			}
			creada = cuerpo as Creada;
			await tick();
			await alCrear();
		} finally {
			enviando = false;
		}
	}
</script>

<Sheet.Root
	bind:open
	onOpenChange={(abierto) => {
		if (!abierto) limpiar();
	}}
>
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-nueva-organizacion"
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[46%] data-[side=right]:xl:w-[40%]"
		onInteractOutside={(e) => e.preventDefault()}
		onEscapeKeydown={(e) => {
			e.preventDefault();
			intentarCerrar();
		}}
	>
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">Nuevo registro</Sheet.Title>
			<button
				type="button"
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
				data-testid="cerrar-nueva-organizacion"
				onclick={intentarCerrar}
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</button>
		</div>

		{#if creada}
			<!-- Sin correo: la contraseña temporal se muestra aquí, una vez. -->
			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
				<div class="flex items-center gap-3">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
						<Sparkles class="size-5" />
					</span>
					<div>
						<h2 class="text-lg font-medium text-foreground" data-testid="organizacion-creada">
							{creada.organizacion.nombre} quedó registrada
						</h2>
						<p class="text-sm text-muted-foreground">
							ID asignado: <span class="font-medium text-foreground">{creada.organizacion.slug}</span>
						</p>
					</div>
				</div>
				<p class="text-sm text-muted-foreground">
					Entrega estos accesos a <span class="font-medium text-foreground">{creada.admin.email}</span>. La
					contraseña temporal se muestra una sola vez y se le pedirá cambiarla al entrar.
				</p>
				<SecretUnaVez secret={creada.contrasenaTemporal} testid="contrasena-temporal" />
			</div>
			<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
				<Button
					data-testid="listo-nueva-organizacion"
					onclick={() => {
						open = false;
						limpiar();
					}}
				>
					Listo
				</Button>
			</div>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
				<div class="flex items-center gap-3">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
						<Network class="size-5" />
					</span>
					<div>
						<h2 class="text-lg font-medium text-foreground">Agrega una nueva organización</h2>
						<p class="text-sm text-muted-foreground">Completa la información requerida.</p>
					</div>
				</div>

				<div class="flex flex-col gap-1.5">
					<label for="org-nombre" class="text-sm font-medium text-foreground">
						Nombre de la organización <span class="text-destructive">*</span>
					</label>
					<div class="relative">
						<input
							id="org-nombre"
							placeholder="Ingresa el nombre de la organización"
							bind:value={nombre}
							onfocus={() => (sugerenciasAbiertas = true)}
							onblur={() => setTimeout(() => (sugerenciasAbiertas = false), 150)}
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
						{#if sugerenciasAbiertas && !nombre.trim() && recientes.length > 0}
							<!-- "Ultimos registros": ayuda a no duplicar sin querer. -->
							<div
								class="absolute top-full right-0 left-0 z-10 mt-1 rounded-lg border border-border bg-card p-2 shadow-lg"
								data-testid="ultimos-registros"
							>
								<p class="px-2 pb-1 text-xs text-muted-foreground">Ultimos registros</p>
								{#each recientes.slice(0, 4) as reciente (reciente.slug)}
									<div class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground">
										<Clock class="size-3.5 shrink-0 text-muted-foreground" />
										<span class="min-w-0 flex-1 truncate">{reciente.nombre}</span>
										<span class="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
											# ID . {reciente.slug}
										</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					{#if coincidencias.length > 0}
						<div
							class="mt-1 flex gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5"
							data-testid="aviso-coincidencias"
						>
							<Sparkles class="mt-0.5 size-4 shrink-0 text-primary" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-foreground">
									Detectamos coincidencias con el nombre ingresado.<br />
									Al continuar, se asignará automáticamente un ID único para diferenciar este registro.
								</p>
								<p class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
									<CornerDownRight class="size-3" />
									ID encontrado
									<span class="rounded-md bg-card px-1.5 py-0.5 font-medium text-foreground">
										# {coincidencias[0].slug}
									</span>
									ID asignado
									<span
										class="rounded-md bg-card px-1.5 py-0.5 font-medium text-foreground"
										data-testid="id-asignado"
									>
										# {slugPropuesto}
									</span>
								</p>
							</div>
						</div>
					{/if}
				</div>

				<div class="border-t border-border"></div>

				<div class="flex flex-col gap-4">
					<div>
						<h3 class="text-sm font-medium text-foreground">Administrador de la organización</h3>
						<p class="text-xs text-muted-foreground">
							Registra los datos de quien administrará este espacio y tendrá acceso a la configuración principal.
						</p>
					</div>
					<div class="flex flex-col gap-1.5">
						<label for="admin-nombre" class="text-sm font-medium text-foreground">
							Nombre completo <span class="text-destructive">*</span>
						</label>
						<input
							id="admin-nombre"
							placeholder="Ingresa el nombre completo"
							bind:value={adminNombre}
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="flex flex-col gap-1.5">
							<label for="admin-tel" class="text-sm font-medium text-foreground">
								Teléfono celular <span class="text-destructive">*</span>
							</label>
							<CampoTelefono id="admin-tel" bind:value={adminTelefono} />
						</div>
						<div class="flex flex-col gap-1.5">
							<label for="admin-email" class="text-sm font-medium text-foreground">
								Correo electrónico <span class="text-destructive">*</span>
							</label>
							<input
								id="admin-email"
								type="email"
								placeholder="Ingresa correo electrónico"
								bind:value={adminEmail}
								oninput={() => (errorEmail = '')}
								aria-invalid={errorEmail ? 'true' : undefined}
								class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
							/>
							{#if errorEmail}
								<p class="flex items-start gap-1 text-xs text-destructive" data-testid="error-correo-admin">
									<TriangleAlert class="mt-0.5 size-3 shrink-0" />
									{errorEmail}
								</p>
							{/if}
						</div>
					</div>
				</div>

				<div class="rounded-lg border border-border">
					<button
						type="button"
						class="flex w-full items-start gap-3 px-4 py-3 text-left"
						data-testid="toggle-recuperacion"
						onclick={() => (recuperacionAbierta = !recuperacionAbierta)}
					>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-medium text-foreground">Configura tus datos de recuperación</span>
							<span class="block text-xs text-muted-foreground">
								Esta información te permitirá recuperar el acceso a tu cuenta de manera rápida y segura.
							</span>
						</span>
						<ChevronDown
							class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform {recuperacionAbierta
								? 'rotate-180'
								: ''}"
						/>
					</button>
					{#if recuperacionAbierta}
						<div class="grid grid-cols-1 gap-4 border-t border-border px-4 py-4 sm:grid-cols-2">
							<div class="flex flex-col gap-1.5">
								<label for="rec-tel" class="text-sm font-medium text-foreground">Teléfono celular</label>
								<CampoTelefono id="rec-tel" bind:value={recTelefono} />
								{#if recTelRepetido}
									<p class="flex items-start gap-1 text-xs text-destructive" data-testid="error-rec-tel">
										<TriangleAlert class="mt-0.5 size-3 shrink-0" />
										Debe ser distinto al teléfono del administrador.
									</p>
								{/if}
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="rec-email" class="text-sm font-medium text-foreground">Correo electrónico</label>
								<input
									id="rec-email"
									type="email"
									placeholder="Ingresa correo electrónico"
									bind:value={recEmail}
									aria-invalid={recEmailRepetido ? 'true' : undefined}
									class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
								/>
								{#if recEmailRepetido}
									<p class="flex items-start gap-1 text-xs text-destructive" data-testid="error-rec-email">
										<TriangleAlert class="mt-0.5 size-3 shrink-0" />
										Debe ser distinto al correo del administrador.
									</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				{#if errorGeneral}
					<p class="text-xs text-destructive" data-testid="error-general-organizacion">{errorGeneral}</p>
				{/if}
			</div>

			<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
				<Button
					variant="link"
					class="h-auto p-0 text-destructive"
					data-testid="cancelar-organizacion"
					onclick={intentarCerrar}
				>
					Cancelar registro
				</Button>
				<Button data-testid="crear-organizacion" disabled={!completo || enviando} onclick={crear}>
					{enviando ? 'Creando…' : 'Crear organización'}
				</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>

<ConfirmarAccion
	abierto={confirmarSalida}
	titulo="Estás por salir del registro"
	mensaje={MENSAJE_SALIR}
	etiquetaConfirmar="Cancelar registro"
	etiquetaCancelar="Continuar registro"
	onConfirmar={() => {
		open = false;
		limpiar();
	}}
	onCerrar={() => (confirmarSalida = false)}
/>
