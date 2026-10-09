<script lang="ts">
	/**
	 * HU12 · "Perfil Administrador" (Figma `1210:52859`) y HU13 · cambiar la
	 * contraseña desde la sesión (`1340:62809`).
	 *
	 * Un panel con tres bloques, cada uno con su lápiz para editarse por
	 * separado, como el diseño:
	 *
	 *   · **Información personal** — nombre, apellido paterno y materno,
	 *     teléfono. El correo y el rol se muestran pero NO se editan: el correo
	 *     es con el que inicia sesión y el rol lo mueve quien administra. Por eso
	 *     llevan el signo de interrogación del diseño, que lo explica.
	 *   · **Información de recuperación** — correo y teléfono. Con el chip
	 *     naranja "Incompleto" mientras falte alguno.
	 *   · **Seguridad** — el correo, y al editar, los tres campos del cambio de
	 *     contraseña con el mismo medidor del primer acceso.
	 *
	 * Al cambiar la contraseña desde aquí la sesión NO se cierra (es un cambio
	 * voluntario, no un restablecimiento): el servidor solo cierra las demás
	 * cuando la contraseña venía impuesta.
	 */
	import { tick } from 'svelte';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Check from '@lucide/svelte/icons/check';
	import UserCircle from '@lucide/svelte/icons/circle-user-round';

	import LapizFirmaIcon from '$lib/components/icons/LapizFirmaIcon.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import CampoTelefono from '$lib/components/organizaciones/CampoTelefono.svelte';
	import MedidorContrasena from '$lib/components/acceso/MedidorContrasena.svelte';
	import { cumpleTodas } from '$lib/acceso/reglasContrasena';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';

	type PerfilUsuario = {
		guid: string;
		email: string;
		nombre: string;
		apellidoPaterno: string;
		apellidoMaterno: string;
		telefono: string | null;
		esAdminPlataforma: boolean;
		creadoEn: string | null;
		recuperacion: { email?: string | null; telefono?: string | null };
		membresias: { tenantGuid: string; rol: string }[];
	};

	let { open = $bindable(false), rolVisible = '' }: { open?: boolean; rolVisible?: string } = $props();

	let perfil = $state<PerfilUsuario | null>(null);
	let cargando = $state(false);
	let editando = $state<'personal' | 'recuperacion' | 'seguridad' | null>(null);
	let guardando = $state(false);
	let error = $state('');
	let guardado = $state('');

	// Lo que se edita (se llena al abrir cada bloque).
	let nombre = $state('');
	let paterno = $state('');
	let materno = $state('');
	let telefono = $state('');
	let recEmail = $state('');
	let recTelefono = $state('');
	let actual = $state('');
	let nueva = $state('');
	let confirmacion = $state('');
	let verActual = $state(false);
	let verNueva = $state(false);
	let verConfirmacion = $state(false);

	const sinNumero = (t: string | null | undefined) => (t ?? '').replace(/^\+52\s*/, '');
	const conNumero = (t: string) => (t.trim() ? `+52 ${t.trim()}` : null);

	/** La recuperación no puede repetir el correo con el que se entra ni el
	 *  teléfono propio: si se pierde ese dato, repetirlo no recupera nada. */
	const soloDigitos = (v: string) => v.replace(/\D/g, '');
	const recTelRepetido = $derived(
		soloDigitos(recTelefono).length > 0 && soloDigitos(recTelefono) === soloDigitos(telefono)
	);
	const recEmailRepetido = $derived(
		recEmail.trim().length > 0 && recEmail.trim().toLowerCase() === (perfil?.email ?? '').toLowerCase()
	);

	const recuperacionCompleta = $derived(
		Boolean(perfil?.recuperacion?.email?.trim()) && Boolean(perfil?.recuperacion?.telefono?.trim())
	);
	const nombreCompleto = $derived(
		[perfil?.nombre, perfil?.apellidoPaterno, perfil?.apellidoMaterno].filter(Boolean).join(' ')
	);
	const contrasenaLista = $derived(
		actual.length > 0 && cumpleTodas(nueva) && nueva === confirmacion
	);

	$effect(() => {
		if (!open) return;
		void cargar();
	});

	async function cargar() {
		cargando = true;
		error = '';
		try {
			const r = await fetch('/api/auth/yo');
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo cargar tu perfil.';
				return;
			}
			perfil = datos.usuario;
			editando = null;
		} finally {
			cargando = false;
		}
	}

	function editar(bloque: 'personal' | 'recuperacion' | 'seguridad') {
		if (!perfil) return;
		error = guardado = '';
		nombre = perfil.nombre;
		paterno = perfil.apellidoPaterno;
		materno = perfil.apellidoMaterno;
		telefono = sinNumero(perfil.telefono);
		recEmail = perfil.recuperacion?.email ?? '';
		recTelefono = sinNumero(perfil.recuperacion?.telefono);
		actual = nueva = confirmacion = '';
		editando = bloque;
	}

	async function guardarDatos() {
		if (!perfil || guardando) return;
		guardando = true;
		error = '';
		try {
			const r = await fetch('/api/auth/perfil', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nombre: nombre.trim(),
					apellidoPaterno: paterno.trim(),
					apellidoMaterno: materno.trim(),
					telefono: conNumero(telefono),
					recuperacion: { email: recEmail.trim() || null, telefono: conNumero(recTelefono) }
				})
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudieron guardar los cambios.';
				return;
			}
			perfil = datos.usuario;
			editando = null;
			guardado = 'Tus datos se actualizaron correctamente.';
		} finally {
			guardando = false;
		}
	}

	async function guardarContrasena() {
		if (!contrasenaLista || guardando) return;
		guardando = true;
		error = '';
		try {
			const r = await fetch('/api/auth/contrasena', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actual, nueva, confirmacion })
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo cambiar la contraseña.';
				return;
			}
			await tick();
			editando = null;
			actual = nueva = confirmacion = '';
			guardado = 'Tu contraseña se actualizó correctamente.';
		} finally {
			guardando = false;
		}
	}

	function fecha(iso: string | null | undefined): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
	}

	const CLASE_INPUT =
		'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';
</script>

{#snippet lapiz(bloque: 'personal' | 'recuperacion' | 'seguridad', etiqueta: string)}
	<button
		type="button"
		class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20"
		data-testid="editar-{bloque}"
		aria-label={etiqueta}
		onclick={() => editar(bloque)}
	>
		<LapizFirmaIcon class="size-3.5" />
	</button>
{/snippet}

{#snippet dato(etiqueta: string, valor: string, ayuda = '')}
	<div class="min-w-0">
		<p class="flex items-center gap-1 text-xs text-muted-foreground">
			{etiqueta}
			{#if ayuda}
				<span title={ayuda} class="inline-flex text-muted-foreground"><CircleHelp class="size-3" /></span>
			{/if}
		</p>
		<p class="mt-0.5 truncate text-sm text-foreground" title={valor}>{valor || '—'}</p>
	</div>
{/snippet}

<Sheet.Root bind:open>
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-perfil"
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[42%] data-[side=right]:xl:w-[36%]"
	>
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Perfil {rolVisible || 'de usuario'}
			</Sheet.Title>
			<button
				type="button"
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
				data-testid="cerrar-perfil"
				onclick={() => (open = false)}
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</button>
		</div>

		<div class="flex items-center gap-3 px-6 py-4">
			<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
				<UserCircle class="size-5" />
			</span>
			<div>
				<h2 class="text-lg font-medium text-foreground">Información personal</h2>
				<p class="text-sm text-muted-foreground">
					Administrar tu información personal y profesional desde un solo lugar.
				</p>
			</div>
		</div>

		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
			{#if cargando && !perfil}
				<p class="py-10 text-center text-sm text-muted-foreground">Cargando tu perfil…</p>
			{:else if perfil}
				<div class="rounded-xl border border-border p-4">
					<p class="flex flex-wrap items-center gap-2">
						<span class="text-xl font-semibold text-foreground" data-testid="perfil-nombre">{nombreCompleto}</span>
					</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{rolVisible || 'Usuario'} <span aria-hidden="true">•</span> {perfil.email}
					</p>
				</div>

				<!-- Información personal -->
				<div class="rounded-xl border border-border p-4">
					<div class="flex items-center gap-3 border-b border-border pb-3">
						<p class="flex-1 text-base font-medium text-foreground">Información personal</p>
						<p class="text-xs text-muted-foreground">Registro | {fecha(perfil.creadoEn)}</p>
						{#if editando !== 'personal'}{@render lapiz('personal', 'Editar información personal')}{/if}
					</div>
					{#if editando === 'personal'}
						<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div class="flex flex-col gap-1.5">
								<label for="p-nombre" class="text-xs text-muted-foreground">Nombre</label>
								<input id="p-nombre" bind:value={nombre} class={CLASE_INPUT} />
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="p-paterno" class="text-xs text-muted-foreground">Apellido paterno</label>
								<input id="p-paterno" bind:value={paterno} class={CLASE_INPUT} />
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="p-materno" class="text-xs text-muted-foreground">Apellido materno</label>
								<input id="p-materno" bind:value={materno} class={CLASE_INPUT} />
							</div>
						</div>
						<div class="mt-4 max-w-[60%]">
							<label for="p-tel" class="text-xs text-muted-foreground">Número de teléfono</label>
							<div class="mt-1.5"><CampoTelefono id="p-tel" bind:value={telefono} /></div>
						</div>
					{:else}
						<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
							{@render dato('Nombre', perfil.nombre)}
							{@render dato('Apellido paterno', perfil.apellidoPaterno)}
							{@render dato('Apellido materno', perfil.apellidoMaterno)}
							{@render dato('Número de teléfono', sinNumero(perfil.telefono))}
							{@render dato('Correo electrónico', perfil.email, 'Es con el que inicias sesión: no se puede cambiar desde aquí.')}
							{@render dato('Rol de sistema', rolVisible, 'Lo asigna quien administra tu organización.')}
						</div>
					{/if}
				</div>

				<!-- Información de recuperación -->
				<div class="rounded-xl border border-border p-4">
					<div class="flex items-center gap-3 border-b border-border pb-3">
						<p class="flex-1 text-base font-medium text-foreground">Información de recuperación</p>
						{#if !recuperacionCompleta && editando !== 'recuperacion'}
							<span
								class="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
								data-testid="recuperacion-incompleta"
							>
								<TriangleAlert class="size-3" />
								Incompleto
							</span>
						{/if}
						{#if editando !== 'recuperacion'}{@render lapiz('recuperacion', 'Editar información de recuperación')}{/if}
					</div>
					{#if editando === 'recuperacion'}
						<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="flex flex-col gap-1.5">
								<label for="r-email" class="text-xs text-muted-foreground">Correo electrónico</label>
								<input
									id="r-email"
									type="email"
									placeholder="Ingresa correo de recuperación"
									bind:value={recEmail}
									class={CLASE_INPUT}
								/>
								{#if recEmailRepetido}
									<p class="text-xs text-destructive" data-testid="error-rec-email">
										Debe ser distinto al correo con el que inicias sesión.
									</p>
								{/if}
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="r-tel" class="text-xs text-muted-foreground">Número de teléfono</label>
								<CampoTelefono id="r-tel" bind:value={recTelefono} placeholder="Ingresa numero de teléfono" />
								{#if recTelRepetido}
									<p class="text-xs text-destructive" data-testid="error-rec-tel">
										Debe ser distinto a tu teléfono celular.
									</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							{@render dato('Correo electrónico', perfil.recuperacion?.email ?? '')}
							{@render dato('Número de teléfono', sinNumero(perfil.recuperacion?.telefono))}
						</div>
					{/if}
				</div>

				<!-- Seguridad -->
				<div class="rounded-xl border border-border p-4">
					<div class="flex items-center gap-3 border-b border-border pb-3">
						<p class="flex-1 text-base font-medium text-foreground">Seguridad</p>
						{#if editando !== 'seguridad'}{@render lapiz('seguridad', 'Cambiar contraseña')}{/if}
					</div>
					{#if editando === 'seguridad'}
						<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							{@render dato('Correo electrónico', perfil.email)}
							<div class="flex flex-col gap-1.5">
								<label for="s-actual" class="text-sm font-medium text-foreground">Confirmar contraseña actual</label>
								<div class="relative">
									<input
										id="s-actual"
										type={verActual ? 'text' : 'password'}
										autocomplete="current-password"
										placeholder="Ingresa tu contraseña actual"
										bind:value={actual}
										class="{CLASE_INPUT} pr-10"
									/>
									<button
										type="button"
										class="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
										aria-label={verActual ? 'Ocultar contraseña' : 'Mostrar contraseña'}
										onclick={() => (verActual = !verActual)}
									>
										{#if verActual}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
									</button>
								</div>
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="s-nueva" class="text-sm font-medium text-foreground">Nueva contraseña</label>
								<div class="relative">
									<input
										id="s-nueva"
										type={verNueva ? 'text' : 'password'}
										autocomplete="new-password"
										placeholder="Ingresa nueva contraseña"
										bind:value={nueva}
										class="{CLASE_INPUT} pr-10"
									/>
									<button
										type="button"
										class="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
										aria-label={verNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
										onclick={() => (verNueva = !verNueva)}
									>
										{#if verNueva}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
									</button>
								</div>
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="s-confirma" class="text-sm font-medium text-foreground">Confirmar contraseña</label>
								<div class="relative">
									<input
										id="s-confirma"
										type={verConfirmacion ? 'text' : 'password'}
										autocomplete="new-password"
										placeholder="Confirma nueva contraseña"
										bind:value={confirmacion}
										class="{CLASE_INPUT} pr-10"
									/>
									<button
										type="button"
										class="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
										aria-label={verConfirmacion ? 'Ocultar contraseña' : 'Mostrar contraseña'}
										onclick={() => (verConfirmacion = !verConfirmacion)}
									>
										{#if verConfirmacion}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
									</button>
								</div>
								{#if confirmacion && nueva !== confirmacion}
									<p class="text-xs text-destructive" data-testid="perfil-no-coincide">
										La contraseña no coincide; por favor intenta de nuevo.
									</p>
								{/if}
							</div>
						</div>
						<div class="mt-4"><MedidorContrasena contrasena={nueva} /></div>
					{:else}
						<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							{@render dato('Correo electrónico', perfil.email)}
							{@render dato('Contraseña', '••••••••••••••')}
						</div>
					{/if}
				</div>

				{#if guardado}
					<p
						class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700"
						role="status"
						data-testid="perfil-guardado"
					>
						<Check class="size-3.5" />
						{guardado}
					</p>
				{/if}
				{#if error}
					<p class="text-xs text-destructive" data-testid="perfil-error">{error}</p>
				{/if}
			{/if}
		</div>

		<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
			{#if editando === null}
				<Button data-testid="cerrar-perfil-pie" onclick={() => (open = false)}>Cerrar</Button>
			{:else}
				<Button variant="link" class="h-auto p-0 text-destructive" data-testid="cancelar-perfil" onclick={() => (editando = null)}>
					Cancelar
				</Button>
				{#if editando === 'seguridad'}
					<Button data-testid="guardar-contrasena" disabled={!contrasenaLista || guardando} onclick={guardarContrasena}>
						{guardando ? 'Guardando…' : 'Guardar cambios'}
					</Button>
				{:else}
					<Button data-testid="guardar-perfil" disabled={!nombre.trim() || recTelRepetido || recEmailRepetido || guardando} onclick={guardarDatos}>
						{guardando ? 'Guardando…' : 'Guardar cambios'}
					</Button>
				{/if}
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
