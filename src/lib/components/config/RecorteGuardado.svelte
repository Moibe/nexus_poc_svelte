<script lang="ts">
	/**
	 * La miniatura de un recorte GUARDADO (el «Texto seleccionado» de Calibración): el pedazo del documento que se marcó.
	 *
	 * Antes `ConfigSheet` le daba a `RecorteDeDocumento` la imagen del documento —la página 1— y listo. Un recorte hecho en la
	 * página 9 de un PDF tiene que cortarse de la página 9, así que aquí se pide la imagen de la página del recorte
	 * (`usarPaginaDeEjemplo`) y se la pasa. Para un recorte de la página 1, o de una imagen, es la misma URL de siempre y no se
	 * abre ningún PDF.
	 */
	import RecorteDeDocumento from './RecorteDeDocumento.svelte';
	import { usarPaginaDeEjemplo } from '$lib/hooks/usarPaginaDeEjemplo.svelte';
	import {
		paginaDeRecorte,
		type DocumentoEjemploInstancia,
		type Recorte
	} from '$lib/state/configuracion.svelte';

	let {
		doc,
		recorte,
		alt
	}: {
		doc: DocumentoEjemploInstancia;
		recorte: Recorte;
		alt: string;
	} = $props();

	const pagina = $derived(paginaDeRecorte(recorte));
	const vista = usarPaginaDeEjemplo(() => ({ doc, pagina }));
</script>

{#if vista.estado === 'fallo'}
	<p
		data-testid="recorte-pagina-sin-cargar"
		class="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
	>
		No se pudo cargar la página {pagina} del documento para mostrar este recorte. Las coordenadas siguen guardadas; intenta
		de nuevo en unos minutos.
	</p>
{:else if vista.url}
	<RecorteDeDocumento fuente={vista.url} {recorte} {alt} />
{:else}
	<p data-testid="recorte-cargando" class="text-xs text-muted-foreground">Cargando la página {pagina}…</p>
{/if}
