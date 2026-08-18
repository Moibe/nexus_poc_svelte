<script lang="ts">
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import X from '@lucide/svelte/icons/x';
	import { formatearTamano, quitarDocumento, type DocumentoEnBandeja } from '$lib/state/bandeja.svelte';

	let { documento }: { documento: DocumentoEnBandeja } = $props();

	const esImagen = ['JPG', 'JPEG', 'TIFF'].includes(documento.extension);
</script>

<div class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
	<span
		class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
	>
		{#if esImagen}
			<ImageIcon />
		{:else}
			<FileIcon />
		{/if}
	</span>

	{#if documento.estado === 'subiendo'}
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-medium text-foreground">{documento.nombre}</p>
			<div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
				<div
					class="h-full rounded-full bg-primary transition-[width]"
					style="width: {documento.progreso}%"
				></div>
			</div>
		</div>
		<span class="shrink-0 text-xs tabular-nums text-muted-foreground">{documento.progreso}%</span>
	{:else}
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-medium text-foreground">{documento.nombre}</p>
			<p class="text-xs text-muted-foreground">
				{documento.extension} · {formatearTamano(documento.tamanioBytes)} · {documento.origen}
			</p>
		</div>
	{/if}

	<button
		type="button"
		aria-label={`Quitar ${documento.nombre}`}
		class="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		onclick={() => quitarDocumento(documento.id)}
	>
		<X class="size-3.5" />
	</button>
</div>
