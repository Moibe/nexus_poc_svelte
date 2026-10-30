<script lang="ts">
	/**
	 * El lienzo de UN proceso (motor de reglas, 2026-10-20): arriba la barra con el nombre del proceso y lo que se hace con él
	 * (volver a la lista, guardar, eliminar); abajo, a la izquierda la paleta (tipos documentales y operadores) y a la
	 * derecha el canvas de Svelte Flow donde se sueltan. Un proceso es un conjunto de reglas y corre sobre un expediente, o sea un
	 * conjunto de documentos: los tipos documentales son sus ENTRADAS y los operadores son las reglas. A un operador se le conectan
	 * CAMPOS, y a un operador lógico, el resultado de otras reglas.
	 *
	 * ## Qué proceso abre (2026-10-29)
	 *
	 * El motor arranca en la lista de procesos (`/motor-de-reglas`) y de ahí se llega aquí con `procesoDeEntrada`: `nuevo` es un proceso en
	 * blanco y cualquier otro valor es el id de uno guardado, que se lee de la organización (si ya no existe, se dice). Antes abría solo el
	 * último que se había tocado y la barra traía un selector para cambiar de proceso. Abrir otro o empezar uno nuevo ahora es volver a la
	 * lista, y de eso se encarga la navegación: la pregunta de «hay cambios sin guardar» ya salta sola al salir de la página.
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

	import { beforeNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, setContext, tick, untrack } from 'svelte';

	import BarraDeProceso from '$lib/components/reglas/BarraDeProceso.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import NodoConstante from '$lib/components/reglas/NodoConstante.svelte';
	import NodoOperador from '$lib/components/reglas/NodoOperador.svelte';
	import NodoTipoDocumental from '$lib/components/reglas/NodoTipoDocumental.svelte';
	import PaletaDeTipos from '$lib/components/reglas/PaletaDeTipos.svelte';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import {
		CLAVE_VEREDICTOS,
		MIME_CONSTANTE,
		MIME_OPERADOR,
		MIME_TIPO_DOCUMENTAL,
		NODO_CONSTANTE,
		NODO_OPERADOR,
		NODO_TIPO,
		evaluar,
		hidratarDibujo,
		huellaDelDibujo,
		idNodoDeTipo,
		motivoDeRechazo,
		numeroDeOperador,
		operadorDe,
		serializarDibujo,
		type ClaveOperador,
		type Conexion,
		type DatosNodoConstante,
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
		procesoActivo,
		reiniciarProcesos,
		type EstadoDeProceso,
		type ProcesoGuardado
	} from '$lib/state/procesos.svelte';
	import { tema } from '$lib/tema.svelte';

	/** `nuevo` (en blanco) o el id de un proceso guardado: lo que trae la dirección. Una pantalla nueva por cada valor (la página la repone con `key`). */
	let { procesoDeEntrada = 'nuevo' }: { procesoDeEntrada?: string } = $props();
	const esNuevo = $derived(procesoDeEntrada === 'nuevo');

	const { screenToFlowPosition, fitView } = useSvelteFlow();

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let zona = $state<HTMLDivElement>();

	const nodeTypes = { [NODO_TIPO]: NodoTipoDocumental, [NODO_OPERADOR]: NodoOperador, [NODO_CONSTANTE]: NodoConstante };

	// El estado de CADA regla y el valor de las que entregan uno, calculados una vez para todo el grafo: una regla que depende de otra
	// tiene que ver lo actual de ésa, y cada nodo no puede recorrer el grafo por su cuenta.
	const evaluacion = $derived(evaluar(nodes, edges, tiposDocumentales));
	setContext(CLAVE_VEREDICTOS, {
		get todos() {
			return evaluacion.estados;
		},
		get valores() {
			return evaluacion.valores;
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

	/** Un valor fijo también se puede poner las veces que haga falta, y su número tampoco se reutiliza. */
	let constantesPuestas = 0;
	function agregarConstante(posicion: Posicion) {
		constantesPuestas += 1;
		const nuevo: Node<DatosNodoConstante> = {
			id: `constante-${constantesPuestas}`,
			type: NODO_CONSTANTE,
			position: posicion,
			data: { familia: 'texto', valor: '' }
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
	function agregarConstanteAlCentro() {
		const posicion = alCentro();
		if (posicion) agregarConstante(posicion);
	}

	function alPasarPorEncima(e: DragEvent) {
		const tipos = e.dataTransfer?.types;
		if (!tipos?.includes(MIME_TIPO_DOCUMENTAL) && !tipos?.includes(MIME_OPERADOR) && !tipos?.includes(MIME_CONSTANTE)) return;
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
			return;
		}
		if (e.dataTransfer?.getData(MIME_CONSTANTE)) {
			e.preventDefault();
			agregarConstante(posicion);
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

	// Cambiar la CLASE de un valor fijo que ya está conectado (de número a texto, por ejemplo) puede dejar su cable donde ya no cabe:
	// se desconecta y se dice por qué, igual que cuando se rechaza un cable nuevo. Solo se tocan los cables del valor fijo QUE CAMBIÓ:
	// si dos lados dejan de ser compatibles entre sí, los dos cables parecen inválidos, y el que está bien no se debe caer. Por eso se
	// recuerda la clase que tenía cada uno. Los cables de un campo no se revisan: dependen de la biblioteca de tipos, que puede estar
	// todavía cargándose, y no se deben quitar por eso.
	const clasesVistas = new Map<string, string>();
	$effect(() => {
		const cambiados = new Set<string>();
		for (const n of nodes) {
			if (n.type !== NODO_CONSTANTE) continue;
			const clase = String((n.data as DatosNodoConstante).familia);
			const antes = clasesVistas.get(n.id);
			if (antes !== undefined && antes !== clase) cambiados.add(n.id);
			clasesVistas.set(n.id, clase);
		}
		if (cambiados.size === 0) return;
		const sobran = edges.filter(
			(e) => cambiados.has(e.source) && motivoDeRechazo(e, nodes, edges.filter((o) => o !== e), tiposDocumentales) !== null
		);
		if (sobran.length === 0) return;
		avisar(
			sobran
				.map((e) => {
					const destino = nodes.find((n) => n.id === e.target);
					const def = destino ? operadorDe(String((destino.data as DatosNodoOperador).operador)) : undefined;
					const motivo = motivoDeRechazo(e, nodes, edges.filter((o) => o !== e), tiposDocumentales);
					return `Se desconectó «Valor fijo #${numeroDeOperador(e.source)}» de «${def?.etiqueta ?? 'la regla'} #${numeroDeOperador(e.target)}»: ${motivo}`;
				})
				.join(' ')
		);
		edges = edges.filter((e) => !sobran.includes(e));
	});

	// ── El proceso que está en el lienzo ─────────────────────────────────────

	const HUELLA_VACIA = huellaDelDibujo({ nodos: [], aristas: [] });

	/** El que está en el lienzo. Un proceso nuevo ya trae su id, pero NO existe en el servidor hasta el primer guardado. */
	let procesoId = $state(idDeProceso());
	let revision = $state(0);
	let existe = $state(false);
	let nombre = $state('');
	let descripcion = $state('');
	/** Si el proceso está activo (se cambia desde la lista de procesos, no aquí). Aquí solo se CONSERVA: al guardar se manda lo mismo que se
	 *  leyó, porque guardar arma el proceso entero y, sin esto, cada guardado lo dejaría activo otra vez. */
	let activo = $state(true);
	/** El tipo de expediente virtual sobre el que corre (2026-10-29), o `null`. Se elige en la barra y se guarda con el proceso. */
	let tipoVirtual = $state<string | null>(null);
	/** Lo último que se guardó (o se abrió): con esto se compara para saber si hay cambios. */
	let guardado = $state<{ huella: string; nombre: string; tipo: string | null }>({ huella: HUELLA_VACIA, nombre: '', tipo: null });
	let guardando = $state(false);

	/** Se está leyendo el proceso del servidor (solo cuando la dirección trae el id de uno guardado). */
	let cargandoProceso = $state(untrack(() => procesoDeEntrada !== 'nuevo'));
	/** Qué impide abrirlo: «no existe» (otra persona lo borró, o es de otra organización: no se distingue) o la lectura falló. */
	let noSePudoAbrir = $state<{ titulo: string; mensaje: string } | null>(null);

	const huella = $derived(huellaDelDibujo(serializarDibujo(nodes, edges)));
	const sucio = $derived(
		existe
			? huella !== guardado.huella || nombre.trim() !== guardado.nombre || tipoVirtual !== guardado.tipo
			: nodes.length > 0 || edges.length > 0 || nombre.trim() !== '' || tipoVirtual !== null
	);
	const estadoDeProceso = $derived<EstadoDeProceso>(existe ? (sucio ? 'cambios' : 'guardado') : sucio ? 'sin_guardar' : 'nuevo');
	const puedeGuardar = $derived(sucio && nombre.trim() !== '');

	/** Pone un proceso del servidor en el lienzo. */
	async function abrir(p: ProcesoGuardado) {
		const dibujo = hidratarDibujo(p.datos);
		clasesVistas.clear();
		nodes = dibujo.nodes;
		edges = dibujo.edges;
		operadoresPuestos = dibujo.operadoresPuestos;
		constantesPuestas = dibujo.constantesPuestas;
		procesoId = p.id;
		revision = p.revision;
		existe = true;
		nombre = p.datos.nombre;
		descripcion = p.datos.descripcion ?? '';
		activo = procesoActivo(p);
		tipoVirtual = p.datos.tipoExpedienteVirtualId ?? null;
		// La huella se saca de lo que quedó en el lienzo, no de lo que mandó el servidor: si algo no se pudo abrir (un operador que ya
		// no existe) el proceso no debe aparecer con cambios sin que nadie los haya hecho.
		guardado = { huella: huellaDelDibujo(serializarDibujo(dibujo.nodes, dibujo.edges)), nombre: p.datos.nombre.trim(), tipo: tipoVirtual };
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

	/** La dirección ya dice el id del proceso (después de su primer guardado), no `nuevo`. */
	let direccionAlDia = false;

	async function guardar() {
		if (!puedeGuardar || guardando) return;
		guardando = true;
		const limpio = nombre.trim();
		const dibujo = serializarDibujo(nodes, edges);
		const tipo = tipoVirtual;
		const r = await guardarProceso(procesoId, existe ? revision : 0, { nombre: limpio, descripcion, activo, tipoExpedienteVirtualId: tipo, ...dibujo });
		guardando = false;
		if (r.ok) {
			revision = r.proceso.revision;
			existe = true;
			nombre = limpio;
			// Lo que se guardó es lo que se mandó: si durante el guardado se tocó algo, eso sigue siendo un cambio.
			guardado = { huella: huellaDelDibujo(dibujo), nombre: limpio, tipo };
			avisarExito('Proceso guardado', `«${limpio}» quedó guardado.`);
			// Un proceso que nació en `/motor-de-reglas/nuevo` ya tiene su dirección: se cambia la barra del navegador SIN navegar (recargar o
			// compartir el enlace abre ESTE proceso, y no un lienzo en blanco).
			if (esNuevo && !direccionAlDia) {
				direccionAlDia = true;
				replaceState(`/motor-de-reglas/${encodeURIComponent(procesoId)}`, {});
			}
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
			// Ya no hay proceso al que volver: se regresa a la lista. Los cambios sin guardar de algo que ya no existe no se preguntan.
			salidaConfirmada = true;
			avisarExito('Proceso eliminado', `«${quitado}» se eliminó.`);
			await goto('/motor-de-reglas');
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

	// Un proceso en blanco no necesita nada del servidor. Uno guardado se busca en la lista de la organización: si no está, la dirección
	// apunta a algo que ya no existe (o que es de otra organización, que desde aquí es lo mismo) y se dice, en vez de enseñar un lienzo
	// vacío que parecería el proceso perdido.
	onMount(() => {
		reiniciarProcesos();
		if (!esNuevo) {
			void cargarProcesos().then(async () => {
				cargandoProceso = false;
				if (!estadoProcesos.cargada) {
					noSePudoAbrir = { titulo: 'No se pudo abrir el proceso', mensaje: estadoProcesos.error || 'No se pudo leer la lista de procesos.' };
					return;
				}
				const p = estadoProcesos.lista.find((x) => x.id === procesoDeEntrada);
				if (!p) {
					noSePudoAbrir = {
						titulo: 'Este proceso ya no existe',
						mensaje: 'Puede que otra persona lo haya eliminado. Regresa a la lista para ver los procesos de tu organización.'
					};
					return;
				}
				await abrir(p);
			});
		}
		return () => reiniciarProcesos();
	});
</script>

<svelte:window onbeforeunload={alCerrarPestana} onkeydown={alPulsar} />

<BarraDeProceso
	bind:nombre
	bind:tipoVirtual
	tiposVirtuales={page.data.tiposVirtuales ?? []}
	estado={estadoDeProceso}
	{guardando}
	{puedeGuardar}
	puedeBorrar={existe}
	alGuardar={guardar}
	alBorrar={() => (dialogo = { tipo: 'borrar' })}
/>

<div
	data-testid="lienzo-reglas"
	class="lienzo relative mt-4 flex h-[calc(100vh-22rem)] min-h-120 overflow-hidden rounded-xl border border-border bg-card"
>
	<PaletaDeTipos {enLienzo} alAgregar={agregarAlCentro} alAgregarOperador={agregarOperadorAlCentro} alAgregarConstante={agregarConstanteAlCentro} />

	<!-- Mientras se lee el proceso, o si no se pudo abrir, una cubierta tapa la paleta y el canvas: un lienzo en blanco se leería como un
	     proceso perdido, y soltar nodos encima de lo que está por llegar se perdería al abrirlo. -->
	{#if cargandoProceso}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-card text-sm text-muted-foreground" data-testid="proceso-cargando" role="status">
			Cargando el proceso…
		</div>
	{:else if noSePudoAbrir}
		<div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-card px-6 text-center" data-testid="proceso-no-abre" role="alert">
			<h2 class="text-lg font-semibold text-foreground">{noSePudoAbrir.titulo}</h2>
			<p class="max-w-md text-sm text-muted-foreground">{noSePudoAbrir.mensaje}</p>
			<Button href="/motor-de-reglas" data-testid="volver-a-procesos-desde-error">Volver a los procesos</Button>
		</div>
	{/if}

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
				El lienzo está vacío. Abre un menú de la izquierda y arrastra aquí los tipos documentales del expediente y los operadores.
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
	/* El lienzo toma los colores de Biblioratum en vez de los de la librería. */
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
