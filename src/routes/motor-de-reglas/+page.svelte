<script lang="ts">
	/**
	 * Motor de reglas · piloto 1 (2026-10-20): los tipos documentales como ENTRADAS de un proceso.
	 *
	 * Un proceso es un conjunto de reglas y corre sobre un expediente (un conjunto de documentos). Por ahora solo se pueden poner
	 * los tipos documentales en un lienzo de Svelte Flow y ver sus campos; los operadores y las conexiones son lo que sigue.
	 */
	import { SvelteFlowProvider } from '@xyflow/svelte';

	import LienzoDeProceso from '$lib/components/reglas/LienzoDeProceso.svelte';
</script>

<div>
	<h1 class="text-2xl font-semibold text-foreground">Motor de reglas</h1>
	<p class="mt-1.5 text-sm text-muted-foreground">
		Piloto: un proceso es un conjunto de reglas que corre sobre un expediente. Aquí se colocan los tipos documentales que son sus
		entradas. Todavía no se guarda.
	</p>
</div>

<SvelteFlowProvider>
	<LienzoDeProceso />
</SvelteFlowProvider>
