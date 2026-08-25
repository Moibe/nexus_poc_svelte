<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import ArrowDownIcon from '$lib/components/icons/ArrowDownIcon.svelte';
	import { agregarArchivos } from '$lib/state/bandeja.svelte';

	let fileInput = $state<HTMLInputElement>();
	let files = $state<FileList | null>(null);
	let arrastrando = $state(false);

	// Selección por clic: bind:files dispara esto; se reenvía a la bandeja y se
	// limpia el input para que el dropzone vuelva a su estado ocioso (el
	// "documento agregado" ya se ve reflejado allá, no hace falta dejar aquí un
	// contador de "N archivos seleccionados").
	$effect(() => {
		if (files && files.length > 0) {
			agregarArchivos(files);
			files = null;
			// Limpiar el estado NO limpia el <input>: su `value` sigue guardando la
			// ruta del archivo elegido, y el navegador solo dispara `change` cuando
			// ese value CAMBIA. Sin esta línea, volver a elegir EL MISMO archivo no
			// hacía absolutamente nada — ni una fila, ni un error, ni un aviso.
			//
			// Y ese caso es de lo más normal: procesas un documento, se va al
			// pipeline, y quieres volver a subirlo (para reprocesarlo, o porque no
			// te diste cuenta de que ya lo habías subido). Antes tenías que elegir
			// otro archivo primero para "destrabar" el input.
			if (fileInput) fileInput.value = '';
		}
	});

	function manejarDrop(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		const soltados = evento.dataTransfer?.files;
		if (soltados && soltados.length > 0) agregarArchivos(soltados);
	}
</script>

<div class="flex h-full flex-col gap-2.5 rounded-2xl border-2 border-border bg-card p-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-base font-medium text-foreground">Carga documental</p>
			<p class="text-xs text-muted-foreground">Iniciar la ingesta de documentos</p>
		</div>
		<div class="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
			<span class="flex size-4 items-center justify-center rounded-full bg-[#ecfdf3]">
				<span class="size-2 rounded-full bg-[#29cc39]"></span>
			</span>
			<span class="text-sm font-medium text-secondary-foreground">Manual</span>
			<ArrowDownIcon />
		</div>
	</div>

	<button
		type="button"
		class={[
			'flex h-50 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors',
			arrastrando ? 'border-primary bg-muted' : 'border-border bg-background'
		]}
		onclick={() => fileInput?.click()}
		ondragover={(evento) => {
			evento.preventDefault();
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
				Arrastra y suelta tus documentos aquí o selecciona archivos desde tu equipo
			</p>
			<p class="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPG, JPEG, PNG, TIFF | Max 20 MB</p>
		</div>
		<input
			bind:this={fileInput}
			bind:files
			type="file"
			multiple
			class="hidden"
			accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.tiff"
		/>
		<span class="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-secondary-foreground">
			Buscar archivos
		</span>
	</button>

	<div class="flex flex-1 items-center justify-center">
		<EmptyState
			icon={ClockBadgeIcon}
			title="Tu área de carga está lista"
			description="Agrega documentos para iniciar el procesamiento, lectura y validación inteligente dentro de NexusDoc."
		/>
	</div>
</div>
