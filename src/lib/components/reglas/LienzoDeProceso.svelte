<script lang="ts">
	/**
	 * El lienzo de un proceso (motor de reglas, piloto 1, 2026-10-20): a la izquierda la lista de tipos documentales, a la derecha
	 * el canvas de Svelte Flow donde se sueltan. Un proceso es un conjunto de reglas y corre sobre un expediente, o sea un
	 * conjunto de documentos: los tipos documentales son sus ENTRADAS. Los operadores y las conexiones vienen en el siguiente piloto.
	 *
	 * Todavía no se guarda nada: el lienzo vive en memoria y se vacía al salir de la página.
	 *
	 * Va dentro de un `<SvelteFlowProvider>` (lo pone la página): `useSvelteFlow` solo existe ahí dentro.
	 *
	 * `nodes` y `edges` son `$state.raw`: Svelte Flow los reemplaza completos en cada cambio y un proxy profundo solo le estorba.
	 */
	import { Background, BackgroundVariant, Controls, MiniMap, SvelteFlow, useSvelteFlow, type Edge, type Node } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import NodoTipoDocumental from '$lib/components/reglas/NodoTipoDocumental.svelte';
	import PaletaDeTipos from '$lib/components/reglas/PaletaDeTipos.svelte';
	import { MIME_TIPO_DOCUMENTAL, NODO_TIPO, idNodoDeTipo, type DatosNodoTipo } from '$lib/reglas/lienzo';
	import { tema } from '$lib/tema.svelte';

	const { screenToFlowPosition, fitView } = useSvelteFlow();

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let zona = $state<HTMLDivElement>();

	const nodeTypes = { [NODO_TIPO]: NodoTipoDocumental };

	/** Los tipos que ya tienen su nodo. */
	const enLienzo = $derived(
		new Set(nodes.flatMap((n) => (n.type === NODO_TIPO ? [(n.data as DatosNodoTipo).tipoId] : [])))
	);

	/** Pone el tipo en el lienzo en `posicion` (coordenadas del lienzo). Si ya está, no lo duplica: lo enfoca. */
	function agregar(tipoId: string, posicion: { x: number; y: number }) {
		const id = idNodoDeTipo(tipoId);
		if (nodes.some((n) => n.id === id)) {
			fitView({ nodes: [{ id }], duration: 300, maxZoom: 1 });
			return;
		}
		const nuevo: Node<DatosNodoTipo> = { id, type: NODO_TIPO, position: posicion, data: { tipoId } };
		nodes = [...nodes, nuevo];
	}

	/** Un clic en la paleta: el nodo aparece en el centro de lo que se ve, escalonado para que varios no queden encimados. */
	function agregarAlCentro(tipoId: string) {
		const caja = zona?.getBoundingClientRect();
		if (!caja) return;
		const escalon = (nodes.length % 6) * 28;
		agregar(
			tipoId,
			screenToFlowPosition({ x: caja.left + caja.width / 2 - 144 + escalon, y: caja.top + 56 + escalon })
		);
	}

	function alPasarPorEncima(e: DragEvent) {
		if (!e.dataTransfer?.types.includes(MIME_TIPO_DOCUMENTAL)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}

	function alSoltar(e: DragEvent) {
		const tipoId = e.dataTransfer?.getData(MIME_TIPO_DOCUMENTAL);
		if (!tipoId) return;
		e.preventDefault();
		agregar(tipoId, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
	}
</script>

<div
	data-testid="lienzo-reglas"
	class="lienzo relative mt-6 flex h-[calc(100vh-18rem)] min-h-120 overflow-hidden rounded-xl border border-border bg-card"
>
	<PaletaDeTipos {enLienzo} alAgregar={agregarAlCentro} />

	<div bind:this={zona} role="presentation" class="relative min-w-0 flex-1" ondragover={alPasarPorEncima} ondrop={alSoltar}>
		<SvelteFlow
			bind:nodes
			bind:edges
			{nodeTypes}
			colorMode={tema.oscuro ? 'dark' : 'light'}
			deleteKey={['Backspace', 'Delete']}
			minZoom={0.2}
			nodesConnectable={false}
			proOptions={{ hideAttribution: true }}
		>
			<Background variant={BackgroundVariant.Dots} gap={20} />
			<Controls showLock={false} />
			<MiniMap pannable zoomable />
		</SvelteFlow>

		{#if nodes.length === 0}
			<p
				data-testid="lienzo-vacio"
				class="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground"
			>
				El lienzo está vacío. Arrastra aquí los tipos documentales del expediente.
			</p>
		{/if}
	</div>
</div>

<style>
	/* El lienzo toma los colores de NexusDoc en vez de los de la librería. */
	.lienzo :global(.svelte-flow) {
		--xy-background-color: var(--card);
		--xy-background-color-default: var(--card);
		--xy-minimap-background-color-default: var(--background);
		--xy-controls-button-background-color-default: var(--card);
		--xy-controls-button-background-color-hover-default: var(--muted);
		--xy-controls-button-color-default: var(--foreground);
		--xy-controls-button-border-color-default: var(--border);
	}
</style>
