<script lang="ts">
	/**
	 * Motor de reglas · el lienzo de UN proceso (2026-10-20; desde el 2026-10-29 vive en su propia dirección, porque el motor arranca en la
	 * lista de procesos): se arma un PROCESO en un lienzo de Svelte Flow y se guarda en el servidor, por organización.
	 *
	 * `/motor-de-reglas/nuevo` es un proceso en blanco; `/motor-de-reglas/<id>` abre el que ya existe (si no existe en esta organización,
	 * el lienzo lo dice). Un proceso es un conjunto de reglas y corre sobre un expediente (un conjunto de documentos): los tipos documentales
	 * son sus entradas y los operadores (igual, distinto, contiene, mayor, menor, y, o, no…) son las reglas, que se pueden encadenar. Todavía
	 * no hay un motor que corra un proceso sobre un expediente de verdad: el lienzo prueba cada regla con valores de ejemplo.
	 */
	import { SvelteFlowProvider } from '@xyflow/svelte';

	import { page } from '$app/state';
	import LienzoDeProceso from '$lib/components/reglas/LienzoDeProceso.svelte';

	/** `nuevo` o el id de un proceso guardado. */
	const entrada = $derived(page.params.id ?? 'nuevo');
</script>

<svelte:head><title>Biblioratum — Motor de reglas</title></svelte:head>

<div>
	<h1 class="text-2xl font-semibold text-foreground">Motor de reglas</h1>
	<p class="mt-1.5 text-sm text-muted-foreground">
		Un proceso es un conjunto de reglas que corre sobre un expediente. Arma el tuyo con los tipos documentales como entradas y los
		operadores como reglas; las reglas se prueban con valores de ejemplo.
	</p>
</div>

<!-- `key`: abrir OTRO proceso es una pantalla nueva, no el mismo lienzo con datos distintos (los contadores de nodos, lo recordado de cada
     valor fijo y lo no guardado son del lienzo y no deben pasar de un proceso a otro). -->
{#key entrada}
	<SvelteFlowProvider>
		<LienzoDeProceso procesoDeEntrada={entrada} />
	</SvelteFlowProvider>
{/key}
