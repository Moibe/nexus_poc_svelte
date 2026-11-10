<script lang="ts">
	/**
	 * El MÓDULO DE CONFIGURACIÓN: la biblioteca de tipos documentales de la organización y todo lo que cuelga de ella (el
	 * asistente de alta y los documentos de ejemplo con sus recortes).
	 *
	 * Sin «Calibrar» (2026-11-06, Moibe: «quiero quitar el feature de calibrar en los modelos documentales, eso implica que ya no se requiere
	 * para activarlos»): hasta ese día un tipo activo tenía además un botón «Calibrar» —generar prompts, correrlos contra un documento y calificar
	 * sus campos— y no extraía hasta terminarlo (`calibradoEn`). Se quitó todo eso: activar el tipo ya basta. Lo que se queda es «Ejemplo
	 * documental» (los documentos de ejemplo con sus recortes), que no era requisito de nada. Para recuperar la pantalla de prompts:
	 * `git show 4ac2a62:src/lib/components/config/ModuloConfiguracion.svelte` y sus tres componentes (`GenerarPrompts`, `DocumentoParaPrompts` y
	 * `RevisionPrompt`, en la misma carpeta).
	 *
	 * Hasta el 2026-10-25 esto era `ConfigSheet.svelte`, un panel lateral que se abría encima de cualquier pantalla desde el
	 * engrane. Ahora el engrane lleva a `/configuracion`, un mosaico con las secciones que se configuran, y esta es la de
	 * «Tipos documentales»: vive en `/configuracion/tipos-documentales` y se pinta como una tarjeta de página. Por dentro no
	 * cambió nada; lo único que se fue con el panel es que Escape y el clic fuera ya no suben de nivel.
	 *
	 * `open` se conserva tal cual (lo apaga la X desde la Biblioteca, y lo miran los efectos de limpieza): la página que lo
	 * monta lo observa y, cuando se apaga, regresa al mosaico. Así la salida del módulo sigue siendo una sola.
	 */
	import { tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button/index.js';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import SetupIcon from '$lib/components/icons/SetupIcon.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import Check from '@lucide/svelte/icons/check';
	import Save from '@lucide/svelte/icons/save';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import Minus from '@lucide/svelte/icons/minus';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import AlertCircle from '@lucide/svelte/icons/circle-alert';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import BadgeAlert from '@lucide/svelte/icons/badge-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Plus from '@lucide/svelte/icons/plus';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Clock from '@lucide/svelte/icons/clock';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import PowerOff from '@lucide/svelte/icons/power-off';
	import Scissors from '@lucide/svelte/icons/scissors';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Info from '@lucide/svelte/icons/info';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import CargarDocumentoEjemplo from './CargarDocumentoEjemplo.svelte';
	import RecortarEjemploCampo from './RecortarEjemploCampo.svelte';
	import DocumentoConRecortes from './DocumentoConRecortes.svelte';
	import RecorteGuardado from './RecorteGuardado.svelte';
	import RecomendacionEjemplos from './RecomendacionEjemplos.svelte';
	import SubcamposGrupo from './SubcamposGrupo.svelte';
	import GenerarCamposDesdeDocumento from './GenerarCamposDesdeDocumento.svelte';
	import ProbarExtraccion from './ProbarExtraccion.svelte';
	import HistorialVersiones from './HistorialVersiones.svelte';
	import { formatearTamano } from '$lib/state/bandeja.svelte';
	import { cargarProcesos, estadoProcesos, procesosQueUsanElTipo } from '$lib/state/procesos.svelte';
	import type { TipoDocumentalGuardado, Recorte, CampoPropuesto } from '$lib/state/configuracion.svelte';
	import {
		borradorTipoDocumental,
		agregarCampoEnCaptura,
		agregarCamposPropuestos,
		ejemplosDeTipo,
		ejemplosDelPaso1Actuales,
		fijarEjemplosDelPaso1,
		recordarEjemplos,
		agregarValorLista,
		alCambiarTipoDato,
		alternarEjemploDocumental,
		borrarDocumentoEjemplo,
		borrarRecorteEjemplo,
		campoCompleto,
		campoIntacto,
		activarTipoDocumental,
		crearNuevaVersion,
		cancelarNuevaVersion,
		desactivarTipoDocumental,
		paginaDeRecorte,
		esPdfSinOriginal,
		estadoBiblioteca,
		cargarBiblioteca,
		reconocerFallaDeGuardado,
		eliminarTipoDocumental,
		reordenarTipoDocumental,
		cargarTipoDocumental,
		etiquetaVersion,
		etiquetaVertical,
		colorParaCampo,
		guardarTipoDocumental,
		irAPaso,
		pasoNavegable,
		pedidoDeConfiguracion,
		tiposDocumentales,
		VERTICALES,
		guardarBorrador,
		limpiarBorrador,
		nombreCampoDuplicado,
		tipoConMismoNombre,
		quitarCampo,
		quitarValorLista,
		sincronizarTipoGuardado,
		valorListaDuplicado,
		CARDINALIDADES,
		REGLAS_TRANSFORMACION,
		TIPOS_DE_DATO,
		UMBRALES_CONFIANZA
	} from '$lib/state/configuracion.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// Cada vez que se abre, se vuelve a leer la biblioteca del servidor: otra persona de la organización pudo crear, editar o
	// borrar tipos desde la última vez. Lo que esta pestaña tenga por enviar se manda ANTES de leer, y si algo cambia mientras
	// se pide, no se pisa (ver `cargarBiblioteca`).
	$effect(() => {
		if (open) untrack(() => void cargarBiblioteca({ refrescar: true }));
	});

	// El módulo tiene tres vistas:
	//  - 'biblioteca': la pantalla de entrada, con el listado de modelos (hoy
	//    vacío) y el botón para arrancar uno nuevo.
	//  - 'wizard': el alta de tipo documental en 3 pasos.
	//  - 'calibracion': "Ejemplo documental" del menú de la tarjeta (2026-09-02,
	//    sin frame de Figma — se construyó desde una captura): los documentos de
	//    ejemplo del tipo y el recorte de cada campo sobre ellos. La clave conserva
	//    el nombre de cuando la pantalla se llamaba «Calibración» (ya no lo dice).
	//    La vista 'prompts' (la revisión de los prompts generados, 2026-09-06) se
	//    quitó el 2026-11-06 junto con el botón «Calibrar».
	// Se entra siempre por 'biblioteca'.
	let vista = $state<'biblioteca' | 'wizard' | 'calibracion'>('biblioteca');
	let avisoExito = $state(false);
	// Si el wizard que está abierto es un ALTA o la edición de un modelo que ya
	// existía. No se puede deducir al final: el tipo documental entra a la
	// biblioteca al salir del PASO 1, así que para cuando se llega al 3 el
	// borrador ya trae `idGuardado` puesto en los dos casos. El único momento en
	// que se distinguen es al ENTRAR, que es donde se marca.
	let altaEnCurso = $state(false);
	// La activación en vuelo (id del tipo) y su error, si lo hubo. Vive aquí y
	// no en el state global porque es efímero de esta pantalla: un spinner y un
	// letrero, no datos del modelo.
	let activandoId = $state<string | null>(null);
	// El aviso rojo lo comparten activar y eliminar — son la misma clase de
	// evento ("una acción sobre el modelo falló") y un solo letrero evita tener
	// dos bloques de markup casi idénticos. El título SÍ cambia según cuál de
	// las dos fue: da contexto sin tener que repetirlo en el cuerpo.
	let tituloError = $state('');
	let errorActivacion = $state('');

	// El campo que se está por quitar, mientras la confirmación está abierta.
	// Se guarda el objeto y no solo el id porque el diálogo necesita el NOMBRE:
	// un "¿seguro?" que no dice qué se va a borrar obliga a cerrarlo para ir a
	// mirar, que es justo lo que la confirmación venía a evitar.
	let campoAQuitar = $state<{ id: string; nombre: string } | null>(null);

	function confirmarQuitarCampo() {
		if (campoAQuitar) quitarCampo(campoAQuitar.id);
		campoAQuitar = null;
	}

	// El recorte que se está por quitar en Calibración, mientras la
	// confirmación está abierta: dejar un campo sin recorte asignado es una
	// decisión que vale la pena confirmar, a diferencia de simplemente
	// rehacerlo (que ya cubre "Editar" sin pasar por aquí). Necesita el id
	// de la instancia de documento, no solo el del tipo: desde el 2026-09-04
	// un tipo puede tener VARIAS, cada una con sus propios recortes.
	let recorteAQuitar = $state<{
		idTipo: string;
		idDocumento: string;
		nombreCampo: string;
	} | null>(null);

	function confirmarQuitarRecorte() {
		if (recorteAQuitar) {
			borrarRecorteEjemplo(recorteAQuitar.idTipo, recorteAQuitar.idDocumento, recorteAQuitar.nombreCampo);
		}
		recorteAQuitar = null;
	}

	// Igual que arriba, pero para UNA instancia completa de documento de
	// ejemplo — con más razón todavía: se lleva en cascada los recortes de
	// TODOS los campos de ESA instancia, no solo el de uno. Guarda el id de
	// la instancia (no un booleano): desde el 2026-09-04 puede haber varias
	// a la vez, hay que saber cuál se está por borrar.
	let documentoAQuitar = $state<string | null>(null);

	function confirmarQuitarDocumentoEjemplo() {
		if (tipoEnCalibracion && documentoAQuitar) {
			borrarDocumentoEjemplo(tipoEnCalibracion.id, documentoAQuitar);
			// Si la instancia borrada era la seleccionada, la selección pasa a
			// la primera que quede (o a ninguna si ya no queda ninguna) — sin
			// esto, la pantalla se quedaría "mirando" un id que ya no existe.
			if (documentoSeleccionadoId === documentoAQuitar) {
				documentoSeleccionadoId = tipoEnCalibracion.documentosEjemplo[0]?.id ?? null;
			}
		}
		documentoAQuitar = null;
	}

	/** Cuántas instancias de documento de ejemplo (`documentosEjemplo`) se
	 *  recomienda tener antes de marcar un tipo como "listo" — copia tal cual
	 *  del mockup compartido. Un "ejemplo" es una INSTANCIA subida (ver
	 *  `documentosEjemplo` en configuracion.svelte.ts), tenga o no ya
	 *  recortes hechos sobre ella: el nombre que ya usa el propio estado
	 *  ("documentos de EJEMPLO") es lo que fija esta lectura. */
	const MINIMO_EJEMPLOS_RECOMENDADO = 3;

	// El tipo sobre el que se picó el switch mientras el aviso de "pocos
	// ejemplos" está abierto — se necesita el id (para activar) y el nombre
	// (si algún día el aviso lo muestra), igual que `campoAQuitar` de arriba.
	let tipoPocosEjemplos = $state<{ id: string; nombre: string } | null>(null);

	/** Onclick del switch "Ejemplo documental": apagarlo siempre es directo
	 *  (no hay nada que recomendar al quitar la marca de "listo"). Prenderlo
	 *  con menos de `MINIMO_EJEMPLOS_RECOMENDADO` instancias abre el aviso en
	 *  vez de activar de una vez — el usuario decide ahí si seguir o ir
	 *  primero a Calibración. */
	function intentarAlternarEjemploDocumental(tipo: TipoDocumentalGuardado) {
		const activando = !tipo.ejemploDocumental;
		if (activando && tipo.documentosEjemplo.length < MINIMO_EJEMPLOS_RECOMENDADO) {
			tipoPocosEjemplos = { id: tipo.id, nombre: tipo.nombre };
			return;
		}
		alternarEjemploDocumental(tipo.id, activando);
	}

	function confirmarActivacionConPocosEjemplos() {
		if (tipoPocosEjemplos) alternarEjemploDocumental(tipoPocosEjemplos.id, true);
		tipoPocosEjemplos = null;
	}

	function irACalibracionDesdeAviso() {
		if (tipoPocosEjemplos) abrirCalibracion(tipoPocosEjemplos.id);
		tipoPocosEjemplos = null;
	}

	// Si el formulario de "Nuevo campo de extracción" del paso 2 está abierto.
	// Cambio pedido el 2026-09-03: antes quedaba SIEMPRE visible y "Agregar
	// otro campo" guardaba Y lo dejaba listo para el siguiente, dos cosas a la
	// vez bajo un solo botón — ambiguo. Ahora "Guardar" hace SOLO eso: el
	// campo se guarda y el formulario se oculta; para agregar otro hay que
	// picar el botón "Agregar campo" que aparece en su lugar. Vive aquí, no en
	// `borrador` (persistido): es un estado de la PANTALLA, no del dato.
	//
	// Arranca en `true` porque ese es el estado real al entrar a un alta
	// nueva (sin campos, nada que mostrar salvo el formulario) — las tres
	// puertas de entrada al wizard (`nuevoTipoDocumental`, `abrirTipoDocumental`,
	// `iniciarNuevaVersion`) lo vuelven a fijar explícitamente según si el
	// tipo que se abre ya trae campos o no.
	let mostrarFormularioCampo = $state(true);

	/** "Guardar" del formulario de captura del paso 2: guarda el campo Y
	 *  oculta el formulario (ver `mostrarFormularioCampo`). `agregarCampoEnCaptura`
	 *  ya deja `campoEnCaptura` en blanco, así que reabrirlo con "Agregar
	 *  campo" siempre arranca limpio. */
	function guardarCampoEnCaptura() {
		agregarCampoEnCaptura();
		mostrarFormularioCampo = false;
	}

	// «Generar a partir de un documento» (2026-10-29): el modal que propone campos leyendo un documento de ejemplo.
	let generarCamposAbierto = $state(false);
	/** Los documentos del paso 1 que se le ofrecen al modal (una copia al abrirlo: no cambian mientras está abierto). */
	let ejemplosParaGenerar = $state<File[]>([]);

	/** Lo que la persona eligió de la propuesta cae en «Campos agregados». Si el formulario de captura estaba en blanco se
	 *  oculta (como al guardar un campo), para que lo agregado quede a la vista; si tenía algo a medias, se respeta. */
	function agregarPropuestos(elegidos: CampoPropuesto[], ejemplos: File[]) {
		agregarCamposPropuestos(elegidos);
		// Los documentos con que se generaron los campos se recuerdan (SOLO en la memoria de la pestaña) para poder probar la extracción con ellos al activar el
		// tipo (`ProbarExtraccion`). El asistente guarda el tipo con cada cambio, pero se asegura aquí para tener su id.
		const id = guardarTipoDocumental() ?? borrador.idGuardado;
		if (id && ejemplos.length > 0) recordarEjemplos(id, ejemplos);
		generarCamposAbierto = false;
		if (campoIntacto(borrador.campoEnCaptura)) mostrarFormularioCampo = false;
	}

	// «Probar con documentos» (2026-11-07): el tipo cuya extracción se está probando (`null` = cerrado). Se abre desde el menú ⋮ de un tipo activo y, solo, justo
	// después de ACTIVAR un tipo cuyos campos se generaron con documentos de ejemplo que todavía están en memoria.
	let pruebaDeId = $state<string | null>(null);
	const tipoEnPrueba = $derived(pruebaDeId ? (tiposDocumentales.find((t) => t.id === pruebaDeId) ?? null) : null);

	// El tipo documental que se está por eliminar. Guarda también si TIENE un
	// procesador real (no si está "activo": un borrador nacido de una futura
	// `crearNuevaVersion()` podría conservar su `procesadorId` aunque ya no
	// esté activo — ver esa función). El diálogo de confirmación necesita
	// saberlo para advertir que esto también borra el Custom Extractor en
	// Document AI — omitir esa advertencia cuando sí aplica sería dejar que
	// alguien destruya un recurso real de GCP sin haberlo sabido de antemano.
	//
	// Desde el 2026-11-04 «Borrar» también se ofrece en un tipo ACTIVO (con su
	// procesador), así que esto ya no es casi siempre `false`: el diálogo avisa.
	let tipoAEliminar = $state<{ id: string; nombre: string; tieneProcesador: boolean } | null>(
		null
	);
	// El borrado en vuelo. Puede tardar unos segundos (borra también el
	// dataset en Google), así que la tarjeta necesita mostrar algo mientras
	// tanto — no es instantáneo como quitar un campo del borrador.
	let eliminandoId = $state<string | null>(null);

	// Qué procesos usan el tipo que se va a borrar (NEX-544; hasta el 2026-11-07 lo decía el diálogo de «Archivar», que se quitó: Moibe, «como ya podemos borrar
	// libremente, en realidad Archivar ya no es necesario»). `null` = no se pudo revisar (el diálogo lo dice). Se lee ANTES de abrir el diálogo, para no pedir la
	// confirmación a ciegas.
	let procesosDelTipo = $state<{ nombre: string; nodos: number }[] | null>([]);

	async function pedirBorrarTipo(tipo: { id: string; nombre: string; tieneProcesador: boolean }) {
		await cargarProcesos();
		procesosDelTipo = estadoProcesos.error ? null : procesosQueUsanElTipo(tipo.id);
		tipoAEliminar = tipo;
	}

	/** Lo que el diálogo de borrar dice de los procesos: a cuáles afecta, o que no se pudo revisar. Vacío si ninguno lo usa. */
	const avisoDeProcesos = $derived(
		procesosDelTipo === null
			? ' No se pudo revisar si algún proceso lo usa.'
			: procesosDelTipo.length === 0
				? ''
				: ` Lo usan ${procesosDelTipo.length === 1 ? 'este proceso' : 'estos procesos'}: ${procesosDelTipo.map((p) => `«${p.nombre}» (${p.nodos} ${p.nodos === 1 ? 'nodo' : 'nodos'})`).join(', ')}. Siguen guardados, pero su nodo de este tipo quedará marcado como que ya no existe y no podrán guardarse hasta que lo quites.`
	);

	async function confirmarEliminarTipo() {
		const objetivo = tipoAEliminar;
		tipoAEliminar = null;
		if (!objetivo) return;
		// Se limpia AL EMPEZAR, no solo al fallar: sin esto, un error de un
		// intento anterior (de activar o de eliminar) se quedaba pegado en
		// pantalla aunque este intento nuevo terminara bien.
		errorActivacion = '';
		eliminandoId = objetivo.id;
		const r = await eliminarTipoDocumental(objetivo.id);
		eliminandoId = null;
		if (!r.ok) {
			tituloError = 'No se pudo eliminar el modelo.';
			errorActivacion = r.mensaje;
			return;
		}
		// El borrado (lo que este botón promete) ya tuvo éxito llegado aquí —
		// un fallo sincronizando el clasificador es secundario, mismo criterio
		// que en `activar` de abajo.
		if (r.avisoClasificador) {
			tituloError = 'El tipo se borró, pero el clasificador no se pudo actualizar.';
			errorActivacion = r.avisoClasificador;
		}
	}

	// El tipo cuyo "Historial de versiones" está desplegado EN LÍNEA bajo su
	// tarjeta (null = nada desplegado). Vive en el propio objeto, no en un id:
	// `HistorialVersiones.svelte` solo lee, no necesita buscarlo de vuelta en
	// `tiposDocumentales`. Cambio pedido el 2026-09-03: la primera versión
	// abría un modal; se pidió la misma lista pero sin overlay, ahí mismo.
	let historialTipo = $state<TipoDocumentalGuardado | null>(null);

	// Lo que existe en la Biblioteca de cara al usuario: un tipo `archivado`
	// (estado viejo: «Archivar» se quitó el 2026-11-07) sigue guardado, pero no
	// se lista en las tarjetas, como cuando se archivaba. Todo lo
	// que antes leía `tiposDocumentales` para RENDERIZAR usa esto en su lugar;
	// el estado de verdad sigue siendo `tiposDocumentales`.
	//
	// Las tarjetas son la lista COMPLETA, siempre (2026-11-04, Moibe: «elimina
	// el árbol doble de aquí»). Antes había un árbol a la izquierda con una
	// rama por tipo que repetía las tarjetas y las filtraba: sin rama elegida
	// la columna derecha quedaba vacía con una pista («Selecciona un modelo en
	// la Biblioteca…»). Se fue el árbol, y con él el filtro y la barra lateral
	// entera de esta vista, igual que en Procesos y API Keys el 2026-11-03.
	const tiposEnBiblioteca = $derived(tiposDocumentales.filter((t) => t.estado !== 'archivado'));

	async function activar(id: string) {
		// Un solo vuelo a la vez: activar dos tipos en paralelo funcionaría,
		// pero complica leer qué falló; y el guardia real contra duplicados
		// vive en el back (busca por displayName antes de crear).
		if (activandoId) return;
		errorActivacion = '';
		activandoId = id;
		const r = await activarTipoDocumental(id);
		activandoId = null;
		if (!r.ok) {
			tituloError = 'No se pudo activar el modelo.';
			errorActivacion = r.mensaje;
			return;
		}
		// Si los campos se generaron con documentos de ejemplo, ahora que ya hay procesador se ofrece probar la extracción con ellos (no corre sola: pide un botón).
		if (ejemplosDeTipo(id).length > 0) pruebaDeId = id;
		// El Extractor (lo que este botón promete) ya quedó activo llegado
		// aquí — un fallo sincronizando el clasificador es secundario: este
		// tipo puede seguir cayendo en "otro" al clasificar hasta que se
		// reintente, pero la activación en sí no fue mentira.
		if (r.avisoClasificador) {
			tituloError = 'El modelo se activó, pero el clasificador no se pudo actualizar.';
			errorActivacion = r.avisoClasificador;
		}
	}

	const steps = [
		{
			title: 'Tipo documental',
			description: 'Define la información básica del tipo documental.'
		},
		{
			title: 'Campos de extracción',
			description: 'Define la información básica del tipo documental.'
		},
		{
			title: 'Propiedades de campo',
			description: 'Configura las propiedades que definirán la información extraída de este campo.'
		}
	];


	// El estado del wizard vive en el módulo, no aquí, y se respalda en
	// localStorage. Antes eran `$state` locales que se borraban al cerrar: si
	// cerrabas la ventana —o se te iba un refresh— perdías la captura completa.
	const borrador = borradorTipoDocumental;

	const verticalLabel = $derived(etiquetaVertical(borrador.vertical));

	const etiquetaTipo = (valor: string) => TIPOS_DE_DATO.find((t) => t.value === valor)?.label;
	const etiquetaRegla = (valor: string) =>
		REGLAS_TRANSFORMACION.find((r) => r.value === valor)?.label;
	const etiquetaCardinalidad = (valor: string) =>
		CARDINALIDADES.find((c) => c.value === valor)?.label;

	const nombreDuplicado = $derived(
		nombreCampoDuplicado(borrador.campoEnCaptura.nombre, borrador.campos)
	);

	// «Sugerir descripción» (2026-11-05, pedido de Moibe): le pide a Gemini (vía nexus_back) una descripción para el clasificador, a partir del
	// nombre del tipo y de los demás tipos de la organización. NUNCA se guarda sola ni pisa lo que la persona escribió:
	//   · si la caja de Descripción está VACÍA, el texto se pone ahí y una leyenda dice que lo generó la IA y que se revise (se quita en cuanto la
	//     persona lo toca: ya lo leyó);
	//   · si ya había texto, la sugerencia sale en un recuadro aparte con «Usar esta sugerencia» y «Descartar».
	// Si falla o tarda, la caja queda como estaba y se dice por qué.
	let sugiriendo = $state(false);
	let sugerencia = $state<string | null>(null);
	let errorSugerencia = $state('');
	/** El texto que puso la IA en la caja, mientras la persona no lo haya tocado. */
	let descripcionSugerida = $state('');
	/**
	 * Con qué documentos de ejemplo se escribió la sugerencia que se ve (2026-11-07, Moibe: «va»): vacío si fue solo con el nombre. Gemini los LEE y se descartan; no se
	 * guardan. Se dice en la leyenda (y que hay que quitar cualquier dato personal que se haya colado), y se recuerdan en la memoria de la pestaña para ofrecerlos al generar los
	 * campos en el paso 2 (`fijarEjemplosDelPaso1`) en vez de pedirlos otra vez.
	 */
	let documentosDeLaSugerencia = $state<string[]>([]);
	/**
	 * Los documentos que la persona dio en el paso 1 y siguen recordados (en memoria) para reutilizarlos: a diferencia de `documentosDeLaSugerencia`, NO se vacía cuando una sugerencia
	 * posterior es solo con el nombre. Es lo que dice la línea «Se reutilizarán para…» bajo los botones, que antes no se avisaba y parecía que los documentos solo servían para la sugerencia.
	 */
	let documentosDelPaso1 = $state<string[]>([]);
	let entradaDocumentosSugerencia = $state<HTMLInputElement | null>(null);
	/** Si la sugerencia en curso es con documentos: el «Pensando…» va en el botón que se usó. */
	let sugiriendoConDocumentos = $state(false);
	// Empezar por el nombre (2026-11-08, Moibe): al abrir el paso 1 de un alta el foco va al nombre; si se pica otra cosa del paso sin haberlo escrito, se
	// regresa ahí y una línea lo dice (sin nombre, la descripción y las sugerencias no sirven de nada: la IA lo necesita).
	let entradaNombreTipo = $state<HTMLInputElement | null>(null);
	let pedirNombrePrimero = $state(false);
	$effect(() => {
		if (borrador.paso === 1 && entradaNombreTipo && untrack(() => borrador.nombre.trim() === '')) entradaNombreTipo.focus();
	});
	$effect(() => {
		if (borrador.nombre.trim() !== '') pedirNombrePrimero = false;
	});
	function exigirNombrePrimero(evento: PointerEvent) {
		if (borrador.nombre.trim() !== '' || !entradaNombreTipo) return;
		if (entradaNombreTipo.contains(evento.target as Node)) return;
		evento.preventDefault();
		pedirNombrePrimero = true;
		entradaNombreTipo.focus();
	}
	const MAX_DOCUMENTOS_SUGERENCIA = 3;
	const MAX_BYTES_SUGERENCIA = 18 * 1024 * 1024;
	const FORMATOS_SUGERENCIA = ['pdf', 'jpg', 'jpeg', 'png'];

	/** «a», «a y b», «a, b y c». */
	const nombresJuntos = (nombres: string[]) => (nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);

	/** Los documentos que la persona eligió para la sugerencia: se revisan aquí (formato, cuántos, peso) antes de mandarlos; el servidor los vuelve a revisar. */
	function alElegirDocumentosDeSugerencia(evento: Event) {
		const input = evento.currentTarget as HTMLInputElement;
		const elegidos = [...(input.files ?? [])];
		input.value = ''; // para que volver a elegir el MISMO archivo dispare el cambio
		if (elegidos.length === 0) return;
		errorSugerencia = '';
		if (elegidos.some((a) => !FORMATOS_SUGERENCIA.includes(a.name.split('.').pop()?.toLowerCase() ?? ''))) {
			errorSugerencia = 'Para sugerir la descripción con documentos usa PDF, JPG o PNG.';
			return;
		}
		if (elegidos.length > MAX_DOCUMENTOS_SUGERENCIA) {
			errorSugerencia = `Son demasiados documentos: elige hasta ${MAX_DOCUMENTOS_SUGERENCIA}.`;
			return;
		}
		if (elegidos.reduce((suma, a) => suma + a.size, 0) > MAX_BYTES_SUGERENCIA) {
			errorSugerencia = 'Los documentos pesan demasiado: entre todos, a lo más 18 MB.';
			return;
		}
		void sugerirDescripcion(elegidos);
	}

	async function sugerirDescripcion(archivos: File[] = []) {
		if (sugiriendo || borrador.nombre.trim() === '') return;
		sugiriendo = true;
		sugiriendoConDocumentos = archivos.length > 0;
		sugerencia = null;
		errorSugerencia = '';
		const tipoPedido = borrador.idGuardado;
		try {
			let r: Response;
			if (archivos.length > 0) {
				// Con documentos: multipart (el nombre, el tipo si ya existe y los archivos). Nada se guarda en ningún lado.
				const cuerpo = new FormData();
				cuerpo.append('nombre', borrador.nombre);
				if (borrador.idGuardado) cuerpo.append('tipoId', borrador.idGuardado);
				for (const a of archivos) cuerpo.append('archivos', a, a.name);
				r = await fetch('/api/tipos-documentales/sugerir-descripcion-con-documentos', { method: 'POST', body: cuerpo });
			} else {
				r = await fetch('/api/tipos-documentales/sugerir-descripcion', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ nombre: borrador.nombre, tipoId: borrador.idGuardado ?? undefined })
				});
			}
			const datos = await r.json().catch(() => null);
			// Si mientras tanto se pasó a otro tipo, esta respuesta ya no es de lo que se ve.
			if (tipoPedido !== borrador.idGuardado) return;
			if (!r.ok || typeof datos?.descripcion !== 'string') {
				errorSugerencia = mensajeDeFallo(datos, r.status, 'al sugerir la descripción');
				return;
			}
			// Los documentos que la leyeron: se dicen en la leyenda y se guardan (en memoria) para ofrecerlos en el paso 2.
			documentosDeLaSugerencia = archivos.map((a) => a.name);
			if (archivos.length > 0) {
				fijarEjemplosDelPaso1(archivos);
				documentosDelPaso1 = archivos.map((a) => a.name);
			}
			if (borrador.descripcion.trim() === '') {
				borrador.descripcion = datos.descripcion;
				descripcionSugerida = datos.descripcion;
			} else {
				sugerencia = datos.descripcion;
				// El recuadro sale abajo y el panel tiene su propio scroll: se desplaza para que «Usar» y «Descartar» se vean.
				void tick().then(() => document.querySelector('[data-testid="sugerencia-panel"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
			}
		} catch {
			errorSugerencia = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		} finally {
			sugiriendo = false;
		}
	}

	function usarSugerencia() {
		if (sugerencia === null) return;
		borrador.descripcion = sugerencia;
		descripcionSugerida = sugerencia;
		sugerencia = null;
	}

	// Al cambiar de tipo (uno nuevo en blanco, o abrir otro) no se arrastra nada de la sugerencia anterior.
	$effect(() => {
		void borrador.idGuardado;
		untrack(() => {
			sugerencia = null;
			errorSugerencia = '';
			descripcionSugerida = '';
			documentosDeLaSugerencia = [];
			documentosDelPaso1 = [];
		});
	});

	// El nombre del TIPO ya lo tiene otro de la organización (2026-11-04, Moibe: el nombre es único; los archivados no cuentan).
	// Se avisa en el paso 1 y no se deja seguir; el nombre repetido tampoco llega a la biblioteca (`guardarTipoDocumental`). Si se
	// abre un duplicado de antes de la regla, el aviso sale de entrada: hay que cambiarle el nombre para terminar.
	const nombreTipoRepetido = $derived(tipoConMismoNombre(borrador.nombre, borrador.idGuardado) !== null);

	// El formulario se puede "Agregar" cuando está completo Y su nombre no choca
	// con uno ya agregado.
	const puedeAgregar = $derived(campoCompleto(borrador.campoEnCaptura) && !nombreDuplicado);

	// Si al picar "continuar" va a EXISTIR al menos un campo — ya agregado, o
	// completo en el formulario y listo para entrar (`continuar()` lo agrega
	// solo). Nombrado aparte porque el aviso de "agrega al menos un campo" de
	// abajo debe mostrarse exactamente cuando esto es falso, ni antes ni
	// después.
	const hayCampoAlAvanzar = $derived(borrador.campos.length > 0 || puedeAgregar);

	/**
	 * ¿El paso `n` está HECHO? Es lo que pinta «Listo» en el costado (2026-11-08, Moibe: «no sé por qué tiene palomita en el 2, si de verdad no tiene
	 * campos configurados, ¿será un bug?»). Lo era: «Listo» salía con solo haber llegado al paso (`pasoMaximo`), así que ir al 2 y regresar al 1 sin
	 * agregar nada dejaba el 2 en «Listo» con cero campos. Ahora, además de visitado:
	 *   · paso 1: nombre y descripción, sin nombre repetido (lo mismo que pide su botón);
	 *   · paso 2: al menos un campo agregado;
	 *   · paso 3: también al menos un campo (sus propiedades vienen con valores por omisión; sin campos no hay nada que configurar).
	 * Un paso visitado pero sin hacer dice «Por configurar» y se sigue pudiendo picar (eso lo decide `pasoNavegable`, no esto).
	 */
	function pasoListo(n: number): boolean {
		if (n > borrador.pasoMaximo) return false;
		if (n === 1) return borrador.nombre.trim() !== '' && borrador.descripcion.trim() !== '' && !nombreTipoRepetido;
		return borrador.campos.length > 0;
	}

	// Se puede pasar al paso 3 si va a quedar al menos un campo (cambio
	// pedido el 2026-09-03: antes los campos eran opcionales para avanzar,
	// a propósito, para no atrapar a quien quería un tipo documental sin
	// campos — pero un tipo sin campos no tiene nada que activar ni que
	// mapear, así que se revirtió esa decisión).
	const canContinue = $derived(
		borrador.paso === 1
			? borrador.nombre.trim() !== '' && borrador.descripcion.trim() !== '' && !nombreTipoRepetido
			: borrador.paso === 2
				// Dos condiciones independientes: (a) el formulario de captura no
				// debe estar a medias ni con el nombre repetido — dejarlo pasar
				// tiraría en silencio, porque `continuar()` intenta agregarlo y
				// `agregarCampoEnCaptura` lo rechazaría sin que nadie se entere; (b)
				// al final tiene que quedar al menos un campo, ver
				// `hayCampoAlAvanzar`.
				? (campoIntacto(borrador.campoEnCaptura) || puedeAgregar) && hayCampoAlAvanzar
				// Paso 3: habilitado. Es un placeholder sin nada que validar, y con el
				// botón apagado la única salida del wizard era la X — se veía roto. El
				// tipo documental ya quedó guardado en el paso 2, así que aquí solo se
				// cierra.
				: true
	);

	// Las tres etiquetas son las literales del diseño. La del paso 3 decía
	// "Finalizar" mientras ese paso era un placeholder; al construirlo se cambió
	// por la del frame.
	const etiquetaAvance = $derived(
		borrador.paso === 1
			? 'Continuar y agregar datos'
			: borrador.paso === 2
				? 'Guardar y agregar propiedades'
				// "Guardar configuración" es el texto literal del frame del paso 3.
				: 'Guardar configuración'
	);

	// Se persiste en cuanto cambia algo, no al picar "Continuar": lo que se
	// quiere salvar es precisamente lo capturado cuando el usuario NO llegó a
	// confirmar nada.
	$effect(() => {
		// Se recorren TODAS las propiedades, en vez de enumerarlas a mano, para
		// que el efecto dependa de cada una. La versión anterior listaba cuatro
		// (`nombre`, `tipoDato`, `descripcion`, `obligatorio`) y al agregar las del
		// paso 3 —umbral, regla, cardinalidad— y `valorEstructura`, esas quedaron
		// FUERA de las dependencias: cambiarlas no disparaba el guardado y se
		// perdían si se cerraba el wizard a media captura.
		//
		// Con el recorrido, cualquier propiedad que se agregue en el futuro queda
		// cubierta sola. Es la diferencia entre una lista que hay que recordar
		// actualizar y una que no puede desactualizarse.
		// Recorrido PROFUNDO. La versión anterior leía `o[clave]` y con eso bastaba
		// para escalares, pero de un arreglo solo leía la REFERENCIA — nunca su
		// contenido. Consecuencia real: quitar un valor del listado de un campo
		// `Lista` no disparaba el guardado (un `splice` no cambia la referencia),
		// mientras que agregarlo sí, pero de rebote: `agregarValorLista` también
		// limpia un campo de texto, y ESE sí estaba vigilado. Un guardado que
		// funciona por efecto colateral es peor que uno que no funciona.
		const tocar = (v: unknown) => {
			if (Array.isArray(v)) {
				void v.length;
				for (const x of v) tocar(x);
			} else if (v !== null && typeof v === 'object') {
				for (const clave of Object.keys(v)) tocar((v as Record<string, unknown>)[clave]);
			}
		};
		tocar(borrador);

		// untrack es OBLIGATORIO aquí, no una optimización: `guardarTipoDocumental`
		// BUSCA la entrada dentro de `tiposDocumentales` (lectura) y luego le
		// asigna los datos nuevos (escritura). Sin untrack, el efecto queda
		// suscrito a ese mismo arreglo que él mismo modifica y Svelte entra en
		// bucle — `effect_update_depth_exceeded`. Las dependencias reales son solo
		// los campos del borrador que se leen arriba.
		untrack(() => {
			guardarBorrador();
			// Si este borrador ya corresponde a un tipo de la biblioteca, lo que se
			// teclea viaja de inmediato a esa entrada. Eso es lo que permite que
			// "Nuevo tipo documental" empiece siempre en blanco sin que nadie
			// pierda trabajo a medio capturar.
			sincronizarTipoGuardado();
		});
	});

	// Al cerrar se vuelve a 'biblioteca' para que la próxima apertura empiece
	// donde marca el diseño. Lo que YA NO se hace es borrar lo capturado: el
	// borrador sobrevive, así que al volver a entrar al wizard los campos
	// siguen llenos. Vaciarlo es una acción explícita ("Cancelar").
	$effect(() => {
		if (!open) {
			// Red de seguridad: hoy todas las salidas del asistente pasan por
			// `cerrarNivel` o por el pie, pero si alguna vez algo apaga `open`
			// estando en el wizard, la nueva versión a medias se quedaría
			// colgada y el tipo desconfigurado. `untrack` porque esto lee el
			// borrador y no queremos que el efecto dependa de él.
			untrack(() => soltarNuevaVersionSiIntacta());
			vista = 'biblioteca';
			avisoExito = false;
			tituloError = '';
			errorActivacion = '';
		}
	});

	/**
	 * "Regresar": retrocede un paso. Antes era "Cancelar registro" y borraba el
	 * borrador — un nombre que además prometía de más, porque el tipo documental
	 * ya vive en la biblioteca desde que sale del paso 1: cancelar el borrador no
	 * cancelaba el registro.
	 *
	 * En el paso 1 no hay paso anterior, así que regresa a la Biblioteca: es la
	 * pantalla de la que se viene. Nada se pierde — el borrador sigue guardado y
	 * el tipo sigue en la lista.
	 */
	/** La X del header. Sube un nivel en vez de cerrar de golpe.
	 *
	 *  Es una lista de vistas INTERIORES, no una negación de 'biblioteca', y hay
	 *  que acordarse de agregar cada vista nueva aquí: si no, su X cierra el
	 *  módulo entero en vez de regresar a la Biblioteca. */
	function cerrarNivel() {
		if (vista === 'wizard' || vista === 'calibracion') {
			// Salir del asistente sin haber tocado nada deshace la nueva versión
			// que abrirlo había empezado. Mientras esto fue un panel lateral,
			// Escape y el clic fuera entraban también por aquí; de página solo
			// queda la X, así que con cubrir esta función queda cubierta la salida.
			if (vista === 'wizard') soltarNuevaVersionSiIntacta();
			vista = 'biblioteca';
		} else {
			open = false;
		}
	}

	function regresar() {
		if (borrador.paso > 1) borrador.paso -= 1;
		else {
			soltarNuevaVersionSiIntacta();
			vista = 'biblioteca';
		}
	}

	/** "Nuevo tipo documental": SIEMPRE en blanco. Retomar uno existente se hace
	 *  picando su tarjeta en la lista, que es donde el usuario lo busca. */
	function nuevoTipoDocumental() {
		// Ya NO hay «rescate» (2026-11-10). Guardaba como tipo NUEVO cualquier borrador sin `idGuardado` que tuviera algo escrito. Nació
		// para los borradores de antes de que existiera la biblioteca (esa época terminó: desde el 2026-10-15 el catálogo vive en el
		// servidor), y en la práctica hacía dos cosas que nadie pidió: RESUCITAR con otro id un tipo recién borrado (al borrarlo, el
		// borrador se desligaba pero conservaba su nombre; Moibe lo vio como «ya existe un tipo con este nombre» tras borrar INE) y meter
		// a la biblioteca un alta abandonada en el paso 1. Un tipo entra a la biblioteca solo con «Continuar» del paso 1.
		limpiarBorrador();
		// Un alta nueva no hereda los documentos del paso 1 de la anterior (si esa se dejó sin salir del paso 1, `idGuardado` seguía en null y nada más los reiniciaba).
		documentosDelPaso1 = [];
		documentosDeLaSugerencia = [];
		avisoExito = false;
		tituloError = '';
		errorActivacion = '';
		altaEnCurso = true;
		// Alta nueva: siempre en blanco, así que siempre hay que mostrar el
		// formulario del paso 2 — no hay campos que listar todavía.
		mostrarFormularioCampo = true;
		vista = 'wizard';
	}

	// Segundo paso del handshake de `pedidoDeConfiguracion` (ver su docstring):
	// TopBar ya abrió el sheet, aquí se navega al tipo nuevo y se apaga la
	// bandera. La condición incluye `open` porque `nuevoTipoDocumental()` deja
	// `vista = 'wizard'`, y hacer eso con el sheet cerrado dejaría el módulo
	// parado en un wizard en blanco la próxima vez que alguien lo abriera por
	// el menú del engrane, sin haberlo pedido.
	$effect(() => {
		if (!pedidoDeConfiguracion.nuevoTipo || !open) return;
		pedidoDeConfiguracion.nuevoTipo = false;
		nuevoTipoDocumental();
	});

	/**
	 * Abre un tipo documental en el wizard, en modo edición. Desde el
	 * 2026-09-06 su ÚNICA puerta es el renglón "Editar" del menú `⋮` de la
	 * tarjeta: la tarjeta misma dejó de ser clicable, a pedido explícito
	 * (antes su zona de clic se estiraba por el área vacía y entraba a editar
	 * sin que nada lo sugiriera).
	 *
	 * El guardia de estado se queda igual y sigue teniendo sentido aunque el
	 * menú ya deshabilite "Editar" para un modelo activo: esta función es la
	 * que decide, no su llamador. Solo un 'borrador' se abre — se probó una
	 * versión que abría un modelo ACTIVO en solo lectura (candado + invitación
	 * a "Crear nueva versión") y se retiró el mismo día a pedido explícito,
	 * porque no hay editing real que ofrecer ahí. Ver docs/pendientes-ux.md.
	 *
	 * Para un modelo activo el camino es "Crear nueva versión" del mismo menú
	 * (ver `iniciarNuevaVersion`), que sí es explícito sobre lo que va a pasar.
	 */
	function abrirTipoDocumental(id: string) {
		const tipo = tiposDocumentales.find((t) => t.id === id);
		// Lista de PERMITIDOS, no de bloqueados: con tres estados posibles ya no
		// basta con negar 'activo' — un 'archivado' tampoco debe poder abrirse,
		// aunque hoy nunca llegue aquí (no se lista en ningún lado clicable).
		if (tipo?.estado !== 'borrador') return;
		if (cargarTipoDocumental(id)) {
			avisoExito = false;
			tituloError = '';
			errorActivacion = '';
			altaEnCurso = false;
			// Ya cargado el borrador: si trae campos, el paso 2 arranca con la
			// lista a la vista y el formulario oculto, no al revés.
			mostrarFormularioCampo = borrador.campos.length === 0;
			vista = 'wizard';
		}
	}

	/**
	 * "Crear nueva versión" del menú: SOLO para un modelo activo (arriba,
	 * `abrirTipoDocumental` ya cubre el borrador). Regresa el tipo a borrador
	 * —conservando sus campos, ver `crearNuevaVersion()`— y abre el wizard
	 * para editar. El procesador NUEVO no se crea aquí: nace al publicar
	 * (`activarTipoDocumental`), que para un tipo ya antes activo crea un
	 * Custom Extractor propio en vez de adoptar el vigente.
	 */
	/**
	 * La nueva versión que se está editando, con la HUELLA del borrador tal
	 * como se cargó. Existe para poder distinguir, al salir del asistente,
	 * entre "abrí y cerré sin tocar nada" y "edité algo y me salí".
	 *
	 * `crearNuevaVersion` muta el registro en el acto (lo pasa a `borrador`), y
	 * antes del 2026-09-22 salir con el tache no
	 * deshacía nada: el tipo se quedaba desconfigurado para siempre aunque su
	 * procesador siguiera publicado y vivo. Esto es lo que permite deshacerlo.
	 */
	let nuevaVersionEnCurso = $state<{ id: string; huella: string } | null>(null);

	/** Lo que cuenta como "haber editado". Solo los datos que el asistente
	 *  puede cambiar; el paso en el que se quedó NO entra, porque navegar
	 *  entre pasos no es editar. */
	function huellaDelBorrador(): string {
		return JSON.stringify({
			nombre: borrador.nombre,
			descripcion: borrador.descripcion,
			instrucciones: borrador.instrucciones,
			vertical: borrador.vertical,
			campos: $state.snapshot(borrador.campos)
		});
	}

	/**
	 * Al salir del asistente: si se había abierto para una nueva versión y el
	 * borrador sigue idéntico a como se cargó, se deshace todo y el tipo queda
	 * como estaba (activo).
	 *
	 * Si SÍ editó algo no se toca nada: su trabajo sigue en el borrador y el
	 * tipo sigue en edición, retomable desde "Editar". Deshacer ahí le borraría
	 * lo que acaba de escribir, que sería un bug peor que el que esto arregla.
	 */
	function soltarNuevaVersionSiIntacta() {
		const enCurso = nuevaVersionEnCurso;
		if (!enCurso) return;
		nuevaVersionEnCurso = null;
		if (huellaDelBorrador() !== enCurso.huella) return;
		// El borrador se limpia junto con el registro: dejarlo vivo haría que
		// `hayBorrador()` siguiera en true por una edición que ya se deshizo.
		if (cancelarNuevaVersion(enCurso.id)) limpiarBorrador();
	}

	async function desactivar(id: string) {
		errorActivacion = '';
		const r = await desactivarTipoDocumental(id);
		if (!r.ok) {
			tituloError = 'El modelo se desactivó, pero el clasificador no se pudo actualizar.';
			errorActivacion = r.mensaje;
		}
	}

	function iniciarNuevaVersion(id: string) {
		if (crearNuevaVersion(id) && cargarTipoDocumental(id)) {
			avisoExito = false;
			tituloError = '';
			errorActivacion = '';
			altaEnCurso = false;
			// Mismo criterio que `abrirTipoDocumental`: conserva sus campos
			// (`crearNuevaVersion` los copia), así que el formulario arranca
			// oculto salvo que de verdad no traiga ninguno.
			mostrarFormularioCampo = borrador.campos.length === 0;
			// Después de cargar: la huella tiene que ser la del borrador YA
			// puesto, que es contra lo que se va a comparar al salir.
			nuevaVersionEnCurso = { id, huella: huellaDelBorrador() };
			vista = 'wizard';
		}
	}

	// El tipo documental sobre el que se abrió "Ejemplo documental". Un id, no
	// una copia del objeto: la pantalla de calibración lee `tiposDocumentales`
	// en vivo a través de esto, igual que el resto del módulo.
	let calibrandoId = $state<string | null>(null);
	// Arranca expandido: en la captura que se compartió, el único tipo del
	// árbol ya se ve desplegado con sus campos a la vista.
	let calibracionExpandida = $state(true);
	// Qué campos, dentro de Calibración, tienen su recorte YA GUARDADO
	// desplegado (imagen + "Texto seleccionado") — a pedido explícito
	// (2026-09-04) arrancan TODOS replegados; se guarda por NOMBRE de campo,
	// mismo criterio que `recortesPorDocumento`. No se resetea al cambiar de
	// instancia de documento: es una preferencia de la pantalla, no del dato.
	// `SvelteSet`, no un `Set` plano: `$state` no intercepta los métodos
	// mutantes (`.add`/`.delete`) de las clases nativas Set/Map, solo la
	// reasignación de la variable — sin esto, alternar un campo no
	// refrescaba la pantalla (medido en carne propia con una prueba que
	// picaba el chevron y no pasaba nada).
	let camposExpandidos = new SvelteSet<string>();

	function alternarExpandidoCampo(nombreCampo: string) {
		if (camposExpandidos.has(nombreCampo)) camposExpandidos.delete(nombreCampo);
		else camposExpandidos.add(nombreCampo);
	}

	// Ver el documento completo con TODOS sus recortes superpuestos (pedido
	// explícito 2026-09-05) — solo un booleano, no un Set: nunca hay más de un
	// documento "seleccionado" a la vez en esta pantalla (el selector de chips
	// ya se encarga de eso), así que no hace falta llevarlo por id.
	let documentoCompletoExpandido = $state(false);

	// Qué tarjetas de "Modelos documentales agregados" tienen su detalle
	// (descripción + lista de campos) desplegado — para verlo sin entrar al
	// modo edición. Mismo criterio de `camposExpandidos`: arranca replegado y
	// usa `SvelteSet` por la misma razón (los métodos de un Set nativo no son
	// reactivos bajo `$state`).
	let tiposExpandidos = new SvelteSet<string>();

	function alternarExpandidoTipo(idTipo: string) {
		if (tiposExpandidos.has(idTipo)) {
			tiposExpandidos.delete(idTipo);
			return;
		}
		tiposExpandidos.add(idTipo);
	}

	// Arrastrar-y-soltar para reordenar los tipos documentales (pedido explícito
	// 2026-09-05, sin frame de Figma). Vivía en las ramas del árbol de la
	// izquierda; desde el 2026-11-04, que se quitó el árbol, se arrastra la
	// TARJETA tomándola de su asa (el ícono de puntos a su izquierda). Solo
	// variables efímeras de PANTALLA — el orden real vive en
	// `tiposDocumentales`, que `reordenarTipoDocumental` ya persiste solo.
	//
	// `soltarDespues`: si el puntero va por la mitad de ABAJO de la tarjeta
	// destino, la arrastrada cae después de ella; por la de arriba, antes. En
	// el árbol solo se podía soltar ANTES, así que bajar un tipo un lugar no
	// hacía nada y al último lugar no se llegaba nunca.
	let idArrastrando = $state<string | null>(null);
	let idSobreTarjeta = $state<string | null>(null);
	let soltarDespues = $state(false);

	function arrastrarSobreTarjeta(e: DragEvent, idDestino: string) {
		if (!idArrastrando) return;
		e.preventDefault();
		const caja = (e.currentTarget as HTMLElement).getBoundingClientRect();
		idSobreTarjeta = idDestino;
		soltarDespues = e.clientY > caja.top + caja.height / 2;
	}

	function soltarSobreTarjeta(idDestino: string) {
		if (idArrastrando && idArrastrando !== idDestino) {
			reordenarTipoDocumental(idArrastrando, idDestino, soltarDespues);
		}
		terminarArrastre();
	}

	function terminarArrastre() {
		idArrastrando = null;
		idSobreTarjeta = null;
		soltarDespues = false;
	}
	const tipoEnCalibracion = $derived(
		calibrandoId ? (tiposDocumentales.find((t) => t.id === calibrandoId) ?? null) : null
	);
	// Qué instancia de documento está activa en el selector de arriba —
	// desde el 2026-09-04 un tipo puede tener VARIAS, y los campos de abajo
	// se recortan siempre sobre la que esté aquí. `abrirCalibracion` la fija
	// a la primera que haya (o a ninguna) cada vez que se entra a esta
	// pantalla; agregar o quitar una instancia también la actualiza — ver
	// esos puntos para no dejarla apuntando a un id que ya no existe.
	let documentoSeleccionadoId = $state<string | null>(null);
	const documentoSeleccionado = $derived(
		documentoSeleccionadoId
			? (tipoEnCalibracion?.documentosEjemplo.find((d) => d.id === documentoSeleccionadoId) ?? null)
			: null
	);

	// El modal de "Cargar ejemplo documental" — AGREGA una instancia más a
	// `documentosEjemplo` del tipo (2026-09-04: pueden ser varias).
	let modalDocumentoAbierto = $state(false);
	// El modal de recorte por campo, sobre la instancia SELECCIONADA. Hace
	// falta saber para qué campo se abrió — por NOMBRE, no por id (ver el
	// comentario de `recortesPorDocumento` en configuracion.svelte.ts: el id
	// de un campo no sobrevive un refresh).
	let modalRecorteAbierto = $state(false);
	let campoRecorteNombre = $state<string | null>(null);
	// La última página en la que se trabajó cada documento (2026-10-16). En un acta de 20 páginas el siguiente campo casi siempre se
	// busca cerca del anterior, y volver a la página 1 cada vez sería recorrer el documento otra vez. Va por id de documento; es de
	// pantalla, no del dato, así que no se guarda.
	let paginaDeTrabajo = $state<Record<string, number>>({});
	/** Con qué página abre el recortador: la de su recorte si el campo ya tiene uno, y si no, la última que se visitó en ese documento. */
	const paginaInicialDelRecorte = $derived.by(() => {
		if (!documentoSeleccionado) return 1;
		const guardado = campoRecorteNombre
			? tipoEnCalibracion?.recortesPorDocumento[documentoSeleccionado.id]?.[campoRecorteNombre]?.recorte
			: null;
		return guardado ? paginaDeRecorte(guardado) : (paginaDeTrabajo[documentoSeleccionado.id] ?? 1);
	});

	// Los recortes YA GUARDADOS de los DEMÁS campos (todos menos
	// `campoRecorteNombre`) para la instancia de documento seleccionada — se le
	// pasan a `RecortarEjemploCampo` solo como contexto visual de solo lectura
	// mientras se recorta el campo actual. `null` en `tipoEnCalibracion` o en
	// `documentoSeleccionado` (nada en calibración, o ninguna instancia
	// seleccionada todavía) se resuelve a `[]`, sin nada que dibujar.
	const otrosRecortesDelDocumento = $derived.by(() => {
		if (!tipoEnCalibracion || !documentoSeleccionado) return [];
		const recortesDelDoc = tipoEnCalibracion.recortesPorDocumento[documentoSeleccionado.id];
		if (!recortesDelDoc) return [];
		const otros: { nombreCampo: string; recorte: Recorte }[] = [];
		for (const campo of tipoEnCalibracion.campos) {
			if (campo.nombre === campoRecorteNombre) continue;
			const ejemplo = recortesDelDoc[campo.nombre];
			if (ejemplo) otros.push({ nombreCampo: campo.nombre, recorte: ejemplo.recorte });
		}
		return otros;
	});

	/**
	 * "Ejemplo documental" del menú de la tarjeta ya NO es un interruptor con
	 * efecto propio — lleva a esta pantalla. El árbol izquierdo se puebla con
	 * los campos REALES de este tipo documental; qué hace y qué muestra el
	 * lado derecho todavía no está definido, queda para la próxima conversación.
	 */
	function abrirCalibracion(id: string) {
		calibrandoId = id;
		calibracionExpandida = true;
		vista = 'calibracion';
		// Arranca en la primera instancia que haya, para no aterrizar en un
		// selector vacío si ya existen documentos de una visita anterior.
		documentoSeleccionadoId =
			tiposDocumentales.find((t) => t.id === id)?.documentosEjemplo[0]?.id ?? null;
	}

	function continuar() {
		if (!canContinue) return;
		// Con un nombre que ya tiene otro tipo no se guarda (2026-11-04). En el paso 1 el botón ya está apagado; a los pasos 2 y 3 se
		// puede llegar por el costado sin pasar por él, así que desde ahí se regresa al 1, que es donde están el campo y el aviso.
		if (nombreTipoRepetido) {
			borrador.paso = 1;
			return;
		}
		// Si quedó un campo completo sin "Agregar", se agrega en vez de perderlo.
		if (borrador.paso === 2) agregarCampoEnCaptura();

		// El tipo documental entra a la biblioteca al salir del PASO 1, no al
		// final: en cuanto tiene nombre y descripción ya es un tipo documental.
		// Los campos son configuración suya, no requisito para que exista.
		//
		// Volver a llamarla en el paso 2 no duplica: `guardarTipoDocumental`
		// actualiza la entrada cuando el borrador ya trae `idGuardado`. Así los
		// campos se agregan a la MISMA entrada que se creó un paso antes.
		if (borrador.paso === 1 || borrador.paso === 2) {
			const idGuardado = guardarTipoDocumental();
			// Los documentos del paso 1 (con los que se sugirió la descripción) pasan a ser los del tipo: así, aunque no se generen los campos con ellos, al activarlo se
			// ofrece probar la extracción. Solo si hay: no se pisan los que ya tuviera (los del paso 2).
			if (borrador.paso === 1 && idGuardado && ejemplosDelPaso1Actuales().length > 0 && ejemplosDeTipo(idGuardado).length === 0) {
				recordarEjemplos(idGuardado, ejemplosDelPaso1Actuales());
			}
			// Si no llegó al disco no se avanza: el paso siguiente da por hecho
			// que el tipo ya existe en la Biblioteca, y seguir dejaría al usuario
			// configurando campos de algo que va a desaparecer al refrescar. El
			// aviso ya está en pantalla explicando por qué.
			if (estadoBiblioteca.falloAlGuardar) return;
		}
		if (borrador.paso < steps.length) {
			borrador.paso += 1;
			// Solo crece: volver atrás desde el sidebar no debe cerrar pasos que ya
			// se habían visitado.
			borrador.pasoMaximo = Math.max(borrador.pasoMaximo, borrador.paso);
		} else {
			// Fin del wizard. El guardado explícito es redundante con la
			// sincronización en vivo, pero cuesta nada y cubre el caso de que esa
			// sincronización se rompa alguna vez: lo último que hace el usuario no
			// debería depender de un efecto.
			const idEnBiblioteca = guardarTipoDocumental();

			// Sin nombre no hay nada que guardar: `guardarTipoDocumental` sale por
			// su guarda y devuelve null. Se puede llegar aquí porque en el paso 3
			// el botón está siempre habilitado y desde el sidebar se salta a
			// cualquier paso ya visitado — basta con borrar el nombre en el 1 y
			// picar el título del 3.
			//
			// Antes de esto, ese camino limpiaba el borrador igual: el usuario
			// picaba "Guardar configuración", perdía lo capturado y no recibía ni
			// aviso ni error. Ahora se devuelve al paso 1, que es donde vive el
			// campo que falta, sin tocar nada de lo suyo; ahí el pie ya está
			// deshabilitado hasta que lo llene, así que la pantalla explica sola
			// qué falta y no hace falta inventar un mensaje que el diseño no tiene.
			if (idEnBiblioteca === null) {
				borrador.paso = 1;
				return;
			}

			// Tampoco se cierra si el guardado no llegó al disco. Es distinto del
			// caso de arriba —ahí falta el nombre, aquí el navegador no pudo
			// escribir— y por eso no se regresa al paso 1: no hay nada que
			// corregir en el formulario. Se queda donde está, con todo lo
			// capturado a la vista, y el aviso explica qué pasó.
			if (estadoBiblioteca.falloAlGuardar) return;

			// Terminar el asistente es una decisión explícita: aunque no se haya
			// cambiado un solo campo, la nueva versión se queda en pie y NO se
			// deshace. Soltar la bandera aquí evita que una salida posterior la
			// encuentre vieja y cancele algo que el usuario sí guardó.
			nuevaVersionEnCurso = null;

			// El borrador se limpia para que el próximo "Nuevo tipo documental"
			// arranque en blanco. Lo capturado no se pierde — vive en la biblioteca.
			limpiarBorrador();
			vista = 'biblioteca';
			// El recién guardado se trae a la vista: el aviso de éxito debe verse
			// junto a su tarjeta, y con muchos tipos podría quedar fuera de la
			// pantalla (antes el árbol lo dejaba seleccionado y era la única
			// tarjeta a la vista).
			void tick().then(() =>
				document
					.querySelector(`[data-testid="tarjeta-tipo-contenedor"][data-tipo-id="${CSS.escape(idEnBiblioteca)}"]`)
					?.scrollIntoView({ block: 'nearest' })
			);
			// Solo se anuncia el ALTA. Al actualizar un modelo que ya existía no se
			// dice nada: el texto del diseño habla de un tipo AGREGADO, y anunciarlo
			// tras una edición se contradice con la lista de atrás, que sigue
			// teniendo las mismas tarjetas. No hay copy aprobado para "actualizado":
			// vale preguntárselo al UX.
			//
			// `guardarTipoDocumental` NO sirve para distinguirlos: devuelve el id
			// tanto en la rama que hace `push` como en la que hace `Object.assign`.
			avisoExito = altaEnCurso;
			altaEnCurso = false;
		}
	}
</script>

<!-- La cáscara es una PÁGINA desde el 2026-10-25; antes era un panel lateral que se abría encima, desde el engrane. El
     módulo pasó a tener su propia dirección, a la que se llega desde el mosaico de `/configuracion`, y por dentro no cambió
     nada: las mismas vistas y el mismo encabezado con su X, que sigue subiendo un nivel y, desde la Biblioteca, apaga `open`
     —la página lo mira y regresa al mosaico—. La tarjeta conserva la altura de la ventana para que sus dos columnas sigan
     teniendo scroll propio; en una pantalla baja se queda en su alto mínimo y entonces crece la página. Lo que se perdió al
     dejar de ser panel: Escape y el clic fuera ya no suben de nivel (en una página no cierran nada), así que el camino de
     vuelta es la X. -->
<div class="flex h-[calc(100vh-18rem)] min-h-150 flex-col overflow-hidden rounded-2xl border-2 border-border bg-card">
	<!-- header . navigation -->
	<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
		<p class="flex-1 text-base font-medium text-foreground">
			{#if vista === 'calibracion'}
				Configuración de tipo documental
			{:else}
				Módulo de configuración
			{/if}
		</p>
		<!-- La X sube UN NIVEL, no sale siempre: estando en el wizard regresa a
		     la Biblioteca; estando ya en la Biblioteca sale del módulo (apaga
		     `open`, y la página regresa al mosaico de Configuración). Cuando esto
		     era un panel, el cierre de golpe sacaba hasta el Home a media captura
		     de un tipo — dos niveles— y había que reabrir el módulo desde el
		     engrane; por eso sube de uno en uno, y así se quedó. -->
		<button
			type="button"
			class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground dark:text-slate-300"
			data-testid="salir-modulo-configuracion"
			onclick={cerrarNivel}
		>
			<CancelSquareIcon />
			<span class="sr-only">
				{vista === 'wizard' || vista === 'calibracion'
				? 'Volver al módulo de configuración'
				: 'Cerrar'}
			</span>
		</button>
	</div>

	<!-- header.modal -->
	<div class="flex items-center gap-3 px-6 py-4">
		<span
			class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
		>
			<!-- El ícono de "Ejemplo documental" es una aproximación: esta pantalla
			     salió de una captura, sin link de Figma que confirmar contra
			     píxeles reales (a diferencia del resto del módulo). -->
			{#if vista === 'calibracion'}
				<Sparkles class="size-4" />
			{:else}
				<SetupIcon />
			{/if}
		</span>
		<div class="min-w-0 flex-1">
			{#if vista === 'calibracion'}
				<h2 class="text-lg font-medium text-foreground">Ejemplo documental</h2>
				<p class="text-sm text-muted-foreground">Carga tus documentos referencia</p>
			{:else}
				<h2 class="text-lg font-medium text-foreground">Motor de configuración documental</h2>
				<p class="text-sm text-muted-foreground">
					Configura la forma en que Biblioratum comprende tus documentos.
				</p>
			{/if}
		</div>
	</div>

	<div class="flex min-h-0 flex-1">
		<!-- statusbar: 330px, fondo #fcfcfc y bordes de 2px según Figma. NO existe en la Biblioteca (2026-11-04, Moibe:
		     «elimina el árbol doble de aquí»): ahí traía el rótulo «Configuración», la tarjeta «Biblioteca» y un árbol con una
		     rama por tipo que repetía las tarjetas de la derecha y las filtraba; arrastrar una rama reordenaba. Se quitó la barra
		     entera, como en Procesos y API Keys (2026-11-03): las tarjetas ocupan todo el ancho, se ven todas y se reordenan
		     arrastrándolas de su asa. En el asistente y en «Ejemplo documental» la barra sigue: ahí es su navegación (los pasos, los
		     campos del tipo), no una copia del panel. Para devolver el árbol: `git show b88d625:src/lib/components/config/ModuloConfiguracion.svelte`. -->
		{#if vista !== 'biblioteca'}
		<aside
			class="w-82.5 shrink-0 overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
		>
			{#if vista === 'calibracion'}
				<!-- Sin frame de Figma (ver el comentario del ícono, arriba): se
				     construyó desde la captura que se compartió. El pedido concreto de
				     esta iteración era ÚNICAMENTE esto — poblar el árbol con los campos
				     reales del tipo — no el lado derecho, que queda para después. -->
				<p class="text-xs text-foreground">Lista de campos documentales</p>
				{#if tipoEnCalibracion}
					<ul class="mt-4">
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 text-left"
								aria-expanded={calibracionExpandida}
								onclick={() => (calibracionExpandida = !calibracionExpandida)}
							>
								<span
									class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
								>
									<SetupIcon class="size-4" />
								</span>
								<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
									{tipoEnCalibracion.nombre}
								</span>
								{#if calibracionExpandida}
									<ChevronUp class="size-4 shrink-0 text-muted-foreground" />
								{:else}
									<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
								{/if}
							</button>

							{#if calibracionExpandida}
								<!-- Mismo lenguaje visual que tenía el árbol de la Biblioteca (quitado el 2026-11-04): eje a
								     x=44 (pl-11), tramo vertical + guion horizontal por renglón. -->
								<ul class="mt-2">
									{#each tipoEnCalibracion.campos as campo (campo.id)}
										<li class="relative flex h-9.5 items-center pl-11">
											<span
												class="absolute top-1/2 left-11 h-5.5 w-px -translate-y-1/2 bg-border"
											></span>
											<span class="absolute top-1/2 left-11 h-px w-[11.5px] bg-border"></span>
											<span class="ml-[19.5px] min-w-0 truncate text-sm text-muted-foreground">
												{campo.nombre}
											</span>
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					</ul>
				{/if}
			{:else}
				<p class="mb-4 text-sm font-semibold text-foreground">Nuevo tipo documental</p>
				<ol class="space-y-6">
					{#each steps as step, i (step.title)}
					{@const n = i + 1}
					<!-- «Listo» = el paso está hecho (`pasoListo`), no solo visitado: al regresar al paso 1 desde el costado, el 2 y el 3 siguen
					     en «Listo» si ya tienen campos, y dicen «Por configurar» si no (2026-11-08: antes bastaba con haberlos visitado). -->
					{@const state = n === borrador.paso ? 'activo' : pasoListo(n) ? 'completado' : 'pendiente'}
					{@const navegable = pasoNavegable(n) && n !== borrador.paso}
					<!-- El subrayado del paso activo va en el verde de éxito de Figma
					     (--exito/exito-2 = #22c55e), no en el color de marca. -->
					<li class={state === 'activo' ? 'border-b-2 border-green-500 pb-4' : 'pb-4'}>
						<div class="mb-1 flex items-center gap-1.5">
							{#if state === 'completado'}
								<Check class="size-3.5 text-green-600" />
								<!-- "Listo", no "Completado": es el texto literal del frame
								     1060:61194 de Figma. Se había puesto "Completado" al
								     implementar el paso 1, cuando ese estado todavía no se veía
								     en ninguna pantalla y no había contra qué contrastarlo. -->
								<span class="text-xs font-medium text-green-600">Listo</span>
							{:else if state === 'activo'}
								<span class="size-1.5 rounded-full bg-green-500"></span>
								<span class="text-xs font-medium text-green-600">En configuración</span>
							{:else}
								<span class="text-xs font-medium text-muted-foreground">Por configurar</span>
							{/if}
						</div>
						{#if navegable}
							<!-- Solo los pasos YA VISITADOS son clicables, en cualquier
							     dirección: si llegaste al 3 y volviste al 1, picar el 3 te
							     regresa. Lo que no se puede es abrir uno al que nunca se llegó
							     — saltar al 3 sin haber definido campos mostraría una pantalla
							     que no tiene de qué hablar.
							     Avanzar MÁS ALLÁ del máximo sigue siendo exclusivo del botón del
							     pie, que es el que valida lo capturado antes de dejar pasar. -->
							<button
								type="button"
								class="block text-left text-sm font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
								onclick={() => irAPaso(n)}
							>
								{n}. {step.title}
							</button>
						{:else}
							<p class="text-sm font-semibold text-foreground">{n}. {step.title}</p>
						{/if}
							<p class="mt-1 text-sm text-muted-foreground">{step.description}</p>
						</li>
					{/each}
				</ol>
			{/if}
		</aside>
		{/if}

		<!-- Sin la barra lateral (la Biblioteca), la línea de 2 px que separaba la banda del título la pone el contenido. -->
		<div class="flex-1 overflow-y-auto p-8 {vista === 'biblioteca' ? 'border-t-2 border-muted' : ''}">
			{#if vista === 'biblioteca' && !estadoBiblioteca.cargada}
				<!-- La biblioteca vive en el servidor (por organización) y todavía no llega: un panel vacío con «Agregar
				     nuevo tipo documental» se leería como «no tienes ninguno», y crear uno encima de eso es justo lo que
				     no hay que invitar. Con un error, la salida es reintentar. -->
				{#if estadoBiblioteca.errorCarga}
					<div class="flex flex-col items-start gap-3" data-testid="biblioteca-error" role="alert">
						<h3 class="text-xl font-semibold text-foreground">No se pudieron cargar tus tipos documentales</h3>
						<p class="text-sm text-muted-foreground">{estadoBiblioteca.errorCarga}</p>
						<Button onclick={() => void cargarBiblioteca()}>Reintentar</Button>
					</div>
				{:else}
					<p class="text-sm text-muted-foreground" data-testid="biblioteca-cargando" role="status">
						Cargando los tipos documentales de tu organización…
					</p>
				{/if}
			{:else if vista === 'biblioteca'}
				{#if tiposEnBiblioteca.length > 0}
					<!-- Biblioteca poblada. Estructura tomada del frame 1077:65410:
					     título "Modelos documentales agregados" y una tarjeta por
					     modelo (682x72). No pude ver los píxeles —se agotó la cuota de
					     Figma— así que el espaciado y el detalle fino quedan pendientes
					     de una pasada de fidelidad contra el frame. -->
					<div class="flex items-center justify-between gap-4">
						<h3 class="text-xl font-semibold text-foreground">Modelos documentales agregados</h3>
						<Button class="shrink-0 gap-2" onclick={nuevoTipoDocumental}>
							<Plus class="size-4" />
							Agregar nuevo tipo documental
						</Button>
					</div>

					<div class="mt-4 flex flex-col gap-3" role="list" aria-label="Modelos documentales agregados">
						{#each tiposEnBiblioteca as tipo (tipo.id)}
							<!-- Tarjeta del frame 1077:65410 (sección HU038). Sus medidas:
							     botón de 82x38, caja de menú de 24x24 con el glifo de 12x12.

							     La tarjeta NO es clicable (2026-09-06, a pedido explícito). Antes
							     el ícono y los textos eran un <button> que abría el modo edición,
							     pero llevaba `flex-1`: se estiraba por todo el espacio libre hasta
							     "Activar", así que picar en el área VACÍA de la tarjeta —donde no
							     hay nada que sugiera que sea clicable— también entraba a editar.
							     Ahora la ÚNICA puerta al modo edición es el renglón "Editar" del
							     menú `⋮` (que ya trae su propio guardia para modelos activos), y
							     en la tarjeta quedan solo dos controles reales: "Activar" y el
							     menú. Ojo si se reintroduce algo clicable aquí: un <button>
							     dentro de otro es HTML inválido —el navegador deshace el
							     anidamiento y los clics dejan de llegar a quien deben—, que es el
							     bug que ya mordió dos veces en este archivo.

							     Arrastrar para reordenar (2026-11-04, cuando se quitó el árbol de la
							     izquierda, que era donde se arrastraba): el destino es el tipo entero
							     —su tarjeta y, si está desplegado, su detalle—, pero solo el ASA lo
							     levanta —si la tarjeta completa fuera `draggable`, sus botones y su
							     texto pelearían con el arrastre—. Una línea arriba o abajo dice dónde
							     va a caer. -->
							{@const destino = idArrastrando !== null && idArrastrando !== tipo.id && idSobreTarjeta === tipo.id}
							<div
								role="listitem"
								data-testid="tarjeta-tipo-contenedor"
								data-tipo-id={tipo.id}
								data-soltar={destino ? (soltarDespues ? 'despues' : 'antes') : ''}
								class="relative flex flex-col gap-3 transition-opacity {idArrastrando === tipo.id ? 'opacity-40' : ''} {destino
									? soltarDespues
										? 'after:absolute after:inset-x-2 after:-bottom-1.75 after:h-0.5 after:rounded-full after:bg-primary'
										: 'before:absolute before:inset-x-2 before:-top-1.75 before:h-0.5 before:rounded-full before:bg-primary'
									: ''}"
								ondragenter={(e) => arrastrarSobreTarjeta(e, tipo.id)}
								ondragover={(e) => arrastrarSobreTarjeta(e, tipo.id)}
								ondragleave={(e) => {
									// Pasar de la tarjeta a uno de sus hijos también dispara `dragleave`, y Chromium lo manda sin
									// `relatedTarget`: solo cuenta si el puntero de verdad quedó fuera de la caja.
									const caja = e.currentTarget.getBoundingClientRect();
									const dentro = e.clientX > caja.left && e.clientX < caja.right && e.clientY > caja.top && e.clientY < caja.bottom;
									if (!dentro && idSobreTarjeta === tipo.id) idSobreTarjeta = null;
								}}
								ondrop={(e) => {
									if (!idArrastrando) return;
									e.preventDefault();
									soltarSobreTarjeta(tipo.id);
								}}
							>
								<div class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3">
									<span
										data-testid="asa-tipo"
										draggable="true"
										title="Arrastra para reordenar"
										aria-label="Arrastra para reordenar {tipo.nombre}"
										role="img"
										class="-mr-2 -ml-1 flex h-8 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 transition-colors hover:text-muted-foreground active:cursor-grabbing"
										ondragstart={(e) => {
											idArrastrando = tipo.id;
											if (e.dataTransfer) {
												e.dataTransfer.effectAllowed = 'move';
												// Firefox no empieza el arrastre sin datos.
												e.dataTransfer.setData('text/plain', tipo.nombre);
												// Lo que se ve bajo el puntero es la tarjeta entera, no solo el asa.
												const tarjeta = e.currentTarget.parentElement;
												if (tarjeta) e.dataTransfer.setDragImage(tarjeta, 16, tarjeta.offsetHeight / 2);
											}
										}}
										ondragend={terminarArrastre}
									>
										<GripVertical class="size-4" aria-hidden="true" />
									</span>
									<div
										data-testid="tarjeta-tipo"
										class="flex min-w-0 flex-1 items-center gap-4"
									>
										<span
											class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
										>
											<SetupIcon class="size-4" />
										</span>

										<span class="min-w-0 flex-1">
											<span class="block truncate text-sm font-medium text-foreground"
												>{tipo.nombre}</span
											>
											<span class="block truncate text-xs text-muted-foreground">
												<!-- "Sin campos configurados" en vez de "0 campos": un tipo
												     puede entrar a la lista antes de tener ninguno, y un cero
												     suelto se lee como que algo salió mal. -->
												{#if tipo.campos.length === 0}
													Sin campos configurados
												{:else}
													{tipo.campos.length}
													{tipo.campos.length === 1 ? 'campo' : 'campos'}
												{/if}
												{#if etiquetaVertical(tipo.vertical)}
													· {etiquetaVertical(tipo.vertical)}
												{/if}
												<!-- La versión solo aparece cuando hay algo publicado, que es
												     como lo dibuja el frame: la tarjeta sin activar no la lleva
												     (`Seguro de Autos | Precisión 0%`) y la activada sí
												     (`... | v0.0.2`). Antes de publicar no hay versión que
												     mostrar, y un "versión: 0" se leería como un error. -->
												{#if etiquetaVersion(tipo.version)}
													· versión: {etiquetaVersion(tipo.version)}
												{/if}
											</span>
										</span>
									</div>

									<!-- Los dos estados de la tarjeta están dibujados en el archivo: sin
									     activar lleva un Button de 82x38 (1077:65581), y ya activada lo
									     cambia por un Badge de 59x22 (1077:66268). El texto del badge no
									     se puede leer del volcado —es una instancia de componente— así
									     que el rótulo nunca salió del diseño. El estado interno del tipo
									     es `activo`, el testid de la insignia `insignia-activo` y el del
									     botón `activar-tipo`.
									     Los rótulos son «Activar» y «Activado». Pasaron por «Activo» (hasta
									     el 2026-09-14), «Configurado» y «Confirmar configuración» (hasta el
									     2026-11-06) porque entre confirmar los campos y poder usar el tipo
									     había un paso más, «Calibrar» (Moibe, 2026-10-30: «Activar» engañaba,
									     el tipo no quedaba listo para usarse). Sin ese paso (2026-11-06,
									     Moibe: «ya no se requiere para activarlos»), activar SÍ deja el tipo
									     listo para extraer y las palabras vuelven a decir la verdad. El
									     botón sigue con `px-4` (el texto manda el ancho) en vez de los
									     82x38 fijos del frame (`w-20.5`).
									     NO se implementó el estado intermedio "Validando configuración..."
									     que aparece en una de las capturas: no hay nada que validar sin
									     el back, y una animación de espera sobre trabajo que nadie está
									     haciendo es una mentira con spinner. -->
									{#if eliminandoId === tipo.id}
										<!-- Va PRIMERO en el if/elseif: mientras se borra no importa si
										     estaba activo o no, ese estado está a punto de dejar de existir. -->
										<Button size="sm" disabled data-testid="eliminando-tipo" class="h-9.5 shrink-0 gap-2">
											<LoaderCircle class="size-4 animate-spin" />
											Eliminando...
										</Button>
									{:else if tipo.estado === 'activo'}
										<!-- El chip de estado. Ganó un punto verde (captura compartida el 2026-09-06) y dejó su
										     ancho fijo (`w-14.75`) por padding: con el punto adentro, un ancho fijo
										     calculado para solo el texto lo apretaba. Hasta el 2026-11-06 el tipo
										     activo traía además un botón «Calibrar» (y, ya calibrado, un rótulo
										     «Activado» suelto): se quitaron con el paso. -->
										<span
											data-testid="insignia-activo"
											class="flex h-5.5 shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400"
										>
											<span class="size-1.5 rounded-full bg-green-500" aria-hidden="true"></span>
											Activado
										</span>
									{:else if activandoId === tipo.id}
										<!-- El estado con spinner del diseño. Ahora es honesto: detrás hay
										     tres llamadas reales a Google (crear el procesador, inicializar
										     su dataset y subir el esquema), medidas en segundos. -->
										<Button size="sm" disabled data-testid="activando-tipo" class="h-9.5 shrink-0 gap-2">
											<LoaderCircle class="size-4 animate-spin" />
											Validando configuración...
										</Button>
									{:else}
										<Button
											size="sm"
											data-testid="activar-tipo"
											class="h-9.5 shrink-0 px-4"
											disabled={activandoId !== null}
											onclick={() => activar(tipo.id)}>Activar</Button
										>
									{/if}

									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											{#snippet child({ props })}
												<button
													{...props}
													type="button"
													data-testid="menu-tipo"
													aria-label="Más opciones de {tipo.nombre}"
													disabled={eliminandoId === tipo.id}
													class="flex size-6 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted data-[state=open]:bg-muted disabled:pointer-events-none disabled:opacity-50"
												>
													<MoreVerticalIcon />
												</button>
											{/snippet}
										</DropdownMenu.Trigger>

										<!-- El menú es el frame `settings` (1077:65931): 259x208, con 12px
										     de padding y cuatro renglones de 235x46 pegados uno tras otro.
										     Los rótulos no están en el volcado —son instancias de
										     componente— así que salen de la captura que compartió el
										     usuario. -->
										<DropdownMenu.Content align="end" class="w-64.75 p-3">
											<!-- No está en el frame de Figma (1077:65931 solo trae los cuatro
											     renglones de abajo): se agregó a petición explícita, para editar un
											     tipo documental SOLO mientras nunca se ha activado (no existe el
											     Custom Extractor todavía). Una vez activo, no hay nada que "editar"
											     desde aquí: picarle a la tarjeta ya es un no-op a propósito (ver
											     `abrirTipoDocumental`), y esto respeta la misma regla en vez de
											     abrir una puerta trasera al mismo problema. -->
											{#if tipo.estado === 'activo'}
												<!-- El renglón deshabilitado es `pointer-events-none` (ver
												     dropdown-menu-item.svelte), así que nunca recibiría el hover
												     que abre el tooltip. El truco de siempre: el trigger real es
												     el <span> que lo envuelve, no el ítem mismo.
												     `ignoreNonKeyboardFocus` (2026-09-07, mismo bug y misma
												     corrección que ya se aplicó al tooltip de "Ejemplo documental"
												     de abajo): el menú, al abrirse, mueve el foco a su primer
												     renglón — que es justo este—, y bits-ui abre el tooltip con
												     CUALQUIER foco, no solo el de teclado. Sin esto, el mensaje
												     aparecía solo con abrir el menú, antes de que el mouse tocara
												     nada. -->
												<Tooltip.Provider>
													<Tooltip.Root ignoreNonKeyboardFocus>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<span {...props} class="block">
																	<DropdownMenu.Item
																		class="h-11.5 gap-3 px-2 whitespace-nowrap"
																		disabled
																	>
																		<Pencil class="size-4 text-muted-foreground" />
																		<span>Editar</span>
																	</DropdownMenu.Item>
																</span>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="left">
															No puedes editar un modelo que ya está activo.
														</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>
											{:else}
												<DropdownMenu.Item
													class="h-11.5 gap-3 px-2 whitespace-nowrap"
													onSelect={() => abrirTipoDocumental(tipo.id)}
												>
													<Pencil class="size-4 text-muted-foreground" />
													<span>Editar</span>
												</DropdownMenu.Item>
											{/if}

											<!-- "Crear nueva versión" es el reverso de "Editar": habilitado
											     SOLO cuando el tipo ya está activo (ver `iniciarNuevaVersion`).
											     "Eventos" (abajo) sigue deshabilitado: necesita la bitácora que
											     vive en el back. En el frame se ven activos los cuatro; dejarlos
											     vivos y sin hacer nada es peor mentira que atenuarlos. Anotado
											     en docs/pendientes-ux.md. -->
											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												disabled={tipo.estado !== 'activo'}
												onSelect={() => iniciarNuevaVersion(tipo.id)}
											>
												<Plus class="size-4 text-muted-foreground" />
												<span>Crear nueva versión</span>
											</DropdownMenu.Item>

											<!-- «Desactivar» (2026-11-10): vuelve el tipo a borrador para editarlo sin crear versión nueva; al reactivarlo se reutiliza su extractor. -->
											{#if tipo.estado === 'activo'}
												<DropdownMenu.Item
													class="h-11.5 gap-3 px-2 whitespace-nowrap"
													data-testid="desactivar-tipo"
													onSelect={() => desactivar(tipo.id)}
												>
													<PowerOff class="size-4 text-muted-foreground" />
													<span>Desactivar</span>
												</DropdownMenu.Item>
											{/if}

											<!-- «Probar con documentos» (2026-11-07): ver qué extrae el tipo de hasta 3 documentos, sin guardar nada. Solo un tipo activo con su procesador. -->
											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												disabled={tipo.estado !== 'activo' || !tipo.procesadorId}
												data-testid="probar-tipo"
												onSelect={() => (pruebaDeId = tipo.id)}
											>
												<FlaskConical class="size-4 text-muted-foreground" />
												<span>Probar con documentos</span>
											</DropdownMenu.Item>

											<!-- Picar el texto/ícono del renglón sigue llevando a Calibración
											     (2026-09-02). El switch, en cambio, ya NO es decorativo
											     (cambio pedido el 2026-09-03): ahora es un interruptor real
											     de "estoy listo" — un estado local, reversible, SIN ningún
											     envío detrás todavía. `stopPropagation()` en su propio click
											     evita que también dispare el `onSelect` del `Item` (que
											     abriría Calibración además de alternar el switch); verificado
											     con Playwright que ambos gestos quedan independientes.
											     Prenderlo (no apagarlo) pasa primero por
											     `intentarAlternarEjemploDocumental` (2026-09-04): con menos
											     de `MINIMO_EJEMPLOS_RECOMENDADO` documentos de ejemplo abre
											     un aviso en vez de activar directo — ver
											     `RecomendacionEjemplos.svelte`, montado al final del
											     archivo. -->
											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												onSelect={() => abrirCalibracion(tipo.id)}
											>
												<Share2 class="size-4 text-muted-foreground" />
												<span>Ejemplo documental</span>
												<Tooltip.Provider>
													<!-- `ignoreNonKeyboardFocus` (2026-09-06, a pedido explícito):
													     sin él el tooltip aparecía SOLO, ya desplegado, nada más
													     con abrir el menú `⋮`. Causa medida: al abrir, el foco
													     aterriza en este switch —los renglones del menú son
													     `div`s, así que el switch es el único elemento
													     nativamente enfocable ahí dentro— y el tooltip de bits-ui
													     abre con foco, no solo con hover (su `#onfocus` llama a
													     `handleOpen`). Con esta prop ese `#onfocus` solo abre si
													     el foco es `:focus-visible`, o sea navegación con teclado
													     de verdad: un foco programático como el del menú ya no lo
													     dispara. El hover NO se toca (va por otra ruta,
													     `#onpointermove`) — verificado midiendo antes y después
													     del cambio: idéntico.
													     Sobre accesibilidad, lo medido y no supuesto: navegando
													     el menú con flechas el foco salta entre RENGLONES y el
													     switch nunca lo recibe, así que por teclado el tooltip no
													     aparece — ni antes ni ahora. No se pierde información: el
													     `aria-label` del switch dice exactamente lo mismo que el
													     tooltip, y eso es lo que lee un lector de pantalla. -->
													<Tooltip.Root ignoreNonKeyboardFocus>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<button
																	{...props}
																	type="button"
																	role="switch"
																	aria-checked={tipo.ejemploDocumental}
																	aria-label={tipo.ejemploDocumental
																		? `Quitar la marca de listo de ${tipo.nombre}`
																		: `Marcar ${tipo.nombre} como listo`}
																	class="ml-auto inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {tipo.ejemploDocumental
																		? 'bg-primary'
																		: 'bg-input'}"
																	onclick={(e) => {
																		e.stopPropagation();
																		intentarAlternarEjemploDocumental(tipo);
																	}}
																>
																	<span
																		class="size-4 rounded-full bg-background shadow-sm transition-transform {tipo.ejemploDocumental
																			? 'translate-x-4.5'
																			: 'translate-x-0.5'}"
																	></span>
																</button>
															{/snippet}
														</Tooltip.Trigger>
														<!-- pointer-events-none! (con important -- ver abajo): a
														     diferencia del tooltip de "Editar" (que envuelve un
														     renglón YA deshabilitado, sin nada que tapar), este vive
														     sobre un renglón que SÍ se puede picar. Sin esto, el
														     tooltip abierto se interponía entre el mouse y el renglón
														     y se tragaba el clic -- confirmado con Playwright
														     (`elementFromPoint` sobre el renglón daba el tooltip, no
														     el `menuitem`). El `!important` es obligatorio y no
														     cosmético: `TooltipPrimitive.Content` de bits-ui fija
														     `pointer-events: auto` como ESTILO INLINE (para que el
														     tooltip mismo se pueda hover, un requisito de
														     accesibilidad) — un inline style le gana a cualquier clase
														     normal sin importar el orden, así que una `pointer-events-none`
														     sin el modificador de Tailwind v4 no hace nada aquí. -->
														<Tooltip.Content side="bottom" class="pointer-events-none!">
															{tipo.ejemploDocumental ? 'Quitar la marca de listo' : 'Marcar como listo'}
														</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>
											</DropdownMenu.Item>

											<!-- Habilitado SOLO con historial real (mismo criterio que
											     "Crear nueva versión"): un tipo que nunca se ha re-publicado
											     no tiene ninguna versión anterior que mostrar. Despliega
											     `HistorialVersiones` (frame 1077:66342) EN LÍNEA bajo esta
											     misma tarjeta — reemplaza al link "Listar versiones
											     anteriores" que se había puesto junto al encabezado de la
											     Biblioteca (nunca llegó a verse en producción; este menú es
											     más descubrible). Toggle: volver a picarlo lo oculta.
											     Deshabilitado, lleva el MISMO tooltip que "Editar" arriba —
											     mismo truco (el `<span>` que envuelve es el trigger real,
											     porque el renglón deshabilitado es `pointer-events-none` y
											     nunca recibiría el hover) y el mismo `ignoreNonKeyboardFocus`
											     desde el principio: sin él, este tooltip se abriría solo al
											     abrir el menú en cuanto un tipo SIN historial fuera el primer
											     renglón deshabilitado que recibe el foco — el mismo bug que ya
											     se corrigió una vez arriba, en "Editar". -->
											{#if tipo.historialVersiones.length}
												<DropdownMenu.Item
													class="h-11.5 gap-3 px-2 whitespace-nowrap"
													onSelect={() =>
														(historialTipo = historialTipo?.id === tipo.id ? null : tipo)}
												>
													<Calendar class="size-4 text-muted-foreground" />
													<span>Historial de versiones</span>
												</DropdownMenu.Item>
											{:else}
												<Tooltip.Provider>
													<Tooltip.Root ignoreNonKeyboardFocus>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<span {...props} class="block">
																	<DropdownMenu.Item
																		class="h-11.5 gap-3 px-2 whitespace-nowrap"
																		disabled
																	>
																		<Calendar class="size-4 text-muted-foreground" />
																		<span>Historial de versiones</span>
																	</DropdownMenu.Item>
																</span>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="left">Aún no hay nuevas versiones.</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>
											{/if}

											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												disabled
											>
												<Clock class="size-4 text-muted-foreground" />
												<span>Eventos</span>
											</DropdownMenu.Item>

											<!-- «Borrar»: lo quita junto con su Custom Extractor en Document AI, sin vuelta atrás; la confirmación lo dice, y dice qué procesos lo usan. Hasta el
											     2026-11-07 un modelo ACTIVO ofrecía además «Archivar» (lo sacaba de la Biblioteca sin tocar Document AI y no había cómo volver); Moibe: «como ya
											     podemos borrar libremente, en realidad Archivar ya no es necesario». -->
											{#if eliminandoId !== tipo.id}
												<DropdownMenu.Item
													variant="destructive"
													class="h-11.5 gap-3 px-2 whitespace-nowrap"
													onSelect={() =>
														void pedirBorrarTipo({
															id: tipo.id,
															nombre: tipo.nombre,
															tieneProcesador: Boolean(tipo.procesadorId)
														})}
												>
													<Trash2 class="size-4" />
													<span>Borrar</span>
												</DropdownMenu.Item>
											{/if}
										</DropdownMenu.Content>
									</DropdownMenu.Root>

									<!-- Chevron para ver descripción + campos sin entrar al modo
									     edición (pedido 2026-09-05). Mismo patrón que
									     `camposExpandidos` en Calibración: arranca replegado, un
									     SvelteSet lleva qué tarjetas están desplegadas. -->
									<button
										type="button"
										aria-label={tiposExpandidos.has(tipo.id)
											? `Ocultar el detalle de ${tipo.nombre}`
											: `Mostrar el detalle de ${tipo.nombre}`}
										aria-expanded={tiposExpandidos.has(tipo.id)}
										data-testid="chevron-tipo"
										class="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										onclick={() => alternarExpandidoTipo(tipo.id)}
									>
										{#if tiposExpandidos.has(tipo.id)}
											<ChevronUp class="size-4" />
										{:else}
											<ChevronDown class="size-4" />
										{/if}
									</button>
								</div>

								{#if tiposExpandidos.has(tipo.id)}
									<div
										data-testid="detalle-tipo"
										class="-mt-1 flex flex-col gap-4 rounded-xl border border-border bg-muted/30 px-4 py-4"
									>
										<div>
											<p class="text-xs font-medium text-muted-foreground">Descripción</p>
											<p class="mt-1 text-sm text-foreground">
												{tipo.descripcion || 'Sin descripción.'}
											</p>
										</div>

										<div>
											<p class="text-xs font-medium text-muted-foreground">Campos</p>
											{#if tipo.campos.length === 0}
												<p class="mt-1 text-sm text-muted-foreground">Sin campos configurados.</p>
											{:else}
												<!-- `subgrid` (pedido explícito 2026-09-05, ajustado el mismo
													     día): la primera versión fijaba las columnas 2-4 en rem
													     A OJO (6/7/14rem) — a un ancho de panel angosto eso le
													     dejaba casi nada a la columna del nombre, que es
													     justamente la que más varía ("numero_poliza" truncado a
													     "n..."). Con `subgrid`, las columnas 2-4 se miden UNA
													     SOLA VEZ para todo el grupo (el ancho real del texto más
													     largo que traiga esa columna en cualquier fila: "Múltiples
													     valores (Multi Value)", "Obligatorio", etc.) y la del
													     nombre (`minmax(0,1fr)`) se queda con TODO lo que sobra —
													     nunca reserva de más. Cada fila sigue siendo su propia
													     tarjeta (borde, fondo, padding); lo que comparten es
													     `grid-template-columns` vía `grid-cols-subgrid`. -->
												<div class="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-4 gap-y-2">
													{#each tipo.campos as campo (campo.id)}
														<div
															class="col-span-4 grid grid-cols-subgrid items-center rounded-lg border border-border bg-background px-3 py-2 text-sm"
														>
															<span class="min-w-0 truncate font-medium text-foreground"
																>{campo.nombre}</span
															>
															<span class="text-muted-foreground whitespace-nowrap"
																>{etiquetaTipo(campo.tipoDato) ?? 'Sin tipo'}</span
															>
															<span class="text-muted-foreground whitespace-nowrap"
																>{campo.obligatorio ? 'Obligatorio' : 'Opcional'}</span
															>
															<span class="text-muted-foreground whitespace-nowrap"
																>{etiquetaCardinalidad(campo.cardinalidad) ?? campo.cardinalidad}</span
															>
														</div>
														{#if campo.tipoDato === 'grupo' && campo.subcampos?.length}
															<p class="col-span-4 -mt-1 mb-1 px-3 text-xs text-muted-foreground" data-testid="subcampos-ficha">
																Campos del grupo: {campo.subcampos.map((sub) => `${sub.nombre} (${etiquetaTipo(sub.tipoDato) ?? sub.tipoDato}${sub.obligatorio ? '' : ', opcional'})`).join(' · ')}
															</p>
														{/if}
													{/each}
												</div>
											{/if}
										</div>
									</div>
								{/if}

								{#if historialTipo?.id === tipo.id}
									<HistorialVersiones {tipo} onCerrar={() => (historialTipo = null)} />
								{/if}
							</div>
						{/each}
					</div>
				{:else}
				<!-- Estado vacío de la biblioteca de modelos documentales -->
				<div class="flex h-full flex-col items-center justify-center gap-6 text-center">
					<span
						class="flex size-12.5 items-center justify-center rounded-xl border-2 border-muted bg-card text-primary"
					>
						<SetupIcon class="size-6" />
					</span>
					<div>
						<p class="text-sm font-medium text-foreground">
							Aún no hay tipos documentales
						</p>
						<p class="mt-1 max-w-md text-xs text-muted-foreground">Crea el primero para definir sus campos.</p>
					</div>
					<Button class="w-60" onclick={nuevoTipoDocumental}>Nuevo tipo documental</Button>
				</div>
				{/if}
			{:else if vista === 'calibracion'}
				<!-- Réplica de la captura compartida; sin frame de Figma que
				     verificar. El pedido de esta iteración es el árbol de la
				     izquierda — esto de aquí seguía siendo la parte "todo lo demás".
				     Cambio grande el 2026-09-04 (segunda ronda, misma mañana): un
				     tipo documental puede tener VARIAS instancias de documento de
				     ejemplo (`documentosEjemplo`), cada una con sus propios recortes
				     por campo (`recortesPorDocumento`) — antes de esto era UN
				     documento compartido por todo el tipo, y antes de eso uno por
				     campo. El selector de chips de abajo elige cuál instancia está
				     activa; los campos siempre recortan sobre ESA. -->
				<h3 class="text-xl font-semibold text-foreground">Configurar ejemplos de extracción</h3>
				<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
					Carga y etiqueta uno o más documentos de ejemplo para asociar sus valores a los campos
					configurados. Estos ejemplos ayudan al motor de IA a mejorar la precisión y el nivel de
					confianza durante la extracción de información.
				</p>

				{#if tipoEnCalibracion}
					<div class="mt-8 max-w-3xl">
						<!-- Selector de instancias: un chip por documento ya subido,
						     más un "+" para agregar otro. Sin frame de Figma — no hay
						     mockup de esta parte, se diseñó desde cero para el pedido
						     de "varias instancias". -->
						<div class="flex flex-wrap items-center gap-2 border-b border-border pb-4">
							{#each tipoEnCalibracion.documentosEjemplo as doc (doc.id)}
								<!-- Palomita verde: qué documentos ya tienen AL MENOS un
									     campo etiquetado (recortado), de un vistazo, sin tener
									     que seleccionar cada chip para averiguarlo (pedido
									     explícito 2026-09-05). -->
								{@const recortesDelDoc = tipoEnCalibracion.recortesPorDocumento[doc.id] ?? {}}
								{@const tieneRecortes = Object.keys(recortesDelDoc).length > 0}
								{@const todosEtiquetados =
									tipoEnCalibracion.campos.length > 0 &&
									tipoEnCalibracion.campos.every((c) => recortesDelDoc[c.nombre])}
								<!-- `aria-label` fijo al nombre del archivo: sin él, el
								     nombre ACCESIBLE de este botón incluiría también el
								     texto (aunque sea `sr-only`) de la palomita/círculo de
								     abajo, y dejaría de ser exactamente `doc.nombre` — rompía
								     en la práctica un `getByRole('button', { name: ...,
								     exact: true })` de una prueba ya existente en cuanto el
								     documento tenía algún campo etiquetado. El estado
								     ("parcial"/"100%") lo sigue explicando el tooltip de cada
								     ícono (se abre también con foco de teclado, no solo con
								     el mouse — no hace falta duplicarlo aquí. -->
								<button
									type="button"
									aria-pressed={documentoSeleccionadoId === doc.id}
									aria-label={doc.nombre}
									class="inline-flex max-w-48 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors {documentoSeleccionadoId ===
									doc.id
										? 'border-primary bg-primary/10 text-primary'
										: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
									onclick={() => (documentoSeleccionadoId = doc.id)}
								>
									{#if todosEtiquetados}
										<!-- Tooltip vía snippet `child` (renderiza un <span>, no el
										     <button> por default de Tooltip.Trigger): esto YA está
										     dentro de un <button> (todo el chip), y un botón dentro
										     de otro es HTML inválido — el navegador deshace el
										     anidamiento y los clics dejan de llegar a quien deben,
										     mismo motivo documentado en la tarjeta de "Modelos
										     documentales agregados". -->
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<span
															{...props}
															class="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-amber-400"
														>
															<Check class="size-2.5 text-white" aria-hidden="true" />
														</span>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content side="top">Etiquetado al 100%</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									{:else if tieneRecortes}
										<!-- Mismo truco que el círculo dorado de arriba: snippet
										     `child` para que el trigger sea un <span>, no el
										     <button> por default (ya estamos dentro del <button>
										     del chip). -->
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<Check
															{...props}
															class="size-3.5 shrink-0 text-green-600"
															aria-hidden="true"
														/>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content side="top">Parcialmente etiquetado</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									{/if}
									<span class="truncate">{doc.nombre}</span>
								</button>
							{/each}
							{#if tipoEnCalibracion.documentosEjemplo.length === 0}
								<!-- Sin ningún documento todavía: el botón con texto es más
								     descubrible que un "+" suelto — mismo criterio que el
								     resto del módulo para la primera acción de una lista
								     vacía (ver "Nuevo tipo documental", "Agregar campo"). -->
								<Button variant="outline" size="sm" onclick={() => (modalDocumentoAbierto = true)}>
									Cargar ejemplo documental
								</Button>
							{:else}
								<Tooltip.Provider>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<button
													{...props}
													type="button"
													aria-label="Agregar otro documento de ejemplo"
													class="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
													onclick={() => (modalDocumentoAbierto = true)}
												>
													<CirclePlus class="size-4" />
												</button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content side="top">
											Puedes agregar más ejemplos documentales.
										</Tooltip.Content>
									</Tooltip.Root>
								</Tooltip.Provider>
							{/if}
						</div>

						{#if documentoSeleccionado}
							{@const doc = documentoSeleccionado}
							<!-- Mismo lenguaje visual que las tarjetas de archivo de
							     `DocumentoRow.svelte` (icono + nombre + subtítulo +
							     quitar), ahora para la instancia SELECCIONADA nada más. -->
							<div
								class="mt-4 flex max-w-lg items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
							>
								<span
									class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
								>
									<FileIcon />
								</span>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-foreground">{doc.nombre}</p>
									<p class="text-xs text-muted-foreground">
										{doc.tipo} · {formatearTamano(doc.tamanoBytes)}{#if (doc.paginas ?? 1) > 1}
											· <span data-testid="paginas-del-documento">{doc.paginas} páginas</span>{/if}
										{#if esPdfSinOriginal(doc)}
											<!-- Un PDF subido antes del 2026-09-24: de él solo quedó la
											     página 1 como imagen (ver `esPdfSinOriginal`). Se marca
											     para que se sepa cuál volver a subir si hace falta el
											     documento completo. Aquí el trigger SÍ puede ser el
											     <button> por default: no está dentro de otro botón, y así
											     el tooltip también se abre con el teclado. -->
											·
											<Tooltip.Provider>
												<Tooltip.Root>
													<Tooltip.Trigger
														data-testid="pdf-sin-original"
														class="font-medium text-amber-700 underline decoration-dotted underline-offset-2"
													>
														solo la página 1
													</Tooltip.Trigger>
													<Tooltip.Content side="top" class="max-w-xs">
														Este PDF se guardó antes de que se conservara el archivo original: solo
														quedó su página 1, como imagen. Para tenerlo completo, quítalo y vuelve a
														subirlo — al quitarlo se van también sus recortes.
													</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>
										{/if}
									</p>
								</div>
								<button
									type="button"
									aria-label={`Quitar el documento "${doc.nombre}"`}
									class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
									onclick={() => (documentoAQuitar = doc.id)}
								>
									<Trash2 class="size-3.5" />
								</button>
								<!-- Ver el documento completo con todos sus recortes ya
									     marcados encima (pedido explícito 2026-09-05) — sin salir
									     de Calibración ni abrir el modal de recorte, que es de
									     edición, no de vista. -->
								<button
									type="button"
									aria-label={documentoCompletoExpandido
										? 'Ocultar el documento completo'
										: 'Ver el documento completo con sus recortes'}
									aria-expanded={documentoCompletoExpandido}
									class="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									onclick={() => (documentoCompletoExpandido = !documentoCompletoExpandido)}
								>
									{#if documentoCompletoExpandido}
										<ChevronUp class="size-4" />
									{:else}
										<ChevronDown class="size-4" />
									{/if}
								</button>
							</div>

							{#if documentoCompletoExpandido}
								<!-- Una página a la vez, con sus recortes encima (`DocumentoConRecortes`). Con una sola página se ve como siempre. -->
								{#key doc.id}
									<DocumentoConRecortes
										{doc}
										campos={tipoEnCalibracion.campos}
										recortes={tipoEnCalibracion.recortesPorDocumento[doc.id] ?? {}}
									/>
								{/key}
							{/if}

							{#each tipoEnCalibracion.campos as campo (campo.id)}
								{@const ejemplo = tipoEnCalibracion.recortesPorDocumento[doc.id]?.[campo.nombre]}
								<div class="border-b border-border py-4 last:border-0">
									<div class="flex items-center justify-between gap-4">
										<span class="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
											<!-- Columna fija para la palomita (pedido explícito
											     2026-09-05): antes vivía inline antes del nombre, así
											     que un campo CON recorte empujaba su nombre más a la
											     derecha que uno sin recorte — los nombres no quedaban
											     alineados entre sí. Este `span` de ancho fijo se
											     dibuja SIEMPRE (con o sin palomita), para que el
											     nombre arranque en la misma columna en todas las
											     filas. -->
											<span class="flex size-4 shrink-0 items-center justify-center">
												{#if ejemplo}
													<Check class="size-4 text-green-600" aria-hidden="true" />
												{/if}
											</span>
											{campo.nombre}
											{#if ejemplo && ((doc.paginas ?? 1) > 1 || paginaDeRecorte(ejemplo.recorte) > 1)}
												<span
													data-testid="pagina-del-recorte"
													class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular-nums"
												>
													p. {paginaDeRecorte(ejemplo.recorte)}
												</span>
											{/if}
										</span>
										<div class="flex items-center gap-1">
											{#if ejemplo}
												<!-- Orden pedido el 2026-09-05: ojo, lápiz, bote (antes
												     era lápiz, bote, chevron). Los tres con tooltip
												     ("Ver"/"Editar"/"Eliminar") — mismos `aria-label`
												     de siempre, que ya describen la acción sin
												     ambigüedad, así que las pruebas que buscan por ellos
												     no se tocaron. -->
												<Tooltip.Provider>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<button
																	{...props}
																	type="button"
																	aria-label={camposExpandidos.has(campo.nombre)
																		? `Ocultar el recorte de ${campo.nombre}`
																		: `Mostrar el recorte de ${campo.nombre}`}
																	aria-expanded={camposExpandidos.has(campo.nombre)}
																	class="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
																	onclick={() => alternarExpandidoCampo(campo.nombre)}
																>
																	{#if camposExpandidos.has(campo.nombre)}
																		<EyeOff class="size-4" />
																	{:else}
																		<Eye class="size-4" />
																	{/if}
																</button>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="top">Ver</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>

												<!-- Réplica del Figma: con un recorte ya guardado, el
												     botón deja de ser "Recortar" y pasa a ser un ícono
												     de lápiz que reabre el mismo modal para rehacer el
												     recorte — `guardarRecorteEjemplo` ya sobreescribe
												     el anterior, así que "editar" y "recortar de nuevo"
												     son la misma operación. -->
												<Tooltip.Provider>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<button
																	{...props}
																	type="button"
																	aria-label={`Editar el recorte de ${campo.nombre}`}
																	class="flex size-8 shrink-0 items-center justify-center text-primary transition-colors hover:text-primary/70"
																	onclick={() => {
																		campoRecorteNombre = campo.nombre;
																		modalRecorteAbierto = true;
																	}}
																>
																	<Pencil class="size-4" />
																</button>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="top">Editar recorte</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>

												<!-- Basura para poder dejar el campo SIN recorte
												     asignado EN ESTA INSTANCIA (a diferencia de "editar",
												     esto sí pide confirmar). -->
												<Tooltip.Provider>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<button
																	{...props}
																	type="button"
																	aria-label={`Quitar el recorte de ${campo.nombre}`}
																	class="flex size-8 shrink-0 items-center justify-center text-primary transition-colors hover:text-primary/70"
																	onclick={() =>
																		(recorteAQuitar = {
																			idTipo: tipoEnCalibracion.id,
																			idDocumento: doc.id,
																			nombreCampo: campo.nombre
																		})}
																>
																	<Trash2 class="size-4" />
																</button>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="top">Eliminar</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>
											{:else}
												<!-- Mismo orden y mismos tres tooltips que arriba. Ojo y
												     bote van DESHABILITADOS y grises — sin recorte
												     todavía no hay nada que ver ni que quitar — puro
												     relleno por simetría (pedido explícito 2026-09-05).
												     Un botón `disabled` no dispara el hover del tooltip
												     (mismo motivo que el "Editar" deshabilitado del menú
												     `⋮`, arriba): el trigger real es el `<span>` que lo
												     envuelve, no el botón mismo. -->
												<Tooltip.Provider>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<span {...props} class="block">
																	<button
																		type="button"
																		aria-label={`Aún no hay recorte que ver de ${campo.nombre}`}
																		disabled
																		class="flex size-8 shrink-0 items-center justify-center text-muted-foreground/50"
																	>
																		<Eye class="size-4" />
																	</button>
																</span>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="top">Ver</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>

												<!-- Ícono, no botón con texto (cambio pedido el
												     2026-09-05): misma concordancia visual que el
												     lápiz de "Editar" y la basura de "Quitar" — mismo
												     tamaño, mismo `bg-primary/10`, mismo radio. -->
												<Tooltip.Provider>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<button
																	{...props}
																	type="button"
																	aria-label={`Recortar ${campo.nombre}`}
																	class="flex size-8 shrink-0 items-center justify-center text-primary transition-colors hover:text-primary/70"
																	onclick={() => {
																		campoRecorteNombre = campo.nombre;
																		modalRecorteAbierto = true;
																	}}
																>
																	<Scissors class="size-4" />
																</button>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="top">Marcar recorte</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>

												<!-- Basura deshabilitada, puramente de relleno (pedido
												     explícito 2026-09-05): sin recorte todavía no hay nada
												     que quitar, pero dejar SOLO las tijeras rompía la
												     simetría con las filas de arriba (lápiz + basura +
												     chevron). Mismo tamaño que las demás, en gris para que
												     se lea inerte. -->
												<Tooltip.Provider>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<span {...props} class="block">
																	<button
																		type="button"
																		aria-label={`Aún no hay recorte que quitar de ${campo.nombre}`}
																		disabled
																		class="flex size-8 shrink-0 items-center justify-center text-muted-foreground/50"
																	>
																		<Trash2 class="size-4" />
																	</button>
																</span>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="top">Eliminar</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>
											{/if}
										</div>
									</div>

									{#if ejemplo && camposExpandidos.has(campo.nombre)}
										<!-- Lo que "Guardar" del modal de recorte dejó: la región
										     seleccionada, como imagen — nunca un texto, porque aquí
										     no corrió ningún OCR todavía. Desde el 2026-09-25 no es
										     una copia guardada del pedazo sino el documento mismo
										     recortado con CSS en sus coordenadas (ver
										     `RecorteDeDocumento.svelte`). El documento de origen ya
										     se muestra arriba (una vez por instancia seleccionada),
										     así que aquí no se repite su tarjeta. -->
										<div class="mt-4 max-w-lg">
											<p class="mb-2 text-xs font-medium text-muted-foreground">
												Texto seleccionado{#if (doc.paginas ?? 1) > 1 || paginaDeRecorte(ejemplo.recorte) > 1} · página {paginaDeRecorte(ejemplo.recorte)}{/if}
											</p>
											<RecorteGuardado
												{doc}
												recorte={ejemplo.recorte}
												alt={`Recorte guardado para ${campo.nombre}`}
											/>
										</div>
									{/if}
								</div>
							{/each}
						{:else}
							<p class="mt-6 text-sm text-muted-foreground">
								Agrega un documento de ejemplo para empezar a recortar sus campos.
							</p>
						{/if}
					</div>
				{/if}
			{:else if borrador.paso === 1}
				<h3 class="text-xl font-semibold text-foreground">Nuevo tipo documental</h3>
				<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
					Captura los datos básicos del tipo; después defines sus campos.
				</p>

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="mt-8 max-w-2xl space-y-6" onpointerdowncapture={exigirNombrePrimero}>
					<div class="space-y-2">
						<Label for="nombre-tipo">Nombre de tipo documental *</Label>
						<!-- Nombre único en la organización (2026-11-04): mismo trato visual que el nombre de campo repetido del
						     paso 2 (borde rojo por aria-invalid, ícono y una línea abajo). -->
						<div class="relative">
							<Input
								id="nombre-tipo"
								bind:ref={entradaNombreTipo}
								bind:value={borrador.nombre}
								placeholder="Ingresa el nombre del tipo documental a configurar, por ejemplo: INE"
								aria-invalid={nombreTipoRepetido || pedirNombrePrimero}
								aria-describedby={nombreTipoRepetido ? 'nombre-tipo-error' : pedirNombrePrimero ? 'nombre-tipo-primero' : undefined}
								class={nombreTipoRepetido ? 'pr-9' : undefined}
							/>
							{#if nombreTipoRepetido}
								<AlertCircle
									class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-destructive"
								/>
							{/if}
						</div>
						{#if pedirNombrePrimero}
							<p id="nombre-tipo-primero" class="text-xs text-destructive" role="alert" data-testid="nombre-tipo-primero">Empieza por el nombre del tipo documental.</p>
						{/if}
						{#if nombreTipoRepetido}
							<p id="nombre-tipo-error" class="text-xs text-destructive" data-testid="nombre-tipo-repetido">
								Ya existe un tipo documental con este nombre. Utiliza uno diferente.
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<!-- Sin línea de ayuda (2026-11-08, Moibe: «quita el texto de "Para que el clasificador reconozca..." con el de abajo basta»): el texto
						     de ejemplo de la caja ya dice qué escribir. -->
						<Label for="descripcion-tipo">Descripción *</Label>
						<Textarea
							id="descripcion-tipo"
							bind:value={borrador.descripcion}
							rows={3}
							placeholder="Describe el propósito y contenido de este tipo documental."
							class="text-justify"
						/>
						<!-- Texto justificado (2026-11-05, Moibe: «¿podría salir justificado?»): la descripción suele ser un párrafo largo (la que
						     sugiere la IA ronda las 70 palabras) y así se lee como tal. Es solo presentación: el valor guardado no cambia, y la última
						     línea queda a la izquierda (lo normal en `text-align: justify`). El recuadro de la sugerencia, más abajo, va igual para
						     que lo que se previsualiza se vea como quedará en la caja. Sin guiones automáticos a propósito: la página declara
						     `lang="en"` y partiría el español con las reglas del inglés. -->
						<!-- «Sugerir descripción» (2026-11-05): ver `sugerirDescripcion`. Necesita el nombre del tipo; nunca guarda ni pisa nada solo. -->
						<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
							<!-- Dos botones de acción en un mismo marco (2026-11-10, Moibe: «en lugar del texto "Solo con el nombre", que ese botón diga ya de
							     golpe "✨ Sugerir descripción" directamente»). Antes (2026-11-08) era un interruptor «Solo con el nombre / Con documentos de
							     ejemplo» más un botón de acción aparte; ahora cada mitad actúa con un clic. El marco común conserva la idea de «uno u otro».
							     Sin nombre del tipo, los dos quedan apagados (2026-11-08: «que toda la sección esté greyada hasta que el título lo habilite»). -->
							<div
								role="group"
								aria-label="Sugerir la descripción"
								class="inline-flex min-h-8 max-w-full items-stretch gap-0.5 rounded-lg border border-border bg-background p-0.5"
								data-testid="sugerir-grupo"
							>
								<button
									type="button"
									data-testid="sugerir-descripcion"
									class="flex min-h-6.5 min-w-0 items-center justify-center gap-1 rounded-md px-2.5 py-0.5 text-center text-xs leading-tight font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
									disabled={sugiriendo || borrador.nombre.trim() === ''}
									title={borrador.nombre.trim() === '' ? 'Escribe primero el nombre del tipo documental' : 'La IA la escribe a partir del nombre del tipo'}
									onclick={() => void sugerirDescripcion()}
								>
									{#if sugiriendo && !sugiriendoConDocumentos}
										<LoaderCircle class="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
										Pensando…
									{:else}
										<Sparkles class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
										Sugerir descripción
									{/if}
								</button>
								<!-- Con documentos (2026-11-07): la IA los LEE para describir lo que de verdad traen (hasta 3: PDF, JPG o PNG; no se guardan). Abre el selector y al elegirlos sugiere. -->
								<button
									type="button"
									data-testid="sugerir-con-documentos"
									class="flex min-h-6.5 min-w-0 items-center justify-center gap-1 rounded-md px-2.5 py-0.5 text-center text-xs leading-tight font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
									disabled={sugiriendo || borrador.nombre.trim() === ''}
									title={borrador.nombre.trim() === ''
										? 'Escribe primero el nombre del tipo documental'
										: `Elige hasta ${MAX_DOCUMENTOS_SUGERENCIA} documentos de ejemplo (PDF, JPG o PNG): se leen para escribirla y no se guardan`}
									onclick={() => entradaDocumentosSugerencia?.click()}
								>
									{#if sugiriendo && sugiriendoConDocumentos}
										<LoaderCircle class="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
										Pensando…
									{:else}
										<Paperclip class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
										Con documentos de ejemplo
									{/if}
								</button>
							</div>
							<input
								bind:this={entradaDocumentosSugerencia}
								data-testid="sugerir-documentos-archivo"
								type="file"
								multiple
								class="hidden"
								accept=".pdf,.jpg,.jpeg,.png"
								onchange={alElegirDocumentosDeSugerencia}
							/>
							<span role="status" aria-live="polite">
								{#if descripcionSugerida !== '' && borrador.descripcion === descripcionSugerida}
									<span class="text-xs text-muted-foreground" data-testid="sugerencia-aviso">
										{documentosDeLaSugerencia.length > 0
											? `Sugerencia generada con IA a partir de ${nombresJuntos(documentosDeLaSugerencia.map((n) => `«${n}»`))}.`
											: 'Sugerencia generada con IA.'}
									</span>
								{/if}
							</span>
						</div>
						{#if errorSugerencia}
							<p class="text-xs text-destructive" role="alert" data-testid="sugerencia-error">{errorSugerencia}</p>
						{/if}
						{#if sugerencia !== null}
							<div class="space-y-2 rounded-lg border border-border bg-muted/30 p-3" data-testid="sugerencia-panel">
								<p class="text-xs font-medium text-muted-foreground" data-testid="sugerencia-panel-titulo">
									{documentosDeLaSugerencia.length > 0
										? `Sugerencia generada con IA a partir de ${nombresJuntos(documentosDeLaSugerencia.map((n) => `«${n}»`))}: revísala antes de usarla y quita cualquier dato personal de los ejemplos que se haya colado.`
										: 'Sugerencia generada con IA: revísala antes de usarla.'}
								</p>
								<p class="text-sm text-justify text-foreground" data-testid="sugerencia-texto">{sugerencia}</p>
								<div class="flex flex-wrap gap-2">
									<Button size="sm" data-testid="usar-sugerencia" onclick={usarSugerencia}>Usar esta sugerencia</Button>
									<Button size="sm" variant="outline" data-testid="descartar-sugerencia" onclick={() => (sugerencia = null)}>Descartar</Button>
								</div>
							</div>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="vertical-negocio">Vertical de negocio</Label>
						<Select.Root type="single" bind:value={borrador.vertical}>
							<Select.Trigger id="vertical-negocio" class="w-full">
								{verticalLabel ?? 'Ingresa una vertical de negocio'}
							</Select.Trigger>
							<Select.Content>
								{#each VERTICALES as v (v.value)}
									<Select.Item value={v.value} label={v.label} />
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>
			{:else if borrador.paso === 2}
				<h3 class="text-xl font-semibold text-foreground">Campos de Extracción</h3>
				<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
					Completa la información requerida para agregar un nuevo campo al modelo documental y
					mejorar la precisión de la extracción automática.
				</p>
				<!-- Aquí vivieron las «Instrucciones para la extracción» (2026-10-30 → 2026-11-10). Quitadas el 2026-11-10 (Moibe: «adelante», tras medir que la descripción del campo logra lo mismo): medido contra Google el 2026-11-10,
				     «Nombre completo del titular, no del beneficiario» en la descripción del campo devolvió solo al titular 3/3, igual que las
				     instrucciones, y hasta orientó la fecha de nacimiento (sin regla propia). Con una regla por campo no hace falta una general, y se
				     evita el riesgo de pedir formatos (lo que no coincide con lo impreso desaparece). Los tipos ya activados conservan su documentPrompt. -->
				<!-- Como el botón del mismo nombre en la consola de Document AI (pedido el 2026-10-29): en vez de capturar campo por
				     campo, Document AI propone los campos leyendo un documento de ejemplo. Ver `GenerarCamposDesdeDocumento.svelte`. Va después de
				     -->
				<Button
					variant="outline"
					class="mt-4 gap-2"
					data-testid="abrir-generar-campos"
					onclick={() => {
						ejemplosParaGenerar = ejemplosDelPaso1Actuales();
						generarCamposAbierto = true;
					}}
				>
					<Sparkles class="size-4 text-primary" />
					Generar a partir de un documento
				</Button>

				{#if mostrarFormularioCampo}
					<!-- El formulario de alta. Ya NO queda siempre visible (cambio del
					     2026-09-03, ver `mostrarFormularioCampo`): se muestra para dar de
					     alta UN campo a la vez y se oculta al guardarlo. Así está en
					     Figma (1067:62363) para el caso "formulario abierto". -->
					<div class="mt-8 max-w-3xl rounded-xl border border-border bg-background p-6">
						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="campo-nombre">Nombre del campo *</Label>
								<!-- El borde rojo lo pinta el propio Input a través de aria-invalid
								     (trae `aria-invalid:border-destructive`), así que el atributo no es
								     solo accesibilidad: es también lo que dispara el estilo. -->
								<div class="relative">
									<Input
										id="campo-nombre"
										bind:value={borrador.campoEnCaptura.nombre}
										placeholder="Ingresa nombre de campo"
										aria-invalid={nombreDuplicado}
										aria-describedby={nombreDuplicado ? 'campo-nombre-error' : undefined}
										class={nombreDuplicado ? 'pr-9' : undefined}
									/>
									{#if nombreDuplicado}
										<AlertCircle
											class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-destructive"
										/>
									{/if}
								</div>
								{#if nombreDuplicado}
									<!-- Texto literal del frame. Mi versión anterior nombraba el campo
									     en conflicto («Ya agregaste un campo llamado "curp"»), que ayuda
									     cuando hay muchos, pero el diseño manda. -->
									<p id="campo-nombre-error" class="text-xs text-destructive">
										Ya existe un campo con este nombre. Utiliza uno diferente.
									</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="campo-tipo">Tipo de dato *</Label>
								<Select.Root
									type="single"
									value={borrador.campoEnCaptura.tipoDato}
									onValueChange={(v) => alCambiarTipoDato(borrador.campoEnCaptura, v)}
								>
									<Select.Trigger id="campo-tipo" class="w-full">
										{etiquetaTipo(borrador.campoEnCaptura.tipoDato) ?? 'Selecciona un tipo de campo'}
									</Select.Trigger>
									<Select.Content>
										{#each TIPOS_DE_DATO as tipo (tipo.value)}
											<Select.Item value={tipo.value} label={tipo.label} />
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						</div>

						<!-- "Valor de estructura": renglón propio y solo la columna izquierda,
						     como en el frame. SIN asterisco — es opcional. Es un valor de
						     EJEMPLO que muestra la forma esperada del dato, no una validación:
						     su destino en el diccionario es `field_definition.prompt_hint`. -->
						{#if borrador.campoEnCaptura.tipoDato === 'grupo'}
							<!-- Un grupo no tiene «valor de estructura» (un ejemplo de UN valor); lo suyo son los campos de cada fila. -->
							<SubcamposGrupo campo={borrador.campoEnCaptura} />
						{:else}
							<div class="mt-6 grid gap-6 md:grid-cols-2">
								<div class="space-y-2">
									<Label for="campo-estructura">Valor de estructura</Label>
									<Input
										id="campo-estructura"
										bind:value={borrador.campoEnCaptura.valorEstructura}
										placeholder="Ingresa un valor de ejemplo"
									/>
								</div>
							</div>
						{/if}

						<div class="mt-6 space-y-2">
							<Label for="campo-desc">Descripción funcional *</Label>
							<Textarea
								id="campo-desc"
								bind:value={borrador.campoEnCaptura.descripcion}
								rows={3}
								placeholder="Describe qué información representa este campo y cómo debe interpretarse durante la extracción."
							/>
						</div>

						<div class="mt-6 flex items-center justify-between gap-4">
							<div class="flex items-center gap-2">
								<Checkbox
									id="campo-obligatorio"
									checked={borrador.campoEnCaptura.obligatorio}
									onCheckedChange={(v) => (borrador.campoEnCaptura.obligatorio = v === true)}
								/>
								<Label for="campo-obligatorio" class="font-normal text-muted-foreground">
									Obligatorio
								</Label>
								<Tooltip.Provider>
									<Tooltip.Root>
										<Tooltip.Trigger>
											<Info class="size-3.5 text-muted-foreground" />
											<span class="sr-only">Qué significa "Obligatorio"</span>
										</Tooltip.Trigger>
										<Tooltip.Content side="top" class="max-w-64">
											Selecciona "Obligatorio" si el campo SIEMPRE aparece en el documento.
										</Tooltip.Content>
									</Tooltip.Root>
								</Tooltip.Provider>
							</div>

							<!-- Deshabilitado mientras el campo esté incompleto: es el único
							     camino para que se pueda guardar, y dejarlo picar sin efecto
							     visible se siente como que la app se tragó el clic. Ya NO
							     dice "Agregar otro campo" (cambio del 2026-09-03): ese texto
							     mezclaba dos ideas en un solo botón — guardar ESTE campo, y
							     dejar listo el formulario para el siguiente. "Guardar" hace
							     solo lo primero; lo segundo ahora es explícito, ver el botón
							     "Agregar campo" de más abajo. -->
							<Button
								variant="link"
								class="h-auto gap-1.5 p-0 text-primary"
								disabled={!puedeAgregar}
								onclick={guardarCampoEnCaptura}
							>
								<Save class="size-4" />
								Guardar
							</Button>
						</div>
					</div>
				{:else}
					<!-- Reemplaza al formulario mientras está oculto (ver
					     `mostrarFormularioCampo`): es el único camino para agregar un
					     campo MÁS después del primero. -->
					<button
						type="button"
						class="mt-8 flex max-w-3xl items-center gap-3 rounded-xl border border-dashed border-border px-6 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
						onclick={() => (mostrarFormularioCampo = true)}
					>
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
						>
							<CirclePlus class="size-4" />
						</span>
						<span class="text-sm font-medium text-foreground">Agregar campo</span>
					</button>
				{/if}

				{#if borrador.campos.length > 0}
					<h4 class="mt-8 text-xl font-semibold text-foreground">Campos agregados</h4>

					<div class="mt-4 flex max-w-3xl flex-col gap-4">
						{#each borrador.campos as campo (campo.id)}
							<!-- Duplicado contra los DEMÁS campos, no contra la lista completa:
							     de otro modo un campo editable se marcaría duplicado de sí mismo
							     en cuanto se abriera el modo edición, sin haber tocado nada. -->
							{@const nombreDuplicadoAqui =
								!altaEnCurso &&
								nombreCampoDuplicado(
									campo.nombre,
									borrador.campos.filter((c) => c.id !== campo.id)
								)}
							<div class="flex items-end gap-4">
								<div class="grid flex-1 gap-4 md:grid-cols-2">
									<div class="space-y-2">
										<Label for="agregado-nombre-{campo.id}">Nombre del campo</Label>
										{#if altaEnCurso}
											<!-- readonly, no disabled: `disabled` los saca del orden de
											     tabulación y del lector de pantalla, y este contenido sí
											     hay que poder leerlo. En una alta nueva la edición no existe
											     en el diseño; para cambiar algo se quita y se vuelve a
											     agregar. En modo edición o "Crear nueva versión" (abajo) sí
											     se puede tocar directo — a petición explícita del
											     2026-09-02: ya se pasó por Editar/Crear nueva versión a
											     propósito, así que no tiene sentido obligar a
											     quitar-y-reagregar solo para corregir un nombre. -->
											<Input
												id="agregado-nombre-{campo.id}"
												value={campo.nombre}
												readonly
												class="bg-muted text-muted-foreground"
											/>
										{:else}
											<div class="relative">
												<Input
													id="agregado-nombre-{campo.id}"
													bind:value={campo.nombre}
													aria-invalid={nombreDuplicadoAqui}
													aria-describedby={nombreDuplicadoAqui
														? `agregado-nombre-${campo.id}-error`
														: undefined}
													class={nombreDuplicadoAqui ? 'pr-9' : undefined}
												/>
												{#if nombreDuplicadoAqui}
													<AlertCircle
														class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-destructive"
													/>
												{/if}
											</div>
											{#if nombreDuplicadoAqui}
												<p id="agregado-nombre-{campo.id}-error" class="text-xs text-destructive">
													Ya existe un campo con este nombre. Utiliza uno diferente.
												</p>
											{/if}
										{/if}
									</div>
									<div class="space-y-2">
										<Label for="agregado-tipo-{campo.id}">Tipo de dato</Label>
										<!-- El tipo de un campo ya agregado se puede cambiar también en un alta nueva (2026-11-10, Moibe: «en ésta etapa quiero poder cambiar el tipo de dato»). -->
										<Select.Root
											type="single"
											value={campo.tipoDato}
											onValueChange={(v) => alCambiarTipoDato(campo, v)}
										>
											<Select.Trigger id="agregado-tipo-{campo.id}" class="w-full">
												{etiquetaTipo(campo.tipoDato) ?? 'Selecciona un tipo de campo'}
											</Select.Trigger>
											<Select.Content>
												{#each TIPOS_DE_DATO as tipo (tipo.value)}
													<Select.Item value={tipo.value} label={tipo.label} />
												{/each}
											</Select.Content>
										</Select.Root>
									</div>
								</div>

								<button
									type="button"
									aria-label={`Quitar el campo ${campo.nombre}`}
									class="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100"
									onclick={() => (campoAQuitar = { id: campo.id, nombre: campo.nombre })}
								>
									<Minus class="size-4" />
								</button>
							</div>
							{#if campo.tipoDato === 'grupo'}
								<!-- En una alta nueva los campos ya agregados no se editan (igual que el resto): solo se ven. En modo edición o «Crear nueva versión» sí. -->
								<div class="-mt-2"><SubcamposGrupo {campo} /></div>
							{/if}
						{/each}
					</div>
				{:else if !puedeAgregar}
					<!-- Se muestra EXACTAMENTE cuando `hayCampoAlAvanzar` es falso —
					     mismo momento en que "Guardar y agregar propiedades" está
					     deshabilitado. En cuanto el formulario de arriba queda listo
					     para entrar, este aviso desaparece y el botón se habilita a la
					     vez: no hay ventana en la que uno diga una cosa y el otro
					     otra. -->
					<p class="mt-4 max-w-3xl text-xs text-muted-foreground">
						Agrega al menos un campo de extracción para poder continuar al siguiente paso.
					</p>
				{/if}
			{:else}
				<h3 class="text-xl font-semibold text-foreground">Propiedades de campo</h3>
				<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
					Personaliza las propiedades del campo para mejorar la precisión y calidad de la
					extracción documental.
				</p>

				{#if borrador.campos.length === 0}
					<!-- Estado vacío que el frame no contempla: ahí siempre hay campos.
					     Desde el 2026-09-03 el botón del paso 2 ya NO deja avanzar sin
					     campos, así que por el flujo normal esto no debería verse — pero
					     el sidebar salta a cualquier paso ya visitado sin pasar por ese
					     botón, así que sigue siendo alcanzable: llegar al 3 con campos,
					     volver al 2 y quitarlos todos, y picar "3." desde el sidebar. Sin
					     esto la pantalla quedaría en blanco sin explicación. -->
					<div class="mt-10 rounded-xl border border-dashed border-border p-8 text-center">
						<p class="text-sm font-medium text-foreground">Todavía no hay campos que configurar</p>
						<p class="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
							Regresa al paso 2 y agrega al menos un campo de extracción para poder definir sus
							propiedades.
						</p>
					</div>
				{:else}
					<Accordion.Root type="single" class="mt-8 flex max-w-3xl flex-col gap-3">
						{#each borrador.campos as campo (campo.id)}
							<Accordion.Item
								value={campo.id}
								class="rounded-xl border border-border bg-background px-4 last:border-b"
							>
								<!-- `min-w-0` NO es decorativo: sin él, una descripción larga se sale
								     de la tarjeta. El Trigger es un flex item con `min-width: auto`, así
								     que su mínimo automático es el ancho de su contenido y se niega a
								     encogerse — medido: 1340px dentro de un contenedor de 653px. El
								     `truncate` del texto de adentro no puede hacer nada, porque su padre
								     ya viene inflado. Con `min-w-0` el botón sí encoge y el truncate
								     vuelve a servir. -->
								<Accordion.Trigger class="min-w-0 gap-3 hover:no-underline">
									<span
										class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card font-mono text-xs text-primary"
									>
										{'{ }'}
									</span>
									<span class="min-w-0 flex-1 text-left">
										<span class="block truncate text-sm font-medium text-foreground">
											{campo.nombre}
										</span>
										{#if campo.descripcion.trim()}
											<span class="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
												{campo.descripcion}
											</span>
										{/if}
									</span>
									<span
										class="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground"
									>
										{etiquetaTipo(campo.tipoDato) ?? campo.tipoDato}
									</span>
								</Accordion.Trigger>

								<!-- La línea vertical a la izquierda es el `line` de 22px del frame:
								     ata visualmente el panel con su encabezado. -->
								<Accordion.Content class="border-l border-border pb-4 pl-6 ml-4">
									<div class="grid gap-6 md:grid-cols-2">
										<div class="space-y-2">
											<Label for="umbral-{campo.id}">Umbral de confianza *</Label>
											<Select.Root type="single" bind:value={campo.umbralConfianza}>
												<Select.Trigger id="umbral-{campo.id}" class="w-full">
													{campo.umbralConfianza ? `${campo.umbralConfianza}%` : 'Selecciona un umbral'}
												</Select.Trigger>
												<Select.Content>
													{#each UMBRALES_CONFIANZA as u (u.value)}
														<Select.Item value={u.value} label={u.label} />
													{/each}
												</Select.Content>
											</Select.Root>
										</div>

										<div class="space-y-2">
											<Label for="regla-{campo.id}">Reglas de transformación</Label>
											<Select.Root type="single" bind:value={campo.reglaTransformacion}>
												<Select.Trigger id="regla-{campo.id}" class="w-full">
													<span class="truncate">
														{etiquetaRegla(campo.reglaTransformacion) ??
															'Selecciona regla de transformación'}
													</span>
												</Select.Trigger>
												<Select.Content>
													{#each REGLAS_TRANSFORMACION as r (r.value)}
														<Select.Item value={r.value} label={r.label} />
													{/each}
												</Select.Content>
											</Select.Root>
										</div>
									</div>

									{#if campo.tipoDato === 'lista'}
										<!-- Solo para tipo "Lista": son los valores permitidos del
										     campo, o sea `catalog_value` (2.3 del diccionario). Aparece
										     entre las reglas y la cardinalidad, como en el frame. -->
										{@const duplicado = valorListaDuplicado(
											campo.valorListaEnCaptura,
											campo.valoresLista
										)}
										{@const puedeAgregarValor =
											campo.valorListaEnCaptura.trim() !== '' && !duplicado}

										<div class="mt-6 space-y-2">
											<Label for="listado-{campo.id}">Agregar listado</Label>
											<Input
												id="listado-{campo.id}"
												bind:value={campo.valorListaEnCaptura}
												placeholder="Ingresa un listado personalizado"
												aria-invalid={duplicado}
												onkeydown={(e) => {
													// Enter agrega el valor: teclear una lista de diez
													// elementos sin poder usar Enter es innecesariamente
													// lento. No está en el frame, pero tampoco lo contradice.
													if (e.key === 'Enter') {
														e.preventDefault();
														agregarValorLista(campo);
													}
												}}
											/>
											{#if duplicado}
												<p class="text-xs text-destructive">
													Ese valor ya está en el listado.
												</p>
											{/if}

											<div class="flex justify-end">
												<Button
													variant="link"
													class="h-auto gap-1.5 p-0 text-primary"
													disabled={!puedeAgregarValor}
													onclick={() => agregarValorLista(campo)}
												>
													<CirclePlus class="size-4" />
													Agregar otro campo
												</Button>
											</div>

											{#if campo.valoresLista.length > 0}
												<div class="flex flex-wrap gap-2 pt-1">
													{#each campo.valoresLista as valor (valor)}
														<span
															class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pr-1.5 pl-3 text-xs text-foreground"
														>
															{valor}
															<button
																type="button"
																aria-label={`Quitar ${valor} del listado`}
																class="text-muted-foreground transition-colors hover:text-destructive"
																onclick={() => quitarValorLista(campo, valor)}
															>
																<CircleX class="size-3.5" />
															</button>
														</span>
													{/each}
												</div>
											{/if}
										</div>
									{/if}

									{#if campo.tipoDato === 'grupo'}
										<SubcamposGrupo {campo} soloLectura />
									{/if}

									<div class="mt-6 rounded-xl border border-border p-4">
										<p class="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
											Cardinalidad
											{#if campo.cardinalidadSugerida}
												<!-- La propuso Document AI con un solo ejemplo («Generar a partir de un documento»): conviene revisarla. -->
												<span
													class="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-normal text-primary"
													title="Biblioratum la propuso leyendo el documento de ejemplo. Revísala: un solo ejemplo no garantiza que el dato nunca se repita."
													data-testid="cardinalidad-sugerida">Sugerida por el documento</span
												>
											{/if}
										</p>
										<RadioGroup.Root
											bind:value={campo.cardinalidad}
											onValueChange={() => delete campo.cardinalidadSugerida}
											class="mt-3 gap-0"
										>
											{#each CARDINALIDADES as c, i (c.value)}
												{#if i > 0}
													<div class="my-3 border-t border-border"></div>
												{/if}
												<div class="flex items-start gap-3">
													<RadioGroup.Item
														value={c.value}
														id="card-{campo.id}-{c.value}"
														class="mt-0.5"
													/>
													<Label
														for="card-{campo.id}-{c.value}"
														class="flex-1 cursor-pointer font-normal"
													>
														<span class="block text-sm text-foreground">{c.label}</span>
														<span class="mt-1 block text-xs leading-relaxed text-muted-foreground">
															{c.descripcion}
														</span>
													</Label>
												</div>
											{/each}
										</RadioGroup.Root>
									</div>

									<!-- Mismo dato que el checkbox "Obligatorio" del paso 2: en el
									     diseño aparece en las dos pantallas, así que se enlaza a la
									     MISMA propiedad. Cambiarlo aquí lo cambia allá. -->
									<div class="mt-6 flex items-center gap-2">
										<Checkbox
											id="obligatorio-{campo.id}"
											checked={campo.obligatorio}
											onCheckedChange={(v) => (campo.obligatorio = v === true)}
										/>
										<Label for="obligatorio-{campo.id}" class="font-normal text-muted-foreground">
											Obligatorio
										</Label>
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger>
													<Info class="size-3.5 text-muted-foreground" />
													<span class="sr-only">Qué significa "Obligatorio"</span>
												</Tooltip.Trigger>
												<Tooltip.Content side="top" class="max-w-64">
													Selecciona "Obligatorio" si el campo SIEMPRE aparece en el documento.
												</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
								</Accordion.Content>
							</Accordion.Item>
						{/each}
					</Accordion.Root>
				{/if}
			{/if}
		</div>
	</div>

	<!-- El contenedor con role="status" está SIEMPRE montado, aunque esté vacío:
	     una región `aria-live` que se monta junto con su texto no se anuncia —
	     el lector de pantalla tiene que estar observándola de antes. Por eso la
	     bandera controla la tarjeta de adentro y no este div. Vacío no mide
	     nada, así que no separa nada.

	     Con el `mx-8` de la tarjeta el aviso queda alineado con el título
	     "Modelos documentales agregados" (el `p-8` del contenido). Hasta el
	     2026-11-04 llevaba además `pl-82.5`, el ancho de la barra lateral que la
	     Biblioteca tenía a la izquierda; al quitarse esa barra se fue también ese
	     padding (los avisos solo salen en la Biblioteca). En el frame el
	     aviso va debajo del modal entero y ocupa unos dos tercios; aquí el
	     panel es de altura completa, así que se adapta al pie de la columna de
	     contenido — que además es donde está el modelo que se acaba de
	     agregar. Anotado en docs/pendientes-ux.md. -->
	<div role="status" aria-live="polite">
		{#if avisoExito && vista === 'biblioteca'}
			<div
				data-testid="aviso-exito"
				class="mx-8 mb-8 flex items-start gap-3 rounded-lg border border-green-200 bg-linear-to-r from-green-50 to-emerald-100/70 px-5 py-4 dark:border-green-900 dark:from-green-950 dark:to-green-950/60"
			>
				<BadgeCheck class="size-5 shrink-0 fill-green-500 text-white" />
				<div class="min-w-0">
					<p class="text-sm font-semibold text-green-700 dark:text-green-300">Nuevo tipo documental agregado.</p>
					<!-- green-700 y no green-600: sobre `green-50`, el 600 a 12px da
					     ~3.1:1 de contraste y AA pide 4.5:1 para texto normal. El 700
					     llega a ~4.7:1 y además se parece más al verde apagado del
					     frame que el 600, que sale demasiado vivo. -->
					<p class="mt-1 max-w-2xl text-xs text-green-700 dark:text-green-300">
						La configuración se completó con éxito. El modelo documental está listo para activarse.
					</p>
				</div>
			</div>
		{/if}
		{#if errorActivacion && vista === 'biblioteca'}
			<!-- Gemelo rojo del aviso de éxito: el frame trae un "Alert error"
			     (1077:65797, 684x94) junto al Success. Sin poder ver sus píxeles
			     (cuota de Figma), espeja el diseño del verde con la paleta roja.
			     El texto del cuerpo es el error real del back, no uno genérico:
			     "no se pudo" sin el porqué obliga a adivinar. -->
			<div
				data-testid="aviso-error"
				class="mx-8 mb-8 flex items-start gap-3 rounded-lg border border-red-200 bg-linear-to-r from-red-50 to-rose-100/70 px-5 py-4 dark:border-red-900 dark:from-red-950 dark:to-red-950/60"
			>
				<BadgeAlert class="size-5 shrink-0 fill-red-500 text-white" />
				<div class="min-w-0">
					<p class="text-sm font-semibold text-red-700 dark:text-red-300">{tituloError}</p>
					<p class="mt-1 max-w-2xl text-xs text-red-700 dark:text-red-300">{errorActivacion}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- El pie solo existe en el wizard; la pantalla de entrada no lo tiene
	     (así está en Figma: ahí la única acción es el botón del centro). -->
	{#if vista === 'wizard'}
		<div class="flex items-center justify-between border-t border-border px-6 py-4">
			<!-- Verde, no el rojo del frame: ahí era "Cancelar registro" y el rojo
			     (--error) señalaba una acción destructiva. "Regresar" no lo es, y
			     dejarlo rojo hacía dudar antes de picarlo. Se usa el mismo
			     `text-green-600` que ya llevan "Listo" y "En configuración" en el
			     sidebar, que es el verde de éxito del archivo (--exito/exito-2). -->
			<Button variant="link" class="h-auto p-0 text-green-600" onclick={regresar}>
				Regresar
			</Button>
			<Button disabled={!canContinue} onclick={continuar}>{etiquetaAvance}</Button>
		</div>
	{:else if vista === 'calibracion'}
		<!-- "Guardar configuración" nacía deshabilitado (cuando el lado
		     derecho todavía era estático); habilitado desde el 2026-09-04 a
		     pedido explícito. Cada acción de esta pantalla (subir un
		     documento, guardar/editar/quitar un recorte) ya persiste sola en
		     cuanto ocurre — no hay nada "pendiente" que este botón tenga que
		     empujar — así que su función es la misma que "Cancelar
		     configuración" en cuanto a navegación (salir de Calibración,
		     mismo destino que la X, Escape y el clic fuera vía
		     `cerrarNivel`), pero como la acción AFIRMATIVA de "ya terminé de
		     configurar los ejemplos", en vez de la de salida. -->
		<div class="flex items-center justify-between border-t border-border px-6 py-4">
			<Button
				variant="link"
				class="h-auto p-0 text-destructive"
				onclick={() => (vista = 'biblioteca')}
			>
				Cancelar configuración
			</Button>
			<Button onclick={() => (vista = 'biblioteca')}>Guardar configuración</Button>
		</div>
	{/if}
</div>

<!-- Lo último que se hizo no quedó guardado en el servidor, o quedó distinto de lo que se veía. Es un AVISO y no una
     pregunta: ya pasó, no hay nada que cancelar. El texto lo pone el módulo de la biblioteca (`estadoBiblioteca`) según lo que
     pasó: el servidor no contestó (se reintenta solo unas veces), otra persona cambió o borró ese tipo antes (se cargó su
     versión), o el servidor no aceptó los datos. Antes esto hablaba del espacio del navegador; ya no hay tal límite. -->
<ConfirmarAccion
	abierto={estadoBiblioteca.falloAlGuardar}
	variante="destructivo"
	soloAviso
	titulo={estadoBiblioteca.avisoTitulo || 'No se pudo guardar'}
	mensaje={estadoBiblioteca.avisoMensaje || 'Lo último que hiciste no quedó guardado en el servidor.'}
	etiquetaConfirmar="Entendido"
	onConfirmar={reconocerFallaDeGuardado}
	onCerrar={reconocerFallaDeGuardado}
/>

<!-- Vive FUERA del Sheet a propósito: se porta a sí mismo al <body> y sube a
     z-60 para quedar encima del panel (z-50). Montarlo dentro del árbol del
     Sheet lo ataría a la vista que lo disparó. -->
<ConfirmarAccion
	abierto={campoAQuitar !== null}
	titulo="¿Quitar este campo?"
	mensaje={altaEnCurso
		? `Se eliminará "${campoAQuitar?.nombre ?? ''}" de este tipo documental. Los campos agregados no se pueden editar en una alta nueva, así que tendrías que volver a capturarlo desde cero.`
		: `Se eliminará "${campoAQuitar?.nombre ?? ''}" de este tipo documental. Esta acción no se puede deshacer.`}
	etiquetaConfirmar="Sí, quitar"
	onConfirmar={confirmarQuitarCampo}
	onCerrar={() => (campoAQuitar = null)}
/>

<!-- El mensaje se bifurca en si el tipo TIENE un procesador real (ver el
     comentario de `tipoAEliminar` arriba): ahí no solo se borra un renglón de
     la Biblioteca, también se destruye el Custom Extractor en Document AI.
     Callarse esa parte dejaría confirmar a ciegas algo que toca un recurso de
     GCP y no se puede deshacer. Desde que «Borrar» también sale en un tipo activo,
     la rama del procesador es la normal. Y dice qué procesos lo usan (`avisoDeProcesos`). -->
<ConfirmarAccion
	abierto={tipoAEliminar !== null}
	titulo="¿Borrar este tipo documental?"
	mensaje={tipoAEliminar?.tieneProcesador
		? `Se eliminará "${tipoAEliminar.nombre}" de la Biblioteca y su extractor. Esta acción es irreversible: se pierde el extractor junto con su configuración publicada.${avisoDeProcesos}`
		: `Se eliminará "${tipoAEliminar?.nombre ?? ''}" de la Biblioteca. Esta acción no se puede deshacer.${avisoDeProcesos}`}
	etiquetaConfirmar="Sí, borrar"
	onConfirmar={confirmarEliminarTipo}
	onCerrar={() => (tipoAEliminar = null)}
/>

<!-- A diferencia de quitar el documento compartido (que se lleva TODOS los
     recortes sin preguntar), quitar el de UN SOLO campo sí se confirma —
     cambio pedido el 2026-09-04: es una decisión más deliberada (dejar ese
     campo sin recorte asignado) que simplemente rehacerlo, que ya cubre
     "Editar" sin pasar por aquí. -->
<ConfirmarAccion
	abierto={recorteAQuitar !== null}
	titulo="¿Quitar este recorte?"
	mensaje={`Se quitará el recorte guardado para "${recorteAQuitar?.nombreCampo ?? ''}". El campo se queda sin ejemplo asignado hasta que se recorte de nuevo sobre el mismo documento.`}
	etiquetaConfirmar="Sí, quitar"
	onConfirmar={confirmarQuitarRecorte}
	onCerrar={() => (recorteAQuitar = null)}
/>

<!-- Más grave que quitar un solo recorte: esto se lleva TODOS los de ESTA
     instancia de un golpe, el mensaje lo dice explícito — las demás
     instancias del tipo (si hay) no se tocan. -->
<ConfirmarAccion
	abierto={documentoAQuitar !== null}
	titulo="¿Quitar este documento de ejemplo?"
	mensaje={`Se quitará "${tipoEnCalibracion?.documentosEjemplo.find((d) => d.id === documentoAQuitar)?.nombre ?? ''}" junto con TODOS los recortes ya guardados sobre él, en todos los campos. Esta acción no se puede deshacer.`}
	etiquetaConfirmar="Sí, quitar"
	onConfirmar={confirmarQuitarDocumentoEjemplo}
	onCerrar={() => (documentoAQuitar = null)}
/>

<CargarDocumentoEjemplo
	abierto={modalDocumentoAbierto}
	tipoId={calibrandoId}
	onGuardado={(idNuevo) => (documentoSeleccionadoId = idNuevo)}
	onCerrar={() => (modalDocumentoAbierto = false)}
/>

<RecortarEjemploCampo
	abierto={modalRecorteAbierto}
	tipoId={calibrandoId}
	campoNombre={campoRecorteNombre}
	documento={documentoSeleccionado}
	recorteExistente={(campoRecorteNombre &&
		documentoSeleccionado &&
		tipoEnCalibracion?.recortesPorDocumento[documentoSeleccionado.id]?.[campoRecorteNombre]?.recorte) ||
		null}
	otrosRecortes={otrosRecortesDelDocumento}
	paginaInicial={paginaInicialDelRecorte}
	onCambioPagina={(n) => {
		if (documentoSeleccionado) paginaDeTrabajo[documentoSeleccionado.id] = n;
	}}
	onCerrar={() => (modalRecorteAbierto = false)}
/>

<RecomendacionEjemplos
	abierto={tipoPocosEjemplos !== null}
	onAgregarMas={irACalibracionDesdeAviso}
	onContinuar={confirmarActivacionConPocosEjemplos}
	onCerrar={() => (tipoPocosEjemplos = null)}
/>

<ProbarExtraccion
	abierto={tipoEnPrueba !== null}
	tipo={tipoEnPrueba}
	archivosIniciales={pruebaDeId ? ejemplosDeTipo(pruebaDeId) : []}
	onCerrar={() => (pruebaDeId = null)}
/>

<GenerarCamposDesdeDocumento
	abierto={generarCamposAbierto}
	nombreTipo={borrador.nombre}
	descripcionTipo={borrador.descripcion}
	existentes={borrador.campos.map((c) => c.nombre)}
	ejemplosPrevios={ejemplosParaGenerar}
	onCerrar={() => (generarCamposAbierto = false)}
	onAgregar={agregarPropuestos}
/>
