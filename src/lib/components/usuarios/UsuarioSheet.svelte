<script lang="ts">
	/**
	 * HU06 · "Agrega una nuevo usuario" (el título es del diseño, con su falta
	 * de concordancia). Editar a alguien (HU07) ya NO pasa por aquí: el diseño lo
	 * abre en la propia fila de la tabla (`EdicionUsuarioFila.svelte`).
	 *
	 * Los roles son tarjetas con radio y su descripción, como el diseño. Al
	 * crear, "Crear nuevo usuario" se enciende con nombre, correo válido y un
	 * rol elegido.
	 *
	 * Al crear, el servidor le manda su bienvenida por correo y esta pantalla lo dice.
	 * Solo si el correo NO salió se muestra la contraseña temporal UNA vez, con el
	 * mismo componente que las API Keys.
	 */
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import UserPlus from '@lucide/svelte/icons/user-plus';

	import { LARGO_MAXIMO_CORREO, validarCorreo } from '$lib/acceso/correo';
	import AvisoRojo from '$lib/components/config/AvisoRojo.svelte';
	import SecretUnaVez from '$lib/components/config/SecretUnaVez.svelte';
	import CampoTelefono from '$lib/components/organizaciones/CampoTelefono.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import type { Rol } from '$lib/usuarios/tipos';

	let {
		open = $bindable(false),
		roles,
		alGuardar,
		alEnviarAccesos
	}: {
		open?: boolean;
		roles: Rol[];
		alGuardar: () => Promise<void> | void;
		/** Se llama cuando el alta salió bien Y el correo con los accesos también. En ese caso el panel se cierra solo:
		 *  el aviso de "Enviamos sus accesos por correo" lo pinta la PÁGINA, suelto, como los demás avisos verdes, y no
		 *  dentro de este panel. Si el correo NO salió, el panel se queda abierto: ahí la contraseña temporal se muestra
		 *  una sola vez y cerrarlo la perdería. */
		alEnviarAccesos: (usuario: { nombre: string; email: string }) => void;
	} = $props();

	let nombre = $state('');
	let paterno = $state('');
	let materno = $state('');
	let email = $state('');
	let telefono = $state('');
	let rol = $state('');
	let enviando = $state(false);
	let errorEmail = $state('');
	let errorGeneral = $state('');
	/** Lo que contestó el alta. Si el correo SALIÓ (`correoEnviado`), la contraseña temporal no viene: la persona la
	 *  tiene en su bandeja. Si no (`correoMotivo`: `sin_canal` en un ambiente que no manda correo, `fallo` si el
	 *  servicio no pudo), viene aquí y se muestra una sola vez, como siempre. */
	let creada = $state<{
		usuario: { nombre: string; email: string };
		correoEnviado?: boolean;
		correoMotivo?: string | null;
		contrasenaTemporal?: string;
	} | null>(null);

	const correo = $derived(validarCorreo(email));
	/** El rol NO apaga el botón: sin rol, al pulsar se dice por qué no se crea (HU06, CA-4: "el sistema informa el
	 *  error correspondiente y no permite completar el registro"). Un botón apagado sin explicación no informa nada. */
	const completo = $derived(nombre.trim().length > 0 && paterno.trim().length > 0 && correo.ok);
	let sinRol = $state(false);
	const mensajeRol = $derived(sinRol && rol === '' ? 'Selecciona un rol para el usuario: define a qué puede acceder.' : '');

	/** El aviso de formato NO sale mientras se teclea —pintar de rojo un "a@" a
	 *  medio escribir es ruido—, sino al salir del campo. */
	let correoTocado = $state(false);
	const mensajeCorreo = $derived(errorEmail !== '' ? errorEmail : correoTocado && !correo.ok ? correo.motivo : '');

	/** Al abrir, el panel se vacía. */
	$effect(() => {
		if (!open) return;
		creada = null;
		errorEmail = errorGeneral = '';
		correoTocado = sinRol = false;
		nombre = paterno = materno = email = telefono = rol = '';
	});

	async function guardar() {
		if (!completo || enviando) return;
		if (rol === '') {
			sinRol = true;
			return;
		}
		enviando = true;
		errorEmail = errorGeneral = '';
		try {
			const cuerpo = {
				nombre: nombre.trim(),
				apellidoPaterno: paterno.trim(),
				apellidoMaterno: materno.trim(),
				telefono: telefono.trim() ? `+52 ${telefono.trim()}` : null,
				rol,
				email: email.trim()
			};
			const r = await fetch('/api/usuarios', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(cuerpo)
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				// `correo_invalido` es el formato visto por el servidor: va bajo el
				// campo, no en la línea de abajo, que queda lejos y no lo señala.
				if (datos?.codigo === 'correo_registrado' || datos?.codigo === 'correo_invalido')
					errorEmail = datos.mensaje;
				else errorGeneral = datos?.mensaje ?? 'No se pudo guardar. Intenta de nuevo.';
				return;
			}
			await alGuardar();
			if (datos.correoEnviado) {
				open = false;
				alEnviarAccesos(datos.usuario);
				return;
			}
			creada = datos;
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
				Nuevo registro
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
				<!-- Aquí solo se llega si el correo NO salió (si salió, el panel se cierra y la página avisa; ver
				     `alEnviarAccesos`), así que lo que hay que hacer es entregar la contraseña a mano. -->
				{#if creada.correoMotivo === 'fallo'}
					<AvisoRojo testid="correo-no-enviado-usuario" titulo="No pudimos enviar el correo">
						Entrégale tú estos accesos: la contraseña no se vuelve a mostrar.
					</AvisoRojo>
				{/if}
				{#if creada.contrasenaTemporal}
					<SecretUnaVez secret={creada.contrasenaTemporal} testid="contrasena-temporal-usuario" />
				{/if}
			</div>
			<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
				<Button data-testid="listo-usuario" onclick={() => (open = false)}>Listo</Button>
			</div>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
				<div class="flex items-center gap-3">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
						<UserPlus class="size-5" />
					</span>
					<div>
						<h2 class="text-lg font-medium text-foreground">
							Agrega una nuevo usuario
						</h2>
						<p class="text-sm text-muted-foreground">Completa la información requerida.</p>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div class="flex flex-col gap-1.5">
						<label for="usuario-nombre" class="text-sm font-medium text-foreground">
							Nombre(s) <span class="text-destructive">*</span>
						</label>
						<input
							id="usuario-nombre"
							placeholder="Ingresa el nombre"
							bind:value={nombre}
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>
					<div class="flex flex-col gap-1.5">
						<label for="usuario-paterno" class="text-sm font-medium text-foreground">
							Apellido paterno <span class="text-destructive">*</span>
						</label>
						<input
							id="usuario-paterno"
							placeholder="Ingresa el apellido paterno"
							bind:value={paterno}
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>
					<div class="flex flex-col gap-1.5">
						<label for="usuario-materno" class="text-sm font-medium text-foreground">Apellido materno</label>
						<input
							id="usuario-materno"
							placeholder="Ingresa el apellido materno"
							bind:value={materno}
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>
				</div>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="flex flex-col gap-1.5">
						<label for="usuario-email" class="text-sm font-medium text-foreground">
							Correo electrónico <span class="text-destructive">*</span>
						</label>
						<input
							id="usuario-email"
							type="email"
							placeholder="Ingresa correo electrónico"
							bind:value={email}
							maxlength={LARGO_MAXIMO_CORREO}
							oninput={() => (errorEmail = '')}
							onblur={() => (correoTocado = true)}
							aria-invalid={mensajeCorreo ? 'true' : undefined}
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
						/>
						{#if mensajeCorreo}
							<p class="flex items-start gap-1 text-xs text-destructive" data-testid="error-correo-usuario">
								<TriangleAlert class="mt-0.5 size-3 shrink-0" />
								{mensajeCorreo}
							</p>
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
					<div
						class="divide-y divide-border rounded-lg border {mensajeRol ? 'border-destructive' : 'border-border'}"
						data-testid="roles"
						aria-invalid={mensajeRol ? 'true' : undefined}
					>
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
					{#if mensajeRol}
						<p class="flex items-start gap-1 text-xs text-destructive" data-testid="error-rol-usuario">
							<TriangleAlert class="mt-0.5 size-3 shrink-0" />
							{mensajeRol}
						</p>
					{/if}
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
					{enviando ? 'Guardando…' : 'Crear nuevo usuario'}
				</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
