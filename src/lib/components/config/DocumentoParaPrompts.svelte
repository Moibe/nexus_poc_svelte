<script lang="ts">
	/**
	 * "Carga un documento de ejemplo" — el paso intermedio entre elegir CUÁNTOS
	 * prompts generar (`GenerarPrompts.svelte`) y la pantalla de revisión: sin
	 * un documento sobre el que probar, esa revisión no tendría qué comparar.
	 *
	 * NO es `CargarDocumentoEjemplo.svelte`, aunque el título se parezca: ese
	 * pertenece a Calibración, renderiza el documento en un canvas para poder
	 * recortarlo campo por campo, y lo persiste en `documentosEjemplo` del tipo.
	 * Este solo ELIGE un archivo y lo entrega a quien lo abrió; no persiste
	 * nada. Compartir componente entre los dos habría significado un montón de
	 * banderas para apagar la mitad del comportamiento.
	 *
	 * Sin frame de Figma en el volcado: construido desde las capturas del
	 * 2026-09-06 ("HU001 | 129" el estado vacío, "HU001 | 130" el estado con
	 * archivo, y una tercera con los tres estados de la ficha).
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';

	import { Button } from '$lib/components/ui/button/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import { formatearTamano } from '$lib/state/bandeja.svelte';

	/**
	 * Mismos formatos que el dropzone del Home, y por la misma razón: son los
	 * que Document AI puede procesar. La captura de este modal dice "PDF, DOCX,
	 * XLSX", pero DOCX/XLSX se quitaron del resto de la app el 2026-09-06
	 * justamente porque Document AI no los procesa — y este documento existe
	 * para que NexusDoc lo ANALICE, así que aceptarlos aquí sería volver a
	 * ofrecer algo que va a fallar más adelante.
	 */
	const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'tiff'];
	const MAX_MB = 20;
	const MAX_BYTES = MAX_MB * 1024 * 1024;

	// Mismos números que `bandeja.svelte.ts` usa para la barra de la Bandeja, para
	// que el progreso se sienta igual en las dos pantallas. Se copian en vez de
	// exportarlos desde allá: son dos constantes de presentación, no API.
	const DURACION_ANIMACION_MS = 900;
	const INTERVALO_TICK_MS = 60;

	let {
		abierto = false,
		onContinuar,
		onCancelar
	}: {
		abierto?: boolean;
		/** El archivo elegido, ya leído sin errores. Quien abre decide qué hacer
		 *  con él — este modal no persiste nada. */
		onContinuar: (archivo: File) => void;
		/** "Cancelar generación", la X, Escape y el clic fuera: todos abortan la
		 *  generación completa, no solo este paso. */
		onCancelar: () => void;
	} = $props();

	/**
	 * Los tres estados de la ficha, según la captura. NO son decorativos: cada
	 * uno corresponde a algo que de verdad pasa al leer el archivo.
	 *   - 'leyendo': `arrayBuffer()` en curso. Con un archivo de varios MB esto
	 *      toma tiempo real, así que la barra mide algo que sí está ocurriendo
	 *      (mismo criterio que la Bandeja del Home).
	 *   - 'error':   la lectura falló. Pasa de verdad — el archivo se movió, se
	 *      desmontó la USB, o el navegador negó el permiso; está documentado en
	 *      `procesarArchivo` de `bandeja.svelte.ts` por el mismo motivo. De ahí
	 *      que "Recargar" tenga sentido: reintentar puede funcionar.
	 *   - 'listo':   se pudo leer completo.
	 */
	type EstadoArchivo = 'leyendo' | 'error' | 'listo';

	let fileInput = $state<HTMLInputElement>();
	let files = $state<FileList | null>(null);
	let arrastrando = $state(false);
	let archivo = $state<File | null>(null);
	let estado = $state<EstadoArchivo>('listo');
	let progreso = $state(0);
	/** Error de VALIDACIÓN (formato/tamaño), que se muestra bajo el dropzone y
	 *  no llega a crear ficha. Distinto de `estado === 'error'`, que es un fallo
	 *  de LECTURA de un archivo que sí pasó la validación. */
	let errorValidacion = $state('');

	const esImagen = $derived(archivo ? !/\.pdf$/i.test(archivo.name) : false);
	const extension = $derived((archivo?.name.split('.').pop() ?? '').toUpperCase());

	/**
	 * Contador que invalida lecturas viejas. Sin esto hay una carrera real: si
	 * se quita el archivo (o se elige otro) mientras el `await arrayBuffer()`
	 * del anterior sigue vivo, al resolverse pisaría el estado y "resucitaría"
	 * una ficha que ya no debería existir.
	 */
	let lecturaId = 0;
	let intervalo: ReturnType<typeof setInterval> | null = null;

	function limpiarIntervalo() {
		if (intervalo !== null) {
			clearInterval(intervalo);
			intervalo = null;
		}
	}

	/** Quita la ficha y aborta cualquier lectura en curso. Lo usan "Eliminar",
	 *  la X del estado 'leyendo', y el reinicio al cerrar el modal. */
	function quitarArchivo() {
		lecturaId += 1;
		limpiarIntervalo();
		archivo = null;
		estado = 'listo';
		progreso = 0;
	}

	async function leer(f: File) {
		const miLectura = ++lecturaId;
		limpiarIntervalo();
		archivo = f;
		estado = 'leyendo';
		progreso = 0;

		// Tope en 90%: el 100 se reserva para cuando la lectura DE VERDAD terminó.
		// Una barra que llega al 100 y se queda ahí esperando miente sobre lo que
		// falta (mismo criterio que `animarProgresoMientrasSube` de la Bandeja).
		const inicio = Date.now();
		intervalo = setInterval(() => {
			if (miLectura !== lecturaId) {
				limpiarIntervalo();
				return;
			}
			progreso = Math.min(90, Math.round(((Date.now() - inicio) / DURACION_ANIMACION_MS) * 90));
		}, INTERVALO_TICK_MS);

		try {
			await f.arrayBuffer();
		} catch {
			if (miLectura !== lecturaId) return;
			limpiarIntervalo();
			estado = 'error';
			return;
		}

		if (miLectura !== lecturaId) return; // lo quitaron mientras se leía
		limpiarIntervalo();
		progreso = 100;
		estado = 'listo';
	}

	// Al reabrir siempre se arranca en el dropzone, sin el archivo de la vez
	// anterior — mismo criterio que `CargarDocumentoEjemplo`. También corta la
	// lectura en curso: cerrar a media lectura no debe dejar un setInterval vivo.
	$effect(() => {
		if (abierto) return;
		quitarArchivo();
		errorValidacion = '';
	});

	$effect(() => {
		if (files && files.length > 0) {
			aceptar(files[0]);
			files = null;
			// Sin esto, elegir el MISMO archivo dos veces seguidas no vuelve a
			// disparar `change` (mismo patrón que CargaDocumentalPanel).
			if (fileInput) fileInput.value = '';
		}
	});

	function aceptar(f: File) {
		const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
		if (!EXTENSIONES.includes(ext)) {
			errorValidacion = `Formato no admitido. Se aceptan ${EXTENSIONES.join(', ').toUpperCase()}.`;
			quitarArchivo();
			return;
		}
		if (f.size > MAX_BYTES) {
			errorValidacion = `El archivo excede el límite de ${MAX_MB} MB.`;
			quitarArchivo();
			return;
		}
		errorValidacion = '';
		leer(f);
	}

	function manejarDrop(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		// El `accept` del <input> NO filtra el drag&drop, así que la validación
		// de `aceptar` es la única que corre por esta vía.
		const soltado = evento.dataTransfer?.files?.[0];
		if (soltado) aceptar(soltado);
	}
</script>

<DialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) onCancelar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10"
		/>
		<DialogPrimitive.Content
			data-testid="modal-documento-prompts"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[88vh] w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<span class="min-w-0 flex-1 text-sm text-muted-foreground">Documento de ejemplo</span>
				<DialogPrimitive.Close aria-label="Cerrar" onclick={onCancelar}>
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
				<div class="flex items-start gap-4">
					<span
						class="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5 text-primary"
					>
						<FolderLibraryIcon />
					</span>
					<div class="min-w-0 flex-1">
						<DialogPrimitive.Title class="text-xl font-bold text-foreground">
							Carga un documento de ejemplo
						</DialogPrimitive.Title>
						<DialogPrimitive.Description class="mt-1 text-sm text-muted-foreground">
							Completa la información requerida.
						</DialogPrimitive.Description>
					</div>
				</div>

				<p class="text-sm text-muted-foreground">
					Selecciona un único documento representativo del tipo documental que deseas configurar.
					NexusDoc analizará su contenido para generar propuestas de prompts que faciliten la
					extracción y clasificación de información.
				</p>

				<!-- Mismo lenguaje visual que el dropzone del Home. El texto va en
				     SINGULAR (un documento, un archivo) porque es el límite real: la
				     captura del estado vacío lo tenía en plural y la del estado con
				     archivo en singular — se toma el singular, que es el que no
				     miente, en vez de cambiar el texto según el estado. -->
				<button
					type="button"
					data-testid="dropzone-documento-prompts"
					class={[
						'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors',
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
					<span
						class="flex size-8 items-center justify-center rounded-lg border border-border bg-card"
					>
						<FolderLibraryIcon />
					</span>
					<span class="flex flex-col items-center gap-0.5 text-center">
						<span class="text-sm font-medium text-foreground">
							Arrastra y suelta un documento aquí o selecciona un archivo desde tu equipo
						</span>
						<span class="text-xs text-muted-foreground">
							PDF, JPG, JPEG, PNG, TIFF | Max {MAX_MB} MB
						</span>
					</span>
					<input
						bind:this={fileInput}
						bind:files
						type="file"
						class="hidden"
						accept=".pdf,.jpg,.jpeg,.png,.tiff"
					/>
					<span
						class="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-secondary-foreground"
					>
						Buscar archivos
					</span>
				</button>

				{#if errorValidacion}
					<p data-testid="error-documento-prompts" class="text-xs text-destructive">
						{errorValidacion}
					</p>
				{/if}

				{#if archivo}
					<div class="flex flex-col gap-2">
						<div class="flex items-center gap-3">
							<span class="h-px flex-1 bg-border"></span>
							<span class="text-xs text-muted-foreground">Archivos</span>
							<span class="h-px flex-1 bg-border"></span>
						</div>

						<div
							data-testid="archivo-elegido"
							data-estado={estado}
							class="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
						>
							<div class="flex items-center gap-3">
								<span
									class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
								>
									{#if esImagen}
										<ImageIcon />
									{:else}
										<FileIcon />
									{/if}
								</span>

								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium text-foreground">
										{archivo.name}
									</span>
									{#if estado === 'error'}
										<!-- Sustituye a "tipo • tamaño", no se agrega debajo: así lo trae
										     la captura, y el dato de tamaño de un archivo que no se pudo
										     leer no aporta nada. -->
										<span class="block text-xs text-destructive">Error al cargar archivo</span>
									{:else}
										<span class="block text-xs text-muted-foreground">
											{extension} • {formatearTamano(archivo.size)}
										</span>
									{/if}
								</span>

								{#if estado === 'leyendo'}
									<div class="flex shrink-0 flex-col items-end gap-1">
										<button
											type="button"
											data-testid="cancelar-lectura"
											aria-label="Cancelar la carga de {archivo.name}"
											class="text-muted-foreground transition-colors hover:text-foreground"
											onclick={quitarArchivo}
										>
											<X class="size-4" />
										</button>
										<span class="text-xs tabular-nums text-muted-foreground">{progreso}%</span>
									</div>
								{:else if estado === 'error'}
									<div class="flex shrink-0 items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											class="text-destructive hover:text-destructive"
											data-testid="quitar-archivo-prompts"
											onclick={quitarArchivo}
										>
											Eliminar
										</Button>
										<Button
											variant="outline"
											size="sm"
											class="text-primary hover:text-primary"
											data-testid="recargar-archivo-prompts"
											onclick={() => archivo && leer(archivo)}
										>
											Recargar
										</Button>
									</div>
								{:else}
									<Button
										variant="outline"
										size="sm"
										class="shrink-0 text-destructive hover:text-destructive"
										data-testid="quitar-archivo-prompts"
										onclick={quitarArchivo}
									>
										Eliminar
									</Button>
								{/if}
							</div>

							{#if estado === 'leyendo'}
								<div
									class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
									role="progressbar"
									aria-valuenow={progreso}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-label="Progreso de carga de {archivo.name}"
								>
									<div
										class="h-full rounded-full bg-primary transition-[width] duration-100"
										style="width: {progreso}%"
									></div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
				<Button
					variant="link"
					class="h-auto p-0 text-destructive"
					data-testid="cancelar-generacion"
					onclick={onCancelar}
				>
					Cancelar generación
				</Button>
				<!-- Exige estado 'listo', no solo que haya archivo: mientras se lee no
				     se sabe si se va a poder, y con un error de lectura definitivamente
				     no hay documento que mandar a la revisión. -->
				<Button
					data-testid="continuar-documento-prompts"
					disabled={archivo === null || estado !== 'listo'}
					onclick={() => archivo && estado === 'listo' && onContinuar(archivo)}
				>
					Continuar
				</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
