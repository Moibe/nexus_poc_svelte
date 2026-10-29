<script lang="ts">
	/**
	 * La tarjeta de un documento dentro de un expediente (Figma, Sprint 5, HUN2, `.Folder_preview` del detalle): la hoja arriba y abajo,
	 * el nombre del archivo, «PDF | 0.5 MB» y la fecha en que entró. Mide 210 px de ancho.
	 *
	 * Lo que el diseño trae y aquí falta: las páginas («Páginas 4»), porque el documento todavía no guarda cuántas tiene, y la etiqueta
	 * del tipo documental, porque la clasificación aún no vive en el servidor (cuando exista, va en el renglón de la fecha). Tampoco hay
	 * menú de tres puntos ni estado de seleccionada: no hay nada que hacer con un documento desde aquí, así que no es un botón.
	 */
	import ArchivoIlustracion from '$lib/components/icons/ArchivoIlustracion.svelte';
	import { fechaCorta, formatearTamano, formatoDe, type DocumentoDeExpediente } from '$lib/expedientes/expedientes';

	let { documento }: { documento: DocumentoDeExpediente } = $props();
</script>

<div data-testid="tarjeta-documento" class="w-52.5 overflow-hidden rounded-xl border-2 border-border bg-card">
	<div class="p-3">
		<div class="flex items-center justify-center rounded-md border border-border bg-background p-6">
			<span class="flex size-12 items-center justify-center"><ArchivoIlustracion /></span>
		</div>
	</div>
	<div class="flex flex-col gap-1.5 px-3 pb-4">
		<p class="truncate text-xs font-medium text-foreground" data-testid="documento-nombre" title={documento.nombreOriginal}>{documento.nombreOriginal}</p>
		<p class="text-xs font-medium text-muted-foreground" data-testid="documento-detalle">{formatoDe(documento)} | {formatearTamano(documento.tamanoBytes)}</p>
		<p class="text-xs font-medium text-muted-foreground" data-testid="documento-fecha">{fechaCorta(documento.recibidoEn)}</p>
	</div>
</div>
