<script lang="ts">
	/**
	 * La tarjeta de un documento dentro de un expediente (Figma, Sprint 5, HUN2, `.Folder_preview` del detalle): la hoja arriba y abajo,
	 * el nombre del archivo, «PDF | 0.5 MB» y la fecha en que entró. Mide 210 px de ancho.
	 *
	 * Lo que el diseño trae y aquí falta: las páginas («Páginas 4»), porque el documento todavía no guarda cuántas tiene, y la etiqueta
	 * del tipo documental, porque la clasificación aún no vive en el servidor (cuando exista, va en el renglón de la fecha). Tampoco hay
	 * menú de tres puntos ni estado de seleccionada.
	 *
	 * Desde el 2026-10-29, dentro de un expediente VIRTUAL la tarjeta puede llevar «Quitar» (`alQuitar`): saca el documento del grupito, no
	 * del expediente. Sin `alQuitar` (el expediente, o quien no organiza) no hay nada que hacer con ella.
	 */
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	import ArchivoIlustracion from '$lib/components/icons/ArchivoIlustracion.svelte';
	import { fechaCorta, formatearTamano, formatoDe, type DocumentoDeExpediente } from '$lib/expedientes/expedientes';

	let {
		documento,
		alQuitar,
		quitando = false
	}: {
		documento: DocumentoDeExpediente;
		/** Si viene, la tarjeta ofrece «Quitar» (de un expediente virtual). */
		alQuitar?: () => void;
		/** Se está quitando: el botón gira y no se puede volver a picar. */
		quitando?: boolean;
	} = $props();
</script>

<div data-testid="tarjeta-documento" data-documento-id={documento.id} class="w-52.5 overflow-hidden rounded-xl border-2 border-border bg-card">
	<div class="p-3">
		<div class="flex items-center justify-center rounded-md border border-border bg-background p-6">
			<span class="flex size-12 items-center justify-center"><ArchivoIlustracion /></span>
		</div>
	</div>
	<div class="flex flex-col gap-1.5 px-3 pb-4">
		<p class="truncate text-xs font-medium text-foreground" data-testid="documento-nombre" title={documento.nombreOriginal}>{documento.nombreOriginal}</p>
		<p class="text-xs font-medium text-muted-foreground" data-testid="documento-detalle">{formatoDe(documento)} | {formatearTamano(documento.tamanoBytes)}</p>
		<div class="flex items-center justify-between gap-2">
			<p class="text-xs font-medium text-muted-foreground" data-testid="documento-fecha">{fechaCorta(documento.recibidoEn)}</p>
			{#if alQuitar}
				<button
					type="button"
					class="flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline disabled:opacity-50"
					disabled={quitando}
					onclick={alQuitar}
					aria-label={`Quitar «${documento.nombreOriginal}» de este expediente virtual`}
					data-testid="quitar-del-virtual"
				>
					{#if quitando}<LoaderCircle class="size-3 animate-spin" />{/if}
					Quitar
				</button>
			{/if}
		</div>
	</div>
</div>
