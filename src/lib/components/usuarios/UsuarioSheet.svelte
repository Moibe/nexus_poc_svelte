<script lang="ts">
	/**
	 * HU06 · "Agrega una nuevo usuario" (el título es del diseño, con su falta
	 * de concordancia) y HU07 · "Actualiza la información del usuario".
	 *
	 * El mismo panel para los dos: cambian el encabezado, el botón y si el
	 * correo se puede escribir. Al editar NO se toca el correo: es la identidad
	 * con la que la persona entra.
	 *
	 * Los roles son tarjetas con radio y su descripción, como el diseño. Al
	 * crear, "Crear nuevo usuario" se enciende con nombre, correo válido y un
	 * rol elegido.
	 *
	 * Sin correo (decisión del 2026-10-07): al crear se muestra la contraseña
	 * temporal UNA vez, con el mismo componente que las API Keys.
	 */
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import UserPen from '@lucide/svelte/icons/user-pen';

	import SecretUnaVez from '$lib/components/config/SecretUnaVez.svelte';
	import CampoTelefono from '$lib/components/organizaciones/CampoTelefono.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import type { Rol, UsuarioDeOrganizacion } from '$lib/usuarios/tipos';

	let {
		open = $bindable(false),
		roles,
		editando = null,
		alGuardar
	}: {
		open?: boolean;
		roles: Rol[];
		/** El usuario que se está editando, o `null` para dar de alta. */
		editando?: UsuarioDeOrganizacion | null;
		alGuardar: () => Promise<void> | void;
	} = $props();

	let nombre = $state('');
	let email = $state('');
	let telefono = $state('');
	let rol = $state('');
	let enviando = $state(false);
	let errorEmail = $state('');
	let errorGeneral = $state('');
	let creada = $state<{ usuario: { nombre: string; email: string }; contrasenaTemporal: string } | null>(null);

	const esEdicion = $derived(editando !== null);
	const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
	const completo = $derived(nombre.trim().length > 0 && (esEdicion || RE_CORREO.test(email.trim())) && rol !== '');

	/** Al abrir, el panel se llena con lo que haya (editar) o se vacía (crear). */
	$effect(() => {
		if (!open) return;
		creada = null;
		errorEmail = errorGeneral = '';
		nombre = editando?.nombre ?? '';
		email = editando?.email ?? '';
		telefono = (editando?.telefono ?? '').replace(/^\+52\s*/, '');
		rol = editando?.rol ?? '';
	});

	async function guardar() {
		if (!completo || enviando) return;
		enviando = true;
		errorEmail = errorGeneral = '';
		try {
			const cuerpo = {
				nombre: nombre.trim(),
				apellidos: '',
				telefono: telefono.trim() ? `+52 ${telefono.trim()}` : null,
				rol,
				...(esEdicion ? {} : { email: email.trim() })
			};
			const r = await fetch(esEdicion ? `/api/usuarios/${editando!.guid}` : '/api/usuarios', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(cuerpo)
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				if (datos?.codigo === 'correo_registrado') errorEmail = datos.mensaje;
				else errorGeneral = datos?.mensaje ?? 'No se pudo guardar. Intenta de nuevo.';
				return;
			}
			await alGuardar();
			if (esEdicion) open = false;
			else creada = datos;
		} finally {
			enviando = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-usuario"
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[46%] data-[side=right]:xl:w-[40%]"
	>
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				{esEdicion ? 'Edición de usuario' : 'Nuevo registro'}
			</Sheet.Title>
			<button
				type="button"
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
				data-testid="cerrar-usuario"
				onclick={() => (open = false)}
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</button>
		</div>

		{#if creada}
			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
				<div>
					<h2 class="text-lg font-medium text-foreground" data-testid="usuario-creado">
						{creada.usuario.nombre} ya tiene acceso
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Entrega estos accesos a <span class="font-medium text-foreground">{creada.usuario.email}</span>.
						La contraseña temporal se muestra una sola vez y se le pedirá cambiarla al entrar.
					</p>
				</div>
				<SecretUnaVez secret={creada.contrasenaTemporal} testid="contrasena-temporal-usuario" />
			</div>
			<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
				<Button data-testid="listo-usuario" onclick={() => (open = false)}>Listo</Button>
			</div>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
				<div class="flex items-center gap-3">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
						{#if esEdicion}<UserPen class="size-5" />{:else}<UserPlus class="size-5" />{/if}
					</span>
					<div>
						<h2 class="text-lg font-medium text-foreground">
							{esEdicion ? 'Actualiza la información del usuario' : 'Agrega una nuevo usuario'}
						</h2>
						<p class="text-sm text-muted-foreground">
							{esEdicion
								? 'Realiza cambios en la información y permisos del usuario para mantener una administración segura y centralizada.'
								: 'Completa la información requerida.'}
						</p>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="flex flex-col gap-1.5">
						<label for="usuario-nombre" class="text-sm font-medium text-foreground">
							Nombre completo <span class="text-destructive">*</span>
						</label>
						<input
							id="usuario-nombre"
							placeholder="Ingresa el nombre completo"
							bind:value={nombre}
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>
					<div class="flex flex-col gap-1.5">
						<label for="usuario-email" class="text-sm font-medium text-foreground">
							Correo electrónico <span class="text-destructive">*</span>
						</label>
						<input
							id="usuario-email"
							type="email"
							placeholder="Ingresa correo electrónico"
							bind:value={email}
							disabled={esEdicion}
							oninput={() => (errorEmail = '')}
							aria-invalid={errorEmail ? 'true' : undefined}
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
						/>
						{#if errorEmail}
							<p class="flex items-start gap-1 text-xs text-destructive" data-testid="error-correo-usuario">
								<TriangleAlert class="mt-0.5 size-3 shrink-0" />
								{errorEmail}
							</p>
						{:else if esEdicion}
							<p class="text-xs text-muted-foreground">El correo no se puede cambiar: es con el que inicia sesión.</p>
						{/if}
					</div>
				</div>

				<div class="flex max-w-[50%] flex-col gap-1.5">
					<label for="usuario-tel" class="text-sm font-medium text-foreground">Teléfono celular</label>
					<CampoTelefono id="usuario-tel" bind:value={telefono} />
				</div>

				<div class="border-t border-border"></div>

				<fieldset class="flex flex-col gap-3">
					<legend class="text-sm font-medium text-foreground">Asignación de roles y permisos</legend>
					<p class="text-xs text-muted-foreground">
						Define y gestiona los roles y permisos de los usuarios para controlar su nivel de acceso y las
						acciones que pueden realizar dentro de la plataforma.
					</p>
					<div class="divide-y divide-border rounded-lg border border-border" data-testid="roles">
						{#each roles as opcion (opcion.codigo)}
							<label
								class="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-muted/50"
								data-testid="rol-{opcion.codigo}"
							>
								<input
									type="radio"
									name="rol"
									value={opcion.codigo}
									bind:group={rol}
									class="mt-0.5 size-4 shrink-0 accent-primary"
								/>
								<span class="min-w-0 flex-1">
									<span class="block text-sm font-medium text-foreground">{opcion.nombre}</span>
									<span class="block text-xs text-muted-foreground">{opcion.descripcion}</span>
								</span>
							</label>
						{/each}
					</div>
				</fieldset>

				{#if errorGeneral}
					<p class="text-xs text-destructive" data-testid="error-general-usuario">{errorGeneral}</p>
				{/if}
			</div>

			<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
				<Button
					variant="link"
					class="h-auto p-0 text-destructive"
					data-testid="cancelar-usuario"
					onclick={() => (open = false)}
				>
					Cancelar registro
				</Button>
				<Button data-testid="guardar-usuario" disabled={!completo || enviando} onclick={guardar}>
					{enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear nuevo usuario'}
				</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
