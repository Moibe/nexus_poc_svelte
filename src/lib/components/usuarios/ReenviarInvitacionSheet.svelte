<script lang="ts">
	/**
	 * "Reenviar invitación" (HU06, CA-6): a quien sigue sin hacer su primer
	 * acceso —o dejó caducar el de las 48 horas— se le genera una contraseña
	 * temporal NUEVA y se le manda otra vez la bienvenida. La anterior deja de
	 * servir, y eso cambia algo que otra persona puede estar usando, así que se
	 * pide confirmar antes (un modal propio, nunca el `confirm()` del navegador).
	 *
	 * El resultado se dice en este mismo panel y con las mismas piezas que el
	 * alta (`UsuarioSheet`): si el correo salió, la contraseña no vuelve a
	 * mostrarse; si no salió, se muestra UNA vez para entregarla a mano.
	 *
	 * Lo abre el administrador de una organización (desde Usuarios) o el de
	 * plataforma (desde Organizaciones, con `organizacion`): en ese segundo caso
	 * la ruta cuelga de la organización, como la de cerrar sesión.
	 */
	import MailPlus from '@lucide/svelte/icons/mail-plus';

	import AvisoRojo from '$lib/components/config/AvisoRojo.svelte';
	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import SecretUnaVez from '$lib/components/config/SecretUnaVez.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import type { UsuarioDeOrganizacion } from '$lib/usuarios/tipos';

	let {
		open = $bindable(false),
		usuario,
		organizacion = null,
		alTerminar
	}: {
		open?: boolean;
		usuario: UsuarioDeOrganizacion | null;
		/** El guid de la organización del usuario, cuando quien actúa es el administrador de plataforma. */
		organizacion?: string | null;
		alTerminar: () => Promise<void> | void;
	} = $props();

	let enviando = $state(false);
	let error = $state('');
	/** Lo que contestó el servidor: `correoEnviado` y, solo si el correo no salió, `contrasenaTemporal`. */
	let hecho = $state<{
		correoEnviado?: boolean;
		correoMotivo?: string | null;
		contrasenaTemporal?: string;
	} | null>(null);
	/** A quién se le reenvió: el panel sigue mostrándolo aunque la lista se recargue por debajo. */
	let destino = $state<{ nombre: string; email: string } | null>(null);

	$effect(() => {
		if (!open) return;
		error = '';
		hecho = null;
		destino = usuario ? { nombre: usuario.nombre, email: usuario.email } : null;
	});

	async function confirmar() {
		if (enviando || !usuario) return;
		enviando = true;
		error = '';
		try {
			const ruta = organizacion
				? `/api/organizaciones/${organizacion}/usuarios/${usuario.guid}/reenviar-invitacion`
				: `/api/usuarios/${usuario.guid}/reenviar-invitacion`;
			const r = await fetch(ruta, { method: 'POST' });
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo reenviar la invitación. Intenta de nuevo.';
				// Si ya la había activado (o la desactivaron) mientras tanto, la lista está desactualizada.
				if (datos?.codigo === 'ya_activa' || datos?.codigo === 'desactivada') await alTerminar();
				return;
			}
			hecho = datos ?? {};
			await alTerminar();
		} finally {
			enviando = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-reenviar"
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[40%] data-[side=right]:xl:w-[34%]"
	>
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">Reenvío de invitación</Sheet.Title>
			<button
				type="button"
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
				data-testid="cerrar-reenviar"
				onclick={() => (open = false)}
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</button>
		</div>

		{#if hecho && destino}
			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
				<div>
					<h2 class="text-lg font-medium text-foreground" data-testid="reenviar-hecho">
						La invitación de {destino.nombre} se renovó
					</h2>
					{#if !hecho.correoEnviado}
						<p class="mt-1 text-sm text-muted-foreground">
							Entrega estos accesos a <span class="font-medium text-foreground">{destino.email}</span>.
							La contraseña temporal se muestra una sola vez y se le pedirá cambiarla al entrar.
						</p>
					{/if}
				</div>
				{#if hecho.correoEnviado}
					<AvisoVerde
						testid="correo-enviado-reenvio"
						titulo="Enviamos sus accesos nuevos por correo"
						cuerpo="Los mandamos a {destino.email}. La contraseña anterior ya no sirve; la nueva viaja solo por ese correo y se le pedirá cambiarla al entrar."
					/>
				{:else}
					{#if hecho.correoMotivo === 'fallo'}
						<AvisoRojo testid="correo-no-enviado-reenvio" titulo="No pudimos enviar el correo">
							Entrégale tú estos accesos: la contraseña no se vuelve a mostrar. La anterior ya no sirve.
						</AvisoRojo>
					{/if}
					{#if hecho.contrasenaTemporal}
						<SecretUnaVez secret={hecho.contrasenaTemporal} testid="contrasena-temporal-reenvio" />
					{/if}
				{/if}
			</div>
			<div class="flex items-center justify-end border-t border-border px-6 py-4">
				<Button data-testid="listo-reenviar" onclick={() => (open = false)}>Listo</Button>
			</div>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
				<div class="flex items-center gap-3">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
						<MailPlus class="size-5" />
					</span>
					<div>
						<h2 class="text-lg font-medium text-foreground">¿Reenviar la invitación?</h2>
						<p class="text-sm text-muted-foreground">Confirma antes de generar accesos nuevos.</p>
					</div>
				</div>

				{#if usuario}
					<p class="text-sm text-muted-foreground">
						Usuario: <span class="font-medium text-foreground">{usuario.nombre}</span>
						<span class="text-muted-foreground">({usuario.email})</span>
					</p>
				{/if}

				<p class="text-sm text-muted-foreground">
					Se le generará una contraseña temporal nueva y se le enviará por correo. La contraseña temporal anterior
					dejará de funcionar, y la nueva se le pedirá cambiar en su primer acceso.
				</p>

				{#if error}
					<p class="text-xs text-destructive" data-testid="error-reenviar">{error}</p>
				{/if}
			</div>

			<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
				<Button
					variant="link"
					class="h-auto p-0 text-destructive"
					data-testid="cancelar-reenviar"
					onclick={() => (open = false)}
				>
					Cancelar
				</Button>
				<Button data-testid="confirmar-reenviar" disabled={enviando} onclick={confirmar}>
					{enviando ? 'Enviando…' : 'Reenviar invitación'}
				</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
