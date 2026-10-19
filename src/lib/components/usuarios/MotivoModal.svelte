<script lang="ts">
	/**
	 * "Registro de motivo" (Figma `561:26129` y `555:27537`): la misma ventana para
	 * desactivar a alguien (HU08) y para cerrarle la sesión (HU05). Solo cambian el
	 * encabezado, la etiqueta del campo y el botón.
	 *
	 * ES UN MODAL CENTRADO de 684 px, no un panel lateral: así lo dibujan los dos
	 * frames. Hasta el 2026-10-19 era un `Sheet` de la derecha (de ahí que el archivo
	 * se llamara `MotivoSheet`) y QA lo marcó contra el diseño. Las medidas salen de
	 * los frames, no de las capturas: tarjeta de 684 con 24 de padding, cuerpo con 16
	 * de sangría, botones de 38 de alto y 8 de aire entre bloques (con las clases de
	 * abajo suma 377 contra los 376 del diseño). Mismo molde que `FiltrosAvanzados` y
	 * `ConfirmarAccion`: `Dialog` de bits-ui en un portal, z-60 para quedar sobre un
	 * Sheet (z-50) y bajo un `ConfirmarAccion` (z-70).
	 *
	 * Cuatro diferencias deliberadas respecto de lo que había, todas porque el Figma
	 * no las trae:
	 *  - Sin la línea «Usuario: nombre (correo)». Era un agregado nuestro. Ya no se
	 *    ve de quién es la sesión que se va a cerrar, salvo por la fila que queda
	 *    desenfocada detrás; si eso preocupa, lo correcto es pedirle a diseño que el
	 *    nombre vaya en el subtítulo, no volver a meterlo por nuestra cuenta.
	 *  - Sin placeholder en el campo: el diseño lo muestra vacío.
	 *  - El asterisco del campo va del color del texto, no en rojo.
	 *  - El botón de cerrar sesión dice «Forzar cierre de sesión».
	 * El ícono es el mismo en los dos flujos (`bubble-chat-add`) y está REDIBUJADO a
	 * mano porque se agotó la cuota de Figma: ver `BubbleChatAddIcon`.
	 *
	 * El estado "hecho" (La cuenta fue desactivada / Sesión finalizada) conserva su
	 * contenido de antes: sus frames no se revisaron, solo se mudó al modal.
	 *
	 * El motivo es obligatorio: es lo que deja auditable por qué se le quitó el
	 * acceso a una persona. El servidor lo vuelve a exigir.
	 *
	 * Al terminar, la confirmación del diseño ("La cuenta fue desactivada" /
	 * "Sesión finalizada") se muestra en este mismo modal.
	 *
	 * Lo abre el administrador de una organización (desde Usuarios) o el de
	 * plataforma (desde Organizaciones, con `organizacion`): en ese segundo caso
	 * "Cerrar sesión" va por la ruta que cuelga de la organización.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import LogOut from '@lucide/svelte/icons/log-out';

	import BubbleChatAddIcon from '$lib/components/icons/BubbleChatAddIcon.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { UsuarioDeOrganizacion } from '$lib/usuarios/tipos';

	let {
		open = $bindable(false),
		accion,
		usuario,
		organizacion = null,
		alTerminar
	}: {
		open?: boolean;
		accion: 'desactivar' | 'cerrar-sesion';
		usuario: UsuarioDeOrganizacion | null;
		/** El guid de la organización del usuario, cuando quien actúa es el
		 *  administrador de plataforma. Solo aplica a `cerrar-sesion`: desactivar
		 *  sigue siendo del administrador de la organización. */
		organizacion?: string | null;
		alTerminar: () => Promise<void> | void;
	} = $props();

	const TEXTOS = {
		desactivar: {
			titulo: 'Agrega un motivo por desactivación',
			etiqueta: 'Motivo de desactivación',
			boton: 'Desactivar usuario',
			hechoTitulo: 'La cuenta fue desactivada',
			hechoCuerpo:
				'Las sesiones activas fueron cerradas y el acceso a la plataforma ha sido restringido. Las tareas asignadas al usuario serán retomados por proceso HITL.'
		},
		'cerrar-sesion': {
			titulo: 'Agrega un motivo por cierre de sesión',
			etiqueta: 'Motivo de cierre de sesión',
			// Antes decía «Cerrar sesión». El frame 555:27537 dice «Forzar cierre de sesión».
			boton: 'Forzar cierre de sesión',
			hechoTitulo: 'Sesión finalizada',
			// Es el literal del diseño. Del 2026-10-12 al 2026-10-13 dijo otra cosa
			// ("...no podrá renovarlas... algunas pantallas pueden seguir funcionando
			// hasta 15 minutos más") porque no era del todo cierto: lo que decide solo
			// el front aceptaba el JWT hasta que venciera. La 2ª etapa de HU05 (el
			// guard le pregunta al back si la sesión sigue viva) lo volvió cierto.
			hechoCuerpo: 'El usuario deberá iniciar sesión nuevamente para acceder a la plataforma.'
		}
	} as const;

	let motivo = $state('');
	let enviando = $state(false);
	let error = $state('');
	let hecho = $state(false);
	/** Cuántas sesiones cerró el servidor (solo en `cerrar-sesion`). 0 = la persona no tenía ninguna abierta. */
	let cerradas = $state<number | null>(null);

	const textos = $derived(TEXTOS[accion]);

	$effect(() => {
		if (!open) return;
		motivo = '';
		error = '';
		hecho = false;
		cerradas = null;
	});

	async function confirmar() {
		if (!motivo.trim() || enviando || !usuario) return;
		enviando = true;
		error = '';
		try {
			const ruta =
				accion === 'desactivar'
					? `/api/usuarios/${usuario.guid}/estado`
					: organizacion
						? `/api/organizaciones/${organizacion}/usuarios/${usuario.guid}/cerrar-sesion`
						: `/api/usuarios/${usuario.guid}/cerrar-sesion`;
			const cuerpo = accion === 'desactivar' ? { activo: false, motivo: motivo.trim() } : { motivo: motivo.trim() };
			const r = await fetch(ruta, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(cuerpo)
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo completar la acción. Intenta de nuevo.';
				return;
			}
			cerradas = accion === 'cerrar-sesion' && typeof datos?.cerradas === 'number' ? datos.cerradas : null;
			hecho = true;
			await alTerminar();
		} finally {
			enviando = false;
		}
	}
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10"
		/>
		<DialogPrimitive.Content
			data-testid="modal-motivo"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg"
		>
			<!-- header . navigation: la línea de abajo llega de lado a lado de la tarjeta
			     (menos su padding), no de borde a borde, como en el frame. -->
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="flex-1 text-sm text-muted-foreground">Registro de motivo</p>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
					data-testid="cerrar-motivo"
					onclick={() => (open = false)}
				>
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</button>
			</div>

			{#if hecho}
				<div class="flex flex-col items-center gap-4 px-8 py-8 text-center">
					<span class="flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
						{#if accion === 'desactivar'}<TriangleAlert class="size-7" />{:else}<LogOut class="size-7" />{/if}
					</span>
					<DialogPrimitive.Title class="text-xl font-semibold text-foreground" data-testid="motivo-hecho">
						{textos.hechoTitulo}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="max-w-sm text-sm text-muted-foreground">
						{textos.hechoCuerpo}
					</DialogPrimitive.Description>
					{#if cerradas === 0}
						<!-- No está en el diseño. El cierre se registra aunque no hubiera nada que cerrar: el administrador
						     lo pidió, y la lista puede ir unos segundos atrasada respecto de lo que la persona hizo. -->
						<p class="max-w-sm text-xs text-muted-foreground" data-testid="motivo-sin-sesiones">
							No tenía ninguna sesión abierta en este momento; el cierre quedó registrado.
						</p>
					{/if}
				</div>
				<div class="flex items-center justify-end border-t border-border p-2.5">
					<Button class="h-9.5 px-4" data-testid="listo-motivo" onclick={() => (open = false)}>Listo</Button>
				</div>
			{:else}
				<!-- header.modal -->
				<div class="flex h-16 shrink-0 items-center gap-3">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
						<BubbleChatAddIcon class="size-4" />
					</span>
					<div class="min-w-0">
						<!-- `leading-relaxed` (1.625): los textos del frame tienen interlineado de 1.6, y con el
						     de Tailwind el subtítulo quedaba ~3 px más pegado al título. -->
						<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">
							{textos.titulo}
						</DialogPrimitive.Title>
						<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
							Completa la información requerida.
						</DialogPrimitive.Description>
					</div>
				</div>

				<!-- body.modal: 16 de sangría a cada lado, y la etiqueta en 16 px (text-base), más grande que el
				     texto de apoyo de arriba, como en el frame. -->
				<div class="flex flex-col gap-2 px-4 py-4">
					<label for="motivo" class="text-base font-medium text-foreground">{textos.etiqueta} *</label>
					<textarea
						id="motivo"
						rows="3"
						bind:value={motivo}
						class="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					></textarea>
					{#if error}
						<p class="text-xs text-destructive" data-testid="error-motivo">{error}</p>
					{/if}
				</div>

				<!-- footer.modal: la línea de arriba y 10 de padding alrededor; entre los dos botones, 16. «Cancelar
				     registro» es un botón de 152 de ancho (su texto más 16 por lado), no un enlace pelón. -->
				<div class="flex items-center justify-end gap-4 border-t border-border p-2.5">
					<Button
						variant="link"
						class="h-9.5 px-4 text-destructive"
						data-testid="cancelar-motivo"
						onclick={() => (open = false)}
					>
						Cancelar registro
					</Button>
					<Button
						class="h-9.5 px-4"
						data-testid="confirmar-motivo"
						disabled={!motivo.trim() || enviando}
						onclick={confirmar}
					>
						{enviando ? 'Procesando…' : textos.boton}
					</Button>
				</div>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
