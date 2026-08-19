<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import X from '@lucide/svelte/icons/x';
	import {
		alternarSeleccion,
		formatearFecha,
		formatearTamano,
		quitarDocumento,
		type DocumentoEnBandeja
	} from '$lib/state/bandeja.svelte';

	let { documento }: { documento: DocumentoEnBandeja } = $props();

	const esImagen = $derived(['JPG', 'JPEG', 'TIFF'].includes(documento.extension));

	// Los tres estados problemáticos se muestran igual: texto rojo bajo los
	// metadatos, sin fondo ni punto de color. Así están en Figma (el token
	// --error/error-2), donde la tarjeta se queda blanca y solo cambia el texto.
	const problema = $derived(
		{
			duplicado: 'Documento duplicado',
			protegido: 'Documento protegido mediante contraseña',
			corrupto: 'Archivo corrupto o ilegible'
		}[documento.estado as 'duplicado' | 'protegido' | 'corrupto']
	);
</script>

<div class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
	<Checkbox
		checked={documento.seleccionado}
		disabled={documento.estado === 'subiendo'}
		onCheckedChange={() => alternarSeleccion(documento.id)}
		aria-label={`Seleccionar ${documento.nombre}`}
	/>

	<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
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
				{documento.extension} · {formatearTamano(documento.tamanioBytes)} · {documento.origen} ·
				{formatearFecha(documento.agregadoEn)}
			</p>
			{#if problema}
				<p class="mt-0.5 text-xs text-red-500">{problema}</p>
			{/if}
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
