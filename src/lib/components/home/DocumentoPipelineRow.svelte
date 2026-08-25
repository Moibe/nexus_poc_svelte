<script lang="ts">
	/**
	 * Fila del panel "Pipeline documental".
	 *
	 * Se parece a DocumentoRow (el de la bandeja) pero no lo reutiliza: ahí la
	 * acción es quitar de la lista y el subtexto habla de problemas de archivo;
	 * aquí la acción es abrir el detalle y el subtexto habla del resultado de la
	 * extracción. Forzar un solo componente con banderas para las dos cosas
	 * saldría más enredado que tener dos.
	 *
	 * El formato del subtexto (`PDF • 2.8 MB | 12/05/2026 | 12:45`) sale de
	 * Figma HU001|106 y NO coincide con el que usa hoy la fila de la bandeja
	 * (separadores `·` y con el origen incluido). Se dejó como está en Figma
	 * para este panel; la de la bandeja quedó pendiente de alinear.
	 */
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import { formatearTamano } from '$lib/state/bandeja.svelte';
	import {
		alternarSeleccionPipeline,
		ETIQUETA_ESTADO,
		type DocumentoEnPipeline
	} from '$lib/state/pipeline.svelte';

	let {
		documento,
		alAbrirDetalle
	}: { documento: DocumentoEnPipeline; alAbrirDetalle: (id: string) => void } = $props();

	const esImagen = $derived(['JPG', 'JPEG', 'PNG', 'TIFF'].includes(documento.extension));
	const etiqueta = $derived(ETIQUETA_ESTADO[documento.estado]);
	const enProceso = $derived(documento.estado === 'en_cola' || documento.estado === 'procesando');

	// Figma muestra en las filas duplicadas SOLO el renglón rojo, sin el "Listo"
	// verde: la nota de que se procesó a propósito pesa más que el resultado.
	const esDuplicadoProcesado = $derived(documento.eraDuplicado && documento.estado === 'procesado');

	function fechaCorta(fecha: Date): string {
		const dia = String(fecha.getDate()).padStart(2, '0');
		const mes = String(fecha.getMonth() + 1).padStart(2, '0');
		return `${dia}/${mes}/${fecha.getFullYear()}`;
	}

	function horaCorta(fecha: Date): string {
		return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
	}
</script>

<div class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
	<Checkbox
		checked={documento.seleccionado}
		onCheckedChange={() => alternarSeleccionPipeline(documento.id)}
		aria-label={`Seleccionar ${documento.nombre}`}
	/>

	<span
		class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
	>
		{#if esImagen}
			<ImageIcon />
		{:else}
			<FileIcon />
		{/if}
	</span>

	<button
		type="button"
		class="min-w-0 flex-1 text-left"
		onclick={() => alAbrirDetalle(documento.id)}
	>
		<p class="truncate text-sm font-medium text-foreground">{documento.nombre}</p>
		<p class="text-xs text-muted-foreground">
			{documento.extension} • {formatearTamano(documento.tamanioBytes)} | {fechaCorta(
				documento.agregadoEn
			)} | {horaCorta(documento.agregadoEn)}
		</p>

		{#if esDuplicadoProcesado}
			<p class="mt-0.5 text-xs text-red-500">Duplicado procesado de forma explícita</p>
		{:else if etiqueta.tono === 'ok'}
			<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
				<span class="size-1.5 rounded-full bg-green-500"></span>
				{etiqueta.texto}
			</p>
		{:else if etiqueta.tono === 'error'}
			<p class="mt-0.5 text-xs text-red-500">{etiqueta.texto}</p>
		{:else}
			<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
				<span class="size-1.5 animate-pulse rounded-full bg-primary"></span>
				{etiqueta.texto}
			</p>
		{/if}
	</button>

	{#if enProceso}
		<span class="shrink-0 text-xs text-muted-foreground" aria-hidden="true">…</span>
	{:else if documento.resultado?.confianza_minima != null}
		<!-- La confianza MÍNIMA, no el promedio: un solo campo mal leído (la CURP,
		     por ejemplo) se diluye en un promedio y es justo el que importa. -->
		<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
			<!-- toFixed(2), NO toFixed(1): con un decimal, 99.98 se imprime como
			     "100.0" — un cien que no existe. En una pantalla cuyo trabajo es
			     decir qué tan confiable fue la lectura, mostrar un 100 falso es
			     justo el error que no se puede permitir. Dos decimales es además
			     la precisión real: el back redondea a 2 al convertir de 0-1 a
			     0-100 (`_a_cien` en servicios/ia.py). -->
			{documento.resultado.confianza_minima.toFixed(2)}%
		</span>
	{/if}
</div>
