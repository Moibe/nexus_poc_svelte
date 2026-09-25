<script lang="ts">
	import { tick } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import Upload from '@lucide/svelte/icons/upload';
	import { agregarDocumentoEjemplo, TENANT_OPERADOR } from '$lib/state/configuracion.svelte';
	import { subirAlAlmacen } from '$lib/almacen/subir';

	let {
		abierto = false,
		tipoId = null,
		onGuardado,
		onCerrar
	}: {
		abierto?: boolean;
		/** A qué tipo documental pertenece el documento que se está subiendo.
		 *  Un tipo puede tener VARIAS instancias (2026-09-04): esto solo AGREGA
		 *  una más, nunca sobreescribe. `null` no debería pasar en la práctica:
		 *  "Subir" simplemente no hace nada sin él. */
		tipoId?: string | null;
		/** Se llama justo después de agregar la instancia, con su id — lo usa
		 *  `ConfigSheet.svelte` para dejarla seleccionada de inmediato en vez de
		 *  obligar a un segundo clic para elegirla. */
		onGuardado?: (idDocumento: string) => void;
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

	/**
	 * Qué carga es la VIGENTE. Cada vez que el modal se limpia —al cerrarlo, o al
	 * elegir otro archivo— sube, y con eso invalida lo que siga en vuelo de la
	 * carga anterior: un PDF que pdf.js rechaza tarde, o una subida lenta.
	 *
	 * Sin esto, lo que terminaba tarde caía sobre el archivo que el usuario
	 * eligió DESPUÉS: el fallo de un PDF ya descartado borraba la imagen nueva,
	 * y una subida que sobrevivía a cerrar el modal guardaba una entrada con el
	 * nombre del archivo nuevo y los bytes del viejo. Todo lo que continúa
	 * después de un `await` compara su número contra este antes de tocar nada.
	 */
	let cargaVigente = 0;

	function limpiarArchivo() {
		cargaVigente += 1;
		if (urlImagen) URL.revokeObjectURL(urlImagen);
		archivo = null;
		urlImagen = null;
		esPdf = false;
		cargandoPdf = false;
		errorCarga = '';
		zoom = 1;
		guardando = false;
	}

	/** Los mismos 20 MB que ya usan `bandeja.svelte.ts` y `DocumentoParaPrompts`.
	 *  Se copian en vez de exportarlos: son constantes de presentación de cada
	 *  pantalla, no API compartida — mismo criterio que el resto del módulo. */
	const MAX_MB = 20;
	const MAX_BYTES = MAX_MB * 1024 * 1024;
	const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png'];

	async function cargarArchivo(f: File) {
		// Estas dos guardias no existían, y este era el ÚNICO de los tres
		// dropzones sin ellas: el "Max 20 MB" de abajo era solo texto en
		// pantalla y el `accept` del input no filtra lo que se suelta
		// arrastrando. Nacieron cuando lo que se soltaba aquí terminaba en
		// base64 dentro de localStorage (el camino más corto para reventar la
		// cuota); desde el 2026-09-24 va al almacén, y siguen haciendo falta
		// para no subir algo que el back va a rechazar.
		const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
		if (!EXTENSIONES.includes(ext)) {
			limpiarArchivo();
			errorCarga = `Formato no admitido. Se aceptan ${EXTENSIONES.join(', ').toUpperCase()}.`;
			return;
		}
		if (f.size > MAX_BYTES) {
			limpiarArchivo();
			errorCarga = `El archivo pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el límite es ${MAX_MB} MB.`;
			return;
		}
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
		const carga = cargaVigente;
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
			// Si mientras tanto se eligió otro archivo, este canvas ya es suyo.
			if (carga !== cargaVigente) return;
			const canvas = canvasEl;
			const ctx = canvas?.getContext('2d');
			if (!canvas || !ctx) return;
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			await pagina.render({ canvasContext: ctx, viewport }).promise;
		} catch {
			// Un PDF ya descartado que falla tarde no toca el archivo de ahora.
			if (carga !== cargaVigente) return;
			// De vuelta al dropzone, donde el error SÍ se ve. Antes solo se apagaba
			// `esPdf` y el archivo quedaba puesto: la vista salía en blanco, el
			// mensaje no aparecía, y "Subir" seguía habilitado y guardaba un PDF
			// sin vista que ningún `<img>` podía pintar.
			limpiarArchivo();
			errorCarga = 'No se pudo mostrar este PDF. Intenta con otro archivo.';
		} finally {
			// Si la carga cambió, `limpiarArchivo` ya bajó el indicador y el de la
			// carga nueva le pertenece a ella.
			if (carga === cargaVigente) cargandoPdf = false;
		}
	}

	// ── Zoom (solo para ver mejor el documento antes de confirmarlo) ─────────
	let zoom = $state(1);
	const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));


	// Cerrar el modal al guardar es la confirmación: vuelve a la lista de
	// campos de "Calibración" de la que salió, mismo criterio que el resto del
	// módulo (ver RecortarEjemploCampo.svelte).

	/**
	 * Sube un archivo al almacén y devuelve su puntero, o `null` con el motivo
	 * ya puesto en `errorCarga`.
	 *
	 * El `tenant` es el prefijo de OPERADOR: un documento de ejemplo no es de
	 * ningún cliente, es de CSI configurando un tipo documental, y su procesador
	 * vive en el GCP de CSI. Ver el docstring de `servicios/almacen.py` en
	 * nexus_back, donde quedó decidido el 2026-09-24.
	 */
	async function subir(f: File | Blob, nombre: string, carga: number) {
		const r = await subirAlAlmacen(f, nombre, TENANT_OPERADOR);
		if (!r.ok) {
			// El motivo de una carga que ya no es la vigente no se pinta sobre la
			// de ahora: hablaría de un archivo que el usuario ya descartó.
			if (carga === cargaVigente) errorCarga = r.mensaje;
			return null;
		}
		return r.puntero;
	}

	async function guardarDocumento() {
		if (!tipoId || !archivo || guardando) return;
		// Todo lo que se usa después de un `await` se fija AQUÍ: el estado del
		// modal puede ser de otro archivo para cuando la subida responda.
		const carga = cargaVigente;
		const idTipo = tipoId;
		const f = archivo;
		const pdf = esPdf;
		guardando = true;
		errorCarga = '';
		try {
			// El ORIGINAL siempre. Antes solo sobrevivía el raster de la página 1 y
			// el PDF completo se perdía — y el original es lo que Document AI va a
			// querer el día que se etiqueten ejemplos.
			const original = await subir(f, f.name, carga);
			// Si se cerró el modal o se eligió otro archivo mientras subía, lo que
			// ya se subió se queda como objeto suelto en el almacén (barato, y el
			// almacén dedupica) y aquí no se toca nada más.
			if (!original || carga !== cargaVigente) return;

			// Y además la VISTA, solo si el original no se puede pintar en un
			// `<img>`. Para una imagen, el original ya es la vista.
			let vista: { rutaRelativa: string; mime: string } | null = null;
			if (pdf) {
				const png = await new Promise<Blob | null>((resolver) =>
					canvasEl ? canvasEl.toBlob(resolver, 'image/png') : resolver(null)
				);
				if (carga !== cargaVigente) return;
				if (!png) {
					errorCarga = 'No se pudo preparar la vista del PDF.';
					return;
				}
				const subida = await subir(png, `${f.name}.png`, carga);
				if (!subida || carga !== cargaVigente) return;
				vista = subida;
			}

			const idNuevo = agregarDocumentoEjemplo(idTipo, {
				nombre: f.name,
				tipo: pdf ? 'PDF' : (f.type.split('/')[1] ?? f.name.split('.').pop() ?? '').toUpperCase(),
				tamanoBytes: f.size,
				rutaRelativa: original.rutaRelativa,
				sha256: original.sha256,
				mime: original.mime,
				...(vista ? { rutaVista: vista.rutaRelativa, mimeVista: vista.mime } : {})
			});
			if (!idNuevo) return;
			onGuardado?.(idNuevo);
			cerrar();
		} finally {
			// Si la carga cambió, `limpiarArchivo` ya bajó `guardando`, y el de una
			// subida nueva que esté corriendo le pertenece a ella.
			if (carga === cargaVigente) guardando = false;
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

					<!-- El motivo de una subida fallida (almacén caído, archivo
					     rechazado). Sin esto no se veía nunca: el mensaje del
					     dropzone solo existe mientras NO hay archivo, y aquí siempre
					     lo hay — "Subir" se apagaba un instante y volvía, sin decir
					     por qué. Justo encima de la barra, que es donde está la
					     mirada después de picar "Subir". -->
					{#if errorCarga}
						<p
							role="alert"
							data-testid="error-carga-documento"
							class="absolute bottom-20 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-lg border border-destructive/30 bg-white px-3 py-2 text-center text-xs text-destructive shadow-sm"
						>
							{errorCarga}
						</p>
					{/if}

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
							class="flex items-center gap-2 rounded-full bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:pointer-events-none disabled:opacity-40"
							onclick={guardarDocumento}
						>
							<Upload class="size-4" />
							Subir
						</button>
					</div>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
