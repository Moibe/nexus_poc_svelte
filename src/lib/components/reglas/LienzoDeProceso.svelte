<script lang="ts">
	/**
	 * El lienzo de un proceso (motor de reglas, 2026-10-20): arriba la barra con el nombre del proceso y lo que se hace con él
	 * (abrir otro, empezar uno nuevo, guardar, eliminar); abajo, a la izquierda la paleta (tipos documentales y operadores) y a la
	 * derecha el canvas de Svelte Flow donde se sueltan. Un proceso es un conjunto de reglas y corre sobre un expediente, o sea un
	 * conjunto de documentos: los tipos documentales son sus ENTRADAS y los operadores son las reglas. A un operador se le conectan
	 * CAMPOS, y a un operador lógico, el resultado de otras reglas.
	 *
	 * Qué se acepta conectar lo decide `motivoDeRechazo` (en `reglas.ts`, probado aparte). Cuando se rechaza, el lienzo dice POR QUÉ
	 * en un aviso sobre el canvas: soltar un cable y que no pase nada es lo peor que le puede pasar a quien está armando una regla.
	 *
	 * ## Guardar
	 *
	 * Un proceso se guarda cuando la persona lo pide (botón o Ctrl+S) y vive en el servidor, por organización (`procesos.svelte.ts`).
	 * «Cambios sin guardar» sale de comparar la huella del dibujo de ahora con la del último guardado: mover un nodo y devolverlo, o
	 * escribir un valor y borrarlo, deja el proceso como estaba, sin cambios. Antes de perder cambios —empezar uno nuevo, abrir otro o
	 * salir de la página— se pregunta. Si otra persona guardó el mismo proceso antes, no se pisa: se ofrece cargar lo suyo.
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

	import { beforeNavigate, goto } from '$app/navigation';
	import { onMount, setContext, tick } from 'svelte';

	import BarraDeProceso from '$lib/components/reglas/BarraDeProceso.svelte';
	import NodoOperador from '$lib/components/reglas/NodoOperador.svelte';
	import NodoTipoDocumental from '$lib/components/reglas/NodoTipoDocumental.svelte';
	import PaletaDeTipos from '$lib/components/reglas/PaletaDeTipos.svelte';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import {
		CLAVE_VEREDICTOS,
		MIME_OPERADOR,
		MIME_TIPO_DOCUMENTAL,
		NODO_OPERADOR,
		NODO_TIPO,
		evaluar,
		hidratarDibujo,
		huellaDelDibujo,
		idNodoDeTipo,
		motivoDeRechazo,
		operadorDe,
		serializarDibujo,
		type ClaveOperador,
		type Conexion,
		type DatosNodoOperador,
		type DatosNodoTipo
	} from '$lib/reglas/reglas';
	import { avisarExito } from '$lib/state/avisos.svelte';
	import { tiposDocumentales } from '$lib/state/configuracion.svelte';
	import {
		borrarProceso,
		cargarProcesos,
		estadoProcesos,
		guardarProceso,
		idDeProceso,
		reiniciarProcesos,
		type EstadoDeProceso,
		type ProcesoGuardado
	} from '$lib/state/procesos.svelte';
	import { tema } from '$lib/tema.svelte';

	const { screenToFlowPosition, fitView } = useSvelteFlow();

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let zona = $state<HTMLDivElement>();

	const nodeTypes = { [NODO_TIPO]: NodoTipoDocumental, [NODO_OPERADOR]: NodoOperador };

	// El veredicto de CADA regla, calculado una vez para todo el grafo: una regla que depende de otra tiene que ver el veredicto
	// actual de ésa, y cada nodo no puede recorrer el grafo por su cuenta.
	const veredictos = $derived(evaluar(nodes, edges, tiposDocumentales));
	setContext(CLAVE_VEREDICTOS, {
		get todos() {
			return veredictos;
		}
	});

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
		const operador = operadorDe(clave);
		if (!operador) return;
		operadoresPuestos += 1;
		const nuevo: Node<DatosNodoOperador> = {
			id: `operador-${operadoresPuestos}`,
			type: NODO_OPERADOR,
			position: posicion,
			data: { operador: operador.clave as ClaveOperador, a: '', b: '' }
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

	// ── El proceso que está en el lienzo ─────────────────────────────────────

	const HUELLA_VACIA = huellaDelDibujo({ nodos: [], aristas: [] });

	/** El que está en el lienzo. Un proceso nuevo ya trae su id, pero NO existe en el servidor hasta el primer guardado. */
	let procesoId = $state(idDeProceso());
	let revision = $state(0);
	let existe = $state(false);
	let nombre = $state('');
	let descripcion = $state('');
	/** Lo último que se guardó (o se abrió): con esto se compara para saber si hay cambios. */
	let guardado = $state({ huella: HUELLA_VACIA, nombre: '' });
	let guardando = $state(false);

	const huella = $derived(huellaDelDibujo(serializarDibujo(nodes, edges)));
	const sucio = $derived(
		existe ? huella !== guardado.huella || nombre.trim() !== guardado.nombre : nodes.length > 0 || edges.length > 0 || nombre.trim() !== ''
	);
	const estadoDeProceso = $derived<EstadoDeProceso>(existe ? (sucio ? 'cambios' : 'guardado') : sucio ? 'sin_guardar' : 'nuevo');
	const puedeGuardar = $derived(sucio && nombre.trim() !== '');

	/** Deja un proceso nuevo y en blanco. */
	function nuevo() {
		nodes = [];
		edges = [];
		operadoresPuestos = 0;
		procesoId = idDeProceso();
		revision = 0;
		existe = false;
		nombre = '';
		descripcion = '';
		guardado = { huella: HUELLA_VACIA, nombre: '' };
		aviso = '';
	}

	/** Pone un proceso del servidor en el lienzo. */
	async function abrir(p: ProcesoGuardado) {
		const dibujo = hidratarDibujo(p.datos);
		nodes = dibujo.nodes;
		edges = dibujo.edges;
		operadoresPuestos = dibujo.operadoresPuestos;
		procesoId = p.id;
		revision = p.revision;
		existe = true;
		nombre = p.datos.nombre;
		descripcion = p.datos.descripcion ?? '';
		// La huella se saca de lo que quedó en el lienzo, no de lo que mandó el servidor: si algo no se pudo abrir (un operador que ya
		// no existe) el proceso no debe aparecer con cambios sin que nadie los haya hecho.
		guardado = { huella: huellaDelDibujo(serializarDibujo(dibujo.nodes, dibujo.edges)), nombre: p.datos.nombre.trim() };
		aviso = '';
		await tick();
		fitView({ padding: 0.15, maxZoom: 1, duration: 0 });
	}

	// ── Lo que pregunta antes de perder algo, y lo que avisa ─────────────────

	type Dialogo =
		| null
		| { tipo: 'cambios'; despues: () => void }
		| { tipo: 'borrar' }
		| { tipo: 'conflicto' }
		| { tipo: 'error'; titulo: string; mensaje: string };
	let dialogo = $state<Dialogo>(null);
	const dialogoDeError = $derived(dialogo?.tipo === 'error' ? dialogo : null);

	/** Hace `accion` ya, o antes pregunta si hay cambios sin guardar que se perderían. */
	function sinPerderCambios(accion: () => void) {
		if (sucio) dialogo = { tipo: 'cambios', despues: accion };
		else accion();
	}

	const alNuevo = () => sinPerderCambios(nuevo);
	function alAbrir(id: string) {
		const p = estadoProcesos.lista.find((x) => x.id === id);
		if (p && id !== procesoId) sinPerderCambios(() => void abrir(p));
	}

	async function guardar() {
		if (!puedeGuardar || guardando) return;
		guardando = true;
		const limpio = nombre.trim();
		const dibujo = serializarDibujo(nodes, edges);
		const r = await guardarProceso(procesoId, existe ? revision : 0, { nombre: limpio, descripcion, ...dibujo });
		guardando = false;
		if (r.ok) {
			revision = r.proceso.revision;
			existe = true;
			nombre = limpio;
			// Lo que se guardó es lo que se mandó: si durante el guardado se tocó algo, eso sigue siendo un cambio.
			guardado = { huella: huellaDelDibujo(dibujo), nombre: limpio };
			avisarExito('Proceso guardado', `«${limpio}» quedó guardado.`);
		} else if (r.conflicto) {
			dialogo = { tipo: 'conflicto' };
		} else if (r.status === 404) {
			// Otra persona lo eliminó mientras se editaba: el dibujo no se pierde, y guardar otra vez lo crea de nuevo.
			existe = false;
			revision = 0;
			dialogo = { tipo: 'error', titulo: 'Este proceso ya no existe', mensaje: 'Otra persona lo eliminó. Tu dibujo sigue aquí: al guardar se crea de nuevo.' };
		} else {
			dialogo = { tipo: 'error', titulo: 'No se pudo guardar el proceso', mensaje: r.mensaje };
		}
	}

	/** El proceso cambió en el servidor mientras se editaba: se carga lo de la otra persona y lo no guardado aquí se pierde. */
	async function cargarLoDeLaOtraPersona() {
		await cargarProcesos();
		const suyo = estadoProcesos.lista.find((x) => x.id === procesoId);
		if (suyo) await abrir(suyo);
	}

	async function eliminar() {
		const quitado = nombre.trim();
		const r = await borrarProceso(procesoId);
		if (r.ok) {
			nuevo();
			avisarExito('Proceso eliminado', `«${quitado}» se eliminó.`);
		} else {
			dialogo = { tipo: 'error', titulo: 'No se pudo eliminar el proceso', mensaje: r.mensaje };
		}
	}

	// ── Salir de la página ───────────────────────────────────────────────────

	let salidaConfirmada = false;
	beforeNavigate((navegacion) => {
		// `willUnload` es cerrar la pestaña o ir a otro sitio: de eso se encarga `beforeunload`, el único aviso que el navegador permite.
		if (navegacion.willUnload || salidaConfirmada || !sucio || !navegacion.to) return;
		navegacion.cancel();
		const destino = navegacion.to.url;
		dialogo = {
			tipo: 'cambios',
			despues: () => {
				salidaConfirmada = true;
				void goto(destino);
			}
		};
	});

	function alCerrarPestana(e: BeforeUnloadEvent) {
		if (!sucio) return;
		e.preventDefault();
		e.returnValue = '';
	}

	function alPulsar(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			void guardar();
		}
	}

	// Al entrar se lee la lista de la organización y, si la persona todavía no empezó nada, se abre el proceso que se tocó más recientemente.
	onMount(() => {
		reiniciarProcesos();
		void cargarProcesos().then(() => {
			if (existe || sucio || estadoProcesos.lista.length === 0) return;
			const reciente = [...estadoProcesos.lista].sort((a, b) => (b.modificadoEn ?? '').localeCompare(a.modificadoEn ?? ''))[0];
			void abrir(reciente);
		});
		return () => reiniciarProcesos();
	});
</script>

<svelte:window onbeforeunload={alCerrarPestana} onkeydown={alPulsar} />

<BarraDeProceso
	bind:nombre
	estado={estadoDeProceso}
	actualId={procesoId}
	{guardando}
	{puedeGuardar}
	puedeBorrar={existe}
	alGuardar={guardar}
	alNuevo={alNuevo}
	{alAbrir}
	alBorrar={() => (dialogo = { tipo: 'borrar' })}
/>

<div
	data-testid="lienzo-reglas"
	class="lienzo relative mt-4 flex h-[calc(100vh-22rem)] min-h-120 overflow-hidden rounded-xl border border-border bg-card"
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

<ConfirmarAccion
	abierto={dialogo?.tipo === 'cambios'}
	titulo="Hay cambios sin guardar"
	mensaje="Si continúas, se pierden los cambios de «{nombre.trim() || 'este proceso'}» que no guardaste."
	etiquetaConfirmar="Salir sin guardar"
	etiquetaCancelar="Seguir editando"
	onConfirmar={() => {
		const despues = dialogo?.tipo === 'cambios' ? dialogo.despues : null;
		dialogo = null;
		despues?.();
	}}
	onCerrar={() => {
		if (dialogo?.tipo === 'cambios') dialogo = null;
	}}
/>

<ConfirmarAccion
	abierto={dialogo?.tipo === 'borrar'}
	titulo="Eliminar el proceso"
	mensaje="«{nombre.trim()}» se eliminará de la organización y no se puede deshacer."
	etiquetaConfirmar="Eliminar"
	onConfirmar={() => {
		dialogo = null;
		void eliminar();
	}}
	onCerrar={() => {
		if (dialogo?.tipo === 'borrar') dialogo = null;
	}}
/>

<ConfirmarAccion
	abierto={dialogo?.tipo === 'conflicto'}
	titulo="Otra persona guardó este proceso"
	mensaje="Para no pisar su trabajo hay que cargar su versión. Los cambios que hiciste aquí y no guardaste se perderán."
	variante="neutral"
	etiquetaConfirmar="Cargar su versión"
	etiquetaCancelar="Seguir con la mía"
	onConfirmar={() => {
		dialogo = null;
		void cargarLoDeLaOtraPersona();
	}}
	onCerrar={() => {
		if (dialogo?.tipo === 'conflicto') dialogo = null;
	}}
/>

<ConfirmarAccion
	abierto={dialogoDeError !== null}
	titulo={dialogoDeError?.titulo ?? ''}
	mensaje={dialogoDeError?.mensaje ?? ''}
	variante="neutral"
	soloAviso
	etiquetaConfirmar="Entendido"
	onConfirmar={() => (dialogo = null)}
	onCerrar={() => {
		if (dialogo?.tipo === 'error') dialogo = null;
	}}
/>

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
