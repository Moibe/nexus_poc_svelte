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

	const esImagen = $derived(['JPG', 'JPEG', 'PNG', 'TIFF'].includes(documento.extension));

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

<!-- El nombre con la etiqueta de ORIGEN a su derecha (2026-09-30, a pedido
     con captura): "MANUAL" o "API REST", en una etiqueta y no como un dato más
     del renglón de abajo — con documentos llegando solos por la API, de dónde
     vino cada uno es lo primero que se busca. Misma etiqueta gris que ya usa el
     detalle del documento (`DetalleDocumentoSheet`), en mayúsculas como la
     captura. Va en los tres estados de la fila: uno de la API también pasa por
     "En cola" mientras se baja del almacén. -->
{#snippet nombreConOrigen()}
	<div class="flex items-start justify-between gap-2">
		<p class="truncate text-sm font-medium text-foreground">{documento.nombre}</p>
		<span
			data-testid="origen-documento"
			class="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase"
		>
			{documento.origen}
		</span>
	</div>
{/snippet}

<div class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
	<Checkbox
		checked={documento.seleccionado}
		disabled={documento.estado === 'subiendo' || documento.estado === 'en_cola'}
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

	{#if documento.estado === 'en_cola'}
		<!-- Sin barra de progreso a propósito: todavía no se ha leído un solo byte
		     de este archivo. Una barra en 0% se ve trabada; "En cola" dice lo que
		     de verdad está pasando. -->
		<div class="min-w-0 flex-1">
			{@render nombreConOrigen()}
			<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
				<span class="size-1.5 rounded-full bg-muted-foreground/40"></span>
				En cola
			</p>
		</div>
	{:else if documento.estado === 'subiendo'}
		<div class="min-w-0 flex-1">
			{@render nombreConOrigen()}
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
			{@render nombreConOrigen()}
			<p class="text-xs text-muted-foreground">
				{documento.extension} · {formatearTamano(documento.tamanioBytes)} · {formatearFecha(documento.agregadoEn)}
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
