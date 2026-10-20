<script lang="ts">
	/**
	 * Motor de reglas (2026-10-20): se arma un PROCESO en un lienzo de Svelte Flow y se guarda en el servidor, por organización.
	 *
	 * Un proceso es un conjunto de reglas y corre sobre un expediente (un conjunto de documentos): los tipos documentales son sus
	 * entradas y los operadores (igual, distinto, contiene, mayor, menor, y, o, no) son las reglas, que se pueden encadenar. Todavía
	 * no hay un motor que corra un proceso sobre un expediente de verdad: el lienzo prueba cada regla con valores de ejemplo.
	 */
	import { SvelteFlowProvider } from '@xyflow/svelte';

	import LienzoDeProceso from '$lib/components/reglas/LienzoDeProceso.svelte';
</script>

<div>
	<h1 class="text-2xl font-semibold text-foreground">Motor de reglas</h1>
	<p class="mt-1.5 text-sm text-muted-foreground">
		Un proceso es un conjunto de reglas que corre sobre un expediente. Arma el tuyo con los tipos documentales como entradas y los
		operadores como reglas; las reglas se prueban con valores de ejemplo.
	</p>
</div>

<SvelteFlowProvider>
	<LienzoDeProceso />
</SvelteFlowProvider>
