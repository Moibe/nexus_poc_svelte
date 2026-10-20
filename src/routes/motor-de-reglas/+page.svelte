<script lang="ts">
	/**
	 * Motor de reglas · piloto 0 (2026-10-20): solo el LIENZO.
	 *
	 * Un canvas al estilo n8n sobre Svelte Flow (`@xyflow/svelte`): pan, zoom, minimapa y controles. Todavía no hay nodos, ni
	 * paleta de tipos documentales, ni conexiones con significado: qué es un nodo y qué viaja por una conexión se define en los
	 * siguientes pilotos. Aquí solo se comprueba que la librería vive dentro de NexusDoc con su tema claro/oscuro.
	 *
	 * `nodes` y `edges` son `$state.raw`: Svelte Flow los reemplaza completos en cada cambio (no los muta), y un proxy profundo
	 * solo le estorba.
	 */
	import { Background, BackgroundVariant, Controls, MiniMap, SvelteFlow, type Edge, type Node } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import { tema } from '$lib/tema.svelte';

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
</script>

<div>
	<h1 class="text-2xl font-semibold text-foreground">Motor de reglas</h1>
	<p class="mt-1.5 text-sm text-muted-foreground">
		Piloto: un lienzo donde se van a arrastrar tipos documentales para hacer cosas con ellos.
	</p>
</div>

<div
	data-testid="lienzo-reglas"
	class="relative mt-6 h-[calc(100vh-18rem)] min-h-120 overflow-hidden rounded-xl border border-border bg-card"
>
	<SvelteFlow bind:nodes bind:edges colorMode={tema.oscuro ? 'dark' : 'light'} fitView proOptions={{ hideAttribution: true }}>
		<Background variant={BackgroundVariant.Dots} gap={20} />
		<Controls showLock={false} />
		<MiniMap pannable zoomable />
	</SvelteFlow>

	{#if nodes.length === 0}
		<p
			data-testid="lienzo-vacio"
			class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
		>
			El lienzo está vacío.
		</p>
	{/if}
</div>

<style>
	/* El lienzo toma los colores de NexusDoc en vez de los de la librería. */
	div[data-testid='lienzo-reglas'] :global(.svelte-flow) {
		--xy-background-color: var(--card);
		--xy-background-color-default: var(--card);
		--xy-minimap-background-color-default: var(--background);
		--xy-controls-button-background-color-default: var(--card);
		--xy-controls-button-background-color-hover-default: var(--muted);
		--xy-controls-button-color-default: var(--foreground);
		--xy-controls-button-border-color-default: var(--border);
	}
</style>
