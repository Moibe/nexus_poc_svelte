<script lang="ts">
	import { tick } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { Button } from '$lib/components/ui/button/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import Crop from '@lucide/svelte/icons/crop';

	let {
		abierto = false,
		onCerrar
	}: {
		abierto?: boolean;
		onCerrar: () => void;
	} = $props();

	// Reinicia TODO al cerrar — reabrir debe empezar siempre desde el dropzone,
	// nunca con el documento de la vez anterior todavía puesto.
	function cerrar() {
		limpiarArchivo();
		onCerrar();
	}

	// ── Selección de archivo (mismo patrón que CargaDocumentalPanel) ───────────
	let fileInput = $state<HTMLInputElement>();
	let files = $state<FileList | null>(null);
	let arrastrando = $state(false);
	let archivo = $state<File | null>(null);
	let urlImagen = $state<string | null>(null);
	let esPdf = $state(false);
	let cargandoPdf = $state(false);
	let errorCarga = $state('');

	$effect(() => {
		if (files && files.length > 0) {
			cargarArchivo(files[0]);
			files = null;
			// Igual que en CargaDocumentalPanel: sin esto, elegir el MISMO archivo
			// dos veces seguidas no dispara `change` la segunda vez.
			if (fileInput) fileInput.value = '';
		}
	});

	function limpiarArchivo() {
		if (urlImagen) URL.revokeObjectURL(urlImagen);
		archivo = null;
		urlImagen = null;
		esPdf = false;
		errorCarga = '';
		zoom = 1;
		modoRecorte = false;
		recorte = null;
	}

	async function cargarArchivo(f: File) {
		limpiarArchivo();
		archivo = f;
		esPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
		if (esPdf) {
			await renderizarPdf(f);
		} else {
			urlImagen = URL.createObjectURL(f);
		}
	}

	function manejarDrop(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		const soltado = evento.dataTransfer?.files?.[0];
		if (soltado) cargarArchivo(soltado);
	}

	// ── Render de PDF (página 1) ────────────────────────────────────────────
	// pdfjs-dist se importa DINÁMICO: es una librería pesada que la mayoría de
	// las aperturas de este modal (las que suben una imagen) no necesita nunca.
	//
	// OJO con la versión mayor en package.json: pdfjs-dist@6 exige Node >=22,
	// y el server de CSI corre Node 20.19.5 — medido en carne propia, el primer
	// deploy con pdfjs-dist@6 murió en `npm ci` con EBADENGINE y dejó el front
	// en el build viejo, en silencio (el webhook responde 200 igual, haya
	// fallado el build o no — hay que verificar el bundle servido, no solo el
	// código de respuesta del hook). Se fijó en pdfjs-dist@4, que solo pide
	// Node >=20 y no lleva la CVE de ejecución de JS arbitraria que sí tiene
	// pdfjs-dist@5.6.83–6.2.107 (GHSA-hq66-cqwq-w95j) — relevante aquí porque
	// este modal renderiza justo el tipo de archivo que esa CVE explota. NO
	// subir de mayor sin antes confirmar la versión de Node del server.
	let canvasEl = $state<HTMLCanvasElement>();

	async function renderizarPdf(f: File) {
		cargandoPdf = true;
		try {
			const pdfjsLib = await import('pdfjs-dist');
			// Vite empaqueta el worker como asset aparte y resuelve su URL real en
			// build — es el patrón recomendado por pdfjs-dist para bundlers ESM.
			pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
				'pdfjs-dist/build/pdf.worker.min.mjs',
				import.meta.url
			).href;
			const buffer = await f.arrayBuffer();
			const documento = await pdfjsLib.getDocument({ data: buffer }).promise;
			const pagina = await documento.getPage(1);
			const viewport = pagina.getViewport({ scale: 1.75 });
			await tick(); // el <canvas> nace con el {#if esPdf}; hay que esperar a que exista
			const canvas = canvasEl;
			const ctx = canvas?.getContext('2d');
			if (!canvas || !ctx) return;
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			await pagina.render({ canvasContext: ctx, viewport }).promise;
		} catch {
			errorCarga = 'No se pudo mostrar este PDF. Intenta con otro archivo.';
			esPdf = false;
		} finally {
			cargandoPdf = false;
		}
	}

	// ── Zoom ─────────────────────────────────────────────────────────────────
	let zoom = $state(1);
	const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

	// ── Recorte: dibujar / mover / redimensionar un rectángulo ──────────────
	// Todo en PORCENTAJE del contenedor, no en píxeles: así el rectángulo se
	// mantiene correcto sin importar el zoom. No pasa nada al soltar —ni OCR,
	// ni asociarlo a un campo— eso y el menú que lo acompañará quedan para
	// cuando se platique esa parte.
	type Recorte = { x: number; y: number; w: number; h: number };
	let modoRecorte = $state(false);
	let recorte = $state<Recorte | null>(null);
	let contenedorEl = $state<HTMLDivElement>();
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
			data-testid="modal-ejemplo-documental"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[88vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<div class="min-w-0 flex-1">
					<DialogPrimitive.Title class="truncate text-sm font-medium text-foreground">
						{archivo?.name ?? 'Cargar ejemplo documental'}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="mt-1 text-xs text-muted-foreground">
						Utiliza la herramienta de recorte para seleccionar en el documento la información que
						se necesita extraer y leer. El texto reconocido por OCR se mostrará automáticamente
						para su revisión.
					</DialogPrimitive.Description>
				</div>
				<DialogPrimitive.Close aria-label="Cerrar" onclick={cerrar}>
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
				{#if !archivo}
					<!-- Mismo lenguaje visual que "Carga documental" del home, con el
					     alcance recortado a lo que aquí aplica: un solo archivo, y solo
					     los tipos que se pueden RENDERIZAR para recortar sobre ellos
					     (PDF e imagen — un DOCX/XLSX no tiene una página que mostrar). -->
					<button
						type="button"
						class={[
							'flex h-64 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors',
							arrastrando ? 'border-primary bg-muted' : 'border-border bg-background'
						]}
						onclick={() => fileInput?.click()}
						ondragover={(e) => {
							e.preventDefault();
							arrastrando = true;
						}}
						ondragleave={() => (arrastrando = false)}
						ondrop={manejarDrop}
					>
						<span class="flex size-8 items-center justify-center rounded-lg border border-border bg-card">
							<FolderLibraryIcon />
						</span>
						<div class="flex flex-col items-center gap-0.5 text-center">
							<p class="text-sm font-medium text-foreground">
								Arrastra y suelta tu documento de ejemplo aquí o selecciona un archivo
							</p>
							<p class="text-xs text-muted-foreground">PDF, JPG, JPEG, PNG | Max 20 MB</p>
						</div>
						<input
							bind:this={fileInput}
							bind:files
							type="file"
							class="hidden"
							accept=".pdf,.jpg,.jpeg,.png"
						/>
						<span class="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-secondary-foreground">
							Buscar archivo
						</span>
					</button>
					{#if errorCarga}
						<p class="mt-3 text-center text-xs text-destructive">{errorCarga}</p>
					{/if}
				{:else}
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
							{#if esPdf}
								<canvas bind:this={canvasEl} class="block max-w-full"></canvas>
							{:else if urlImagen}
								<img src={urlImagen} alt="Documento de ejemplo" class="block max-w-full select-none" draggable="false" />
							{/if}

							{#if cargandoPdf}
								<div class="absolute inset-0 flex items-center justify-center bg-white/70">
									<p class="text-sm text-muted-foreground">Cargando documento…</p>
								</div>
							{/if}

							{#if recorte}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="absolute border-2 border-primary bg-primary/10"
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

					<!-- Barra flotante: mismo lugar y forma que la captura compartida.
					     Sin frame de Figma. -->
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
						{/if}
					</div>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
