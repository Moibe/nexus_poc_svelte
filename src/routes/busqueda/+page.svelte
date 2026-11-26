<script lang="ts">
	/**
	 * Búsqueda · preguntar en lenguaje natural y ver la respuesta en una tabla (NEX-607, 2026-11-23). Se llega desde el cuadro «Búsqueda» del Módulo de
	 * uso; la ven todos los roles que usan el producto, porque solo lee (como los expedientes): nexus_back decide, aquí no se filtra nada.
	 *
	 * Una caja para escribir la pregunta y la respuesta como tabla con cuántos renglones son. Lo que pasa en medio (el modelo escribe la consulta, el
	 * servidor la revisa y la corre con la conexión de solo lectura que solo ve esta organización) es del back: la pantalla manda la pregunta al BFF
	 * (`/api/busqueda/preguntar`) y pinta lo que vuelve. Los datos de los documentos no salen del servidor hacia ningún modelo.
	 *
	 * Estados: sin preguntar (con las preguntas sugeridas), pensando, la tabla (o «no hay información»), «no se puede responder con los datos
	 * extraídos» (ámbar: no es un error), tardó demasiado y error. La pantalla no nombra al proveedor del modelo.
	 *
	 * NEX-608 (entender la respuesta y llevársela), NEX-609 (bitácora, «¿Te sirvió?», recientes, tope) y NEX-610 (la gráfica): todo lo de UNA respuesta
	 * vive en `RespuestaBusqueda.svelte` desde NEX-611. NEX-611 (la conversación) vive en `ConversacionBusqueda.svelte` desde NEX-612, que la usa también
	 * dentro del expediente («Preguntar», acotado a ese expediente). Aquí se pregunta sobre TODA la organización.
	 */
	import { invalidate } from '$app/navigation';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';

	import ConversacionBusqueda from '$lib/components/busqueda/ConversacionBusqueda.svelte';
	import { preguntasSugeridas } from '$lib/busqueda/busqueda';

	let { data } = $props();

	const sugeridas = $derived(preguntasSugeridas(data.tipos ?? []));
</script>

<svelte:head><title>Biblioratum — Búsqueda</title></svelte:head>

<p class="text-xs text-muted-foreground">Uso / Búsqueda</p>
<div class="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
	<div>
		<h1 class="text-2xl font-semibold text-foreground">Búsqueda</h1>
		<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
			Pregunta con tus palabras sobre los datos extraídos de los documentos de tu organización, y sigue preguntando sobre la respuesta. Llega como tabla
			y, cuando se presta, también como gráfica.
		</p>
	</div>
	{#if data.administra}
		<!-- Solo quien administra la organización aprueba ejemplos: el enlace dice cuántas respuestas útiles esperan revisión. -->
		<a
			href="/busqueda/ejemplos"
			data-testid="ir-a-ejemplos"
			class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<BadgeCheck class="size-4 text-primary" aria-hidden="true" />
			Ejemplos de tu organización
			{#if data.porRevisar > 0}
				<span class="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground tabular-nums" data-testid="cuantas-por-revisar">
					{data.porRevisar} por revisar
				</span>
			{/if}
			<ArrowRight class="size-3.5 text-muted-foreground" aria-hidden="true" />
		</a>
	{/if}
</div>

<ConversacionBusqueda
	organizacion={data.organizacion ?? null}
	{sugeridas}
	recientes={data.recientes ?? []}
	alPreguntar={() => {
		// La pregunta ya quedó en la bitácora: «Tus preguntas recientes» (y lo que espera revisión) se vuelven a pedir. Si falla, no pasa nada.
		void invalidate('busqueda:recientes').catch(() => undefined);
	}}
/>
