<script lang="ts">
	/**
	 * Un documento DESCARTADO, tal como se ve cuando el filtro de Estado incluye «Descartado» (Figma: «movido correctamente a la
	 * sección de descartados»). Sin casilla ni acciones: ya no se procesa. Dice cuándo se descartó y, si la persona lo escribió,
	 * por qué. El archivo sigue en el almacén.
	 */
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import { formatearFecha, formatearTamano, type DocumentoDescartado } from '$lib/state/bandeja.svelte';

	let { documento }: { documento: DocumentoDescartado } = $props();

	const esImagen = $derived(['JPG', 'JPEG', 'PNG', 'TIFF'].includes(documento.extension));
</script>

<div class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 opacity-80" data-testid="documento-descartado">
	<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
		{#if esImagen}
			<ImageIcon />
		{:else}
			<FileIcon />
		{/if}
	</span>
	<div class="min-w-0 flex-1">
		<div class="flex items-start justify-between gap-2">
			<p class="truncate text-sm font-medium text-foreground">{documento.nombre}</p>
			<span
				data-testid="origen-documento"
				class="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase"
			>
				{documento.origen}
			</span>
		</div>
		<p class="text-xs text-muted-foreground">
			{documento.extension} · {formatearTamano(documento.tamanioBytes)} · {formatearFecha(documento.agregadoEn)}
		</p>
		<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="estado-descartado">
			<span class="size-1.5 rounded-full bg-muted-foreground/50"></span>
			Descartado el {formatearFecha(documento.descartadoEn)}
		</p>
		{#if documento.detalle}
			<p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title="Motivo: {documento.detalle}" data-testid="motivo-del-descarte">Motivo: {documento.detalle}</p>
		{/if}
	</div>
</div>
