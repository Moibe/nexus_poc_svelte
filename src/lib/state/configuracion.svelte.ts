/**
 * Borrador del tipo documental que se está capturando en el Módulo de
 * configuración (el wizard de 3 pasos).
 *
 * PROVISIONAL, igual que la bandeja y el pipeline: esto vive en el navegador
 * mientras SQL Server no existe. Su destino es una `config_version` en estado
 * `draft`, y cuando esa tabla exista este módulo pasa a leer y escribir contra
 * la API en vez de contra el almacenamiento del navegador. La forma de aquí se
 * eligió parecida a propósito para que esa mudanza sea de fontanería y no de
 * rediseño.
 */

import { browser } from '$app/environment';

/**
 * Los seis tipos que ofrece el desplegable en Figma (frame 972:53474). Su
 * destino es `field_definition.data_type` del diccionario.
 *
 * OJO con `lista`: implica que el campo tiene un conjunto cerrado de valores
 * permitidos, o sea filas en `catalog_value` (2.3). Hoy nada las captura — eso
 * es trabajo del paso 3 ("Propiedades de campo"), que todavía no existe.
 */
export const TIPOS_DE_DATO = [
	{ value: 'texto', label: 'Texto' },
	{ value: 'numero', label: 'Número' },
	{ value: 'fecha', label: 'Fecha' },
	{ value: 'moneda', label: 'Moneda' },
	{ value: 'booleano', label: 'Booleano' },
	{ value: 'lista', label: 'Lista' }
] as const;

const VALORES_TIPO = TIPOS_DE_DATO.map((t) => t.value) as readonly string[];

/**
 * Umbral de confianza por campo (paso 3). Debajo de él, el dato extraído
 * debería rutearse a revisión humana en vez de darse por bueno.
 *
 * OJO, y esto está MEDIDO, no supuesto: dos corridas del mismo documento con la
 * MISMA versión de modelo devuelven confianzas ligeramente distintas (98.74 vs
 * 97.18 en campos idénticos). Un campo que quede pegado a su umbral va a rutear
 * a revisión en una corrida y no en la siguiente, sin que nada haya cambiado.
 * Conviene elegir umbrales con margen, no al filo. Ver la nota de la sección 2.7
 * en nexus_back/docs/solicitudes-dba.md.
 */
export const UMBRALES_CONFIANZA = ['50', '60', '70', '80', '90', '100'].map((v) => ({
	value: v,
	label: `${v}%`
}));

/**
 * Reglas de transformación del paso 3, tal como las lista el desplegable del
 * diseño (frame `option 6`).
 *
 * Estas son reglas de NORMALIZACIÓN, y son distintas del `transform` que se le
 * propuso al DBA en la sección 2.6 —`token_1` / `token_2`, que PARTE un valor
 * compuesto. Son complementarias: una parte el dato, la otra lo limpia. El
 * catálogo de `extractor_field_map.transform` va a tener que contemplar ambas
 * familias.
 *
 * Dos de estas ya existen hardcodeadas en el back para INE: la normalización de
 * fechas a ISO en `_valor_normalizado` y la limpieza de puntuación del domicilio
 * en `_limpiar_ine`. Cuando esto se guarde en base, esas dos dejan de ser código
 * fijo y pasan a ser configuración.
 */
export const REGLAS_TRANSFORMACION = [
	{ value: 'fecha_iso', label: 'Normalización de fechas a ISO 8601' },
	{ value: 'quitar_moneda', label: 'Eliminación de símbolos de moneda' },
	{ value: 'cambiar_caja', label: 'Conversión a mayúsculas o minúsculas' },
	{ value: 'trim_espacios', label: 'Trim de espacios' },
	{ value: 'valor_canonico', label: 'Variantes textuales a valor canónico' }
] as const;

/**
 * Cardinalidad. Junto con `obligatorio` forma exactamente las cuatro
 * combinaciones del `occurrenceType` de Document AI, verificadas contra su
 * discovery document:
 *
 *   obligatorio + único    → REQUIRED_ONCE
 *   obligatorio + múltiple → REQUIRED_MULTIPLE
 *   opcional    + único    → OPTIONAL_ONCE
 *   opcional    + múltiple → OPTIONAL_MULTIPLE
 *
 * O sea que estos dos controles de la UI son, juntos, un solo campo del esquema
 * del procesador. Es la correspondencia más limpia que hay entre el wizard y
 * Document AI.
 */
export const CARDINALIDADES = [
	{
		value: 'unico',
		label: 'Valor único (Single Value)',
		descripcion:
			'El dato aparece una sola vez en el documento. El sistema extraerá únicamente una coincidencia para este campo.'
	},
	{
		value: 'multiple',
		label: 'Múltiples valores (Multi Value)',
		descripcion:
			'El dato aparece varias veces en el documento. El sistema identificará y extraerá todas las coincidencias encontradas para este campo.'
	}
] as const;

const VALORES_UMBRAL = UMBRALES_CONFIANZA.map((u) => u.value) as readonly string[];
const VALORES_REGLA = REGLAS_TRANSFORMACION.map((r) => r.value) as readonly string[];

export type CampoBorrador = {
	/** Solo para la llave del #each; no viaja a la base. */
	id: string;
	nombre: string;
	tipoDato: string;
	/**
	 * Un valor de EJEMPLO que muestra la forma esperada del dato
	 * (`POL-2026-00045871`). Opcional — el frame no lo marca con asterisco.
	 *
	 * Su destino natural en el diccionario es `field_definition.prompt_hint`:
	 * es exactamente el tipo de pista que alimenta el prompt ensamblado. No es
	 * una expresión regular ni una validación, es un ejemplo para el motor.
	 */
	valorEstructura: string;
	descripcion: string;
	obligatorio: boolean;

	// ── Propiedades del paso 3 ──────────────────────────────────────────────
	/** Debajo de este porcentaje, el dato debería ir a revisión humana. */
	umbralConfianza: string;
	/** Regla de normalización a aplicar. Vacío = ninguna. */
	reglaTransformacion: string;
	/** `unico` | `multiple`. Con `obligatorio` arma el occurrenceType. */
	cardinalidad: string;
	/**
	 * Valores permitidos cuando `tipoDato === 'lista'`. Su destino en el
	 * diccionario es `catalog_value` (2.3), una fila por valor.
	 *
	 * NO se borran al cambiar el tipo de dato a otro: quedan guardados aunque la
	 * sección deje de mostrarse. Tirar lo que alguien escribió porque tocó un
	 * desplegable es peor que dejar un dato inerte, y si regresa a "Lista" los
	 * encuentra donde los dejó.
	 */
	valoresLista: string[];
	/** Lo que se está tecleando en "Agregar listado", antes de volverse chip. */
	valorListaEnCaptura: string;
};

export type BorradorTipoDocumental = {
	nombre: string;
	descripcion: string;
	vertical: string;
	/** Los campos YA agregados, los que se listan bajo "Campos agregados". */
	campos: CampoBorrador[];
	/** El formulario de arriba. Vive aparte de la lista a propósito: en Figma
	 *  siempre está en blanco y es el que da de alta, no un elemento más. */
	campoEnCaptura: CampoBorrador;
	/** Si este borrador ya se guardó, el id de su entrada en la biblioteca.
	 *  Sirve para que volver a guardar ACTUALICE en vez de duplicar. */
	idGuardado: string | null;
	/** En qué paso del wizard se quedó (1-3). */
	paso: number;
	/**
	 * El paso más avanzado al que se llegó **por el flujo normal**. Es lo que
	 * habilita la navegación hacia atrás desde el sidebar: un paso solo se
	 * puede picar si ya se visitó una vez.
	 *
	 * Un solo número alcanza porque el wizard es lineal: llegar al 3 implica
	 * haber pasado por el 1 y el 2. Si algún día hubiera ramas, esto tendría
	 * que volverse un conjunto de pasos visitados.
	 */
	pasoMaximo: number;
	/** ISO-8601 de la última vez que se persistió, tal como venía al rehidratar.
	 *  No se actualiza en memoria al guardar — el valor fresco va al payload. */
	actualizadoEn: string | null;
};

// NO usar crypto.randomUUID: esa API solo existe en contexto seguro y el server
// de CSI sirve por HTTP plano, donde ni siquiera está definida. Misma razón que
// en bandeja.svelte.ts. Esto solo tiene que ser único dentro de una lista.
let contadorCampo = 0;
function idCampo(): string {
	contadorCampo += 1;
	return `campo-${Date.now().toString(36)}-${contadorCampo}`;
}

export function campoVacio(): CampoBorrador {
	return {
		id: idCampo(),
		nombre: '',
		tipoDato: '',
		valorEstructura: '',
		descripcion: '',
		// Obligatorio por default. Además de ser lo pedido, es lo que dicen los
		// datos: en el procesador de INE, 15 de los 19 campos activos están
		// marcados "Obligatoria una vez". El caso común es que el dato deba estar.
		//
		// Solo aplica a campos NUEVOS. `leerCampo` sigue leyendo `obligatorio`
		// como venga de localStorage — cambiar el default no debe reescribir la
		// decisión que alguien ya tomó sobre un campo existente.
		obligatorio: true,
		// 50% viene del frame, que muestra ese valor ya seleccionado. Es un
		// default bajo: acepta casi cualquier lectura sin mandarla a revisión.
		umbralConfianza: '50',
		reglaTransformacion: '',
		cardinalidad: 'unico',
		valoresLista: [],
		valorListaEnCaptura: ''
	};
}

// Función y no constante: `campoEnCaptura` es un objeto, y una constante
// compartida haría que limpiar el borrador reusara la MISMA referencia que ya
// está en el estado reactivo — mutarla en un lado la mutaría en el otro.
function vacio(): BorradorTipoDocumental {
	return {
		nombre: '',
		descripcion: '',
		vertical: '',
		campos: [],
		campoEnCaptura: campoVacio(),
		idGuardado: null,
		paso: 1,
		pasoMaximo: 1,
		actualizadoEn: null
	};
}

/**
 * La llave lleva versión en el nombre. Si algún día cambia la forma del
 * borrador, se sube el número y los navegadores con la forma vieja simplemente
 * no encuentran nada — en vez de leer un objeto incompatible y romper el
 * wizard con datos de otra época.
 */
const LLAVE = 'nexusdoc:borrador-tipo-documental:v1';

/**
 * localStorage (no sessionStorage) porque así se pidió, y porque sobrevivir a
 * un refresh accidental es justo lo que salva el trabajo capturado.
 *
 * Si se quiere que el borrador muera al cerrar la pestaña, este es el ÚNICO
 * lugar que hay que tocar: cambiar `localStorage` por `sessionStorage` aquí y
 * en `escribir`/`limpiar`. La API es idéntica.
 */
function almacen(): Storage | null {
	// Durante el render del servidor no hay `window`: SvelteKit ejecuta este
	// módulo en Node antes de mandarlo al navegador, y tocar localStorage ahí
	// truena el render entero.
	if (!browser) return null;
	try {
		return window.localStorage;
	} catch {
		// Puede lanzar, no solo venir vacío: navegación privada en algunos
		// navegadores y las configuraciones que bloquean "datos de sitios"
		// tiran una excepción al ACCEDER a la propiedad, no al usarla.
		return null;
	}
}

/** Normaliza un campo venido de localStorage. `null` si no es ni un objeto. */
function leerCampo(c: unknown): CampoBorrador | null {
	if (typeof c !== 'object' || c === null) return null;
	const d = c as Record<string, unknown>;
	return {
		// El id se REGENERA en vez de confiar en el guardado: si dos pestañas
		// escribieron, podrían venir repetidos, y un #each de Svelte con llaves
		// duplicadas rompe el render.
		id: idCampo(),
		nombre: typeof d.nombre === 'string' ? d.nombre : '',
		tipoDato: typeof d.tipoDato === 'string' && VALORES_TIPO.includes(d.tipoDato) ? d.tipoDato : '',
		valorEstructura: typeof d.valorEstructura === 'string' ? d.valorEstructura : '',
		descripcion: typeof d.descripcion === 'string' ? d.descripcion : '',
		obligatorio: d.obligatorio === true,
		umbralConfianza:
			typeof d.umbralConfianza === 'string' && VALORES_UMBRAL.includes(d.umbralConfianza)
				? d.umbralConfianza
				: '50',
		reglaTransformacion:
			typeof d.reglaTransformacion === 'string' && VALORES_REGLA.includes(d.reglaTransformacion)
				? d.reglaTransformacion
				: '',
		cardinalidad: d.cardinalidad === 'multiple' ? 'multiple' : 'unico',
		valoresLista: Array.isArray(d.valoresLista)
			? d.valoresLista.filter((v: unknown): v is string => typeof v === 'string')
			: [],
		valorListaEnCaptura:
			typeof d.valorListaEnCaptura === 'string' ? d.valorListaEnCaptura : ''
	};
}

function leer(): BorradorTipoDocumental | null {
	const store = almacen();
	if (!store) return null;
	try {
		const crudo = store.getItem(LLAVE);
		if (!crudo) return null;
		const datos = JSON.parse(crudo);
		// El contenido de localStorage es entrada NO confiable: lo pudo dejar
		// una versión anterior de la app, o alguien desde la consola. Se valida
		// campo por campo en vez de confiar en el JSON.
		if (typeof datos !== 'object' || datos === null) return null;

		const campos = Array.isArray(datos.campos)
			? (datos.campos.map(leerCampo).filter(Boolean) as CampoBorrador[])
			: [];
		const paso =
			Number.isInteger(datos.paso) && datos.paso >= 1 && datos.paso <= 3 ? datos.paso : 1;
		const pasoMaximoLeido =
			Number.isInteger(datos.pasoMaximo) && datos.pasoMaximo >= 1 && datos.pasoMaximo <= 3
				? (datos.pasoMaximo as number)
				: 1;

		return {
			nombre: typeof datos.nombre === 'string' ? datos.nombre : '',
			descripcion: typeof datos.descripcion === 'string' ? datos.descripcion : '',
			vertical: typeof datos.vertical === 'string' ? datos.vertical : '',
			campoEnCaptura: leerCampo(datos.campoEnCaptura) ?? campoVacio(),
			campos,
			idGuardado: typeof datos.idGuardado === 'string' ? datos.idGuardado : null,
			paso,
			// `pasoMaximo` se DERIVA, no se lee suelto. Dos razones, las dos con
			// consecuencias reales:
			//
			// 1. Un borrador viejo no trae la propiedad y caía en 1. Como el
			//    $effect de ConfigSheet sincroniza el borrador hacia la biblioteca
			//    AL MONTAR —sin que el usuario toque nada— ese 1 se escribía encima
			//    del valor que `leerPasoMaximo` acababa de inferir para el tipo
			//    guardado. La migración se anulaba sola, y peor: dejaba el 1
			//    explícito en disco, así que la inferencia (que solo actúa cuando
			//    la propiedad FALTA) ya nunca volvía a correr.
			//
			// 2. Invariante `pasoMaximo >= paso`. Leerlos por separado permitía
			//    rehidratar pares que ningún escritor produce (paso 3 con máximo 1),
			//    y ahí el sidebar anunciaba "Por configurar" el paso 2 mientras el
			//    usuario estaba parado en el 3.
			//
			// El piso por `campos` es conservador: tener campos prueba que se
			// visitó el paso 2, nada más. No se concede el 3 sin evidencia.
			pasoMaximo: Math.max(pasoMaximoLeido, paso, campos.length > 0 ? 2 : 1),
			actualizadoEn: typeof datos.actualizadoEn === 'string' ? datos.actualizadoEn : null
		};
	} catch {
		return null;
	}
}

export const borradorTipoDocumental = $state<BorradorTipoDocumental>(leer() ?? vacio());

/** ¿Hay algo capturado que valga la pena conservar? */
export function hayBorrador(): boolean {
	return (
		borradorTipoDocumental.nombre.trim() !== '' ||
		borradorTipoDocumental.descripcion.trim() !== '' ||
		borradorTipoDocumental.vertical !== '' ||
		borradorTipoDocumental.campos.length > 0 ||
		!campoIntacto(borradorTipoDocumental.campoEnCaptura)
	);
}

/**
 * ¿Ya hay un campo con ese nombre?
 *
 * La comparación ignora mayúsculas y espacios de los extremos a propósito:
 * `curp`, `CURP` y ` Curp ` son el MISMO campo para cualquiera que lea la
 * pantalla, y dejarlos convivir produce dos `field_definition` que compiten por
 * el mismo dato. Del lado de Document AI el nombre es la llave del `EntityType`,
 * así que duplicarlo tampoco tiene sentido allá.
 *
 * Lo que NO se normaliza es el separador: `fecha nacimiento` y
 * `fecha_nacimiento` se consideran distintos, porque ahí sí hay una decisión de
 * nomenclatura que no nos toca adivinar.
 */
export function nombreCampoDuplicado(nombre: string, campos: CampoBorrador[]): boolean {
	const n = nombre.trim().toLowerCase();
	if (n === '') return false;
	return campos.some((c) => c.nombre.trim().toLowerCase() === n);
}

/** Mueve el formulario a la lista y lo deja en blanco. No hace nada si el campo
 *  no está completo — el botón que lo llama ya viene deshabilitado en ese caso,
 *  esto es el segundo cinturón. */
export function agregarCampoEnCaptura(): boolean {
	const c = borradorTipoDocumental.campoEnCaptura;
	if (!campoCompleto(c)) return false;
	// Segundo cinturón: el botón ya viene deshabilitado, pero `continuar()`
	// también llama a esta función para no perder un campo a medio capturar, y
	// ahí sí podría colarse un duplicado.
	if (nombreCampoDuplicado(c.nombre, borradorTipoDocumental.campos)) return false;
	borradorTipoDocumental.campos.push({ ...$state.snapshot(c), id: idCampo() });
	borradorTipoDocumental.campoEnCaptura = campoVacio();
	return true;
}

export function quitarCampo(id: string) {
	const i = borradorTipoDocumental.campos.findIndex((c) => c.id === id);
	if (i !== -1) borradorTipoDocumental.campos.splice(i, 1);
}

/** Un campo está completo cuando tiene sus tres obligatorios. */
export function campoCompleto(c: CampoBorrador): boolean {
	return c.nombre.trim() !== '' && c.tipoDato !== '' && c.descripcion.trim() !== '';
}

/** Un campo al que no se le ha tocado nada. Se ignoran al guardar.
 *
 *  `valorEstructura` SÍ cuenta aquí aunque sea opcional: si alguien escribió un
 *  ejemplo y nada más, el formulario no está intacto y no se debe tirar sin
 *  avisar. Pero NO cuenta en `campoCompleto`, porque no es obligatorio. */
export function campoIntacto(c: CampoBorrador): boolean {
	return (
		c.nombre.trim() === '' &&
		c.tipoDato === '' &&
		c.valorEstructura.trim() === '' &&
		c.descripcion.trim() === ''
	);
}

export function guardarBorrador() {
	const store = almacen();
	if (!store) return;
	try {
		// Un borrador vacío no es un borrador: se QUITA la llave en vez de dejar
		// un objeto de campos en blanco. Esto hace que el almacenamiento sea una
		// función pura de los datos y no dependa del orden en que corran las
		// cosas — que es justo lo que falló antes: `limpiarBorrador` hacía
		// removeItem, pero el $effect del componente se disparaba después por la
		// mutación y volvía a escribir la llave vacía.
		if (!hayBorrador()) {
			store.removeItem(LLAVE);
			return;
		}
		// El timestamp se arma en el payload y NO se escribe en el estado
		// reactivo: mutar `$state` desde dentro de un `$effect` es la receta de
		// los bucles de actualización, aunque este en particular no se leyera.
		//
		// $state.snapshot porque el objeto está envuelto en un proxy de Svelte y
		// JSON.stringify sobre el proxy no serializa lo que uno espera.
		const payload = {
			...$state.snapshot(borradorTipoDocumental),
			actualizadoEn: new Date().toISOString()
		};
		store.setItem(LLAVE, JSON.stringify(payload));
	} catch {
		// Cuota llena o almacenamiento bloqueado. No se avisa al usuario: el
		// wizard sigue funcionando en memoria, solo pierde la red de seguridad
		// del refresh. Romper la captura por no poder guardar el respaldo sería
		// peor que la falla que se intenta cubrir.
	}
}

export function limpiarBorrador() {
	Object.assign(borradorTipoDocumental, vacio());
	const store = almacen();
	if (!store) return;
	try {
		store.removeItem(LLAVE);
	} catch {
		/* mismo caso que arriba */
	}
}


// ─────────────────────────────────────────────────────────────────────────────
// Biblioteca de tipos documentales guardados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un tipo documental ya guardado. Su destino en la base es un `document_type`
 * más su `config_version` con los `field_definition` — o sea que esto que hoy es
 * UN objeto plano se va a partir en tres tablas. Se deja plano a propósito
 * mientras no exista la base: inventar aquí la normalización sin poder probarla
 * contra SQL Server solo agregaría formas que después habría que corregir.
 */
export type TipoDocumentalGuardado = {
	id: string;
	nombre: string;
	descripcion: string;
	vertical: string;
	campos: CampoBorrador[];
	/** Hasta qué paso se configuró. Al retomarlo, esos pasos quedan navegables
	 *  sin tener que recorrer el wizard de nuevo. */
	pasoMaximo: number;
	/** ISO-8601 de cuándo se guardó por primera vez. */
	guardadoEn: string;
	/** Precursor de `config_version.status`. `activo` es lo que marca el botón
	 *  "Activar" de la tarjeta (HU038). OJO: aquí NO se valida todavía que los
	 *  campos requeridos tengan mapeo, que es la regla de integridad #3 de la
	 *  sección 2.6 del diccionario — esa validación necesita el back.
	 *
	 *  `archivado` lo pone `archivarTipoDocumental()`: es la alternativa NO
	 *  destructiva a "Borrar" para un modelo activo — no toca Document AI, solo
	 *  saca el tipo de la Biblioteca. Todavía no hay pantalla de "Archivados"
	 *  para verlos ni un camino de vuelta; el registro simplemente deja de
	 *  listarse en el árbol y en las tarjetas. */
	estado: 'borrador' | 'activo' | 'archivado';
	/** Cuántas veces se ha PUBLICADO esta configuración a Document AI. 0 = nunca.
	 *  Es el precursor de `config_version.version_no` del diccionario, y por eso
	 *  cuenta activaciones y no ediciones: lo que versiona es lo que se publicó,
	 *  no lo que se tecleó. En el frame de la tarjeta activada se muestra como
	 *  `v0.0.2`; la no activada no lleva versión, que es coherente — no hay
	 *  versión publicada hasta que se publica. */
	version: number;
	/** Id del Custom Extractor de Document AI que "Activar" creó (o adoptó)
	 *  para este tipo. Vacío mientras el tipo siga en borrador. */
	procesadorId: string;
	/** La versión foundation con la que nació el procesador. Se guarda para
	 *  FIJARLA en cada extracción: la default de Google cambia sin aviso y la
	 *  reproducibilidad ya nos mordió una vez. */
	procesadorVersion: string;
	/** El interruptor "Ejemplo documental" del menú de la tarjeta. Todavía no
	 *  hace nada más que recordarse: no hay ejemplo que adjuntar ni a dónde
	 *  mandarlo. Se persiste para que el interruptor no mienta al reabrir. */
	ejemploDocumental: boolean;
};

const LLAVE_BIBLIOTECA = 'nexusdoc:tipos-documentales:v1';

/**
 * Hasta qué paso se configuró un tipo guardado — con MIGRACIÓN para los que se
 * guardaron antes de que existiera `pasoMaximo`.
 *
 * El problema concreto que resuelve: un tipo guardado hace días no trae la
 * propiedad. Leerlo como 1 hacía que, al retomarlo desde la biblioteca, los
 * pasos 2 y 3 NO fueran navegables — aunque el tipo tuviera sus campos y sus
 * propiedades ya definidas. Nada se perdía, pero la app se comportaba peor con
 * datos viejos que con nuevos, y sin explicación visible.
 *
 * La inferencia solo se aplica cuando la propiedad FALTA. Un dato nuevo siempre
 * trae su valor real, así que esto no relaja la regla de "solo se navega a lo
 * ya visitado" — es una migración de una sola vez:
 *
 *   - Existe en la biblioteca → necesariamente salió del paso 1, así que ≥ 2.
 *     Un tipo solo se guarda al pasar de ese paso.
 *   - Tiene campos → el paso 3 tiene algo real que mostrar (el acordeón de esos
 *     campos), así que se concede 3. Estos datos son anteriores a la función; la
 *     alternativa era dejarlos artificialmente cerrados para siempre.
 */
function leerPasoMaximo(d: Record<string, unknown>): number {
	const guardado = d.pasoMaximo;
	if (Number.isInteger(guardado) && (guardado as number) >= 1 && (guardado as number) <= 3) {
		return guardado as number;
	}
	const cuantosCampos = Array.isArray(d.campos) ? d.campos.length : 0;
	return cuantosCampos > 0 ? 3 : 2;
}

let contadorTipo = 0;
function idTipo(): string {
	contadorTipo += 1;
	return `tipo-${Date.now().toString(36)}-${contadorTipo}`;
}

function leerBiblioteca(): TipoDocumentalGuardado[] {
	const store = almacen();
	if (!store) return [];
	try {
		const crudo = store.getItem(LLAVE_BIBLIOTECA);
		if (!crudo) return [];
		const datos = JSON.parse(crudo);
		if (!Array.isArray(datos)) return [];
		return datos
			.filter((d) => typeof d === 'object' && d !== null && typeof d.nombre === 'string')
			.map((d: Record<string, unknown>) => ({
				id: typeof d.id === 'string' ? d.id : idTipo(),
				nombre: d.nombre as string,
				descripcion: typeof d.descripcion === 'string' ? d.descripcion : '',
				vertical: typeof d.vertical === 'string' ? d.vertical : '',
				campos: Array.isArray(d.campos)
					? (d.campos.map(leerCampo).filter(Boolean) as CampoBorrador[])
					: [],
				pasoMaximo: leerPasoMaximo(d),
				guardadoEn: typeof d.guardadoEn === 'string' ? d.guardadoEn : new Date().toISOString(),
				// Se acepta 'activo' o 'archivado' solo si están escritos tal cual.
				// Cualquier otra cosa —incluido lo que guardaron las versiones
				// anteriores, que ni siquiera tenían el campo— cae en 'borrador', que
				// es el estado seguro: un modelo mal leído no debe amanecer activo en
				// producción (ni, por la misma razón, oculto por error como archivado).
				estado:
					d.estado === 'activo'
						? ('activo' as const)
						: d.estado === 'archivado'
							? ('archivado' as const)
							: ('borrador' as const),
				// Lo guardado antes de que existiera este campo no trae `version`. Si
				// ese tipo ya estaba activo, se le infiere 1: se publicó una vez,
				// aunque nadie lo hubiera contado. Un borrador arranca en 0.
				version:
					Number.isInteger(d.version) && (d.version as number) >= 0
						? (d.version as number)
						: d.estado === 'activo'
							? 1
							: 0,
				procesadorId: typeof d.procesadorId === 'string' ? d.procesadorId : '',
				procesadorVersion: typeof d.procesadorVersion === 'string' ? d.procesadorVersion : '',
				ejemploDocumental: d.ejemploDocumental === true
			}));
	} catch {
		return [];
	}
}

export const tiposDocumentales = $state<TipoDocumentalGuardado[]>(leerBiblioteca());

function guardarBiblioteca() {
	const store = almacen();
	if (!store) return;
	try {
		if (tiposDocumentales.length === 0) {
			store.removeItem(LLAVE_BIBLIOTECA);
			return;
		}
		store.setItem(LLAVE_BIBLIOTECA, JSON.stringify($state.snapshot(tiposDocumentales)));
	} catch {
		/* cuota llena o almacenamiento bloqueado; ver guardarBorrador */
	}
}

/**
 * Guarda el borrador actual en la biblioteca y devuelve su id.
 *
 * Si el borrador ya se había guardado (`idGuardado`), ACTUALIZA esa entrada en
 * vez de crear otra. Sin eso, pasar dos veces por el paso 2 —algo normal si el
 * usuario regresa a corregir un campo— dejaría dos tipos documentales iguales
 * en la lista.
 */
/**
 * La versión como la escribe el diseño: `0.0.2`. Se usa el tercer dígito porque
 * cada publicación es un cambio de configuración, no de producto; los otros dos
 * quedan libres para cuando haya criterio de qué es un cambio mayor.
 * Devuelve '' si nunca se ha publicado, para que quien lo use no tenga que
 * preguntar por el estado.
 */
export function etiquetaVersion(version: number): string {
	return version > 0 ? `0.0.${version}` : '';
}

export function guardarTipoDocumental(): string | null {
	const b = borradorTipoDocumental;
	if (b.nombre.trim() === '') return null;

	const datos = {
		nombre: b.nombre.trim(),
		descripcion: b.descripcion.trim(),
		vertical: b.vertical,
		campos: $state.snapshot(b.campos) as CampoBorrador[],
		pasoMaximo: b.pasoMaximo
	};

	const existente = b.idGuardado
		? tiposDocumentales.find((tp) => tp.id === b.idGuardado)
		: undefined;

	if (existente) {
		Object.assign(existente, datos);
	} else {
		const nuevo: TipoDocumentalGuardado = {
			id: idTipo(),
			...datos,
			guardadoEn: new Date().toISOString(),
			estado: 'borrador',
			version: 0,
			procesadorId: '',
			procesadorVersion: '',
			ejemploDocumental: false
		};
		tiposDocumentales.push(nuevo);
		b.idGuardado = nuevo.id;
	}

	guardarBiblioteca();
	return b.idGuardado;
}

/**
 * Activa un modelo: crea (o adopta) su Custom Extractor en Document AI, vía el
 * back, y solo si Google respondió marca el estado local. Es el botón
 * "Activar" de la tarjeta (HU038), y es LA operación del sistema: convierte la
 * configuración capturada en un extractor zero-shot utilizable.
 *
 * El orden importa: primero el procesador, después el estado. Al revés
 * quedaría un tipo "activo" apuntando a nada si la llamada falla.
 *
 * Devuelve `{ ok, mensaje }` en vez de tirar: quien llama es un manejador de
 * clic y el error tiene que llegar a la pantalla, no a la consola.
 */
export async function activarTipoDocumental(id: string): Promise<{ ok: boolean; mensaje: string }> {
	const tipo = tiposDocumentales.find((t) => t.id === id);
	if (!tipo) return { ok: false, mensaje: 'Ese tipo documental ya no existe.' };
	if (tipo.estado === 'activo') return { ok: true, mensaje: '' };

	let respuesta: Response;
	try {
		respuesta = await fetch('/api/procesadores/activar', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: tipo.id,
				nombre: tipo.nombre,
				descripcion: tipo.descripcion,
				campos: $state.snapshot(tipo.campos)
			})
		});
	} catch {
		return { ok: false, mensaje: 'No se pudo contactar al servidor. Revisa la conexión.' };
	}

	let datos: Record<string, unknown> = {};
	try {
		datos = await respuesta.json();
	} catch {
		/* un cuerpo ilegible cae al mensaje genérico de abajo */
	}

	if (!respuesta.ok) {
		const mensaje =
			typeof datos.mensaje === 'string' ? datos.mensaje : `Falló la activación (HTTP ${respuesta.status}).`;
		return { ok: false, mensaje };
	}

	tipo.estado = 'activo';
	// Sube DESPUÉS de que Google confirmó, igual que el estado: una publicación
	// que falló no gastó número de versión.
	tipo.version += 1;
	tipo.procesadorId = typeof datos.procesadorId === 'string' ? datos.procesadorId : '';
	tipo.procesadorVersion =
		typeof datos.versionDefault === 'string' ? datos.versionDefault : '';
	guardarBiblioteca();
	return { ok: true, mensaje: '' };
}

/**
 * Vuelve editable un tipo ACTIVO, regresándolo a `borrador`. Es la puerta que
 * pedía la sección 2.6b de solicitudes-dba.md ("corregir un mapeo activo
 * obliga a versión nueva; no hay atajo") — aquí generalizada a cualquier
 * campo, no solo el mapeo.
 *
 * SIN USAR todavía: se construyó, se le dio una tarjeta y un menú, y se retiró
 * el mismo día (2026-09-01) a pedido explícito — por ahora un modelo activo no
 * debe ofrecer ninguna vía de edición, ni con explicación ni con invitación.
 * Se deja lista para cuando exista esa pantalla, mismo trato que
 * `eliminarTipoDocumental()`.
 *
 * No crea una copia aparte: es el MISMO registro, que vuelve a `borrador` para
 * poder tocarse. El procesador de Document AI sigue sirviendo la configuración
 * YA PUBLICADA hasta que se vuelva a activar — esta función no toca Google.
 */
export function crearNuevaVersion(id: string): boolean {
	const tipo = tiposDocumentales.find((t) => t.id === id);
	if (!tipo || tipo.estado !== 'activo') return false;
	tipo.estado = 'borrador';
	guardarBiblioteca();
	return true;
}

/** El interruptor "Ejemplo documental" del menú de la tarjeta. */
export function alternarEjemploDocumental(id: string, valor: boolean) {
	const tipo = tiposDocumentales.find((t) => t.id === id);
	if (!tipo) return;
	tipo.ejemploDocumental = valor;
	guardarBiblioteca();
}

/**
 * Archiva un tipo documental ACTIVO: lo saca de la Biblioteca sin tocar
 * Document AI. A diferencia de `eliminarTipoDocumental`, no borra nada — ni
 * el registro local ni el Custom Extractor, que sigue viviendo en Google
 * exactamente como estaba. Es la alternativa NO destructiva a "Borrar" para
 * un modelo activo, a pedido explícito: el registro se queda en
 * `localStorage`, solo deja de listarse en el árbol y en las tarjetas.
 *
 * No hay todavía una pantalla de "Archivados" para verlos ni un
 * `desarchivarTipoDocumental()` para volver — se agregan cuando se pidan.
 */
export function archivarTipoDocumental(id: string): boolean {
	const tipo = tiposDocumentales.find((t) => t.id === id);
	if (!tipo) return false;
	tipo.estado = 'archivado';
	guardarBiblioteca();
	return true;
}

/**
 * Borra un tipo documental. Si ya tenía un procesador en Document AI
 * (`procesadorId` no vacío), lo borra ALLÁ primero — nunca al revés.
 *
 * El orden es la parte que importa: si se borrara primero de la Biblioteca y
 * el borrado en Google fallara después, quedaría un procesador huérfano en
 * GCP sin ningún registro en la app que lo señale — nadie volvería a saber
 * que existe para limpiarlo. Borrando primero en Google, un fallo deja el
 * tipo documental intacto localmente y se puede reintentar.
 *
 * Devuelve `{ ok, mensaje }`, igual que `activarTipoDocumental`: quien llama
 * es un manejador de clic y el error tiene que llegar a la pantalla.
 */
export async function eliminarTipoDocumental(id: string): Promise<{ ok: boolean; mensaje: string }> {
	const tipo = tiposDocumentales.find((tp) => tp.id === id);
	if (!tipo) return { ok: false, mensaje: 'Ese tipo documental ya no existe.' };

	if (tipo.procesadorId) {
		let respuesta: Response;
		try {
			respuesta = await fetch(`/api/procesadores/${encodeURIComponent(tipo.procesadorId)}`, {
				method: 'DELETE'
			});
		} catch {
			return { ok: false, mensaje: 'No se pudo contactar al servidor. Revisa la conexión.' };
		}
		if (!respuesta.ok) {
			let datos: Record<string, unknown> = {};
			try {
				datos = await respuesta.json();
			} catch {
				/* cae al mensaje genérico de abajo */
			}
			const mensaje =
				typeof datos.mensaje === 'string'
					? datos.mensaje
					: `No se pudo borrar el procesador (HTTP ${respuesta.status}).`;
			return { ok: false, mensaje };
		}
	}

	const i = tiposDocumentales.findIndex((tp) => tp.id === id);
	if (i !== -1) tiposDocumentales.splice(i, 1);
	// Si se borró el que el borrador tenía asociado, se desliga para que un
	// próximo guardado cree una entrada nueva en vez de buscar una que ya no está.
	if (borradorTipoDocumental.idGuardado === id) borradorTipoDocumental.idGuardado = null;
	guardarBiblioteca();
	return { ok: true, mensaje: '' };
}

/** Etiqueta legible de la vertical. Vive aquí y no en el componente porque la
 *  biblioteca la necesita para pintar las tarjetas. */
export const VERTICALES = [
	{ value: 'seguros', label: 'Seguros' },
	{ value: 'bancario', label: 'Bancario / Financiero' },
	{ value: 'retail', label: 'Retail' },
	{ value: 'salud', label: 'Salud' },
	{ value: 'gobierno', label: 'Gobierno' },
	{ value: 'logistica', label: 'Logística' },
	{ value: 'otro', label: 'Otro' }
] as const;

export function etiquetaVertical(valor: string): string | undefined {
	return VERTICALES.find((v) => v.value === valor)?.label;
}

/**
 * Carga un tipo documental guardado dentro del borrador, para retomarlo.
 *
 * Los campos se copian con ids NUEVOS: los del guardado podrían chocar con los
 * que ya trae el borrador en memoria, y un `#each` de Svelte con llaves
 * repetidas rompe el render.
 *
 * Se abre en el paso 1 a propósito: es "abrir el expediente", y desde ahí se
 * avanza. Aterrizar directo en el 2 escondería el nombre y la descripción, que
 * son justo lo que uno quiere confirmar al retomar algo de hace días.
 */
export function cargarTipoDocumental(id: string): boolean {
	const tipo = tiposDocumentales.find((tp) => tp.id === id);
	if (!tipo) return false;
	Object.assign(borradorTipoDocumental, {
		nombre: tipo.nombre,
		descripcion: tipo.descripcion,
		vertical: tipo.vertical,
		campos: tipo.campos.map((c) => ({ ...$state.snapshot(c), id: idCampo() })),
		campoEnCaptura: campoVacio(),
		idGuardado: tipo.id,
		paso: 1,
		// Se restaura para que los pasos que ya se configuraron sigan navegables:
		// un tipo con propiedades definidas SÍ llegó al 3 por el flujo normal, y
		// obligar a recorrerlo otra vez para volver ahí no tendría sentido.
		pasoMaximo: tipo.pasoMaximo
	});
	guardarBorrador();
	return true;
}

/**
 * Sincroniza la entrada de la biblioteca con lo que hay en el borrador, PERO
 * solo si ese borrador ya corresponde a una entrada guardada.
 *
 * Esto es lo que vuelve seguro que "Nuevo tipo documental" empiece siempre en
 * blanco: sin esta sincronización, alguien a media captura del paso 2 que
 * cerrara y picara "Nuevo" perdería los campos que aún no había guardado. Con
 * ella, todo lo que se teclea sobre un tipo ya existente viaja de inmediato a
 * la biblioteca y no hay nada que perder.
 *
 * No crea entradas: si el borrador todavía no se guardó (`idGuardado` en null)
 * no hace nada. Dar de alta sigue siendo un acto explícito del wizard.
 */
export function sincronizarTipoGuardado() {
	if (!borradorTipoDocumental.idGuardado) return;
	guardarTipoDocumental();
}

/**
 * ¿Ese valor ya está en el listado del campo?
 *
 * Misma regla que con los nombres de campo: ignora mayúsculas y espacios de los
 * extremos. `SUV` y `suv` serían el mismo valor de catálogo, y tenerlos dos
 * veces no significa nada — `catalog_value` guardaría dos filas para un solo
 * valor permitido.
 */
export function valorListaDuplicado(valor: string, valores: string[]): boolean {
	const v = valor.trim().toLowerCase();
	if (v === '') return false;
	return valores.some((x) => x.trim().toLowerCase() === v);
}

/** Pasa lo tecleado en "Agregar listado" a la lista de chips. */
export function agregarValorLista(campo: CampoBorrador): boolean {
	const v = campo.valorListaEnCaptura.trim();
	if (v === '' || valorListaDuplicado(v, campo.valoresLista)) return false;
	campo.valoresLista.push(v);
	campo.valorListaEnCaptura = '';
	return true;
}

export function quitarValorLista(campo: CampoBorrador, valor: string) {
	const i = campo.valoresLista.indexOf(valor);
	if (i !== -1) campo.valoresLista.splice(i, 1);
}

/** ¿Se puede navegar a ese paso desde el sidebar? Solo si ya se visitó. */
export function pasoNavegable(n: number): boolean {
	return n <= borradorTipoDocumental.pasoMaximo;
}

/** Salta a un paso ya visitado. No avanza: para eso está el botón del pie, que
 *  es el que valida. Saltar hacia adelante sin validar dejaría pasar un paso 1
 *  incompleto. */
export function irAPaso(n: number): boolean {
	if (!pasoNavegable(n)) return false;
	borradorTipoDocumental.paso = n;
	return true;
}
