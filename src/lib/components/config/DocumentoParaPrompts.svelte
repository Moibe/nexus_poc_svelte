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
	 * Sin frame de Figma en el volcado: construido desde la captura del
	 * 2026-09-06 (rotulada "HU001 | 129" el estado vacío y "HU001 | 130" el
	 * estado con archivo).
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';

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

	let {
		abierto = false,
		onContinuar,
		onCancelar
	}: {
		abierto?: boolean;
		/** El archivo elegido. Quien abre decide qué hacer con él — este modal no
		 *  persiste nada. */
		onContinuar: (archivo: File) => void;
		/** "Cancelar generación", la X, Escape y el clic fuera: todos abortan la
		 *  generación completa, no solo este paso. */
		onCancelar: () => void;
	} = $props();

	let fileInput = $state<HTMLInputElement>();
	let files = $state<FileList | null>(null);
	let arrastrando = $state(false);
	let archivo = $state<File | null>(null);
	let error = $state('');

	const esImagen = $derived(
		archivo ? !/\.pdf$/i.test(archivo.name) : false
	);

	// Al reabrir siempre se arranca en el dropzone, sin el archivo de la vez
	// anterior — mismo criterio que `CargarDocumentoEjemplo`.
	$effect(() => {
		if (abierto) return;
		archivo = null;
		error = '';
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
		const extension = f.name.split('.').pop()?.toLowerCase() ?? '';
		if (!EXTENSIONES.includes(extension)) {
			error = `Formato no admitido. Se aceptan ${EXTENSIONES.join(', ').toUpperCase()}.`;
			archivo = null;
			return;
		}
		if (f.size > MAX_BYTES) {
			error = `El archivo excede el límite de ${MAX_MB} MB.`;
			archivo = null;
			return;
		}
		error = '';
		archivo = f;
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

				{#if error}
					<p data-testid="error-documento-prompts" class="text-xs text-destructive">{error}</p>
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
							class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
						>
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
								<span class="block text-xs text-muted-foreground">
									{(archivo.name.split('.').pop() ?? '').toUpperCase()} • {formatearTamano(
										archivo.size
									)}
								</span>
							</span>
							<Button
								variant="outline"
								size="sm"
								data-testid="quitar-archivo-prompts"
								onclick={() => (archivo = null)}
							>
								Eliminar
							</Button>
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
				<!-- Deshabilitado sin archivo, como en la captura del estado vacío: sin
				     documento no hay nada sobre lo que probar los prompts. -->
				<Button
					data-testid="continuar-documento-prompts"
					disabled={archivo === null}
					onclick={() => archivo && onContinuar(archivo)}
				>
					Continuar
				</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
