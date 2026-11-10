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
	 * ## El alta (2026-11-06)
	 *
	 * «Nuevo proceso» ya no llega aquí en blanco: la lista pide primero el nombre y los TIPOS DOCUMENTALES (Figma HUN5; `NuevoProceso.svelte`) y los manda
	 * en la dirección (`/motor-de-reglas/nuevo?nombre=…&tipo=…&tipo=…`, `entradasDeProcesoNuevo`). Aquí se lee eso: el nombre se pone de una vez y cada
	 * tipo entra como un nodo, en columna, en cuanto la biblioteca está leída (sin ella no se sabe cuáles están activos). Es un borrador sin guardar
	 * (nada existe en el servidor hasta «Guardar»); los campos de cada tipo se eligen aquí, conectándolos a las reglas. Una dirección `nuevo` sin
	 * nada de eso sigue siendo un lienzo en blanco.
	 *
	 * Qué se acepta conectar lo decide `motivoDeRechazo` (en `reglas.ts`, probado aparte). Cuando se rechaza, el lienzo dice POR QUÉ
	 * en un aviso sobre el canvas: soltar un cable y que no pase nada es lo peor que le puede pasar a quien está armando una regla.
	 *
	 * ## Cómo termina (2026-11-03)
	 *
	 * Los nodos FINALES dicen qué entrega el proceso: cada «Valor final» es un dato que entra, con su nombre, a la lista de la corrida, y el
	 * «Resultado» —uno solo por proceso— es la palabra con la que termina («Aprobado», «Certificado»…) según pase o no la regla que se le conecta.
	 * No tienen salida. Con los valores de ejemplo, el lienzo dice qué entraría a la lista y con qué palabra terminaría (`evaluar`).
	 *
	 * ## Sobre qué corre (2026-11-05)
	 *
	 * Sobre CUALQUIER expediente de la organización. Moibe quitó los expedientes virtuales: «ahora podremos meter el expediente completo a la
	 * ejecución de un proceso […] en el canvas desplegaremos todos los tipos documentales, y lo que se vierta dentro del canvas ahora básicamente
	 * será el delineador de cuáles son las entradas de un proceso». Hasta ese día el proceso llevaba un «Corre sobre» (un tipo de expediente
	 * virtual) que era obligatorio para guardar y filtraba la paleta por su esquema; ya no hay selector, ni filtro, ni nodo «fuera del esquema».
	 * La paleta ofrece todos los tipos documentales ACTIVOS y los nodos que se ponen declaran qué documentos necesita el proceso del expediente.
	 *
	 * ## Guardar
	 *
	 * Un proceso se guarda cuando la persona lo pide (botón o Ctrl+S) y vive en el servidor, por organización (`procesos.svelte.ts`).
	 * «Cambios sin guardar» sale de comparar la huella del dibujo y el nombre de ahora con los del último guardado (`hayCambiosSinGuardar`): mover
	 * un nodo y devolverlo, o escribir un valor y borrarlo, deja el proceso como estaba, sin cambios. Un proceso viejo que traiga
	 * `tipoExpedienteVirtualId` en sus `datos` se abre igual: ese campo se ignora y no cuenta (`abrirProceso`). Qué le falta a un proceso para
	 * guardarse lo decide `faltaParaGuardar` (nombre, al menos un tipo documental, que ninguno haya dejado de estar activo y el Resultado). Antes de
	 * perder cambios —empezar uno nuevo, abrir otro o salir de la página— se pregunta. Si otra persona guardó el mismo proceso antes, no se pisa: se
	 * ofrece cargar lo suyo.
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
		type OnBeforeDelete,
		type OnBeforeReconnect,
		type OnConnectEnd,
		type OnReconnect,
		type OnReconnectEnd,
		type OnReconnectStart
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import { beforeNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, setContext, tick, untrack } from 'svelte';

	import BarraDeProceso from '$lib/components/reglas/BarraDeProceso.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import CableDeProceso from '$lib/components/reglas/CableDeProceso.svelte';
	import NodoConstante from '$lib/components/reglas/NodoConstante.svelte';
	import NodoOperador from '$lib/components/reglas/NodoOperador.svelte';
	import NodoResultado from '$lib/components/reglas/NodoResultado.svelte';
	import NodoTipoDocumental from '$lib/components/reglas/NodoTipoDocumental.svelte';
	import NodoValorFinal from '$lib/components/reglas/NodoValorFinal.svelte';
	import PaletaDeTipos from '$lib/components/reglas/PaletaDeTipos.svelte';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import {
		CLAVE_VEREDICTOS,
		ID_NODO_RESULTADO,
		MIME_CONSTANTE,
		MIME_OPERADOR,
		MIME_RESULTADO,
		MIME_TIPO_DOCUMENTAL,
		MIME_VALOR_FINAL,
		NODO_CONSTANTE,
		NODO_OPERADOR,
		NODO_RESULTADO,
		NODO_TIPO,
		NODO_VALOR_FINAL,
		TEXTOS_DEL_RESULTADO,
		abrirProceso,
		entradasDeProcesoNuevo,
		evaluar,
		faltaParaGuardar,
		hayCambiosSinGuardar,
		huellaDelDibujo,
		estadoDeTipoEnLienzo,
		idNodoDeTipo,
		motivoDeRechazo,
		numeroDeOperador,
		operadorDe,
		posicionLibre,
		resultadoConectado,
		serializarDibujo,
		usosDeNodo,
		type ClaveOperador,
		type Conexion,
		type DatosNodoConstante,
		type DatosNodoOperador,
		type DatosNodoResultado,
		type DatosNodoTipo,
		type DatosNodoValorFinal,
		type FotoDeProceso
	} from '$lib/reglas/reglas';
	import { avisarExito } from '$lib/state/avisos.svelte';
	import { estadoBiblioteca, tiposDocumentales } from '$lib/state/configuracion.svelte';
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

	/** Todos los cables son el de `CableDeProceso`: se arrastran de un extremo y se quitan de un clic. No se guarda (`serializarDibujo` solo lleva extremos). */
	const edgeTypes = { cable: CableDeProceso };

	const nodeTypes = {
		[NODO_TIPO]: NodoTipoDocumental,
		[NODO_OPERADOR]: NodoOperador,
		[NODO_CONSTANTE]: NodoConstante,
		[NODO_VALOR_FINAL]: NodoValorFinal,
		[NODO_RESULTADO]: NodoResultado
	};

	// El estado de CADA regla y el valor de las que entregan uno, lo que entrega cada valor final y con qué palabra termina el proceso, calculados
	// una vez para todo el grafo: una regla que depende de otra tiene que ver lo actual de ésa, y cada nodo no puede recorrer el grafo por su cuenta.
	const evaluacion = $derived(evaluar(nodes, edges, tiposDocumentales));
	setContext(CLAVE_VEREDICTOS, {
		get todos() {
			return evaluacion.estados;
		},
		get valores() {
			return evaluacion.valores;
		},
		get finales() {
			return evaluacion.finales;
		},
		get resultado() {
			return evaluacion.resultado;
		}
	});

	/** Los tipos que ya tienen su nodo. */
	const enLienzo = $derived(
		new Set(nodes.flatMap((n) => (n.type === NODO_TIPO ? [(n.data as DatosNodoTipo).tipoId] : [])))
	);
	/** El proceso termina con UNA palabra: si ya tiene su nodo de resultado, la paleta no ofrece otro. */
	const hayResultado = $derived(nodes.some((n) => n.type === NODO_RESULTADO));
	/** El proceso necesita al menos un tipo documental: son sus entradas. Sin ninguno no tiene sobre qué correr (NEX-529 y NEX-532). */
	const hayTipoDocumental = $derived(nodes.some((n) => n.type === NODO_TIPO));

	// ── Solo los tipos documentales ACTIVOS se pueden usar (2026-11-05, Moibe: «no deberíamos poder usar en el canvas los tipos documentales
	// que no estén activos»). La paleta ya solo ofrece activos; faltaba lo demás: soltar uno que no lo es, conectar desde un nodo cuyo tipo
	// dejó de estar activo (se archivó, volvió a borrador con «Crear nueva versión» o lo borraron) y guardar un proceso que lo trae. Un nodo
	// así no se quita solo —describe lo que el proceso tenía—: se marca, no deja conectarlo ni guardar, y se quita o se vuelve a activar el
	// tipo. Mientras la biblioteca no está leída no se sabe nada de nadie, así que no se marca ni se rechaza nada.
	const ESTADO_EN_PALABRAS = { borrador: 'está en borrador', archivado: 'está archivado', ausente: 'ya no existe' } as const;
	/** Los nodos de tipo documental cuyo tipo NO está activo, con su nombre y por qué. */
	const tiposNoActivos = $derived(
		!estadoBiblioteca.cargada
			? []
			: nodes.flatMap((n) => {
					if (n.type !== NODO_TIPO) return [];
					const tipoId = (n.data as DatosNodoTipo).tipoId;
					const estado = estadoDeTipoEnLienzo(tiposDocumentales, tipoId);
					return estado === 'activo' ? [] : [{ nodoId: n.id, nombre: nombreDeTipoDocumental(tipoId), estado }];
				})
	);

	type Posicion = { x: number; y: number };

	/**
	 * Lo que mide un nodo nuevo mientras no se ha pintado: todos son de 288 px de ancho y nacen cortos. Los que ya están usan lo que midió la librería.
	 * Un nodo nuevo se corre a la derecha de lo que taparía (NEX-540); mover uno que ya está puesto no pasa por aquí.
	 */
	const TAMANO_DE_NODO_NUEVO = { ancho: 288, alto: 160 };
	function libre(posicion: Posicion): Posicion {
		const ocupadas = nodes.map((n) => ({
			x: n.position.x,
			y: n.position.y,
			ancho: n.measured?.width ?? n.width ?? TAMANO_DE_NODO_NUEVO.ancho,
			alto: n.measured?.height ?? n.height ?? TAMANO_DE_NODO_NUEVO.alto
		}));
		return posicionLibre(posicion, TAMANO_DE_NODO_NUEVO, ocupadas);
	}

	/** Pone el tipo en el lienzo en `posicion` (coordenadas del lienzo). Si ya está, no lo duplica: lo enfoca. */
	function agregar(tipoId: string, posicion: Posicion) {
		// La paleta solo ofrece activos, pero lo que se suelta llega por el arrastre: se comprueba aquí también.
		const estado = estadoDeTipoEnLienzo(tiposDocumentales, tipoId);
		if (estado !== 'activo') {
			// Un id que nunca existió (o es de otra organización: una dirección armada a mano) no es «ya no existe»: no se le puede decir el nombre.
			avisar(
				estado === 'ausente'
					? 'Uno de los tipos documentales pedidos no existe en tu organización, así que no se puso en el lienzo.'
					: `«${nombreDeTipoDocumental(tipoId)}» ${ESTADO_EN_PALABRAS[estado]}: en un proceso solo se pueden usar tipos documentales activos. Se activan en Configuración › Tipos documentales.`
			);
			return;
		}
		const id = idNodoDeTipo(tipoId);
		if (nodes.some((n) => n.id === id)) {
			fitView({ nodes: [{ id }], duration: 300, maxZoom: 1 });
			return;
		}
		// Se registra la versión del tipo con la que se arma el proceso (NEX-542); si la biblioteca aún no lo trae, queda sin registrar.
		const version = tiposDocumentales.find((t) => t.id === tipoId)?.version;
		const nuevo: Node<DatosNodoTipo> = { id, type: NODO_TIPO, position: libre(posicion), data: { tipoId, campos: [], ...(version === undefined ? {} : { version }) } };
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
			position: libre(posicion),
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
			position: libre(posicion),
			data: { familia: 'texto', valor: '' }
		};
		nodes = [...nodes, nuevo];
	}

	/** Un valor final se puede poner las veces que haga falta (cada uno es un dato de la lista de la corrida) y su número no se reutiliza. */
	let valoresFinalesPuestos = 0;
	function agregarValorFinal(posicion: Posicion) {
		valoresFinalesPuestos += 1;
		const nuevo: Node<DatosNodoValorFinal> = {
			id: `valor-final-${valoresFinalesPuestos}`,
			type: NODO_VALOR_FINAL,
			position: libre(posicion),
			data: { nombre: '', a: '' }
		};
		nodes = [...nodes, nuevo];
	}

	/** El resultado es UNO por proceso: si ya está, no se duplica, se enfoca (como un tipo documental). */
	function agregarResultado(posicion: Posicion) {
		if (nodes.some((n) => n.type === NODO_RESULTADO)) {
			const existente = nodes.find((n) => n.type === NODO_RESULTADO);
			if (existente) fitView({ nodes: [{ id: existente.id }], duration: 300, maxZoom: 1 });
			return;
		}
		const nuevo: Node<DatosNodoResultado> = { id: ID_NODO_RESULTADO, type: NODO_RESULTADO, position: libre(posicion), data: { ...TEXTOS_DEL_RESULTADO } };
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
	function agregarValorFinalAlCentro() {
		const posicion = alCentro();
		if (posicion) agregarValorFinal(posicion);
	}
	function agregarResultadoAlCentro() {
		const posicion = alCentro();
		if (posicion) agregarResultado(posicion);
	}

	function alPasarPorEncima(e: DragEvent) {
		const tipos = e.dataTransfer?.types;
		const cosas = [MIME_TIPO_DOCUMENTAL, MIME_OPERADOR, MIME_CONSTANTE, MIME_VALOR_FINAL, MIME_RESULTADO];
		if (!cosas.some((mime) => tipos?.includes(mime))) return;
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
			return;
		}
		if (e.dataTransfer?.getData(MIME_VALOR_FINAL)) {
			e.preventDefault();
			agregarValorFinal(posicion);
			return;
		}
		if (e.dataTransfer?.getData(MIME_RESULTADO)) {
			e.preventDefault();
			agregarResultado(posicion);
		}
	}

	// ── Conexiones ───────────────────────────────────────────────────────────

	/** El cable que se está arrastrando de un extremo (si lo hay): mientras se mueve, no cuenta para decidir si el nuevo lugar le cabe. */
	let cableEnMovimiento: Edge | null = null;
	const rechazo = (c: Conexion) => {
		// Un campo de un tipo que no está activo no se conecta a nada (ver «Solo los tipos documentales ACTIVOS»). Los cables que ya traía no se tocan.
		const noActivo = tiposNoActivos.find((t) => t.nodoId === c.source);
		if (noActivo) return `«${noActivo.nombre}» ${ESTADO_EN_PALABRAS[noActivo.estado]}: sus campos no se pueden conectar. Quítalo del proceso o vuelve a activar el tipo.`;
		return motivoDeRechazo(c, nodes, cableEnMovimiento ? edges.filter((e) => e.id !== cableEnMovimiento!.id) : edges, tiposDocumentales);
	};

	/** Cada entrada de un operador recibe UN campo: al conectar otro, el anterior se va. */
	function alConectar() {
		edges = edges.filter(
			(e, i, todas) => todas.findLastIndex((o) => o.target === e.target && o.targetHandle === e.targetHandle) === i
		);
	}

	const alEmpezarAMoverCable: OnReconnectStart = (_evento, cable) => {
		cableEnMovimiento = cable;
	};

	/** Un cable movido cambia de extremos, así que su id (que lleva los nombres de esos extremos) se rehace: si no, volver a conectar lo de antes repetiría el id. */
	const alRehacerCable: OnBeforeReconnect = (nuevo) => ({
		...nuevo,
		id: `xy-edge__${nuevo.source}${nuevo.sourceHandle ?? ''}-${nuevo.target}${nuevo.targetHandle ?? ''}`
	});

	/** Cada entrada recibe UN campo, también al mover un cable: el que estaba ahí se va y se queda el que se acaba de poner. */
	const alMoverCable: OnReconnect = (_viejo, conexion) => {
		edges = edges.filter((e) => !(e.target === conexion.target && e.targetHandle === conexion.targetHandle && !(e.source === conexion.source && e.sourceHandle === conexion.sourceHandle)));
	};

	/** Soltar el extremo en el VACÍO desconecta el cable. Soltarlo sobre un punto que no lo acepta lo deja donde estaba (y `alTerminarConexion` dice por qué). */
	const alSoltarCable: OnReconnectEnd = (_evento, cable, _tipo, estado) => {
		cableEnMovimiento = null;
		if (estado.isValid || estado.toHandle) return;
		edges = edges.filter((e) => e.id !== cable.id);
	};

	let aviso = $state('');
	let relojAviso: ReturnType<typeof setTimeout> | undefined;
	/** Mientras se siembran los tipos del alta, los avisos se SUMAN (si varios tipos de la dirección no sirven, se dicen todos, no solo el último). */
	let sumandoAvisos = false;
	function avisar(texto: string) {
		aviso = sumandoAvisos && aviso && !aviso.includes(texto) ? `${aviso} ${texto}` : texto;
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

	const nombreDeTipoDocumental = (tipoId: string) => tiposDocumentales.find((t) => t.id === tipoId)?.nombre ?? 'Tipo documental no disponible';

	/** Lo último que se guardó (o se abrió): con esto se compara para saber si hay cambios. */
	let guardado = $state<FotoDeProceso>({ huella: HUELLA_VACIA, nombre: '' });
	let guardando = $state(false);

	/** Se está leyendo el proceso del servidor (solo cuando la dirección trae el id de uno guardado). */
	let cargandoProceso = $state(untrack(() => procesoDeEntrada !== 'nuevo'));
	/** Qué impide abrirlo: «no existe» (otra persona lo borró, o es de otra organización: no se distingue) o la lectura falló. */
	let noSePudoAbrir = $state<{ titulo: string; mensaje: string } | null>(null);

	const huella = $derived(huellaDelDibujo(serializarDibujo(nodes, edges)));
	const sucio = $derived(hayCambiosSinGuardar(existe, { huella, nombre, hayDibujo: nodes.length > 0 || edges.length > 0 }, guardado));
	const estadoDeProceso = $derived<EstadoDeProceso>(existe ? (sucio ? 'cambios' : 'guardado') : sucio ? 'sin_guardar' : 'nuevo');
	// Qué se exige para guardar lo decide `faltaParaGuardar`: el nombre, al menos un tipo documental en el lienzo (NEX-529, 2026-11-04), que ningún nodo
	// sea de un tipo que no esté activo (2026-11-05) y el RESULTADO (Moibe, 2026-11-03: «sí, que sea obligatorio el Resultado»). De este último solo se
	// exige que el nodo exista. El back NO exige nada de esto (activar o desactivar desde la lista guarda el proceso entero y no debe fallar en los de
	// antes), y la ejecución se niega a correr uno sin Resultado conectado. Ya NO se exige un tipo de expediente virtual (Moibe, 2026-11-05).
	const puedeGuardar = $derived(
		sucio && faltaParaGuardar({ nombre, hayTipoDocumental, tiposNoActivos: tiposNoActivos.length, hayResultado }) === null
	);
	/** El nombre que el servidor rechazó por repetido en la organización (409 `ya_existe`): la barra lo dice bajo el campo mientras siga escrito. */
	let nombreOcupado = $state<string | null>(null);
	/** La paleta, para señalarle a la persona dónde está el Resultado cuando «Guardar» lo echa de menos. */
	let paleta = $state<ReturnType<typeof PaletaDeTipos>>();

	/** Pone un proceso del servidor en el lienzo. */
	async function abrir(p: ProcesoGuardado) {
		// `foto` se saca de lo que quedó en el lienzo, no de lo que mandó el servidor: si algo no se pudo abrir (un operador que ya no existe) el
		// proceso no debe aparecer con cambios sin que nadie los haya hecho. Un `tipoExpedienteVirtualId` viejo en `p.datos` no entra a nada.
		const { dibujo, foto } = abrirProceso(p.datos);
		clasesVistas.clear();
		nodes = dibujo.nodes;
		edges = dibujo.edges;
		operadoresPuestos = dibujo.operadoresPuestos;
		constantesPuestas = dibujo.constantesPuestas;
		valoresFinalesPuestos = dibujo.valoresFinalesPuestos;
		procesoId = p.id;
		revision = p.revision;
		existe = true;
		nombre = p.datos.nombre;
		descripcion = p.datos.descripcion ?? '';
		activo = procesoActivo(p);
		guardado = foto;
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
		| { tipo: 'quitar'; mensaje: string }
		| { tipo: 'error'; titulo: string; mensaje: string };
	let dialogo = $state<Dialogo>(null);
	const dialogoDeError = $derived(dialogo?.tipo === 'error' ? dialogo : null);
	const dialogoDeQuitar = $derived(dialogo?.tipo === 'quitar' ? dialogo : null);

	/** Quien espera la respuesta del aviso de «quitar»: la librería no borra hasta que esto se resuelva con `true`. */
	let resolverQuitar: ((quitar: boolean) => void) | null = null;
	const contestarQuitar = (quitar: boolean) => {
		const r = resolverQuitar;
		resolverQuitar = null;
		dialogo = null;
		r?.(quitar);
	};

	/**
	 * Antes de quitar nodos del lienzo (la X del nodo, Suprimir o Retroceso) (NEX-543): un tipo documental que ya está en uso —tiene cables— pide
	 * confirmación y dice qué reglas se quedan sin esa entrada. Uno suelto, o cualquier otro nodo, se quita de una vez, como siempre.
	 */
	const alAntesDeQuitar: OnBeforeDelete = async ({ nodes: porQuitar }) => {
		const idsPorQuitar = new Set(porQuitar.map((n) => n.id));
		// Un cable hacia otro nodo que también se va no es una pérdida que haya que avisar.
		const cablesQueQuedan = edges.filter((e) => !idsPorQuitar.has(e.target));
		const enUso = porQuitar
			.filter((n) => n.type === NODO_TIPO)
			.map((n) => ({ nombre: nombreDeTipoDocumental((n.data as DatosNodoTipo).tipoId), usos: usosDeNodo(n.id, nodes, cablesQueQuedan) }))
			.filter((x) => x.usos.length > 0);
		if (enUso.length === 0) return true;
		const usosEnTexto = (usos: { destino: string; entrada: string | null }[]) =>
			usos.map((u) => (u.entrada ? `${u.destino} (${u.entrada})` : u.destino)).join(', ');
		const mensaje =
			enUso.length === 1
				? `Vas a quitar «${enUso[0].nombre}», que está conectado a ${usosEnTexto(enUso[0].usos)}. Se borrarán esas conexiones y esas reglas se quedarán sin esa entrada.`
				: `Vas a quitar ${enUso.map((x) => `«${x.nombre}» (conectado a ${usosEnTexto(x.usos)})`).join(' y ')}. Se borrarán esas conexiones y esas reglas se quedarán sin esas entradas.`;
		return new Promise<boolean>((resolver) => {
			resolverQuitar?.(false);
			resolverQuitar = resolver;
			dialogo = { tipo: 'quitar', mensaje };
		});
	};

	/** La dirección ya dice el id del proceso (después de su primer guardado), no `nuevo`. */
	let direccionAlDia = false;

	async function guardar() {
		if (!puedeGuardar || guardando) return;
		guardando = true;
		const limpio = nombre.trim();
		const dibujo = serializarDibujo(nodes, edges);
		const r = await guardarProceso(procesoId, existe ? revision : 0, { nombre: limpio, descripcion, activo, ...dibujo });
		guardando = false;
		if (r.ok) {
			revision = r.proceso.revision;
			existe = true;
			nombre = limpio;
			// Lo que se guardó es lo que se mandó: si durante el guardado se tocó algo, eso sigue siendo un cambio.
			guardado = { huella: huellaDelDibujo(dibujo), nombre: limpio };
			// Guardar solo exige que el nodo Resultado exista; sin una regla conectada a él el proceso queda guardado pero no se puede ejecutar: se dice (2026-11-06).
			avisarExito(
				'Proceso guardado',
				resultadoConectado(dibujo) ? `«${limpio}» quedó guardado.` : `«${limpio}» quedó guardado, pero todavía no se puede ejecutar: conecta una regla a su Resultado.`
			);
			// Un proceso que nació en `/motor-de-reglas/nuevo` ya tiene su dirección: se cambia la barra del navegador SIN navegar (recargar o
			// compartir el enlace abre ESTE proceso, y no un lienzo en blanco).
			if (esNuevo && !direccionAlDia) {
				direccionAlDia = true;
				replaceState(`/motor-de-reglas/${encodeURIComponent(procesoId)}`, {});
			}
		} else if (r.codigo === 'ya_existe') {
			nombreOcupado = limpio;
			document.getElementById('nombre-del-proceso')?.focus();
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

	/** «Guardar y salir» (2026-11-04, Moibe): guarda y, solo si quedó guardado, sigue a donde iba. Si falla, el error se ve y la persona se queda. */
	async function guardarYSalir() {
		const despues = dialogo?.tipo === 'cambios' ? dialogo.despues : despuesPendiente;
		dialogo = null;
		await guardar();
		if (existe && !sucio) despues?.();
	}
	/** Copia de a dónde iba, porque el diálogo se limpia al cerrarse antes de que corra `guardarYSalir`. */
	let despuesPendiente: (() => void) | null = null;
	$effect(() => {
		if (dialogo?.tipo === 'cambios') despuesPendiente = dialogo.despues;
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
	// El alta (2026-11-06): los tipos que eligió la persona antes de llegar, por poner en el lienzo. Esperan a que la biblioteca esté leída: sin ella
	// `agregar` no sabe si un tipo está activo y lo rechazaría. Se vacía al sembrar, así que solo se siembra una vez.
	let tiposPorSembrar = $state<string[]>([]);
	$effect(() => {
		if (tiposPorSembrar.length === 0 || !estadoBiblioteca.cargada) return;
		const tipos = tiposPorSembrar;
		tiposPorSembrar = [];
		untrack(() => void sembrar(tipos));
	});
	/** Un nodo por tipo, en una columna a la izquierda (el lienzo corre cada uno a la derecha de lo que taparía), y la vista ajustada a ellos.
	 *  240 px entre uno y otro: un nodo sin campos mide ~192 y con 190 quedaban pegados y solapados (lo vio la prueba en navegador, 2026-11-06). */
	async function sembrar(tipos: string[]) {
		aviso = '';
		sumandoAvisos = true;
		tipos.forEach((tipoId, i) => agregar(tipoId, { x: 40, y: 40 + i * 240 }));
		sumandoAvisos = false;
		await tick();
		fitView({ padding: 0.15, maxZoom: 1, duration: 0 });
	}

	onMount(() => {
		reiniciarProcesos();
		if (esNuevo) {
			const entradas = entradasDeProcesoNuevo(page.url.searchParams);
			if (entradas.nombre) nombre = entradas.nombre;
			tiposPorSembrar = entradas.tipos;
		}
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
	estado={estadoDeProceso}
	{guardando}
	{puedeGuardar}
	puedeBorrar={existe}
	tieneResultado={hayResultado}
	tieneDocumento={hayTipoDocumental}
	tiposNoActivos={tiposNoActivos.map((t) => t.nombre)}
	{nombreOcupado}
	alGuardar={guardar}
	alBorrar={() => (dialogo = { tipo: 'borrar' })}
	alFaltaResultado={() => void paleta?.mostrarResultado()}
	alFaltaDocumento={() => void paleta?.mostrarTipos()}
	alFaltaActivo={() => {
		const primero = tiposNoActivos[0];
		if (primero) fitView({ nodes: [{ id: primero.nodoId }], duration: 300, maxZoom: 1 });
	}}
/>

<div
	data-testid="lienzo-reglas"
	class="lienzo relative mt-4 flex h-[calc(100vh-22rem)] min-h-120 overflow-hidden rounded-xl border border-border bg-card"
>
	<PaletaDeTipos
		bind:this={paleta}
		{enLienzo}
		{hayResultado}
		alAgregar={agregarAlCentro}
		alAgregarOperador={agregarOperadorAlCentro}
		alAgregarConstante={agregarConstanteAlCentro}
		alAgregarValorFinal={agregarValorFinalAlCentro}
		alAgregarResultado={agregarResultadoAlCentro} />

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
			{edgeTypes}
			defaultEdgeOptions={{ type: 'cable' }}
			colorMode={tema.oscuro ? 'dark' : 'light'}
			deleteKey={['Backspace', 'Delete']}
			minZoom={0.05}
			maxZoom={4}
			onbeforedelete={alAntesDeQuitar}
			isValidConnection={(c) => rechazo(c) === null}
			onconnect={alConectar}
			onconnectend={alTerminarConexion}
			onreconnectstart={alEmpezarAMoverCable}
			onbeforereconnect={alRehacerCable}
			onreconnect={alMoverCable}
			onreconnectend={alSoltarCable}
			proOptions={{ hideAttribution: true }}
		>
			<Background variant={BackgroundVariant.Dots} gap={20} />
			<Controls showLock={false} />
			<!-- El mapa más chico y translúcido (2026-11-03, Moibe: «se encima»): con el tamaño de fábrica tapaba la esquina de lo que hubiera ahí y se leía como otro nodo. -->
			<MiniMap pannable zoomable width={150} height={96} bgColor="color-mix(in oklab, var(--card) 75%, transparent)" class="overflow-hidden rounded-lg border border-border opacity-90" />
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
	accionExtra={{
		etiqueta: 'Guardar y salir',
		deshabilitado: !puedeGuardar,
		titulo: puedeGuardar ? undefined : 'Al proceso le falta algo para guardarse (nombre, un tipo documental activo o el Resultado): sigue editando para completarlo',
		alPulsar: guardarYSalir
	}}
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
	abierto={dialogoDeQuitar !== null}
	titulo="Quitar del lienzo"
	mensaje={dialogoDeQuitar?.mensaje ?? ''}
	etiquetaConfirmar="Quitar y desconectar"
	etiquetaCancelar="Cancelar"
	onConfirmar={() => contestarQuitar(true)}
	onCerrar={() => {
		if (dialogo?.tipo === 'quitar') contestarQuitar(false);
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
