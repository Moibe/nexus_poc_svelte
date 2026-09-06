<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import X from '@lucide/svelte/icons/x';
	import {
		alternarSeleccionPendiente,
		formatearFecha,
		formatearTamano,
		quitarArchivoPendiente,
		type ArchivoPendienteDeCarga
	} from '$lib/state/bandeja.svelte';

	let { archivo }: { archivo: ArchivoPendienteDeCarga } = $props();

	// Mismo criterio que DocumentoRow.svelte para elegir el ícono.
	const esImagen = $derived(['JPG', 'JPEG', 'PNG', 'TIFF'].includes(archivo.extension));
</script>

<div class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
	<Checkbox
		checked={archivo.seleccionado}
		onCheckedChange={() => alternarSeleccionPendiente(archivo.id)}
		aria-label={`Seleccionar ${archivo.nombre}`}
	/>

	<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
		{#if esImagen}
			<ImageIcon />
		{:else}
			<FileIcon />
		{/if}
	</span>

	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium text-foreground">{archivo.nombre}</p>
		<p class="text-xs text-muted-foreground">
			{archivo.extension} · {formatearTamano(archivo.tamanioBytes)} ·
			{formatearFecha(archivo.agregadoEn)}
		</p>
		<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
			<span class="size-1.5 rounded-full bg-muted-foreground/40"></span>
			Pendiente de carga
		</p>
	</div>

	<button
		type="button"
		aria-label={`Quitar ${archivo.nombre}`}
		class="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		onclick={() => quitarArchivoPendiente(archivo.id)}
	>
		<X class="size-3.5" />
	</button>
</div>
