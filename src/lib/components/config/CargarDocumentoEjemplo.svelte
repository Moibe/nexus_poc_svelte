<script lang="ts">
	import { tick } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import Save from '@lucide/svelte/icons/save';
	import { guardarDocumentoEjemploCompartido } from '$lib/state/configuracion.svelte';

	let {
		abierto = false,
		tipoId = null,
		onCerrar
	}: {
		abierto?: boolean;
		/** A qué tipo documental pertenece el documento que se está subiendo —
		 *  desde el 2026-09-04 es UN documento por tipo, compartido por todos
		 *  sus campos, no uno por campo. `null` no debería pasar en la
		 *  práctica: "Guardar" simplemente no hace nada sin él. */
		tipoId?: string | null;
		onCerrar: () => void;
	} = $props();

	// Reinicia TODO al cerrar — reabrir debe empezar siempre desde el dropzone.
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
	let guardando = $state(false);

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
		guardando = false;
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
	// Mismas notas de versión que en el resto del módulo: pdfjs-dist se importa
	// DINÁMICO, y se fija en @4 por Node del server (>=20, no >=22) y por la
	// CVE de ejecución de JS arbitraria en @5.6.83–6.2.107 (GHSA-hq66-cqwq-w95j).
	// Ver el comentario largo en RecortarEjemploCampo.svelte antes de tocar la
	// versión.
	let canvasEl = $state<HTMLCanvasElement>();

	async function renderizarPdf(f: File) {
		cargandoPdf = true;
		try {
			const pdfjsLib = await import('pdfjs-dist');
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

	// ── Zoom (solo para ver mejor el documento antes de confirmarlo) ─────────
	let zoom = $state(1);
	const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

	/** Convierte el archivo de imagen a data URL — a diferencia del PDF (que ya
	 *  se renderiza a un `<canvas>` propio), una imagen se guarda tal cual la
	 *  subieron, sin volver a codificarla. */
	function archivoADataUrl(f: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const lector = new FileReader();
			lector.onload = () => resolve(lector.result as string);
			lector.onerror = () => reject(lector.error instanceof Error ? lector.error : new Error('lectura fallida'));
			lector.readAsDataURL(f);
		});
	}

	// Cerrar el modal al guardar es la confirmación: vuelve a la lista de
	// campos de "Calibración" de la que salió, mismo criterio que el resto del
	// módulo (ver RecortarEjemploCampo.svelte).
	async function guardarDocumento() {
		if (!tipoId || !archivo || guardando) return;
		guardando = true;
		try {
			const dataUrl = esPdf ? (canvasEl?.toDataURL('image/png') ?? null) : await archivoADataUrl(archivo);
			if (!dataUrl) return;
			const guardado = guardarDocumentoEjemploCompartido(tipoId, {
				nombre: archivo.name,
				tipo: esPdf
					? 'PDF'
					: (archivo.type.split('/')[1] ?? archivo.name.split('.').pop() ?? '').toUpperCase(),
				tamanoBytes: archivo.size,
				dataUrl
			});
			if (!guardado) return;
			cerrar();
		} finally {
			guardando = false;
		}
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
			data-testid="modal-documento-ejemplo"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[88vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<div class="min-w-0 flex-1">
					<DialogPrimitive.Title class="truncate text-sm font-medium text-foreground">
						{archivo?.name ?? 'Cargar ejemplo documental'}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="mt-1 text-xs text-muted-foreground">
						Sube un documento de referencia para este tipo documental. Después podrás recortar,
						campo por campo, la información que se necesita extraer de él.
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
					     los tipos que se pueden RENDERIZAR para verlos (PDF e imagen). -->
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
						<div
							class="relative inline-block border border-border bg-white shadow-sm"
							style="transform: scale({zoom}); transform-origin: top center;"
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
						</div>
					</div>

					<!-- Barra flotante: mismo lugar y forma que el resto del módulo, sin
					     herramienta de recorte — aquí solo se confirma el documento. -->
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
							data-testid="boton-guardar-documento"
							disabled={cargandoPdf || guardando}
							class="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
							onclick={guardarDocumento}
						>
							<Save class="size-4" />
							Guardar
						</button>
					</div>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
