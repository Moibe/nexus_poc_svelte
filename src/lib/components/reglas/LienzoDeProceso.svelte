<script lang="ts">
	/**
	 * El lienzo de un proceso (motor de reglas, 2026-10-20): a la izquierda la paleta (tipos documentales y operadores), a la derecha
	 * el canvas de Svelte Flow donde se sueltan. Un proceso es un conjunto de reglas y corre sobre un expediente, o sea un conjunto
	 * de documentos: los tipos documentales son sus ENTRADAS y los operadores son las reglas. A un operador se le conectan CAMPOS.
	 *
	 * Qué se acepta conectar lo decide `motivoDeRechazo` (en `reglas.ts`, probado aparte). Cuando se rechaza, el lienzo dice POR QUÉ
	 * en un aviso sobre el canvas: soltar un cable y que no pase nada es lo peor que le puede pasar a quien está armando una regla.
	 *
	 * Todavía no se guarda nada: el lienzo vive en memoria y se vacía al salir de la página.
	 *
	 * Va dentro de un `<SvelteFlowProvider>` (lo pone la página): `useSvelteFlow` solo existe ahí dentro.
	 *
	 * `nodes` y `edges` son `$state.raw`: Svelte Flow los reemplaza completos en cada cambio y un proxy profundo solo le estorba.
	 */
	import {
		Background,
		BackgroundVariant,
		Controls,
		MiniMap,
		Panel,
		SvelteFlow,
		useSvelteFlow,
		type Edge,
		type Node,
		type OnConnectEnd
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import NodoIgual from '$lib/components/reglas/NodoIgual.svelte';
	import NodoTipoDocumental from '$lib/components/reglas/NodoTipoDocumental.svelte';
	import PaletaDeTipos from '$lib/components/reglas/PaletaDeTipos.svelte';
	import {
		MIME_OPERADOR,
		MIME_TIPO_DOCUMENTAL,
		NODO_IGUAL,
		NODO_TIPO,
		OPERADORES,
		idNodoDeTipo,
		motivoDeRechazo,
		type Conexion,
		type DatosNodoIgual,
		type DatosNodoTipo
	} from '$lib/reglas/reglas';
	import { tiposDocumentales } from '$lib/state/configuracion.svelte';
	import { tema } from '$lib/tema.svelte';

	const { screenToFlowPosition, fitView } = useSvelteFlow();

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let zona = $state<HTMLDivElement>();

	const nodeTypes = { [NODO_TIPO]: NodoTipoDocumental, [NODO_IGUAL]: NodoIgual };

	/** Los tipos que ya tienen su nodo. */
	const enLienzo = $derived(
		new Set(nodes.flatMap((n) => (n.type === NODO_TIPO ? [(n.data as DatosNodoTipo).tipoId] : [])))
	);

	type Posicion = { x: number; y: number };

	/** Pone el tipo en el lienzo en `posicion` (coordenadas del lienzo). Si ya está, no lo duplica: lo enfoca. */
	function agregar(tipoId: string, posicion: Posicion) {
		const id = idNodoDeTipo(tipoId);
		if (nodes.some((n) => n.id === id)) {
			fitView({ nodes: [{ id }], duration: 300, maxZoom: 1 });
			return;
		}
		const nuevo: Node<DatosNodoTipo> = { id, type: NODO_TIPO, position: posicion, data: { tipoId } };
		nodes = [...nodes, nuevo];
	}

	/** Un operador es una regla nueva cada vez: se puede poner las veces que haga falta. El número no se reutiliza al quitar. */
	let operadoresPuestos = 0;
	function agregarOperador(clave: string, posicion: Posicion) {
		const operador = OPERADORES.find((o) => o.clave === clave);
		if (!operador) return;
		operadoresPuestos += 1;
		const nuevo: Node<DatosNodoIgual> = {
			id: `operador-${operadoresPuestos}`,
			type: operador.nodo,
			position: posicion,
			data: { a: '', b: '' }
		};
		nodes = [...nodes, nuevo];
	}

	/** Un clic en la paleta: el nodo aparece en el centro de lo que se ve, escalonado para que varios no queden encimados. */
	function alCentro(): Posicion | null {
		const caja = zona?.getBoundingClientRect();
		if (!caja) return null;
		const escalon = (nodes.length % 6) * 28;
		return screenToFlowPosition({ x: caja.left + caja.width / 2 - 144 + escalon, y: caja.top + 56 + escalon });
	}
	function agregarAlCentro(tipoId: string) {
		const posicion = alCentro();
		if (posicion) agregar(tipoId, posicion);
	}
	function agregarOperadorAlCentro(clave: string) {
		const posicion = alCentro();
		if (posicion) agregarOperador(clave, posicion);
	}

	function alPasarPorEncima(e: DragEvent) {
		const tipos = e.dataTransfer?.types;
		if (!tipos?.includes(MIME_TIPO_DOCUMENTAL) && !tipos?.includes(MIME_OPERADOR)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}

	function alSoltar(e: DragEvent) {
		const posicion = screenToFlowPosition({ x: e.clientX, y: e.clientY });
		const tipoId = e.dataTransfer?.getData(MIME_TIPO_DOCUMENTAL);
		if (tipoId) {
			e.preventDefault();
			agregar(tipoId, posicion);
			return;
		}
		const operador = e.dataTransfer?.getData(MIME_OPERADOR);
		if (operador) {
			e.preventDefault();
			agregarOperador(operador, posicion);
		}
	}

	// ── Conexiones ───────────────────────────────────────────────────────────

	const rechazo = (c: Conexion) => motivoDeRechazo(c, nodes, edges, tiposDocumentales);

	/** Cada entrada de un operador recibe UN campo: al conectar otro, el anterior se va. */
	function alConectar() {
		edges = edges.filter(
			(e, i, todas) => todas.findLastIndex((o) => o.target === e.target && o.targetHandle === e.targetHandle) === i
		);
	}

	let aviso = $state('');
	let relojAviso: ReturnType<typeof setTimeout> | undefined;
	function avisar(texto: string) {
		aviso = texto;
		clearTimeout(relojAviso);
		relojAviso = setTimeout(() => (aviso = ''), 6000);
	}

	/** Si se soltó el cable SOBRE un punto de conexión y no se aceptó, se dice por qué. Soltarlo en el vacío no es un error. */
	const alTerminarConexion: OnConnectEnd = (_evento, estado) => {
		if (estado.isValid || !estado.fromHandle || !estado.toHandle || !estado.fromNode || !estado.toNode) return;
		const desdeSalida = estado.fromHandle.type === 'source';
		const conexion: Conexion = desdeSalida
			? { source: estado.fromNode.id, sourceHandle: estado.fromHandle.id, target: estado.toNode.id, targetHandle: estado.toHandle.id }
			: { source: estado.toNode.id, sourceHandle: estado.toHandle.id, target: estado.fromNode.id, targetHandle: estado.fromHandle.id };
		avisar(rechazo(conexion) ?? 'Esa conexión no se puede hacer.');
	};
</script>

<div
	data-testid="lienzo-reglas"
	class="lienzo relative mt-6 flex h-[calc(100vh-18rem)] min-h-120 overflow-hidden rounded-xl border border-border bg-card"
>
	<PaletaDeTipos {enLienzo} alAgregar={agregarAlCentro} alAgregarOperador={agregarOperadorAlCentro} />

	<div bind:this={zona} role="presentation" class="relative min-w-0 flex-1" ondragover={alPasarPorEncima} ondrop={alSoltar}>
		<SvelteFlow
			bind:nodes
			bind:edges
			{nodeTypes}
			colorMode={tema.oscuro ? 'dark' : 'light'}
			deleteKey={['Backspace', 'Delete']}
			minZoom={0.2}
			isValidConnection={(c) => rechazo(c) === null}
			onconnect={alConectar}
			onconnectend={alTerminarConexion}
			proOptions={{ hideAttribution: true }}
		>
			<Background variant={BackgroundVariant.Dots} gap={20} />
			<Controls showLock={false} />
			<MiniMap pannable zoomable />
			{#if aviso}
				<Panel position="top-center">
					<p
						role="status"
						data-testid="aviso-conexion"
						class="max-w-md rounded-lg border border-destructive/30 bg-card px-3 py-2 text-xs text-destructive shadow-md"
					>
						{aviso}
					</p>
				</Panel>
			{/if}
		</SvelteFlow>

		{#if nodes.length === 0}
			<p
				data-testid="lienzo-vacio"
				class="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground"
			>
				El lienzo está vacío. Arrastra aquí los tipos documentales del expediente y los operadores.
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
