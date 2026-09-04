<script lang="ts">
	import { untrack } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import Crop from '@lucide/svelte/icons/crop';
	import Save from '@lucide/svelte/icons/save';
	import {
		guardarRecorteEjemplo,
		type Recorte,
		type DocumentoEjemploInstancia
	} from '$lib/state/configuracion.svelte';

	let {
		abierto = false,
		tipoId = null,
		campoNombre = null,
		documento = null,
		recorteExistente = null,
		onCerrar
	}: {
		abierto?: boolean;
		/** A qué tipo documental y campo pertenece el recorte que "Guardar" va a
		 *  persistir. El campo se identifica por NOMBRE, no por id (ver
		 *  `guardarRecorteEjemplo`: el id de un campo no sobrevive un refresh). */
		tipoId?: string | null;
		campoNombre?: string | null;
		/** La instancia de documento YA SUBIDA sobre la que se recorta — un tipo
		 *  documental puede tener varias (2026-09-04); esta es la que esté
		 *  SELECCIONADA en Calibración en ese momento (`ConfigSheet.svelte`
		 *  decide cuál). Este modal ya no sube nada, solo recorta sobre lo que
		 *  traiga. `null` no debería pasar en la práctica: el botón que abre
		 *  este modal viene deshabilitado sin ninguna instancia seleccionada. */
		documento?: DocumentoEjemploInstancia | null;
		/** El recorte YA GUARDADO para este (documento, campo), si "Editar" es
		 *  lo que abrió el modal (`null` cuando es la primera vez que se
		 *  recorta esa combinación). Se usa solo para PRECARGAR el rectángulo
		 *  al entrar — no para nada más. */
		recorteExistente?: Recorte | null;
		onCerrar: () => void;
	} = $props();

	// Al cerrar, se limpia todo — lo que se muestre la PRÓXIMA vez que se abra
	// lo decide el efecto de más abajo (en blanco si es la primera vez que se
	// recorta el campo, o con el rectángulo ya guardado si es "Editar").
	// `modoRecorte` se reinicia a `true`, no a `false` (cambio pedido): la
	// herramienta de recorte debe estar YA ACTIVA la próxima vez que se entre
	// a esta pantalla, para poder dibujar el rectángulo directo sobre el
	// documento sin picar antes "Recortar".
	function cerrar() {
		modoRecorte = true;
		recorte = null;
		zoom = 1;
		onCerrar();
	}

	// ── Zoom ─────────────────────────────────────────────────────────────────
	let zoom = $state(1);
	const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

	// ── Recorte: dibujar / mover / redimensionar un rectángulo ──────────────
	// Todo en PORCENTAJE del contenedor, no en píxeles: así el rectángulo se
	// mantiene correcto sin importar el zoom.
	// Arranca en `true` (cambio pedido): al entrar a recortar un campo, la
	// herramienta ya está lista para dibujar con el primer clic, sin tener
	// que activar "Recortar" a mano cada vez.
	let modoRecorte = $state(true);
	let recorte = $state<Recorte | null>(null);

	// Precarga el rectángulo ya guardado al ABRIR — "Editar" (2026-09-04)
	// debe mostrar lo que había, no arrancar en blanco. Se dispara solo en la
	// transición false→true de `abierto` (por eso el `untrack` alrededor de
	// `recorteExistente`): si dependiera también de `recorteExistente`, un
	// recálculo de esa prop mientras el modal sigue abierto podría pisar un
	// rectángulo que el usuario ya esté arrastrando.
	$effect(() => {
		if (abierto) {
			untrack(() => {
				recorte = recorteExistente ? { ...recorteExistente } : null;
			});
		}
	});

	let contenedorEl = $state<HTMLDivElement>();
	// El documento compartido ya es un raster (PNG del PDF renderizado, o la
	// imagen original tal cual) — a diferencia del modal de carga, aquí ya no
	// hace falta distinguir PDF de imagen: siempre se muestra como `<img>`.
	let imgEl = $state<HTMLImageElement>();
	let arrastre: 'nuevo' | 'mover' | 'nw' | 'ne' | 'sw' | 'se' | null = null;
	let inicioPuntero = { x: 0, y: 0 };
	let recorteAlIniciar: Recorte | null = null;

	function puntoPct(e: PointerEvent) {
		const rect = contenedorEl!.getBoundingClientRect();
		return {
			x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
			y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100)
		};
	}

	function alternarRecorte() {
		modoRecorte = !modoRecorte;
		if (!modoRecorte) recorte = null;
	}
	function cancelarRecorte() {
		modoRecorte = false;
		recorte = null;
	}

	/**
	 * Recorta los píxeles REALES dentro de `r` y los devuelve como data URL
	 * PNG. Es lo que "Guardar" persiste como prueba de qué se seleccionó — a
	 * propósito NO un texto: en este punto nunca corrió ningún OCR sobre el
	 * documento, así que mostrar un "texto extraído" sería inventar un
	 * resultado que no existe.
	 *
	 * Lee de `imgEl.naturalWidth/Height` (NO el tamaño mostrado en pantalla,
	 * que puede ser menor por el `max-w-full`) para mapear el porcentaje del
	 * recorte a los píxeles reales del documento compartido.
	 */
	function generarImagenRecorte(r: Recorte): string | null {
		if (!imgEl || imgEl.naturalWidth === 0) return null;
		const anchoFuente = imgEl.naturalWidth;
		const altoFuente = imgEl.naturalHeight;
		const sx = (r.x / 100) * anchoFuente;
		const sy = (r.y / 100) * altoFuente;
		const sw = (r.w / 100) * anchoFuente;
		const sh = (r.h / 100) * altoFuente;
		const destino = document.createElement('canvas');
		destino.width = Math.max(1, Math.round(sw));
		destino.height = Math.max(1, Math.round(sh));
		const ctx = destino.getContext('2d');
		if (!ctx) return null;
		ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, destino.width, destino.height);
		return destino.toDataURL('image/png');
	}

	// Cerrar el modal al guardar es la confirmación: vuelve a la lista de
	// campos de "Calibración" de la que salió, mismo criterio que "Guardar
	// configuración" del wizard.
	function guardarCopia() {
		if (!tipoId || !documento || !campoNombre || !recorte || recorte.w === 0 || recorte.h === 0) return;
		const imagenDataUrl = generarImagenRecorte(recorte);
		if (!imagenDataUrl) return;
		const guardado = guardarRecorteEjemplo(tipoId, documento.id, campoNombre, { recorte, imagenDataUrl });
		if (!guardado) return;
		cerrar();
	}

	function iniciarEnLienzo(e: PointerEvent) {
		if (!modoRecorte) return;
		arrastre = 'nuevo';
		inicioPuntero = puntoPct(e);
		recorte = { x: inicioPuntero.x, y: inicioPuntero.y, w: 0, h: 0 };
	}
	function iniciarMover(e: PointerEvent) {
		if (!modoRecorte || !recorte) return;
		e.stopPropagation();
		arrastre = 'mover';
		inicioPuntero = puntoPct(e);
		recorteAlIniciar = { ...recorte };
	}
	function iniciarRedimensionar(esquina: 'nw' | 'ne' | 'sw' | 'se', e: PointerEvent) {
		if (!recorte) return;
		e.stopPropagation();
		arrastre = esquina;
		inicioPuntero = puntoPct(e);
		recorteAlIniciar = { ...recorte };
	}

	function moverPuntero(e: PointerEvent) {
		if (!arrastre) return;
		const p = puntoPct(e);
		if (arrastre === 'nuevo') {
			recorte = {
				x: Math.min(inicioPuntero.x, p.x),
				y: Math.min(inicioPuntero.y, p.y),
				w: Math.abs(p.x - inicioPuntero.x),
				h: Math.abs(p.y - inicioPuntero.y)
			};
			return;
		}
		if (!recorteAlIniciar) return;
		const dx = p.x - inicioPuntero.x;
		const dy = p.y - inicioPuntero.y;
		if (arrastre === 'mover') {
			recorte = {
				...recorteAlIniciar,
				x: clamp(recorteAlIniciar.x + dx, 0, 100 - recorteAlIniciar.w),
				y: clamp(recorteAlIniciar.y + dy, 0, 100 - recorteAlIniciar.h)
			};
			return;
		}
		// Esquinas: cada una mueve solo sus dos bordes propios.
		let { x, y, w, h } = recorteAlIniciar;
		if (arrastre.includes('n')) {
			y = recorteAlIniciar.y + dy;
			h = recorteAlIniciar.h - dy;
		}
		if (arrastre.includes('s')) {
			h = recorteAlIniciar.h + dy;
		}
		if (arrastre.includes('w')) {
			x = recorteAlIniciar.x + dx;
			w = recorteAlIniciar.w - dx;
		}
		if (arrastre.includes('e')) {
			w = recorteAlIniciar.w + dx;
		}
		// Si arrastraste una esquina más allá de la opuesta, el ancho/alto se
		// vuelve negativo: se normaliza en vez de dejar un rectángulo invertido.
		if (w < 0) {
			x += w;
			w = -w;
		}
		if (h < 0) {
			y += h;
			h = -h;
		}
		recorte = { x: clamp(x, 0, 100), y: clamp(y, 0, 100), w: Math.min(w, 100), h: Math.min(h, 100) };
	}
	function terminarPuntero() {
		arrastre = null;
		recorteAlIniciar = null;
	}
</script>

<DialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) cerrar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/40"
		/>
		<DialogPrimitive.Content
			data-testid="modal-recortar-ejemplo"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[88vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<div class="min-w-0 flex-1">
					<DialogPrimitive.Title class="truncate text-sm font-medium text-foreground">
						{documento?.nombre ?? 'Recortar ejemplo'}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="mt-1 text-xs text-muted-foreground">
						Utiliza la herramienta de recorte para seleccionar en el documento la información que
						se necesita extraer para "{campoNombre}".
					</DialogPrimitive.Description>
				</div>
				<DialogPrimitive.Close aria-label="Cerrar" onclick={cerrar}>
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
				{#if documento}
					<div class="flex justify-center pb-16">
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							bind:this={contenedorEl}
							class="relative inline-block touch-none border border-border bg-white shadow-sm"
							style="transform: scale({zoom}); transform-origin: top center;"
							onpointerdown={iniciarEnLienzo}
							onpointermove={moverPuntero}
							onpointerup={terminarPuntero}
							onpointercancel={terminarPuntero}
						>
							<img
								bind:this={imgEl}
								src={documento.dataUrl}
								alt="Documento de ejemplo"
								class="block max-w-full select-none"
								draggable="false"
							/>

							{#if recorte}
								<!-- El rectángulo YA DIBUJADO se puede volver a arrastrar por su
								     cuerpo para reposicionarlo (`iniciarMover`, con
								     `stopPropagation()` para no disparar `iniciarEnLienzo` del
								     contenedor y empezar uno nuevo encima). `cursor-move` es solo
								     la señal visual de que se puede agarrar — a pedido explícito,
								     porque sin ella no era obvio que ya funcionaba. -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="absolute cursor-move border-2 border-primary bg-primary/10"
									style="left:{recorte.x}%; top:{recorte.y}%; width:{recorte.w}%; height:{recorte.h}%;"
									onpointerdown={iniciarMover}
								>
									{#each ['nw', 'ne', 'sw', 'se'] as const as esquina (esquina)}
										<span
											class="absolute size-3 rounded-full border-2 border-primary bg-background {esquina.includes(
												'n'
											)
												? '-top-1.5'
												: '-bottom-1.5'} {esquina.includes('w') ? '-left-1.5' : '-right-1.5'}"
											style="cursor: {esquina}-resize;"
											onpointerdown={(e) => iniciarRedimensionar(esquina, e)}
										></span>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<!-- Barra flotante: mismo lugar y forma que el resto del módulo. -->
					<div
						class="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#0f172a] px-2 py-2 text-white shadow-lg"
					>
						<button
							type="button"
							aria-label="Alejar"
							class="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
							disabled={zoom <= 0.5}
							onclick={() => (zoom = clamp(zoom - 0.25, 0.5, 2.5))}
						>
							<ZoomOut class="size-4" />
						</button>
						<button
							type="button"
							aria-label="Acercar"
							class="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
							disabled={zoom >= 2.5}
							onclick={() => (zoom = clamp(zoom + 0.25, 0.5, 2.5))}
						>
							<ZoomIn class="size-4" />
						</button>
						<span class="mx-1 h-5 w-px bg-white/20"></span>
						<button
							type="button"
							data-testid="boton-recortar"
							aria-pressed={modoRecorte}
							class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors {modoRecorte
								? 'bg-white/15'
								: 'hover:bg-white/10'}"
							onclick={alternarRecorte}
						>
							<Crop class="size-4" />
							Recortar
						</button>
						{#if modoRecorte}
							<button
								type="button"
								class="rounded-full px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-white/10"
								onclick={cancelarRecorte}
							>
								Cancelar
							</button>
							<button
								type="button"
								data-testid="boton-guardar-recorte"
								disabled={!recorte || recorte.w === 0 || recorte.h === 0}
								class="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
								onclick={guardarCopia}
							>
								<Save class="size-4" />
								Guardar
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
