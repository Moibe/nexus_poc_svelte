<script lang="ts">
	import { untrack } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import SetupIcon from '$lib/components/icons/SetupIcon.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ArchiveIcon from '$lib/components/icons/ArchiveIcon.svelte';
	import ArrowRightIcon from '$lib/components/icons/ArrowRightIcon.svelte';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import Check from '@lucide/svelte/icons/check';
	import Save from '@lucide/svelte/icons/save';
	import X from '@lucide/svelte/icons/x';
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
	import Plus from '@lucide/svelte/icons/plus';
	import UsersRound from '@lucide/svelte/icons/users-round';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Clock from '@lucide/svelte/icons/clock';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Archive from '@lucide/svelte/icons/archive';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import CargarEjemploDocumental from './CargarEjemploDocumental.svelte';
	import HistorialVersiones from './HistorialVersiones.svelte';
	import { formatearTamano } from '$lib/state/bandeja.svelte';
	import type { TipoDocumentalGuardado } from '$lib/state/configuracion.svelte';
	import {
		borradorTipoDocumental,
		agregarCampoEnCaptura,
		agregarValorLista,
		borrarRecorteEjemplo,
		campoCompleto,
		campoIntacto,
		activarTipoDocumental,
		archivarTipoDocumental,
		crearNuevaVersion,
		eliminarTipoDocumental,
		cargarTipoDocumental,
		etiquetaVersion,
		etiquetaVertical,
		guardarTipoDocumental,
		hayBorrador,
		irAPaso,
		pasoNavegable,
		tiposDocumentales,
		VERTICALES,
		guardarBorrador,
		limpiarBorrador,
		nombreCampoDuplicado,
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

	// El módulo tiene tres vistas:
	//  - 'biblioteca': la pantalla de entrada, con el listado de modelos (hoy
	//    vacío) y el botón para arrancar uno nuevo.
	//  - 'wizard': el alta de tipo documental en 3 pasos.
	//  - 'calibracion': "Ejemplo documental" del menú de la tarjeta (2026-09-02,
	//    sin frame de Figma — se construyó desde una captura). Por ahora SOLO
	//    puebla el árbol izquierdo con los campos reales del tipo; qué muestra y
	//    qué hace el lado derecho queda para la siguiente conversación.
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

	// El tipo documental que se está por eliminar. Guarda también si TIENE un
	// procesador real (no si está "activo": un borrador nacido de una futura
	// `crearNuevaVersion()` podría conservar su `procesadorId` aunque ya no
	// esté activo — ver esa función). El diálogo de confirmación necesita
	// saberlo para advertir que esto también borra el Custom Extractor en
	// Document AI — omitir esa advertencia cuando sí aplica sería dejar que
	// alguien destruya un recurso real de GCP sin haberlo sabido de antemano.
	//
	// Hoy, con el menú mostrando "Borrar" SOLO para tipos no-activos, este
	// campo casi siempre es `false` — pero la función de abajo no depende de
	// esa coincidencia, por si el día de mañana un borrador sí llega a
	// tenerlo.
	let tipoAEliminar = $state<{ id: string; nombre: string; tieneProcesador: boolean } | null>(
		null
	);
	// El borrado en vuelo. Puede tardar unos segundos (borra también el
	// dataset en Google), así que la tarjeta necesita mostrar algo mientras
	// tanto — no es instantáneo como quitar un campo del borrador.
	let eliminandoId = $state<string | null>(null);

	// El tipo documental que se está por archivar (SIEMPRE uno activo: es la
	// alternativa no destructiva a "Borrar" para ese caso). A diferencia de
	// eliminar, es instantáneo y local — no hay `archivandoId` porque no hay
	// nada que esperar.
	let tipoAArchivar = $state<{ id: string; nombre: string } | null>(null);

	function confirmarArchivarTipo() {
		const objetivo = tipoAArchivar;
		tipoAArchivar = null;
		if (!objetivo) return;
		archivarTipoDocumental(objetivo.id);
		// Igual que al eliminar: si era el seleccionado, se limpia la selección
		// para no dejar la columna derecha apuntando a un modelo que ya no se
		// lista.
		if (seleccionadoId === objetivo.id) seleccionadoId = null;
	}

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
		// El tipo ya no existe: si era el seleccionado en el árbol, limpiar la
		// selección para que la columna derecha vuelva al estado vacío con su
		// pista, en vez de quedar en blanco sin explicación.
		if (seleccionadoId === objetivo.id) seleccionadoId = null;
	}

	// La rama seleccionada en el árbol del sidebar. Es un FILTRO de la vista,
	// no parte del modelo: por eso vive aquí y no se persiste. null = sin
	// filtro, se listan todos.
	let seleccionadoId = $state<string | null>(null);

	// El tipo cuyo "Historial de versiones" está desplegado EN LÍNEA bajo su
	// tarjeta (null = nada desplegado). Vive en el propio objeto, no en un id:
	// `HistorialVersiones.svelte` solo lee, no necesita buscarlo de vuelta en
	// `tiposDocumentales`. Cambio pedido el 2026-09-03: la primera versión
	// abría un modal; se pidió la misma lista pero sin overlay, ahí mismo.
	let historialTipo = $state<TipoDocumentalGuardado | null>(null);

	// Lo que existe en la Biblioteca de cara al usuario: un tipo `archivado`
	// (ver `archivarTipoDocumental`) sigue en `localStorage`, pero no debe
	// listarse en el árbol ni en las tarjetas — es justo lo que "Archivar"
	// promete. Todo lo que antes leía `tiposDocumentales` para RENDERIZAR usa
	// esto en su lugar; el estado de verdad sigue siendo `tiposDocumentales`.
	const tiposEnBiblioteca = $derived(tiposDocumentales.filter((t) => t.estado !== 'archivado'));

	// Lo que la columna derecha lista. SIN selección no se lista nada: la
	// lista aparece cuando se elige un modelo en el árbol (cambio pedido el
	// 2026-08-28; antes el default eran todos). El área no queda muda — abajo
	// hay una línea que dice qué hacer.
	const tiposVisibles = $derived(
		seleccionadoId ? tiposEnBiblioteca.filter((t) => t.id === seleccionadoId) : []
	);

	// Picar la rama ya seleccionada la des-selecciona y la lista vuelve a
	// quedar vacía, igual que al entrar.
	function seleccionarRama(id: string) {
		seleccionadoId = seleccionadoId === id ? null : id;
	}

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

	const nombreDuplicado = $derived(
		nombreCampoDuplicado(borrador.campoEnCaptura.nombre, borrador.campos)
	);

	// El formulario se puede "Agregar" cuando está completo Y su nombre no choca
	// con uno ya agregado.
	const puedeAgregar = $derived(campoCompleto(borrador.campoEnCaptura) && !nombreDuplicado);

	// Si al picar "continuar" va a EXISTIR al menos un campo — ya agregado, o
	// completo en el formulario y listo para entrar (`continuar()` lo agrega
	// solo). Nombrado aparte porque el aviso de "agrega al menos un campo" de
	// abajo debe mostrarse exactamente cuando esto es falso, ni antes ni
	// después.
	const hayCampoAlAvanzar = $derived(borrador.campos.length > 0 || puedeAgregar);

	// Se puede pasar al paso 3 si va a quedar al menos un campo (cambio
	// pedido el 2026-09-03: antes los campos eran opcionales para avanzar,
	// a propósito, para no atrapar a quien quería un tipo documental sin
	// campos — pero un tipo sin campos no tiene nada que activar ni que
	// mapear, así que se revirtió esa decisión).
	const canContinue = $derived(
		borrador.paso === 1
			? borrador.nombre.trim() !== '' && borrador.descripcion.trim() !== ''
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
			vista = 'biblioteca';
			avisoExito = false;
			tituloError = '';
			errorActivacion = '';
			seleccionadoId = null;
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
	/** La X del header. Sube un nivel en vez de cerrar de golpe. */
	function cerrarNivel() {
		if (vista === 'wizard' || vista === 'calibracion') vista = 'biblioteca';
		else open = false;
	}

	function regresar() {
		if (borrador.paso > 1) borrador.paso -= 1;
		else vista = 'biblioteca';
	}

	/** "Nuevo tipo documental": SIEMPRE en blanco. Retomar uno existente se hace
	 *  picando su tarjeta en la lista, que es donde el usuario lo busca. */
	function nuevoTipoDocumental() {
		// RESCATE antes de limpiar. El diseño se apoya en un invariante: "todo lo
		// capturado ya viajó a la biblioteca, así que limpiar no pierde nada". Eso
		// es cierto para datos nuevos —el tipo se guarda al salir del paso 1— pero
		// NO para un borrador escrito por una versión anterior a que existiera la
		// biblioteca: ese llega con `idGuardado` en null y sin tarjeta que lo abra,
		// así que este botón era su única affordance visible... y lo destruía. En
		// la versión que escribió ese dato, este mismo botón era el que lo RETOMABA.
		//
		// `guardarTipoDocumental` no hace nada si no hay nombre, así que un
		// borrador vacío se limpia como siempre.
		if (!borrador.idGuardado && hayBorrador()) guardarTipoDocumental();
		limpiarBorrador();
		avisoExito = false;
		tituloError = '';
		errorActivacion = '';
		seleccionadoId = null;
		altaEnCurso = true;
		// Alta nueva: siempre en blanco, así que siempre hay que mostrar el
		// formulario del paso 2 — no hay campos que listar todavía.
		mostrarFormularioCampo = true;
		vista = 'wizard';
	}

	/**
	 * Picar la tarjeta de un modelo ACTIVO no hace nada, a propósito.
	 *
	 * Se probó una versión que sí abría el wizard —en modo solo lectura, con un
	 * candado explicando por qué y una invitación a "Crear nueva versión"— pero
	 * se retiró el mismo día a pedido explícito: por ahora no hay editing real
	 * que ofrecer, así que ni la explicación ni la invitación tienen a dónde
	 * llevar. Ver docs/pendientes-ux.md.
	 *
	 * Eso sigue vigente para la TARJETA. `crearNuevaVersion()` ya no está sin
	 * usar, eso sí: el menú (ver `iniciarNuevaVersion`, abajo) la llama
	 * directamente. La diferencia es que ahí la acción es explícita —"Crear
	 * nueva versión" dice exactamente lo que va a pasar—, mientras que picar la
	 * tarjeta entera no lo es.
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
			seleccionadoId = null;
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
	function iniciarNuevaVersion(id: string) {
		if (crearNuevaVersion(id) && cargarTipoDocumental(id)) {
			avisoExito = false;
			tituloError = '';
			errorActivacion = '';
			seleccionadoId = null;
			altaEnCurso = false;
			// Mismo criterio que `abrirTipoDocumental`: conserva sus campos
			// (`crearNuevaVersion` los copia), así que el formulario arranca
			// oculto salvo que de verdad no traiga ninguno.
			mostrarFormularioCampo = borrador.campos.length === 0;
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
	const tipoEnCalibracion = $derived(
		calibrandoId ? (tiposDocumentales.find((t) => t.id === calibrandoId) ?? null) : null
	);

	// El modal de "Cargar ejemplo documental" (subir + recortar). Desde que
	// "Guardar" persiste el recorte, sí hace falta saber para qué campo se
	// abrió — por NOMBRE, no por id (ver el comentario de `recortesEjemplo`
	// en configuracion.svelte.ts: el id de un campo no sobrevive un refresh).
	let modalEjemploAbierto = $state(false);
	let campoEjemploNombre = $state<string | null>(null);

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
	}

	function continuar() {
		if (!canContinue) return;
		// Si quedó un campo completo sin "Agregar", se agrega en vez de perderlo.
		if (borrador.paso === 2) agregarCampoEnCaptura();

		// El tipo documental entra a la biblioteca al salir del PASO 1, no al
		// final: en cuanto tiene nombre y descripción ya es un tipo documental.
		// Los campos son configuración suya, no requisito para que exista.
		//
		// Volver a llamarla en el paso 2 no duplica: `guardarTipoDocumental`
		// actualiza la entrada cuando el borrador ya trae `idGuardado`. Así los
		// campos se agregan a la MISMA entrada que se creó un paso antes.
		if (borrador.paso === 1 || borrador.paso === 2) guardarTipoDocumental();
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

			// El borrador se limpia para que el próximo "Nuevo tipo documental"
			// arranque en blanco. Lo capturado no se pierde — vive en la biblioteca.
			limpiarBorrador();
			vista = 'biblioteca';
			// El recién guardado queda seleccionado en el árbol: el aviso de
			// éxito debe verse JUNTO a su tarjeta, no sobre un área vacía que
			// obligaría a ir a buscarlo. Es además lo que muestra el diseño.
			seleccionadoId = idEnBiblioteca;
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

<Sheet.Root bind:open>
	<!-- Escape y el clic fuera se interceptan para que hagan lo MISMO que la X:
	     subir un nivel. Dejarlos cerrando del todo mientras la X regresaba a la
	     Biblioteca era justo la inconsistencia que se acababa de quitar — el
	     usuario no distingue "dismiss" por teclado de "dismiss" por botón.
	     `preventDefault()` cancela el cierre que hace bits-ui por su cuenta y
	     `cerrarNivel()` decide a dónde ir; desde la Biblioteca sí cierra, así que
	     nunca queda uno atrapado. -->
	<Sheet.Content
		onEscapeKeydown={(e) => {
			e.preventDefault();
			cerrarNivel();
		}}
		onInteractOutside={(e) => {
			e.preventDefault();
			cerrarNivel();
		}}
		showCloseButton={false}
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<!-- header . navigation -->
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				{vista === 'calibracion' ? 'Configuración de tipo documental' : 'Modulo de configuración'}
			</Sheet.Title>
			<!-- La X sube UN NIVEL, no cierra siempre: estando en el wizard regresa a
			     la Biblioteca; estando ya en la Biblioteca sí cierra el módulo. Antes
			     era un `Sheet.Close` puro, así que a media captura de un tipo te
			     sacaba hasta el Home — dos niveles de golpe, y para volver había que
			     reabrir el módulo desde el engrane.
			     Escape y el clic fuera hacen lo mismo que este botón: ver los
			     manejadores de Sheet.Content. -->
			<button
				type="button"
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
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
				<!-- El ícono de "Calibración" es una aproximación: esta pantalla
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
					<h2 class="text-lg font-medium text-foreground">Calibración de campos extraídos</h2>
					<Sheet.Description class="text-sm">Carga tus documentos referencia</Sheet.Description>
				{:else}
					<h2 class="text-lg font-medium text-foreground">Motor de configuración documental</h2>
					<Sheet.Description class="text-sm">
						Configura la forma en que NexusDoc comprende tus documentos.
					</Sheet.Description>
				{/if}
			</div>
		</div>

		<div class="flex min-h-0 flex-1">
			<!-- statusbar: 330px, fondo #fcfcfc y bordes de 2px según Figma -->
			<aside
				class="w-82.5 shrink-0 overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
			>
				{#if vista === 'biblioteca'}
					<p class="text-xs text-foreground">Configuración</p>
					<!-- Tarjeta "Biblioteca": el padre del árbol. Picarla limpia el filtro
					     — es el gesto natural de "ver todo lo que cuelga de aquí". Por ser
					     botón, su contenido va en <span> (contenido de frase), no en <p>. -->
					<button
						type="button"
						data-testid="raiz-biblioteca"
						class="mt-6 flex w-full items-center gap-3 text-left"
						onclick={() => (seleccionadoId = null)}
					>
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
						>
							<ArchiveIcon />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-medium text-foreground">Biblioteca</span>
							<span class="mt-2 block text-xs text-muted-foreground">
								Localiza tu listado de documentos configurados.
							</span>
						</span>
						<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />
					</button>

					<!-- Submenú de la Biblioteca: un renglón por modelo, colgando en árbol.
					     Es el frame `listado` (1077:65481), que hasta ahora estaba sin
					     construir por no tener el diseño. Su geometría se respeta al pixel:

					       · fila de 38px de alto (`listado`, 282x38)
					       · el eje del árbol cae en x=44 — que es exactamente donde empieza
					         el texto "Biblioteca" de arriba (icono de 32 + gap-3 de 12), así
					         que el hijo queda alineado con el padre y no con su ícono
					       · tramo vertical de 22px centrado en la fila (`line`, y=8 h=22)
					       · guion horizontal de 11.5px a media altura (`line`, y=11 w=11.5)
					       · la etiqueta arranca en x=19.5 respecto al eje (`text`, x=19.5)

					     El tramo vertical va POR FILA, no corrido de arriba abajo: en el
					     frame la línea vive dentro del renglón, así que con varios modelos
					     quedan segmentos separados en vez de un eje continuo. Se deja como
					     está el diseño; con un solo modelo las dos lecturas son idénticas y
					     no hay con qué desempatar. Anotado en docs/pendientes-ux.md.

					     El renglón FILTRA la columna derecha: picar una rama deja visible
					     solo su tarjeta, picarla de nuevo (o picar "Biblioteca") vuelve a
					     mostrar todas. Retomar el modelo quedó solo en la tarjeta — un
					     mismo gesto no debe filtrar y navegar a la vez. -->
					{#if tiposEnBiblioteca.length > 0}
						<ul class="mt-4">
							{#each tiposEnBiblioteca as tipo (tipo.id)}
								<li class="relative flex h-9.5 items-center pl-11">
									<span
										class="absolute top-1/2 left-11 h-5.5 w-px -translate-y-1/2 bg-border"
									></span>
									<span class="absolute top-1/2 left-11 h-px w-[11.5px] bg-border"></span>
									<button
										type="button"
										data-testid="rama-tipo"
										aria-pressed={seleccionadoId === tipo.id}
										class="ml-[19.5px] min-w-0 truncate text-left text-sm font-medium transition-colors {seleccionadoId ===
										tipo.id
											? 'text-primary'
											: 'text-foreground hover:text-primary'}"
										onclick={() => seleccionarRama(tipo.id)}
									>
										{tipo.nombre}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				{:else if vista === 'calibracion'}
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
									<!-- Mismo lenguaje visual que el árbol de la Biblioteca: eje a
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
						<!-- El estado se calcula contra `pasoMaximo`, no contra `paso`: al
						     regresar al paso 1 desde el sidebar, los pasos 2 y 3 ya visitados
						     deben seguir diciendo "Listo". Con `paso` volverían a "Por
						     configurar" y se leería como si se hubiera perdido el avance. -->
						{@const state =
							n === borrador.paso
								? 'activo'
								: n <= borrador.pasoMaximo
									? 'completado'
									: 'pendiente'}
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

			<div class="flex-1 overflow-y-auto p-8">
				{#if vista === 'biblioteca'}
					{#if tiposEnBiblioteca.length > 0}
						<!-- Biblioteca poblada. Estructura tomada del frame 1077:65410:
						     título "Modelos documentales agregados" y una tarjeta por
						     modelo (682x72). No pude ver los píxeles —se agotó la cuota de
						     Figma— así que el espaciado y el detalle fino quedan pendientes
						     de una pasada de fidelidad contra el frame. -->
						<h3 class="text-xl font-semibold text-foreground">Modelos documentales agregados</h3>

						{#if tiposVisibles.length === 0}
							<!-- Sin selección la lista es intencionalmente vacía, pero un área
							     en blanco se lee como falla. Una línea dice qué hacer. -->
							<p class="mt-4 text-sm text-muted-foreground" data-testid="pista-seleccion">
								Selecciona un modelo en la Biblioteca para ver su detalle.
							</p>
						{/if}

						<div class="mt-4 flex flex-col gap-3">
							{#each tiposVisibles as tipo (tipo.id)}
								<!-- Tarjeta del frame 1077:65410 (sección HU038). Sus medidas:
								     botón de 82x38, caja de menú de 24x24 con el glifo de 12x12.

								     Ya NO es un <button> entera. Ahora conviven aquí tres controles
								     —retomar, Activar y el menú— y un <button> dentro de otro es
								     HTML inválido: el navegador deshace el anidamiento y los clics
								     dejan de llegar a quien deben. La zona clicable para retomar se
								     acotó al ícono y los textos, que es lo que el usuario asocia con
								     "abrir esto". De paso se arregló otra invalidez que venía de
								     antes: había <div> y <p> dentro del <button>, y un botón solo
								     admite contenido de frase. -->
								<div
									class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3"
								>
									<button
										type="button"
										data-testid="tarjeta-tipo"
										class="flex min-w-0 flex-1 items-center gap-4 rounded-lg text-left transition-colors hover:opacity-80"
										onclick={() => abrirTipoDocumental(tipo.id)}
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
									</button>

									<!-- Los dos estados de la tarjeta están dibujados en el archivo: sin
									     activar lleva un Button de 82x38 (1077:65581), y ya activada lo
									     cambia por un Badge de 59x22 (1077:66268). El texto del badge no
									     se puede leer del volcado —es una instancia de componente— así
									     que "Activo" es una suposición mía.
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
										<span
											data-testid="insignia-activo"
											class="flex h-5.5 w-14.75 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-700"
										>
											Activo
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
											class="h-9.5 w-20.5 shrink-0"
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
												     el <span> que lo envuelve, no el ítem mismo. -->
												<Tooltip.Provider>
													<Tooltip.Root>
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

											<!-- Ya NO es un interruptor real (era `DropdownMenu.SwitchItem`):
											     picarle en cualquier parte del renglón lleva a la pantalla de
											     calibración (2026-09-02, a pedido explícito). El interruptor que
											     se ve es puramente decorativo y SIEMPRE se pinta apagado (cambio
											     pedido el 2026-09-03): activarlo de verdad todavía no existe, así
											     que mostrarlo prendido sería mentir sobre un estado que no hace
											     nada. Al pasar el mouse por encima, un tooltip dice "Activar" —
											     adelanta la acción futura sin dispararla todavía, por ahora nada
											     más que eso. `tipo.ejemploDocumental` se sigue guardando
											     (default `false`), pero ninguna pantalla vuelve a leerlo. -->
											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												onSelect={() => abrirCalibracion(tipo.id)}
											>
												<UsersRound class="size-4 text-muted-foreground" />
												<span>Ejemplo documental</span>
												<Tooltip.Provider>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<span
																	{...props}
																	class="ml-auto inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input"
																>
																	<span
																		class="size-4 translate-x-0.5 rounded-full bg-background shadow-sm"
																	></span>
																</span>
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
														<Tooltip.Content side="left" class="pointer-events-none!"
															>Activar</Tooltip.Content
														>
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
											     más descubrible). Toggle: volver a picarlo lo oculta. -->
											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												disabled={!tipo.historialVersiones.length}
												onSelect={() =>
													(historialTipo = historialTipo?.id === tipo.id ? null : tipo)}
											>
												<Calendar class="size-4 text-muted-foreground" />
												<span>Historial de versiones</span>
											</DropdownMenu.Item>

											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												disabled
											>
												<Clock class="size-4 text-muted-foreground" />
												<span>Eventos</span>
											</DropdownMenu.Item>

											<!-- "Borrar" y "Archivar" son el MISMO renglón, nunca los dos a la
											     vez: cambio pedido para que un modelo ACTIVO ya no se pueda
											     borrar directamente desde aquí (perdería su Custom Extractor sin
											     vuelta atrás) — para ese caso el renglón pasa a "Archivar", que
											     no toca Document AI y solo saca el tipo de la Biblioteca. Solo un
											     borrador (nunca activado) conserva el "Borrar" real. -->
											{#if tipo.estado === 'activo'}
												<DropdownMenu.Item
													class="h-11.5 gap-3 px-2 whitespace-nowrap"
													onSelect={() => (tipoAArchivar = { id: tipo.id, nombre: tipo.nombre })}
												>
													<Archive class="size-4 text-muted-foreground" />
													<span>Archivar</span>
												</DropdownMenu.Item>
											{:else}
												<DropdownMenu.Item
													variant="destructive"
													class="h-11.5 gap-3 px-2 whitespace-nowrap"
													onSelect={() =>
														(tipoAEliminar = {
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
								</div>

								{#if historialTipo?.id === tipo.id}
									<HistorialVersiones {tipo} onCerrar={() => (historialTipo = null)} />
								{/if}
							{/each}
						</div>

						<div class="mt-8">
							<Button class="w-60" onclick={nuevoTipoDocumental}>Nuevo tipo documental</Button>
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
								Comienza configurando un modelo documental
							</p>
							<p class="mt-1 max-w-md text-xs text-muted-foreground">
								Agrega un tipo documental para comenzar a configurar los campos, reglas de extracción
								y validaciones del modelo.
							</p>
						</div>
						<Button class="w-60" onclick={nuevoTipoDocumental}>Nuevo tipo documental</Button>
					</div>
					{/if}
				{:else if vista === 'calibracion'}
					<!-- Réplica de la captura compartida; sin frame de Figma que
					     verificar. El pedido de esta iteración es el árbol de la
					     izquierda — esto de aquí seguía siendo la parte "todo lo demás".
					     "Cargar ejemplo documental" ya deja de ser estático (2026-09-02):
					     abre `CargarEjemploDocumental`, que sube un PDF o imagen y permite
					     dibujar un recorte sobre él. -->
					<h3 class="text-xl font-semibold text-foreground">Configurar ejemplos de extracción</h3>
					<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
						Carga y etiqueta un documento de ejemplo para asociar sus valores a los campos
						configurados. Estos ejemplos ayudan al motor de IA a mejorar la precisión y el nivel de
						confianza durante la extracción de información.
					</p>

					{#if tipoEnCalibracion}
						<div class="mt-8 max-w-3xl">
							{#each tipoEnCalibracion.campos as campo (campo.id)}
								{@const ejemplo = tipoEnCalibracion.recortesEjemplo[campo.nombre]}
								<div class="border-b border-border py-4 last:border-0">
									<div class="flex items-center justify-between gap-4">
										<span class="text-sm font-medium text-foreground">{campo.nombre}</span>
										<!-- Deshabilitado con un ejemplo ya guardado: para reemplazarlo
										     hay que quitarlo primero (la X de la tarjeta de abajo), no
										     sobreescribirlo directo. Esto también resuelve un pendiente
										     que quedó documentado el 2026-09-02 ("reabrirlo siempre
										     arranca en el dropzone... ni con el recorte ya guardado
										     mostrado de vuelta"): ahora ese caso ya no es alcanzable
										     desde la UI. -->
										<Button
											variant="outline"
											size="sm"
											disabled={Boolean(ejemplo)}
											onclick={() => {
												campoEjemploNombre = campo.nombre;
												modalEjemploAbierto = true;
											}}
										>
											Cargar ejemplo documental
										</Button>
									</div>

									{#if ejemplo}
										<!-- Lo que "Guardar" del modal de recorte dejó (2026-09-03):
										     de qué documento salió, y el recorte YA HECHO como imagen —
										     nunca un texto, porque aquí no corrió ningún OCR todavía.
										     Mismo lenguaje visual que las tarjetas de archivo de
										     `DocumentoRow.svelte` (icono + nombre + subtítulo + quitar). -->
										<div class="mt-4 flex max-w-lg flex-col gap-3">
											<div
												class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
											>
												<span
													class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
												>
													<FileIcon />
												</span>
												<div class="min-w-0 flex-1">
													<p class="truncate text-sm font-medium text-foreground">
														{ejemplo.documento.nombre}
													</p>
													<p class="text-xs text-muted-foreground">
														{ejemplo.documento.tipo} · {formatearTamano(ejemplo.documento.tamanoBytes)}
													</p>
												</div>
												<button
													type="button"
													aria-label={`Quitar el ejemplo de ${campo.nombre}`}
													class="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
													onclick={() => borrarRecorteEjemplo(tipoEnCalibracion.id, campo.nombre)}
												>
													<X class="size-3.5" />
												</button>
											</div>

											<div>
												<p class="mb-2 text-xs font-medium text-muted-foreground">
													Recorte guardado
												</p>
												<img
													src={ejemplo.imagenDataUrl}
													alt={`Recorte guardado para ${campo.nombre}`}
													class="max-h-40 max-w-full rounded-lg border border-border object-contain"
												/>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{:else if borrador.paso === 1}
					<h3 class="text-xl font-semibold text-foreground">Nuevo tipo documental</h3>
					<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
						Ingresa la información necesaria para registrar un nuevo tipo documental y continuar
						con la configuración de sus reglas de procesamiento.
					</p>

					<div class="mt-8 max-w-2xl space-y-6">
						<div class="space-y-2">
							<Label for="nombre-tipo">Nombre de tipo documental *</Label>
							<Input
								id="nombre-tipo"
								bind:value={borrador.nombre}
								placeholder="Ingresa el nombre del tipo documental a configurar"
							/>
						</div>

						<div class="space-y-2">
							<Label for="descripcion-tipo">Descripción *</Label>
							<Textarea
								id="descripcion-tipo"
								bind:value={borrador.descripcion}
								rows={3}
								placeholder="Describe el propósito y contenido de este tipo documental."
							/>
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
					<h3 class="text-xl font-semibold text-foreground">Nuevo campo de extracción</h3>
					<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
						Completa la información requerida para agregar un nuevo campo al modelo documental y
						mejorar la precisión de la extracción automática.
					</p>

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
									<Select.Root type="single" bind:value={borrador.campoEnCaptura.tipoDato}>
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
							class="mt-8 flex max-w-3xl items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
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
											{#if altaEnCurso}
												<Input
													id="agregado-tipo-{campo.id}"
													value={etiquetaTipo(campo.tipoDato) ?? campo.tipoDato}
													readonly
													class="bg-muted text-muted-foreground"
												/>
											{:else}
												<Select.Root type="single" bind:value={campo.tipoDato}>
													<Select.Trigger id="agregado-tipo-{campo.id}" class="w-full">
														{etiquetaTipo(campo.tipoDato) ?? 'Selecciona un tipo de campo'}
													</Select.Trigger>
													<Select.Content>
														{#each TIPOS_DE_DATO as tipo (tipo.value)}
															<Select.Item value={tipo.value} label={tipo.label} />
														{/each}
													</Select.Content>
												</Select.Root>
											{/if}
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
									<Accordion.Trigger class="gap-3 hover:no-underline">
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

										<div class="mt-6 rounded-xl border border-border p-4">
											<p class="text-sm font-medium text-foreground">Cardinalidad</p>
											<RadioGroup.Root bind:value={campo.cardinalidad} class="mt-3 gap-0">
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

		     `pl-82.5` es el ancho del sidebar (la misma medida que su `w-82.5`), y
		     con el `mx-8` de la tarjeta el aviso queda alineado exactamente con el
		     título "Modelos documentales agregados". Sin ese padding el borde
		     izquierdo caía en tierra de nadie: ni con el título ni con el sidebar,
		     cruzando por debajo de la división en dos columnas. En el frame el
		     aviso va debajo del modal entero y ocupa unos dos tercios; aquí el
		     panel es de altura completa, así que se adapta al pie de la columna de
		     contenido — que además es donde está el modelo que se acaba de
		     agregar. Anotado en docs/pendientes-ux.md. -->
		<div role="status" aria-live="polite" class="pl-82.5">
			{#if avisoExito && vista === 'biblioteca'}
				<div
					data-testid="aviso-exito"
					class="mx-8 mb-8 flex items-start gap-3 rounded-lg border border-green-200 bg-linear-to-r from-green-50 to-emerald-100/70 px-5 py-4"
				>
					<BadgeCheck class="size-5 shrink-0 fill-green-500 text-white" />
					<div class="min-w-0">
						<p class="text-sm font-semibold text-green-700">Nuevo tipo documental agregado.</p>
						<!-- green-700 y no green-600: sobre `green-50`, el 600 a 12px da
						     ~3.1:1 de contraste y AA pide 4.5:1 para texto normal. El 700
						     llega a ~4.7:1 y además se parece más al verde apagado del
						     frame que el 600, que sale demasiado vivo. -->
						<p class="mt-1 max-w-2xl text-xs text-green-700">
							La configuración se completó con éxito. El modelo documental está listo para
							activarse y ejecutar una prueba de procesamiento para validar su funcionamiento.
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
					class="mx-8 mb-8 flex items-start gap-3 rounded-lg border border-red-200 bg-linear-to-r from-red-50 to-rose-100/70 px-5 py-4"
				>
					<BadgeAlert class="size-5 shrink-0 fill-red-500 text-white" />
					<div class="min-w-0">
						<p class="text-sm font-semibold text-red-700">{tituloError}</p>
						<p class="mt-1 max-w-2xl text-xs text-red-700">{errorActivacion}</p>
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
			<!-- "Guardar configuración" nace deshabilitado a propósito: todavía no
			     hay nada real que guardar (el lado derecho es estático, ver el
			     comentario de arriba) — mismo criterio que "Cargar ejemplo
			     documental". "Cancelar configuración" sí funciona: salir de aquí
			     siempre es válido, y ya lo cubren también la X, Escape y el clic
			     fuera (`cerrarNivel`). -->
			<div class="flex items-center justify-between border-t border-border px-6 py-4">
				<Button
					variant="link"
					class="h-auto p-0 text-destructive"
					onclick={() => (vista = 'biblioteca')}
				>
					Cancelar configuración
				</Button>
				<Button disabled>Guardar configuración</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>

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
     GCP y no se puede deshacer. En la práctica, con "Borrar" mostrándose SOLO
     para tipos no-activos, casi siempre cae en la rama simple. -->
<ConfirmarAccion
	abierto={tipoAEliminar !== null}
	titulo="¿Borrar este tipo documental?"
	mensaje={tipoAEliminar?.tieneProcesador
		? `Se eliminará "${tipoAEliminar.nombre}" de la Biblioteca Y su Custom Extractor en Document AI. Esta acción es irreversible: se pierde el procesador junto con su configuración publicada.`
		: `Se eliminará "${tipoAEliminar?.nombre ?? ''}" de la Biblioteca. Esta acción no se puede deshacer.`}
	etiquetaConfirmar="Sí, borrar"
	onConfirmar={confirmarEliminarTipo}
	onCerrar={() => (tipoAEliminar = null)}
/>

<!-- A diferencia de Borrar, archivar NO toca Google ni pierde el registro:
     el mensaje lo dice explícitamente para que no se lea con la misma
     gravedad que un borrado real. -->
<ConfirmarAccion
	abierto={tipoAArchivar !== null}
	variante="neutral"
	titulo="¿Archivar este tipo documental?"
	mensaje={`"${tipoAArchivar?.nombre ?? ''}" dejará de listarse en la Biblioteca. Su Custom Extractor en Document AI NO se toca: sigue existiendo tal cual.`}
	etiquetaConfirmar="Sí, archivar"
	onConfirmar={confirmarArchivarTipo}
	onCerrar={() => (tipoAArchivar = null)}
/>

<CargarEjemploDocumental
	abierto={modalEjemploAbierto}
	tipoId={calibrandoId}
	campoNombre={campoEjemploNombre}
	onCerrar={() => (modalEjemploAbierto = false)}
/>
