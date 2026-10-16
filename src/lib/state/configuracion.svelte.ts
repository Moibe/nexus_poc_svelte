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
 * Los seis tipos que ofrece el desplegable en Figma (frame 972:53474) y, desde el 2026-10-16, un séptimo que NO está en el
 * diseño: «Grupo de campos» (`grupo`), pedido para las actas constitutivas, donde un dato no es un valor suelto sino una fila
 * de varios (un accionista = nombre + acciones + monto). Su destino es `field_definition.data_type` del diccionario.
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
	{ value: 'lista', label: 'Lista' },
	{ value: 'grupo', label: 'Grupo de campos' }
] as const;

/**
 * Los tipos que puede tener un campo DENTRO de un grupo: los mismos, menos `grupo` (un solo nivel) y menos `lista` (el asistente
 * no captura valores permitidos por subcampo; el back sí los entendería el día que haga falta).
 */
export const TIPOS_DE_SUBCAMPO = TIPOS_DE_DATO.filter((t) => t.value !== 'grupo' && t.value !== 'lista');
const VALORES_SUBTIPO = TIPOS_DE_SUBCAMPO.map((t) => t.value) as readonly string[];

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

/**
 * Un campo dentro de un grupo. Mismo molde que un campo suelto pero más corto: sin cardinalidad (dentro de una fila cada
 * subcampo aparece una vez), sin umbral ni regla del paso 3, sin valor de estructura y sin lista de valores.
 */
export type SubcampoBorrador = {
	/** Solo para la llave del #each; no viaja a la base. */
	id: string;
	nombre: string;
	tipoDato: string;
	descripcion: string;
	obligatorio: boolean;
};

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
	/**
	 * Los campos de cada fila cuando `tipoDato === 'grupo'`. Con `cardinalidad: 'multiple'` el grupo se repite (una fila por
	 * accionista); con `'unico'` aparece una vez (un domicilio). NO se borran al cambiar el tipo a otro, por lo mismo que
	 * `valoresLista`: tirar lo que alguien escribió por tocar un desplegable es peor que dejar un dato inerte.
	 */
	subcampos: SubcampoBorrador[];
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
		valorListaEnCaptura: '',
		subcampos: []
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

/** Normaliza un subcampo de un grupo. `null` si no es ni un objeto. */
function leerSubcampo(c: unknown): SubcampoBorrador | null {
	if (typeof c !== 'object' || c === null) return null;
	const d = c as Record<string, unknown>;
	return {
		id: idCampo(),
		nombre: typeof d.nombre === 'string' ? d.nombre : '',
		tipoDato: typeof d.tipoDato === 'string' && VALORES_SUBTIPO.includes(d.tipoDato) ? d.tipoDato : '',
		descripcion: typeof d.descripcion === 'string' ? d.descripcion : '',
		obligatorio: d.obligatorio === true
	};
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
			typeof d.valorListaEnCaptura === 'string' ? d.valorListaEnCaptura : '',
		subcampos: Array.isArray(d.subcampos)
			? (d.subcampos.map(leerSubcampo).filter(Boolean) as SubcampoBorrador[])
			: []
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

/** Un subcampo está completo cuando tiene nombre y tipo (la descripción es opcional: ayuda al modelo, pero no se exige). */
export function subcampoCompleto(s: SubcampoBorrador): boolean {
	return s.nombre.trim() !== '' && s.tipoDato !== '';
}

/** ¿Ya hay OTRO subcampo con ese nombre en el grupo? (Mismo criterio que `nombreCampoDuplicado`.) */
export function subcampoDuplicado(nombre: string, subcampos: SubcampoBorrador[], exceptoId?: string): boolean {
	const n = nombre.trim().toLowerCase();
	if (n === '') return false;
	return subcampos.some((s) => s.id !== exceptoId && s.nombre.trim().toLowerCase() === n);
}

/** Por qué un grupo todavía no se puede guardar, o `null` si está bien. Es lo que le dice a la persona qué falta. */
export function problemaDelGrupo(c: CampoBorrador): string | null {
	if (c.tipoDato !== 'grupo') return null;
	if (c.subcampos.length === 0) return 'Agrega al menos un campo al grupo.';
	if (!c.subcampos.every(subcampoCompleto)) return 'Completa el nombre y el tipo de cada campo del grupo.';
	if (c.subcampos.some((s) => subcampoDuplicado(s.nombre, c.subcampos, s.id))) {
		return 'Hay campos del grupo con el mismo nombre. Cada uno debe llamarse distinto.';
	}
	return null;
}

/** Un campo está completo cuando tiene sus tres obligatorios y, si es un grupo, sus campos en orden. */
export function campoCompleto(c: CampoBorrador): boolean {
	return c.nombre.trim() !== '' && c.tipoDato !== '' && c.descripcion.trim() !== '' && problemaDelGrupo(c) === null;
}

/** Agrega un subcampo en blanco al grupo (texto y obligatorio por default, como un campo nuevo). */
export function agregarSubcampo(campo: CampoBorrador) {
	campo.subcampos.push({ id: idCampo(), nombre: '', tipoDato: 'texto', descripcion: '', obligatorio: true });
}

export function quitarSubcampo(campo: CampoBorrador, id: string) {
	const i = campo.subcampos.findIndex((s) => s.id === id);
	if (i !== -1) campo.subcampos.splice(i, 1);
}

/**
 * Cambia el tipo de dato de un campo y ajusta lo que depende de él. Un grupo casi siempre se repite (una fila por accionista),
 * así que al elegir «Grupo de campos» la cardinalidad pasa a múltiple y arranca con un subcampo en blanco; al dejarlo, vuelve
 * a único: la cardinalidad de un campo suelto se decide en el paso 3, y un texto «múltiple» heredado de haber probado un grupo
 * sería un dato fantasma. Los subcampos NO se borran (ver `CampoBorrador.subcampos`).
 */
export function alCambiarTipoDato(campo: CampoBorrador, nuevo: string) {
	const antes = campo.tipoDato;
	campo.tipoDato = nuevo;
	if (nuevo === 'grupo' && antes !== 'grupo') {
		campo.cardinalidad = 'multiple';
		if (campo.subcampos.length === 0) agregarSubcampo(campo);
	} else if (antes === 'grupo' && nuevo !== 'grupo') {
		campo.cardinalidad = 'unico';
	}
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
		c.descripcion.trim() === '' &&
		c.subcampos.length === 0
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
/**
 * Una versión YA REEMPLAZADA de un tipo documental. Se guarda en cuanto
 * `activarTipoDocumental` publica la SIGUIENTE — antes de eso no existe: no
 * hay forma de reconstruir el historial de un tipo que ya se re-publicó
 * ANTES del 2026-09-02, cuando esto se empezó a guardar.
 *
 * `campos` es una FOTO de cómo estaban en el momento de publicarse, no una
 * referencia viva — si no se copiaran, editar el tipo después reescribiría
 * también lo que este historial dice que tenía la versión vieja.
 */
/** Un rectángulo de recorte sobre un documento de ejemplo, en PORCENTAJE del
 *  contenedor (no píxeles) — así sobrevive al zoom y al tamaño real del
 *  archivo subido. Ver `guardarRecorteEjemplo` y `CargarEjemploDocumental.svelte`.
 *
 *  `pagina` (1 en adelante) dice sobre QUÉ página del documento está el rectángulo. Existe desde el 2026-10-16, cuando el
 *  etiquetado aprendió PDF de varias páginas (un acta constitutiva ronda las 20); un recorte guardado antes no la trae y vale
 *  la 1, que era la única que se podía marcar — `paginaDeRecorte` es quien lo resuelve. Es también lo que Document AI pide
 *  de una etiqueta: una caja Y la página donde está. */
export type Recorte = { x: number; y: number; w: number; h: number; pagina?: number };

/** La página de un recorte: la que trae, o la 1 si es de antes de que se guardara (o si trae algo que no es una página). */
export function paginaDeRecorte(r: Pick<Recorte, 'pagina'>): number {
	return Number.isInteger(r.pagina) && (r.pagina as number) >= 1 ? (r.pagina as number) : 1;
}

/**
 * UNA instancia de documento de ejemplo — un tipo documental puede tener
 * VARIAS (2026-09-04, a pedido explícito: "varias instancias... a cada uno
 * hacerle sus recortamientos"), cada una con sus propios recortes por campo.
 * Antes de esto hubo dos diseños más simples, los dos superados: uno por
 * CAMPO (2026-09-02/03) y luego uno SOLO compartido por todo el tipo
 * (2026-09-04, misma mañana) — ver la fila de `pendientes-ux.md` de cada uno.
 *
 * Se sube desde `CargarDocumentoEjemplo.svelte`; cada campo dibuja su
 * recorte sobre la instancia que esté SELECCIONADA en ese momento en
 * Calibración (`ConfigSheet.svelte` guarda cuál con `documentoSeleccionadoId`,
 * un estado de pantalla, no de este módulo). Varias instancias es más fiel
 * además a cómo se etiqueta en Document AI: varios documentos de ejemplo en
 * el Dataset, cada uno con sus propias anotaciones.
 *
 * `dataUrl` es el documento YA RENDERIZADO como raster (PNG del `<canvas>`
 * si era PDF, o el archivo original leído tal cual si ya era imagen) — nunca
 * un blob URL: tiene que sobrevivir un refresh de la página para que
 * recortar un campo nuevo días después no obligue a resubir el archivo.
 */
export type DocumentoEjemploInstancia = {
	id: string;
	nombre: string;
	tipo: string;
	tamanoBytes: number;
	/**
	 * DÓNDE viven los bytes, no los bytes. Desde el 2026-09-24 el archivo se
	 * sube a `POST /api/archivos` y aquí solo queda su ruta relativa en el
	 * almacén; para pintarlo se pide a `GET /api/archivos/<ruta>`.
	 *
	 * Es el arreglo de raíz del problema de cuota: una foto de INE de 2 MB
	 * guardada como base64 ocupaba ~5.3 MB de localStorage (base64 infla 4/3 y
	 * localStorage cuenta UTF-16 a 2 bytes por carácter), así que UN tipo
	 * configurado bastaba para llenarla. Un puntero ocupa ~150 caracteres.
	 */
	rutaRelativa?: string;
	/** El hash del contenido. Es además el nombre del objeto en disco, así que
	 *  sirve para verificar integridad sin pedir el archivo. */
	sha256?: string;
	/** Con qué `Content-Type` pedirlo de vuelta: el almacén NO guarda el MIME
	 *  —en disco los objetos no tienen extensión— así que lo lleva el catálogo. */
	mime?: string;
	/**
	 * La VISTA: el mismo documento rasterizado a PNG, para poder pintarlo en un
	 * `<img>`. Solo existe cuando el original no se puede pintar directo, o sea
	 * cuando es PDF; para una imagen, el original YA es la vista y este campo
	 * no se llena.
	 *
	 * Se guardan los dos a propósito. Antes solo sobrevivía el raster de la
	 * página 1 y el PDF original se perdía para siempre — y el original es justo
	 * lo que Document AI va a querer el día que se etiqueten ejemplos. Guardar
	 * ambos no desperdicia disco cuando coinciden: el almacén direcciona por
	 * contenido, así que dos subidas de los mismos bytes son UN objeto.
	 *
	 * Un PDF viejo migrado trae `rutaVista` SIN `rutaRelativa`: de él solo
	 * sobrevivió la página 1 como imagen. Ver `esPdfSinOriginal`.
	 */
	rutaVista?: string;
	mimeVista?: string;
	/**
	 * Cuántas páginas tiene, si es un PDF y se supo al subirlo (desde el 2026-10-16). Los que se subieron antes no lo traen: el
	 * visor lo descubre al abrir el original (`usarPaginaDeEjemplo`), y mientras tanto la tarjeta simplemente no lo dice.
	 */
	paginas?: number;
	/**
	 * LEGADO. Los bytes en base64, como se guardaban antes del 2026-09-24.
	 *
	 * Nada nuevo lo escribe, y lo que queda se va: al abrir Configuración,
	 * `migrarEjemplos.ts` sube estos bytes al almacén y los cambia por su
	 * puntero (ver `pasarEjemploAlAlmacen`). Mientras eso no pase —el almacén
	 * caído, por ejemplo— el documento se sigue pintando desde aquí:
	 * `fuenteDeDocumento()` resuelve cuál toca, y es el único lugar que debería
	 * preguntárselo.
	 */
	dataUrl?: string;
	/** ISO-8601 de cuándo se guardó este documento. */
	guardadoEn: string;
};

/**
 * De dónde sacar la imagen de un documento de ejemplo: del almacén si ya está
 * allá, o de los bytes viejos si es de antes de la migración. Cadena vacía si
 * no hay ninguno de los dos, para que quien pinte muestre su hueco en vez de
 * pedir una URL inventada.
 */
export function fuenteDeDocumento(doc: DocumentoEjemploInstancia): string {
	// La vista gana cuando existe: es la que se puede pintar. El original puede
	// ser un PDF, que un `<img>` no sabe mostrar.
	const ruta = doc.rutaVista || doc.rutaRelativa;
	if (ruta) {
		const mime = (doc.rutaVista ? doc.mimeVista : doc.mime) || 'application/octet-stream';
		return `/api/archivos/${ruta}?mime=${encodeURIComponent(mime)}`;
	}
	return doc.dataUrl ?? '';
}

/**
 * Un PDF del que solo existe la página 1 como imagen, sin el archivo original.
 *
 * Son los ejemplos subidos ANTES del 2026-09-24: entonces se guardaba solo el
 * raster de la página 1 y el PDF se tiraba. La migración los mueve al almacén
 * como VISTA —`rutaVista` sin `rutaRelativa`— en vez de hacerlos pasar por
 * originales, para que lo que algún día necesite el PDF completo (Document
 * AI, al etiquetar ejemplos) sepa que no está, en vez de recibir una imagen
 * creyendo que es el documento. La pantalla lo marca para que se pueda
 * volver a subir.
 */
export function esPdfSinOriginal(doc: DocumentoEjemploInstancia): boolean {
	// La excepción: cuando pdf.js no podía abrir el PDF (con contraseña, o
	// corrupto), el código viejo guardaba el PDF MISMO en `dataUrl`. Ese sí
	// conserva su original, y la migración lo sube como tal.
	return doc.tipo === 'PDF' && !doc.rutaRelativa && !doc.dataUrl?.startsWith('data:application/pdf');
}

/**
 * Lo que "Guardar" persiste desde `RecortarEjemploCampo.svelte` para UN
 * campo, sobre UNA instancia de documento — ver `TipoDocumentalGuardado.recortesPorDocumento`
 * para cómo se indexan las dos dimensiones (documento × campo).
 *
 * Desde el 2026-09-25 un recorte ES sus 4 coordenadas, nada más. Antes
 * guardaba además `imagenDataUrl`: los píxeles del pedazo exportados como PNG
 * en base64, una copia por cada campo de cada ejemplo, que era lo que más
 * cuota de localStorage gastaba de todo el módulo. Esa copia sobraba — el
 * documento vive en el almacén y las coordenadas ya estaban — así que
 * Calibración ahora dibuja la región sobre el documento mismo
 * (`RecorteDeDocumento.svelte`), y los recortes viejos pierden su copia al
 * abrir Configuración (`quitarImagenesDeRecortes`).
 *
 * Sigue siendo una IMAGEN lo que se muestra, no un texto, a propósito: en
 * este punto nunca corrió ningún OCR sobre el documento, así que mostrar un
 * "texto extraído" sería inventar un resultado que no existe. Y las
 * coordenadas son justo lo que Document AI usa para etiquetar ejemplos:
 * cajas sobre el documento original.
 */
export type EjemploGuardado = {
	recorte: Recorte;
	/** ISO-8601 de cuándo se guardó este ejemplo. */
	guardadoEn: string;
};

export type VersionPublicada = {
	version: number;
	procesadorId: string;
	procesadorVersion: string;
	/** ISO-8601 de cuándo se publicó ESTA versión (no cuándo se reemplazó). */
	publicadoEn: string;
	/** Si ESTA versión llegó a calibrarse, y cuándo. Lo necesita
	 *  `cancelarNuevaVersion` para devolver el tipo tal como estaba si la
	 *  edición se abandona sin tocar nada: sin este dato, cancelar dejaría sin
	 *  calibrar a un tipo que sí lo estaba, y eso ya no es cosmético — un tipo
	 *  sin calibrar deja de extraer (ver `pipeline.svelte.ts`). */
	calibradoEn: string | null;
	campos: CampoBorrador[];
};

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
	/** El nombre VISIBLE del procesador en la consola de Document AI (algo como
	 *  `nexusdoc--tipo-abc--v2--ine`), tal como lo devolvió Google al activar —
	 *  no se recalcula de este lado. Existe solo para que una persona pueda
	 *  casar el tipo documental de NexusDoc con el procesador que ve en GCP.
	 *  Vacío en los tipos activados ANTES del 2026-09-08, que no lo recibieron:
	 *  ahí la ficha cae al `procesadorId`, que igual lo identifica. */
	procesadorDisplayName: string;
	/** El interruptor "Ejemplo documental" del menú de la tarjeta. Todavía no
	 *  hace nada más que recordarse: no hay ejemplo que adjuntar ni a dónde
	 *  mandarlo. Se persiste para que el interruptor no mienta al reabrir. */
	ejemploDocumental: boolean;
	/** ISO-8601 de cuándo se publicó la versión VIGENTE (`version`, arriba).
	 *  Es lo que pasa a `publicadoEn` en `historialVersiones` el día que esta
	 *  versión se reemplace por una nueva. `null` mientras nunca se ha
	 *  publicado, o si el tipo se guardó antes de que este campo existiera. */
	activadoEn: string | null;
	/** ISO-8601 de cuándo TERMINÓ la calibración de prompts de la versión
	 *  vigente, o `null` si todavía no se ha calibrado. Es lo que distingue,
	 *  en la tarjeta de la Biblioteca, entre ofrecer "Calibrar" y mostrar
	 *  "Activado".
	 *
	 *  Desde el 2026-09-14 también es REQUISITO para procesar: el pipeline
	 *  exige `estado === 'activo'` **y** `calibradoEn`. Un tipo activo sin
	 *  calibrar clasifica bien pero no extrae — su documento se va a
	 *  `pendiente_revision` diciendo qué le falta (ver `pipeline.svelte.ts`).
	 *  Activar solo crea el Custom Extractor; hasta que la calibración
	 *  termina, nadie ha comprobado que lo que extrae sea correcto.
	 *
	 *  Sigue siendo un campo aparte y NO un valor más de `estado`, aunque
	 *  ahora los dos hagan falta: `estado` describe qué se publicó a Document
	 *  AI y `calibradoEn` si se verificó, que son dos hechos distintos y con
	 *  ciclos de vida distintos (republicar una versión conserva el estado y
	 *  tira la calibración). Fundirlos obligaría a inventar un orden entre
	 *  ellos que el dominio no tiene.
	 *
	 *  Se BORRA en `crearNuevaVersion`: lo que se calibró fue la versión
	 *  anterior, y arrastrar la marca haría pasar por calibrada a una
	 *  configuración que nadie probó. */
	calibradoEn: string | null;
	/** Versiones anteriores a la vigente, más reciente primero. Detrás de
	 *  "Listar versiones anteriores" en la Biblioteca. Vacío para cualquier
	 *  tipo que nunca se haya re-publicado. */
	historialVersiones: VersionPublicada[];
	/**
	 * Foto de la versión vigente tomada por `crearNuevaVersion()` justo ANTES
	 * de empezar a editarla — `activarTipoDocumental` la consume (la mueve a
	 * `historialVersiones`) en cuanto la publicación siguiente tiene éxito, y
	 * la deja en `null`.
	 *
	 * Sin esto no habría cómo archivar bien la versión vieja: para cuando
	 * `activarTipoDocumental` se entera de que Google respondió, `campos` ya
	 * se sobreescribió con lo recién editado en el wizard, y ya no quedaría
	 * registro de qué tenía la versión que se está reemplazando.
	 */
	versionEnEdicion: VersionPublicada | null;
	/** Los documentos de ejemplo de este tipo — VARIOS desde el 2026-09-04
	 *  (antes uno solo, compartido por todos los campos; antes de eso, uno
	 *  por campo). Vacío mientras nadie suba ninguno. Ver
	 *  `DocumentoEjemploInstancia` y `agregarDocumentoEjemplo`. Quitar una
	 *  instancia con `borrarDocumentoEjemplo` también vacía sus propios
	 *  recortes en `recortesPorDocumento` — un recorte sin su documento de
	 *  origen no significa nada — pero deja intactas las demás instancias. */
	documentosEjemplo: DocumentoEjemploInstancia[];
	/**
	 * Ejemplo de extracción guardado por (documento × campo) — dos niveles:
	 * `recortesPorDocumento[idDocumento][nombreCampo]`. El nivel de campo se
	 * indexa por NOMBRE, no por `campo.id` (que se regenera en cada lectura
	 * de la Biblioteca; el nombre es lo único de un campo que sobrevive un
	 * refresh) — mismo criterio que ya regía cuando solo había un documento.
	 * Detrás de "Guardar" en `RecortarEjemploCampo.svelte`. Ver
	 * `EjemploGuardado`: son solo las coordenadas de la región, y Calibración
	 * la muestra dibujándola sobre el documento (`RecorteDeDocumento.svelte`).
	 */
	recortesPorDocumento: Record<string, Record<string, EjemploGuardado>>;
};

/** Donde vivía la biblioteca, en el `localStorage` de cada navegador, hasta el 2026-10-15. Ya no se lee: se borra al cargar. */
const LLAVE_BIBLIOTECA_ANTIGUA = 'nexusdoc:tipos-documentales:v1';

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

/** `n` hexadecimales al azar. `crypto.getRandomValues` SÍ existe en contexto inseguro (el HTTP plano por IP del server de
 *  CSI); `crypto.randomUUID` no, y tronó la app el 2026-08-18: por eso no se usa. Con plan B, por si acaso. */
function hexAleatorio(n: number): string {
	const bytes = new Uint8Array(Math.ceil(n / 2));
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
	else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, n);
}

/**
 * El id de un tipo documental: `tipo-` y 32 hexadecimales al azar. Ya NO es `tipo-{hora}-{contador}`: dos navegadores
 * podían inventar el mismo, y desde que el catálogo vive en el servidor tiene que ser único en TODAS las organizaciones
 * (nexus_back lo exige), porque el clasificador es global y nombra cada categoría con el id.
 */
function idTipo(): string {
	return `tipo-${hexAleatorio(32)}`;
}

let contadorDocumentoEjemplo = 0;
function idDocumentoEjemplo(): string {
	contadorDocumentoEjemplo += 1;
	return `doc-ejemplo-${Date.now().toString(36)}-${contadorDocumentoEjemplo}`;
}

/** Igual de defensivo que `leerCampo`: el contenido de localStorage no es de
 *  fiar. Una entrada de historial sin `version` o `procesadorId` legibles no
 *  sirve para nada — se descarta en vez de guardarse a medias. */
function leerVersionPublicada(v: unknown): VersionPublicada | null {
	if (typeof v !== 'object' || v === null) return null;
	const d = v as Record<string, unknown>;
	if (!Number.isInteger(d.version) || (d.version as number) < 0) return null;
	if (typeof d.procesadorId !== 'string' || d.procesadorId === '') return null;
	return {
		version: d.version as number,
		procesadorId: d.procesadorId,
		procesadorVersion: typeof d.procesadorVersion === 'string' ? d.procesadorVersion : '',
		publicadoEn: typeof d.publicadoEn === 'string' ? d.publicadoEn : new Date(0).toISOString(),
		// Lo guardado antes de que existiera este campo cae en null, o sea "esa
		// versión no constaba como calibrada". Es el lado seguro: si se cancela
		// una edición vieja, el tipo pide calibrarse otra vez en vez de darse
		// por bueno sin que nadie lo haya comprobado.
		calibradoEn: typeof d.calibradoEn === 'string' ? d.calibradoEn : null,
		campos: Array.isArray(d.campos) ? (d.campos.map(leerCampo).filter(Boolean) as CampoBorrador[]) : []
	};
}

function esRecorteValido(r: unknown): r is Recorte {
	if (typeof r !== 'object' || r === null) return false;
	const d = r as Record<string, unknown>;
	return (['x', 'y', 'w', 'h'] as const).every(
		(clave) => typeof d[clave] === 'number' && Number.isFinite(d[clave])
	);
}

/** La página de un recorte leído de disco: solo se conserva si es un entero de 1 en adelante (lo demás se lee como «sin página»,
 *  o sea la 1). Un recorte de otra época o de otra pestaña con una página rara no debe perderse por eso. */
function paginaLegible(p: unknown): number | undefined {
	return Number.isInteger(p) && (p as number) >= 1 ? (p as number) : undefined;
}

function esEjemploValido(e: unknown): e is EjemploGuardado {
	if (typeof e !== 'object' || e === null) return false;
	const d = e as Record<string, unknown>;
	if (!esRecorteValido(d.recorte)) return false;
	if (typeof d.guardadoEn !== 'string') return false;
	return true;
}

/**
 * Solo se conservan las entradas con forma válida — un objeto corrupto (o de
 * una versión futura con otro formato) no debe tumbar la lectura de TODO el
 * tipo documental, solo perderse esa entrada suya.
 *
 * Esto también migra en silencio los formatos VIEJOS: el del 2026-09-02 (un
 * `Recorte` suelto, solo `{x,y,w,h}`, sin `guardadoEn`) y el del 2026-09-03
 * (`EjemploGuardado` con un `documento` propio por campo) — ninguno pasa
 * `esEjemploValido` tal como quedó y se descarta; ninguno sobrevivía ya en
 * disco, porque cualquier guardado posterior reescribió el catálogo sin ellos.
 *
 * Y lee SOLO `recorte` y `guardadoEn`: la copia en PNG que traían los recortes
 * de antes del 2026-09-25 (`imagenDataUrl`) se queda afuera de la memoria, así
 * que el siguiente guardado ya no la escribe. Del disco la quita
 * `quitarImagenesDeRecortes` sin esperar a ese guardado.
 */
function leerRecortesDeUnDocumento(d: unknown): Record<string, EjemploGuardado> {
	if (typeof d !== 'object' || d === null) return {};
	const resultado: Record<string, EjemploGuardado> = {};
	for (const [nombreCampo, e] of Object.entries(d as Record<string, unknown>)) {
		if (esEjemploValido(e)) {
			const { x, y, w, h } = e.recorte;
			const pagina = paginaLegible((e.recorte as Record<string, unknown>).pagina);
			resultado[nombreCampo] = { recorte: { x, y, w, h, ...(pagina ? { pagina } : {}) }, guardadoEn: e.guardadoEn };
		}
	}
	return resultado;
}

/**
 * Envuelve `leerRecortesDeUnDocumento` para el nivel de arriba (por id de
 * documento) — migra en silencio, además de los formatos de
 * `leerRecortesDeUnDocumento`, el del 2026-09-04 con un solo nivel
 * (`recortesEjemplo` plano, de cuando solo existía UN documento compartido):
 * ese formato no tiene forma de saber a qué documento pertenecía cada
 * recorte una vez que varias instancias son posibles, así que también se
 * descarta — mismo costo aceptado que las migraciones anteriores.
 */
function leerRecortesPorDocumento(d: unknown): Record<string, Record<string, EjemploGuardado>> {
	if (typeof d !== 'object' || d === null) return {};
	const resultado: Record<string, Record<string, EjemploGuardado>> = {};
	for (const [idDocumento, porCampo] of Object.entries(d as Record<string, unknown>)) {
		resultado[idDocumento] = leerRecortesDeUnDocumento(porCampo);
	}
	return resultado;
}

/** Igual de defensivo que `esEjemploValido`: `dataUrl` vacío no sirve de nada
 *  (no habría de dónde recortar), así que se trata como si no existiera. */
function esDocumentoEjemploValido(d: unknown): d is DocumentoEjemploInstancia {
	if (typeof d !== 'object' || d === null) return false;
	const o = d as Record<string, unknown>;
	return (
		typeof o.id === 'string' &&
		o.id !== '' &&
		typeof o.nombre === 'string' &&
		typeof o.tipo === 'string' &&
		typeof o.tamanoBytes === 'number' &&
		typeof o.guardadoEn === 'string' &&
		// Vale con que tenga UNA fuente: los nuevos traen puntero al almacén, los
		// de antes del 2026-09-24 traen los bytes, y un PDF viejo ya migrado trae
		// solo su vista (ver `esPdfSinOriginal`). Uno sin ninguna no se puede
		// pintar, así que se descarta como siempre se hizo.
		((typeof o.rutaRelativa === 'string' && o.rutaRelativa !== '') ||
			(typeof o.rutaVista === 'string' && o.rutaVista !== '') ||
			(typeof o.dataUrl === 'string' && o.dataUrl !== ''))
	);
}

/**
 * Migra en silencio el formato VIEJO de un solo documento (2026-09-04, antes
 * de esta misma mañana): un objeto suelto en vez de un arreglo, sin `id` —
 * como ya no hay forma de saber si ese documento debería ser el primero de
 * varios o no, y tampoco tiene el `id` que ahora exige `recortesPorDocumento`
 * para asociarle recortes, se descarta igual que las demás migraciones de
 * esta pantalla.
 */
function leerDocumentosEjemplo(d: unknown): DocumentoEjemploInstancia[] {
	if (!Array.isArray(d)) return [];
	return d.filter(esDocumentoEjemploValido).map((doc) => {
		// Un número de páginas ilegible se descarta (se vuelve a descubrir al abrir el PDF) en vez de pintar un «NaN páginas».
		const paginas = paginaLegible(doc.paginas);
		const limpio = { ...doc };
		delete limpio.paginas;
		return paginas ? { ...limpio, paginas } : limpio;
	});
}

/**
 * Un tipo tal como lo guardó el servidor, normalizado. `null` si lo que llegó no es ni un objeto con nombre.
 *
 * Sigue siendo tan defensivo como cuando leía del `localStorage`: los datos los escribió código de otra época (o de otra
 * pestaña), y un campo mal formado no debe tumbar la biblioteca entera.
 */
function leerTipoGuardado(crudo: unknown): TipoDocumentalGuardado | null {
	if (typeof crudo !== 'object' || crudo === null) return null;
	const d = crudo as Record<string, unknown>;
	if (typeof d.nombre !== 'string') return null;
	return {
		id: typeof d.id === 'string' ? d.id : idTipo(),
		nombre: d.nombre,
		descripcion: typeof d.descripcion === 'string' ? d.descripcion : '',
		vertical: typeof d.vertical === 'string' ? d.vertical : '',
		campos: Array.isArray(d.campos) ? (d.campos.map(leerCampo).filter(Boolean) as CampoBorrador[]) : [],
		pasoMaximo: leerPasoMaximo(d),
		guardadoEn: typeof d.guardadoEn === 'string' ? d.guardadoEn : new Date().toISOString(),
		// Se acepta 'activo' o 'archivado' solo si están escritos tal cual. Cualquier otra cosa cae en 'borrador', que es el
		// estado seguro: un modelo mal leído no debe amanecer activo en producción (ni oculto por error como archivado).
		estado: d.estado === 'activo' ? ('activo' as const) : d.estado === 'archivado' ? ('archivado' as const) : ('borrador' as const),
		version: Number.isInteger(d.version) && (d.version as number) >= 0 ? (d.version as number) : d.estado === 'activo' ? 1 : 0,
		procesadorId: typeof d.procesadorId === 'string' ? d.procesadorId : '',
		procesadorVersion: typeof d.procesadorVersion === 'string' ? d.procesadorVersion : '',
		procesadorDisplayName: typeof d.procesadorDisplayName === 'string' ? d.procesadorDisplayName : '',
		ejemploDocumental: d.ejemploDocumental === true,
		activadoEn: typeof d.activadoEn === 'string' ? d.activadoEn : null,
		// Sin el dato, "sin calibrar": darlo por calibrado sin que nadie lo hiciera sería afirmar algo que no ocurrió.
		calibradoEn: typeof d.calibradoEn === 'string' ? d.calibradoEn : null,
		historialVersiones: Array.isArray(d.historialVersiones)
			? (d.historialVersiones.map(leerVersionPublicada).filter(Boolean) as VersionPublicada[])
			: [],
		versionEnEdicion: leerVersionPublicada(d.versionEnEdicion),
		documentosEjemplo: leerDocumentosEjemplo(d.documentosEjemplo),
		recortesPorDocumento: leerRecortesPorDocumento(d.recortesPorDocumento)
	};
}

/** La biblioteca de la organización. Nace VACÍA: se llena al leerla del servidor (`cargarBiblioteca`). */
export const tiposDocumentales = $state<TipoDocumentalGuardado[]>([]);

// ─────────────────────────────────────────────────────────────────────────────
// Persistencia: el catálogo vive en el SERVIDOR, por organización (2026-10-15)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hasta el 2026-10-15 la biblioteca vivía en el `localStorage` de CADA navegador: dos personas de la misma organización no se
 * veían, cada máquina inventaba sus ids (el mismo «INE» creaba un extractor en Google por computadora) y el clasificador,
 * que es uno solo, se sincronizaba con la lista del navegador que lo tocara último. Ahora el catálogo vive en nexus_back
 * (`/tipos-documentales`, por organización) y esta pantalla lo lee y lo escribe a través del BFF. Lo que había en cada
 * navegador NO se migró: se empezó de cero (decisión del 2026-10-15) y esa llave vieja se borra al cargar.
 *
 * ## Cómo se guarda sin cambiar a los quince que llaman a `guardarBiblioteca()`
 *
 * Quien cambia un tipo lo cambia EN MEMORIA, como siempre, y llama a `guardarBiblioteca()`. Esa función ya no escribe: anota
 * que hay algo por enviar, y unos instantes después (`ESPERA_GUARDADO_MS`, para no mandar una petición por cada tecla) una
 * pasada compara cada tipo con la última copia que el servidor confirmó y manda SOLO lo que cambió, con la revisión sobre la
 * que se editó:
 *
 *   · nuevo → `PUT` con revisión 0;  cambiado → `PUT` con la revisión vigente;  quitado → `DELETE`;  reordenado → `PUT /orden`.
 *
 * Es OPTIMISTA: `guardarBiblioteca()` devuelve `true` sin esperar. Si el servidor no pudo, se avisa (`estadoBiblioteca`) y se
 * reintenta solo unas veces. Lo que sí hay que esperar —porque el servidor arma el clasificador con LO QUE TIENE GUARDADO—
 * es antes de sincronizarlo: `vaciarGuardado()`.
 *
 * ## Dos personas editando lo mismo
 *
 * Cada tipo trae una revisión. Si otra persona lo guardó antes, el servidor responde 409: aquí se carga SU versión (no se
 * pisa nada) y se avisa. Si la otra persona lo borró, se quita de esta pantalla y se avisa.
 */
export const estadoBiblioteca = $state<{
	/** Ya se leyó el catálogo del servidor. Antes de eso la biblioteca está vacía sin que eso signifique nada. */
	cargada: boolean;
	cargando: boolean;
	/** Por qué no se pudo cargar; vacío si no hubo problema. */
	errorCarga: string;
	/** Lo último que se intentó guardar no quedó (o quedó distinto de lo que se veía): hay un aviso que leer. */
	falloAlGuardar: boolean;
	avisoTitulo: string;
	avisoMensaje: string;
}>({ cargada: false, cargando: false, errorCarga: '', falloAlGuardar: false, avisoTitulo: '', avisoMensaje: '' });

/** La baja la pantalla cuando ya avisó, para que el mismo fallo no reabra el diálogo en bucle. El siguiente lo vuelve a levantar. */
export function reconocerFallaDeGuardado() {
	estadoBiblioteca.falloAlGuardar = false;
}

function avisar(titulo: string, mensaje: string) {
	estadoBiblioteca.avisoTitulo = titulo;
	estadoBiblioteca.avisoMensaje = mensaje;
	estadoBiblioteca.falloAlGuardar = true;
}

/** Lo que el servidor confirmó de cada tipo: cómo quedó (serializado) y su revisión. */
const sincronizados = new Map<string, { json: string; revision: number }>();
/** El orden de la biblioteca como lo tiene el servidor. */
let ordenSincronizado: string[] = [];
/** Lo que el servidor rechazó por inválido (400): no se vuelve a mandar igual, solo cuando cambie. */
const rechazados = new Map<string, string>();
/** Se sube al cambiar de persona: lo que estaba en vuelo de la anterior se descarta al volver. */
let generacion = 0;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let cola: Promise<void> = Promise.resolve();
let reintentos = 0;

const ESPERA_GUARDADO_MS = 300;
const REINTENTO_MS = 8000;
const MAX_REINTENTOS = 5;

function serializar(tipo: TipoDocumentalGuardado): string {
	return JSON.stringify($state.snapshot(tipo));
}

type RespuestaServidor = { ok: boolean; status: number; cuerpo: Record<string, unknown> | null };

async function llamar(metodo: string, ruta: string, cuerpo?: unknown): Promise<RespuestaServidor> {
	try {
		const r = await fetch(ruta, {
			method: metodo,
			headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
			body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
		});
		const datos: unknown = await r.json().catch(() => null);
		return { ok: r.ok, status: r.status, cuerpo: typeof datos === 'object' && datos !== null ? (datos as Record<string, unknown>) : null };
	} catch {
		return { ok: false, status: 0, cuerpo: null };
	}
}

function textoDe(r: RespuestaServidor, defecto: string): string {
	return typeof r.cuerpo?.mensaje === 'string' ? r.cuerpo.mensaje : defecto;
}

/** ¿Hay algo en pantalla que el servidor todavía no tenga? */
function hayPendientes(): boolean {
	for (const t of tiposDocumentales) {
		const json = serializar(t);
		if (sincronizados.get(t.id)?.json !== json && rechazados.get(t.id) !== json) return true;
	}
	for (const id of sincronizados.keys()) if (!tiposDocumentales.some((t) => t.id === id)) return true;
	return false;
}

/**
 * El asistente edita un BORRADOR aparte (`borradorTipoDocumental`) que viaja a la biblioteca con cada tecla. Si lo que se adopta
 * del servidor es el tipo que ese borrador tiene abierto, el borrador se pone igual: de lo contrario seguiría mostrando lo que
 * la persona tecleó, en el campo, junto a una biblioteca que ya dice otra cosa, y la siguiente tecla pisaría lo de la otra
 * persona sin que se hubiera enterado. Si el tipo ya no existe, el borrador se desliga (no se «resucita» con otro id).
 */
function alinearBorradorCon(id: string) {
	if (borradorTipoDocumental.idGuardado !== id) return;
	const tipo = tiposDocumentales.find((t) => t.id === id);
	if (!tipo) {
		borradorTipoDocumental.idGuardado = null;
		return;
	}
	Object.assign(borradorTipoDocumental, {
		nombre: tipo.nombre,
		descripcion: tipo.descripcion,
		vertical: tipo.vertical,
		campos: $state.snapshot(tipo.campos) as CampoBorrador[],
		// Sin esto el efecto del asistente, que sincroniza el borrador hacia la biblioteca en cuanto cambia, escribiría el
		// `pasoMaximo` viejo del borrador encima del del tipo (el mismo tropiezo que ya describe `leer` más arriba).
		pasoMaximo: tipo.pasoMaximo
	});
}

/** Vuelve a leer UN tipo del servidor y lo pone en pantalla en lugar del local (o lo quita si ya no existe). */
async function adoptarDelServidor(id: string): Promise<boolean> {
	const r = await llamar('GET', '/api/tipos-documentales');
	if (!r.ok || !Array.isArray(r.cuerpo?.tipos)) return false;
	const entrada = (r.cuerpo.tipos as { id: string; revision: number; datos: unknown }[]).find((e) => e.id === id);
	const i = tiposDocumentales.findIndex((t) => t.id === id);
	if (!entrada) {
		if (i !== -1) tiposDocumentales.splice(i, 1);
		sincronizados.delete(id);
		ordenSincronizado = ordenSincronizado.filter((x) => x !== id);
		alinearBorradorCon(id);
		return true;
	}
	const nuevo = leerTipoGuardado(entrada.datos);
	if (!nuevo) return false;
	if (i === -1) tiposDocumentales.push(nuevo);
	else tiposDocumentales.splice(i, 1, nuevo);
	const puesto = tiposDocumentales.find((t) => t.id === id);
	if (puesto) sincronizados.set(id, { json: serializar(puesto), revision: entrada.revision });
	alinearBorradorCon(id);
	return true;
}

/** Una pasada: manda al servidor lo que cambió desde la última confirmada. Nunca levanta; los fallos van a `estadoBiblioteca`. */
async function ejecutarPasada(): Promise<void> {
	if (!browser || !estadoBiblioteca.cargada) return;
	const esta = generacion;
	let hayFallo = false;
	let reintentable = false;
	const falla = (r: RespuestaServidor) => {
		hayFallo = true;
		if (r.status === 0 || r.status >= 500) reintentable = true;
	};

	// 1. Lo que se quitó de la biblioteca.
	for (const id of [...sincronizados.keys()]) {
		if (tiposDocumentales.some((t) => t.id === id)) continue;
		const r = await llamar('DELETE', `/api/tipos-documentales/${encodeURIComponent(id)}`);
		if (esta !== generacion) return;
		if (r.ok || r.status === 404) {
			sincronizados.delete(id);
			ordenSincronizado = ordenSincronizado.filter((x) => x !== id);
			continue;
		}
		falla(r);
		avisar('No se pudo borrar', textoDe(r, 'No se pudo borrar el tipo documental en el servidor. Se reintentará solo.'));
	}

	// 2. Lo nuevo y lo que cambió.
	for (const tipo of [...tiposDocumentales]) {
		const id = tipo.id;
		const previo = sincronizados.get(id);
		const json = serializar(tipo);
		if (previo?.json === json || rechazados.get(id) === json) continue;
		const nombre = tipo.nombre;

		const r = await llamar('PUT', `/api/tipos-documentales/${encodeURIComponent(id)}`, {
			revision: previo?.revision ?? 0,
			datos: JSON.parse(json)
		});
		if (esta !== generacion) return;

		if (r.ok && typeof r.cuerpo?.revision === 'number') {
			sincronizados.set(id, { json, revision: r.cuerpo.revision });
			rechazados.delete(id);
			if (!previo) ordenSincronizado.push(id);
			continue;
		}
		falla(r);
		if (r.status === 409 && previo) {
			// Otra persona lo guardó antes: se carga SU versión y lo que se había cambiado aquí se pierde (se avisa).
			if (await adoptarDelServidor(id)) {
				if (esta !== generacion) return;
				avisar(
					`Otra persona cambió «${nombre}»`,
					'Alguien de tu organización guardó este tipo documental antes que tú. Se cargó su versión: revisa lo que hay y, si hace falta, repite tu cambio.'
				);
				hayFallo = false;
			}
		} else if (r.status === 404 && previo) {
			if (await adoptarDelServidor(id)) {
				if (esta !== generacion) return;
				avisar(`Otra persona borró «${nombre}»`, 'Alguien de tu organización quitó este tipo documental mientras lo editabas, así que ya no está.');
				hayFallo = false;
			}
		} else if (r.status === 400) {
			rechazados.set(id, json);
			avisar('No se pudo guardar', textoDe(r, 'El servidor no aceptó este tipo documental.'));
		} else if (r.status === 401 || r.status === 403) {
			avisar('No se pudo guardar', textoDe(r, 'Tu sesión no permite guardar tipos documentales. Vuelve a iniciar sesión.'));
		} else {
			avisar('No se pudo guardar', textoDe(r, 'No se pudo contactar al servidor. Lo último que hiciste se reintentará solo; si no, avisa al equipo técnico.'));
		}
	}

	// 3. El orden (solo cuenta lo que el servidor ya conoce).
	const locales = tiposDocumentales.map((t) => t.id).filter((id) => sincronizados.has(id));
	const remotos = ordenSincronizado.filter((id) => sincronizados.has(id));
	if (locales.length > 1 && locales.join('|') !== remotos.join('|')) {
		const r = await llamar('PUT', '/api/tipos-documentales/orden', { ids: locales });
		if (esta !== generacion) return;
		if (r.ok) ordenSincronizado = locales;
		else {
			falla(r);
			avisar('No se pudo guardar el orden', textoDe(r, 'No se pudo guardar el orden de la biblioteca.'));
		}
	}

	if (!hayFallo) reintentos = 0;
	if (reintentable && reintentos < MAX_REINTENTOS) {
		reintentos += 1;
		if (temporizador) clearTimeout(temporizador);
		temporizador = setTimeout(() => {
			temporizador = null;
			void vaciarGuardado();
		}, REINTENTO_MS);
	} else if (!hayFallo && hayPendientes()) {
		// Algo cambió mientras la pasada estaba en vuelo.
		programarGuardado();
	}
}

function programarGuardado() {
	if (temporizador) clearTimeout(temporizador);
	temporizador = setTimeout(() => {
		temporizador = null;
		void vaciarGuardado();
	}, ESPERA_GUARDADO_MS);
}

/**
 * Manda ya lo que esté por enviar y espera a que el servidor conteste. Las pasadas van una tras otra, nunca encimadas.
 *
 * Es lo que hay que esperar antes de pedirle al servidor algo que dependa de lo que acaba de cambiar aquí: el clasificador lo
 * arma con los tipos que TIENE guardados, no con los de esta pantalla. Después de esperar, `hayPendientes()` dice si quedó algo.
 */
export function vaciarGuardado(): Promise<void> {
	if (temporizador) {
		clearTimeout(temporizador);
		temporizador = null;
	}
	cola = cola.then(ejecutarPasada, ejecutarPasada);
	return cola;
}

/**
 * Anota que la biblioteca cambió y la manda al servidor en un momento (ver `ESPERA_GUARDADO_MS`).
 *
 * Devuelve `true` SIEMPRE: el guardado es optimista y no espera. Antes devolvía si el `localStorage` aceptó la escritura, y
 * sus quince llamadores revertían el cambio si no; ahora un fallo del servidor se avisa con `estadoBiblioteca`.
 */
function guardarBiblioteca(): boolean {
	if (!browser) return true;
	reintentos = 0;
	programarGuardado();
	return true;
}

let cargaEnCurso: Promise<void> | null = null;
let duenoDeBiblioteca = '';

/** Pone lo que el servidor dijo en pantalla, reemplazando lo que hubiera. */
function aplicarDelServidor(lista: { id: string; revision: number; datos: unknown }[]) {
	const nuevos = lista.map((e) => leerTipoGuardado(e.datos)).filter((t): t is TipoDocumentalGuardado => t !== null);
	tiposDocumentales.splice(0, tiposDocumentales.length, ...nuevos);
	sincronizados.clear();
	rechazados.clear();
	for (const e of lista) {
		const puesto = tiposDocumentales.find((t) => t.id === e.id);
		if (puesto) sincronizados.set(e.id, { json: serializar(puesto), revision: e.revision });
	}
	ordenSincronizado = tiposDocumentales.map((t) => t.id);
}

/**
 * Lee la biblioteca de la organización del servidor. Una sola petición a la vez: quien llame mientras otra va en camino
 * recibe la misma promesa. Con `refrescar` vuelve a leer aunque ya esté cargada (al abrir Configuración, para ver lo que
 * otra persona haya hecho); sin él, una biblioteca ya cargada no se vuelve a pedir.
 *
 * Primero manda lo que esté por enviar: leer encima de cambios sin guardar los perdería. Y si MIENTRAS se pedía cambió algo
 * en pantalla, no se pisa.
 */
export function cargarBiblioteca(opciones: { refrescar?: boolean } = {}): Promise<void> {
	if (!browser) return Promise.resolve();
	if (estadoBiblioteca.cargada && !opciones.refrescar) return Promise.resolve();
	if (cargaEnCurso) return cargaEnCurso;

	const esta = generacion;
	const leer = async () => {
		if (!estadoBiblioteca.cargada) estadoBiblioteca.cargando = true;
		estadoBiblioteca.errorCarga = '';
		try {
			await vaciarGuardado();
			const r = await llamar('GET', '/api/tipos-documentales');
			if (esta !== generacion) return;
			if (!r.ok || !Array.isArray(r.cuerpo?.tipos)) {
				if (!estadoBiblioteca.cargada) {
					estadoBiblioteca.errorCarga = textoDe(r, 'No se pudieron cargar los tipos documentales de tu organización.');
				}
				return;
			}
			// En la PRIMERA lectura no hay nada legítimo por enviar (guardar se rechaza mientras no esté cargada), así que no se
			// espera a nada. En las siguientes, si algo cambió mientras se pedía, no se pisa.
			if (estadoBiblioteca.cargada && hayPendientes()) return;
			aplicarDelServidor(r.cuerpo.tipos as { id: string; revision: number; datos: unknown }[]);
			estadoBiblioteca.cargada = true;
			// El borrador que dejó el navegador puede estar viejo respecto de la biblioteca (otra persona cambió ese tipo) o apuntar
			// a uno que esta organización no tiene (de otra época, o de otra persona en este mismo navegador): en el primer caso se
			// pone igual que el tipo, en el segundo se desliga, para que seguir tecleando no pise lo de la otra persona ni resucite
			// un tipo bajo otro id sin que nadie lo pida.
			if (borradorTipoDocumental.idGuardado) alinearBorradorCon(borradorTipoDocumental.idGuardado);
			// Lo que había en este navegador (la biblioteca de antes) ya no se lee: se borra para que no confunda.
			try {
				almacen()?.removeItem(LLAVE_BIBLIOTECA_ANTIGUA);
			} catch {
				/* bloqueado: no importa, nadie lo lee */
			}
		} finally {
			if (esta === generacion) estadoBiblioteca.cargando = false;
		}
	};
	const promesa: Promise<void> = leer().finally(() => {
		if (cargaEnCurso === promesa) cargaEnCurso = null;
	});
	cargaEnCurso = promesa;
	return promesa;
}

/**
 * Deja la biblioteca lista para quien tiene la sesión puesta: si cambió la persona (cerró sesión y entró otra en la misma
 * pestaña), suelta lo de la anterior ANTES de leer; con `null` (no hay sesión) solo suelta. Lo llama el layout.
 */
export function prepararBiblioteca(usuarioGuid: string | null) {
	if (!browser) return;
	if (duenoDeBiblioteca !== (usuarioGuid ?? '')) {
		generacion += 1;
		cargaEnCurso = null;
		if (temporizador) clearTimeout(temporizador);
		temporizador = null;
		tiposDocumentales.splice(0, tiposDocumentales.length);
		sincronizados.clear();
		rechazados.clear();
		ordenSincronizado = [];
		reintentos = 0;
		cola = Promise.resolve();
		Object.assign(estadoBiblioteca, { cargada: false, cargando: false, errorCarga: '', falloAlGuardar: false, avisoTitulo: '', avisoMensaje: '' });
		duenoDeBiblioteca = usuarioGuid ?? '';
	}
	if (usuarioGuid) void cargarBiblioteca();
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
	// Antes de haber leído la biblioteca del servidor no se puede saber si este borrador ya corresponde a un tipo: guardarlo
	// ahora crearía un duplicado. (El efecto del asistente lo llama al montarse, con el borrador que haya en el navegador.)
	if (!estadoBiblioteca.cargada) return b.idGuardado;

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
			procesadorDisplayName: '',
			ejemploDocumental: false,
			activadoEn: null,
			calibradoEn: null,
			historialVersiones: [],
			versionEnEdicion: null,
			documentosEjemplo: [],
			recortesPorDocumento: {}
		};
		tiposDocumentales.push(nuevo);
		b.idGuardado = nuevo.id;
	}

	guardarBiblioteca();
	return b.idGuardado;
}

/**
 * La categoría de escape del clasificador: "no es ninguno de los tipos
 * documentales configurados". La agrega SIEMPRE el back (`CATEGORIA_OTRO` en
 * `servicios/esquema.py`) y este nombre tiene que coincidir con el de allá —
 * si divergen, lo desconocido deja de caer en "manda esto a revisión" y cae
 * en "categoría que no sé mapear".
 */
export const CATEGORIA_OTRO = 'otro';

/**
 * Misma normalización que `normalizar_nombre` de `servicios/esquema.py`, con
 * la que el back nombra cada categoría del clasificador. Se replica en vez de
 * pedirla al server porque es pura y minúscula, y el mapeo
 * categoría -> tipo documental tiene que poder hacerse sin una llamada más.
 * No se replica el relleno de `campo_` para nombres que no empiezan con
 * letra: los ids que genera el front (`tipo-{base36}-{n}`) y los nombres de
 * tipo documental siempre empiezan con letra.
 *
 * Vive aquí, junto a los tipos documentales, y no en `pipeline.svelte.ts`
 * (donde nació): desde que también se usa para detectar si el clasificador
 * quedó desfasado (`asegurarClasificadorAlDia`), tenerla en dos lugares sería
 * garantía de que un día divergieran.
 */
export function normalizarCategoria(valor: string): string {
	return valor
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // fuera los diacríticos que NFD separó
		.replace(/ñ/gi, 'n')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9_-]/g, '')
		.replace(/_+/g, '_')
		.replace(/^[_-]+|[_-]+$/g, '')
		.slice(0, 64);
}

/** Tipos cuyo nombre de procesador ya se intentó leer en esta sesión, para no
 *  volver a preguntar por cada vez que se despliega la ficha. Incluye los
 *  intentos FALLIDOS a propósito: si el procesador ya no existe en Google, o
 *  la API no respondió, insistir en cada clic solo agrega ruido — se
 *  reintenta al recargar la página, que es cuando algo pudo haber cambiado. */
const nombreProcesadorPedido = new Set<string>();

/**
 * Rellena `procesadorDisplayName` leyéndolo de Document AI, para los tipos
 * que se activaron ANTES de que "Activar" empezara a devolverlo (2026-09-08).
 *
 * Por qué leerlo y no obligar a republicar: cada publicación crea un Custom
 * Extractor NUEVO en GCP, así que "reactiva para ver el nombre" sale
 * carísimo para un dato de solo lectura. `processors.get` no cobra — la
 * facturación de Document AI es por página PROCESADA — y además devuelve la
 * verdad de Google, no una copia local que pudo quedar vieja.
 *
 * No hace nada si el tipo ya tiene el nombre, si no tiene procesador, o si ya
 * se preguntó en esta sesión. Es silenciosa por diseño: si falla, la ficha se
 * queda mostrando el id, que es exactamente lo que mostraba antes — no vale
 * un mensaje de error por un dato accesorio que la persona no pidió.
 */
export async function completarNombreProcesador(idTipo: string): Promise<void> {
	const tipo = tiposDocumentales.find((t) => t.id === idTipo);
	if (!tipo || !tipo.procesadorId || tipo.procesadorDisplayName) return;
	if (nombreProcesadorPedido.has(tipo.procesadorId)) return;
	nombreProcesadorPedido.add(tipo.procesadorId);

	let respuesta: Response;
	try {
		respuesta = await fetch(`/api/procesadores/${encodeURIComponent(tipo.procesadorId)}`);
	} catch {
		return;
	}
	if (!respuesta.ok) return;

	let datos: Record<string, unknown> = {};
	try {
		datos = await respuesta.json();
	} catch {
		return;
	}

	const nombre = typeof datos.procesadorDisplayName === 'string' ? datos.procesadorDisplayName : '';
	if (!nombre) return;

	// Se vuelve a buscar: entre la petición y la respuesta el tipo pudo
	// borrarse o archivarse.
	const vigente = tiposDocumentales.find((t) => t.id === idTipo);
	if (!vigente || vigente.procesadorId !== tipo.procesadorId) return;
	vigente.procesadorDisplayName = nombre;
	guardarBiblioteca();
}

/**
 * Sincroniza el Classifier ÚNICO de Document AI (`POST /procesadores/clasificador/sincronizar`).
 *
 * Desde el 2026-10-15 NO manda la lista de tipos: nexus_back arma las categorías con los tipos ACTIVOS de TODAS las
 * organizaciones, leídos de su propio registro. Antes los mandaba cada navegador, y el último que sincronizaba pisaba a los
 * demás. Por eso, ANTES de llamar se espera a que lo que cambió aquí (activar, archivar, borrar) esté guardado en el
 * servidor: si el guardado no llegó, sincronizar usaría el estado viejo, y se avisa en vez de hacerlo.
 *
 * Se llama automáticamente después de cada mutación que puede cambiar el conjunto de activos (`activarTipoDocumental`,
 * `archivarTipoDocumental`, `eliminarTipoDocumental`), nunca a mano desde la UI. Si no hay NINGÚN tipo activo en todo el
 * sistema, el servidor responde 422 y aquí eso es un "no hay nada que sincronizar", no un error.
 */
export async function sincronizarClasificador(): Promise<{ ok: boolean; mensaje: string }> {
	await vaciarGuardado();
	if (hayPendientes()) {
		return {
			ok: false,
			mensaje: 'El cambio todavía no quedó guardado en el servidor, así que el clasificador no se actualizó. Se reintentará al guardar.'
		};
	}

	const r = await llamar('POST', '/api/procesadores/clasificador/sincronizar');
	if (r.status === 0) {
		return { ok: false, mensaje: 'No se pudo contactar al servidor para actualizar el clasificador.' };
	}
	// Sin tipos activos en todo el sistema no hay nada que distinguir: no es un fallo.
	if (r.status === 422) return { ok: true, mensaje: '' };
	if (!r.ok) {
		return { ok: false, mensaje: textoDe(r, `No se pudo actualizar el clasificador (HTTP ${r.status}).`) };
	}
	return { ok: true, mensaje: '' };
}

/** Ya se comparó el clasificador en esta sesión. Una vez basta: dentro de una sesión, todo lo que cambia el conjunto de
 *  tipos activos ya sincroniza solo. */
let clasificadorRevisado = false;

/**
 * Le pide al servidor que compare el clasificador que Google tiene con los tipos activos de su registro y, si no coinciden,
 * lo sincronice (`POST /procesadores/clasificador/asegurar`).
 *
 * Nació de un fallo real (2026-09-08): el clasificador se quedó con la categoría de un INE que el usuario había borrado
 * mientras su INE vigente tenía otro id, y un INE de verdad se clasificaba en una categoría que la Biblioteca ya no
 * conocía: el pipeline lo mandaba a "Tipo documental no configurado". Desde afuera se ve idéntico a "el clasificador no
 * reconoce una INE". Cubre el desfase que dejan una sincronización fallida o un tipo tocado a mano en Google.
 *
 * Ya no compara este lado (antes lo hacía contra la biblioteca del navegador, y entonces el clasificador "al día" era el de
 * la última computadora que lo tocó): el servidor lo hace contra su registro, que es de todos. Compara nombre Y
 * descripción, que es prompt real para el modelo. La lectura no cobra; la sincronización solo ocurre si hay diferencia.
 */
export async function asegurarClasificadorAlDia(): Promise<void> {
	if (clasificadorRevisado) return;
	clasificadorRevisado = true; // también ante un fallo: no reintentar en cada lote
	await vaciarGuardado();
	// Sin tipos activos en esta organización el pipeline no va a mandar nada a un extractor: nada que exigirle.
	if (!tiposDocumentales.some((t) => t.estado === 'activo')) return;
	await llamar('POST', '/api/procesadores/clasificador/asegurar');
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
 * Devuelve `{ ok, mensaje, avisoClasificador }` en vez de tirar: quien llama
 * es un manejador de clic y el error tiene que llegar a la pantalla, no a la
 * consola. `avisoClasificador` es DISTINTO de `ok = false`: la activación del
 * Extractor (lo que este botón promete) ya tuvo éxito llegado ese punto — un
 * fallo sincronizando el Classifier es un problema real pero secundario
 * (documentos de este tipo pueden seguir cayendo en "otro" hasta reintentar),
 * y tratarlo como si la activación completa hubiera fallado sería mentir
 * sobre lo que sí funcionó.
 */
export async function activarTipoDocumental(
	id: string
): Promise<{ ok: boolean; mensaje: string; avisoClasificador?: string }> {
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
				campos: $state.snapshot(tipo.campos),
				// La versión YA publicada (0 = nunca). El back publica la SIGUIENTE
				// como un procesador nuevo — nunca adopta el de una versión
				// anterior. Ver `activar_tipo_documental` en nexus_back.
				version: tipo.version
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

	// La versión que se está reemplazando se archiva aquí, NO leyendo
	// `tipo.campos` (ya se sobreescribió con lo recién editado) sino la foto
	// que `crearNuevaVersion()` tomó antes de tocar nada. Sin `versionEnEdicion`
	// —primera activación de un tipo que nunca fue "Crear nueva versión"— no
	// hay nada que archivar. Va primero en el arreglo: "más reciente primero",
	// igual que se van a listar.
	if (tipo.versionEnEdicion) {
		tipo.historialVersiones.unshift(tipo.versionEnEdicion);
		tipo.versionEnEdicion = null;
	}

	tipo.estado = 'activo';
	// Sube DESPUÉS de que Google confirmó, igual que el estado: una publicación
	// que falló no gastó número de versión.
	tipo.version += 1;
	tipo.procesadorId = typeof datos.procesadorId === 'string' ? datos.procesadorId : '';
	tipo.procesadorVersion =
		typeof datos.versionDefault === 'string' ? datos.versionDefault : '';
	tipo.procesadorDisplayName =
		typeof datos.procesadorDisplayName === 'string' ? datos.procesadorDisplayName : '';
	tipo.activadoEn = new Date().toISOString();
	guardarBiblioteca();

	// El tipo YA quedó activo localmente aunque esto falle — ver el docstring
	// de arriba sobre por qué `ok` no se ve afectado por esto.
	const sync = await sincronizarClasificador();
	return { ok: true, mensaje: '', avisoClasificador: sync.ok ? undefined : sync.mensaje };
}

/**
 * Vuelve editable un tipo ACTIVO, regresándolo a `borrador`. Es la puerta que
 * pedía la sección 2.6b de solicitudes-dba.md ("corregir un mapeo activo
 * obliga a versión nueva; no hay atajo") — aquí generalizada a cualquier
 * campo, no solo el mapeo.
 *
 * Detrás de "Crear nueva versión" del menú desde el 2026-09-02 (se llama
 * desde `ConfigSheet.svelte`). Se había construido antes, con tarjeta y
 * menú, y se retiró el mismo día (2026-09-01) a pedido explícito porque no
 * había edición real que ofrecer; ahora sí la hay: el wizard vuelve a
 * abrirse, y al publicar (`activarTipoDocumental`) el back crea un
 * procesador GENUINAMENTE NUEVO en vez de adoptar el de la versión
 * anterior — esa se queda viva sin tocarse.
 *
 * No crea una copia aparte: es el MISMO registro, que vuelve a `borrador` para
 * poder tocarse. El procesador de Document AI sigue sirviendo la configuración
 * YA PUBLICADA hasta que se vuelva a activar — esta función no toca Google.
 *
 * Toma la FOTO de la versión vigente en `versionEnEdicion` antes de tocar
 * nada — es el único momento en que `campos` todavía tiene lo que de verdad
 * se publicó. `activarTipoDocumental` la archiva en `historialVersiones`
 * cuando la publicación siguiente tiene éxito (y solo entonces: si se
 * abandona la edición sin volver a publicar, la foto se queda pendiente sin
 * duplicar nada).
 */
export function crearNuevaVersion(id: string): boolean {
	const tipo = tiposDocumentales.find((t) => t.id === id);
	if (!tipo || tipo.estado !== 'activo') return false;
	tipo.versionEnEdicion = {
		version: tipo.version,
		procesadorId: tipo.procesadorId,
		procesadorVersion: tipo.procesadorVersion,
		publicadoEn: tipo.activadoEn ?? tipo.guardadoEn,
		// Se guarda ANTES de limpiarlo abajo: es lo único que permite devolver
		// el tipo a como estaba si la edición se abandona sin tocar nada.
		calibradoEn: tipo.calibradoEn,
		campos: $state.snapshot(tipo.campos) as CampoBorrador[]
	};
	tipo.estado = 'borrador';
	// Lo calibrado fue la versión de la que se acaba de tomar la foto. La
	// nueva todavía no se prueba, así que vuelve a nacer sin calibrar.
	tipo.calibradoEn = null;
	guardarBiblioteca();
	return true;
}

/**
 * Deshace `crearNuevaVersion` cuando la edición se abandona sin haber tocado
 * nada: devuelve el tipo a `activo`, le regresa su `calibradoEn` y tira la
 * foto. Es el reverso exacto, y por eso lee de `versionEnEdicion` en vez de
 * adivinar: ahí está justo lo que había antes de empezar.
 *
 * POR QUÉ HACE FALTA (bug reportado el 2026-09-22). `crearNuevaVersion` muta
 * el registro en el acto, pero salir del asistente con el tache solo cambiaba
 * de vista. El tipo se quedaba en `borrador` para siempre: la tarjeta volvía a
 * ofrecer "Activar" pese a que su procesador seguía publicado y vivo en
 * Document AI, y —desde que calibrar es requisito— además dejaba de extraer.
 * O sea que abrir una pantalla y cerrarla apagaba un tipo en producción.
 *
 * Quien decide si la edición está "intacta" es el componente, que es el que
 * conoce el borrador; aquí solo se restaura. Si el usuario SÍ editó algo, no
 * se llama a esto: su trabajo sigue en el borrador y el tipo sigue en edición.
 */
export function cancelarNuevaVersion(id: string): boolean {
	const tipo = tiposDocumentales.find((t) => t.id === id);
	const foto = tipo?.versionEnEdicion;
	// Sin foto no hay nada que deshacer: o nunca fue "Crear nueva versión", o
	// ya se publicó (`activarTipoDocumental` la consume y la deja en null).
	if (!tipo || !foto || tipo.estado !== 'borrador') return false;
	tipo.estado = 'activo';
	tipo.calibradoEn = foto.calibradoEn;
	tipo.versionEnEdicion = null;
	guardarBiblioteca();
	return true;
}

/**
 * Cierra la calibración de prompts: marca el tipo como calibrado, que es lo
 * que hace que su tarjeta cambie el botón "Calibrar" por el rótulo "Activado".
 *
 * Lo llama el ÚLTIMO "Continuar" de la pantalla de revisión, y solo cuando al
 * menos un prompt alcanzó el umbral — el caso en que ninguno lo alcanza tiene
 * su propio pie ("Calibrar nuevamente" / "Cargar documento") y no llega aquí.
 *
 * No toca `estado` ni Document AI: el procesador ya existía desde "Activar".
 * Lo único que cambia es que ahora consta que su configuración se probó.
 */
export function marcarCalibrado(id: string): boolean {
	const tipo = tiposDocumentales.find((t) => t.id === id);
	if (!tipo || tipo.estado !== 'activo') return false;
	tipo.calibradoEn = new Date().toISOString();
	guardarBiblioteca();
	return true;
}

/**
 * El switch "Ejemplo documental" del menú `⋮` — vuelve a estar en uso desde
 * el 2026-09-03, con un significado nuevo: "estoy listo" (una marca local,
 * reversible, del usuario). Picar el texto/ícono del renglón sigue abriendo
 * Calibración (`abrirCalibracion`); el switch en sí NO dispara ningún envío
 * todavía — eso es a propósito, queda pendiente de que se defina qué lo va
 * a provocar. Apagarlo NO deshace nada que se haya enviado a Document AI
 * (cuando exista ese envío): es solo la marca local la que se quita.
 */
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
 * el servidor, solo deja de listarse en el árbol y en las tarjetas.
 *
 * No hay todavía una pantalla de "Archivados" para verlos ni un
 * `desarchivarTipoDocumental()` para volver — se agregan cuando se pidan.
 *
 * Async desde que archivar también sincroniza el Classifier (2026-09-07): un
 * tipo archivado debe dejar de ser una categoría clasificable, aunque su
 * Custom Extractor se quede vivo sin tocarse. `ok` sigue siendo `true`
 * siempre que el tipo exista —archivar en sí es puramente local, no puede
 * fallar contra Google— así que un problema sincronizando llega SOLO por
 * `avisoClasificador`, nunca convirtiendo esto en un error.
 */
export async function archivarTipoDocumental(
	id: string
): Promise<{ ok: boolean; avisoClasificador?: string }> {
	const tipo = tiposDocumentales.find((t) => t.id === id);
	if (!tipo) return { ok: false };
	tipo.estado = 'archivado';
	guardarBiblioteca();

	const sync = await sincronizarClasificador();
	return { ok: true, avisoClasificador: sync.ok ? undefined : sync.mensaje };
}

/**
 * "Guardar" de `CargarDocumentoEjemplo.svelte`: agrega una instancia MÁS al
 * arreglo de documentos de ejemplo del tipo documental (2026-09-04: pueden
 * ser varias, cada una con sus propios recortes — antes de esto era UN
 * documento compartido, y antes de eso uno por campo). Nunca sobreescribe:
 * cada llamada agrega una entrada nueva con su propio id.
 *
 * Devuelve el id de la instancia recién creada (o `null` si el tipo no
 * existe) para que quien llama pueda seleccionarla de inmediato — es lo que
 * hace `ConfigSheet.svelte` para dejar la instancia recién subida lista para
 * recortar sin un paso extra de "selecciónala tú".
 */
export function agregarDocumentoEjemplo(
	idTipo: string,
	documento: {
		nombre: string;
		tipo: string;
		tamanoBytes: number;
		rutaRelativa: string;
		sha256: string;
		mime: string;
		rutaVista?: string;
		mimeVista?: string;
		/** Cuántas páginas tiene, si es un PDF (ver `DocumentoEjemploInstancia.paginas`). */
		paginas?: number;
	}
): string | null {
	const tipo = tiposDocumentales.find((t) => t.id === idTipo);
	if (!tipo) return null;
	const id = idDocumentoEjemplo();
	tipo.documentosEjemplo.push({ ...documento, id, guardadoEn: new Date().toISOString() });
	guardarBiblioteca();
	return id;
}

/**
 * Quita UNA instancia de documento de ejemplo — y con ella, TODOS los
 * recortes por campo que se hubieran hecho sobre ESA instancia en particular
 * (`recortesPorDocumento[idDocumento]` completo): un recorte guarda solo sus
 * 4 coordenadas SOBRE esa instancia, así que sin ella ya no hay de dónde
 * sacar lo que marcaban. Las DEMÁS instancias del tipo (y sus recortes) no se tocan.
 */
export function borrarDocumentoEjemplo(idTipo: string, idDocumento: string): boolean {
	const tipo = tiposDocumentales.find((t) => t.id === idTipo);
	if (!tipo) return false;
	const i = tipo.documentosEjemplo.findIndex((d) => d.id === idDocumento);
	if (i === -1) return false;
	tipo.documentosEjemplo.splice(i, 1);
	delete tipo.recortesPorDocumento[idDocumento];
	guardarBiblioteca();
	return true;
}

/**
 * "Guardar" del modal de recorte (`RecortarEjemploCampo.svelte`): persiste
 * el recorte (coordenadas + la imagen YA RECORTADA, ver `EjemploGuardado`)
 * para ESE campo, sobre ESA instancia de documento. Sobreescribe si ya había
 * uno guardado para ese mismo par (documento, campo) — solo importa el más
 * reciente, no hay historial de recortes.
 *
 * El campo se indexa por NOMBRE, no por `campo.id`: `leerCampo()` REGENERA
 * los ids de campo en cada lectura de la Biblioteca (a propósito, para que
 * dos pestañas escribiendo no choquen con ids repetidos — ver su comentario),
 * así que un id es estable solo mientras dura la pestaña, nunca entre
 * refrescos. Medido en carne propia: guardar por id dejaba el recorte
 * huérfano en cuanto la página se recargaba una sola vez. El nombre, en
 * cambio, ya es único dentro de un tipo documental (`nombreCampoDuplicado`
 * lo exige), así que sirve de llave estable sin inventar nada nuevo — el
 * único costo es que renombrar un campo (modo edición) huerfana su ejemplo,
 * un caso mucho más raro que "alguien refrescó la página".
 */
export function guardarRecorteEjemplo(
	idTipo: string,
	idDocumento: string,
	nombreCampo: string,
	ejemplo: { recorte: Recorte }
): boolean {
	const tipo = tiposDocumentales.find((t) => t.id === idTipo);
	if (!tipo) return false;
	if (!tipo.recortesPorDocumento[idDocumento]) tipo.recortesPorDocumento[idDocumento] = {};
	tipo.recortesPorDocumento[idDocumento][nombreCampo] = {
		...ejemplo,
		guardadoEn: new Date().toISOString()
	};
	guardarBiblioteca();
	return true;
}

/**
 * Quita el ejemplo guardado de un campo para UNA instancia de documento en
 * particular — vuelve a quedar sin recorte asignado en ESA instancia,
 * disponible para recortarse de nuevo; las demás instancias no se tocan. A
 * diferencia de `borrarDocumentoEjemplo` (que también llama a esto, en
 * cascada, para cada campo de esa instancia), este SÍ pasa por una
 * confirmación en la UI (`ConfirmarAccion`, botón de basura junto al lápiz
 * de "Editar") — la función en sí no valida nada, la confirmación es
 * responsabilidad de quien la llama.
 */
export function borrarRecorteEjemplo(idTipo: string, idDocumento: string, nombreCampo: string): boolean {
	const tipo = tiposDocumentales.find((t) => t.id === idTipo);
	if (!tipo) return false;
	delete tipo.recortesPorDocumento[idDocumento]?.[nombreCampo];
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
 * Devuelve `{ ok, mensaje, avisoClasificador }`, igual que
 * `activarTipoDocumental`: quien llama es un manejador de clic y el error
 * tiene que llegar a la pantalla. `avisoClasificador` solo se llena cuando el
 * tipo borrado ERA activo (ver el comentario junto a la sincronización, más
 * abajo) y esa sincronización falla — el borrado en sí (`ok`) no se ve
 * afectado, por la misma razón que en `activarTipoDocumental`.
 */
export async function eliminarTipoDocumental(
	id: string
): Promise<{ ok: boolean; mensaje: string; avisoClasificador?: string }> {
	const tipo = tiposDocumentales.find((tp) => tp.id === id);
	if (!tipo) return { ok: false, mensaje: 'Ese tipo documental ya no existe.' };
	const eraActivo = tipo.estado === 'activo';

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

	// Solo si ERA activo: un borrador o un archivado ya no contaban como
	// categoría del clasificador, así que borrarlos no cambia nada que
	// sincronizar — evita una llamada a Google que no haría ninguna
	// diferencia. Va DESPUÉS del `splice`: `sincronizarClasificador` lee
	// `tiposDocumentales` tal cual está ahora, y el tipo borrado no debe
	// aparecer en la lista que se le manda al back.
	if (!eraActivo) return { ok: true, mensaje: '' };
	const sync = await sincronizarClasificador();
	return { ok: true, mensaje: '', avisoClasificador: sync.ok ? undefined : sync.mensaje };
}

/**
 * Mueve `idArrastrado` justo ANTES de `idDestino` en `tiposDocumentales` — el
 * orden real que el árbol de la izquierda dibuja, así que reordenar aquí es
 * lo único que hace falta para que el árbol (y la lista de "Modelos
 * documentales agregados") reflejen el nuevo orden. Sin frame de Figma —
 * pedido explícito el 2026-09-05 ("quiero poder arrastrar los tipos
 * documentales... para reordenarlos a gusto").
 *
 * `hacia` se vuelve a buscar DESPUÉS de quitar el arrastrado (no se calcula
 * con aritmética de índices) para no tener que distinguir a mano si el
 * arrastre fue hacia arriba o hacia abajo — el índice post-remoción ya es el
 * correcto en los dos casos.
 */
export function reordenarTipoDocumental(idArrastrado: string, idDestino: string): boolean {
	if (idArrastrado === idDestino) return false;
	const desde = tiposDocumentales.findIndex((t) => t.id === idArrastrado);
	if (desde === -1) return false;
	const [movido] = tiposDocumentales.splice(desde, 1);
	const hacia = tiposDocumentales.findIndex((t) => t.id === idDestino);
	tiposDocumentales.splice(hacia === -1 ? tiposDocumentales.length : hacia, 0, movido);
	guardarBiblioteca();
	return true;
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
 * Paleta de colores para marcar, en pantalla, el recorte de CADA campo con un
 * color distinto — usada en dos lugares que antes no compartían nada
 * (`RecortarEjemploCampo.svelte`, para los recortes de los "otros" campos
 * mientras se edita uno; y `ConfigSheet.svelte`, para "ver el documento
 * completo con sus recortes"). Vive aquí, no en ninguno de los dos
 * componentes, para que un mismo campo se pinte del MISMO color en ambas
 * vistas. Ninguno es azul: ese es el color del rectángulo ACTIVO en el modal
 * de recorte, y mezclarlo confundiría "el que estoy editando" con "uno ya
 * guardado".
 */
export const PALETA_COLORES_CAMPO = [
	{ borde: 'border-amber-500', relleno: 'bg-amber-500/10', etiqueta: 'bg-amber-500' },
	{ borde: 'border-emerald-500', relleno: 'bg-emerald-500/10', etiqueta: 'bg-emerald-500' },
	{ borde: 'border-rose-500', relleno: 'bg-rose-500/10', etiqueta: 'bg-rose-500' },
	{ borde: 'border-violet-500', relleno: 'bg-violet-500/10', etiqueta: 'bg-violet-500' },
	{ borde: 'border-cyan-500', relleno: 'bg-cyan-500/10', etiqueta: 'bg-cyan-500' },
	{ borde: 'border-fuchsia-500', relleno: 'bg-fuchsia-500/10', etiqueta: 'bg-fuchsia-500' },
	{ borde: 'border-lime-600', relleno: 'bg-lime-500/10', etiqueta: 'bg-lime-600' },
	{ borde: 'border-orange-500', relleno: 'bg-orange-500/10', etiqueta: 'bg-orange-500' }
] as const;

/**
 * Un color estable por NOMBRE de campo (no por posición en una lista): así el
 * mismo campo se ve del mismo color sin importar en qué orden aparezca, o si
 * una vista muestra un subconjunto distinto de campos que la otra (el modal
 * de recorte excluye al campo que se está editando; "documento completo" no
 * excluye a ninguno).
 */
export function colorParaCampo(nombreCampo: string): (typeof PALETA_COLORES_CAMPO)[number] {
	let hash = 0;
	for (let i = 0; i < nombreCampo.length; i++) {
		hash = (hash + nombreCampo.charCodeAt(i)) % PALETA_COLORES_CAMPO.length;
	}
	return PALETA_COLORES_CAMPO[hash];
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

/**
 * Canal para que algo FUERA del Módulo de configuración pida abrirlo ya
 * parado en un tipo documental nuevo. Hoy lo usa "Configurar" de una fila del
 * Pipeline documental cuyo documento no correspondió a ningún tipo activo.
 *
 * Existe porque las dos piezas no se pueden hablar directo: quién abre el
 * sheet es `TopBar.svelte` (con estado local suyo, `configAbierto`) y quién
 * sabe arrancar un tipo en blanco es `nuevoTipoDocumental()`, una función
 * privada de `ConfigSheet.svelte`. Pasar un callback desde una fila del
 * pipeline hasta allá cruzaría media app; una bandera compartida no.
 *
 * El handshake es de dos pasos a propósito: `TopBar` ve la bandera y abre el
 * sheet, y `ConfigSheet` —que solo puede navegar cuando YA está abierto— la
 * consume y la apaga. Por eso la apaga el segundo y no el primero: apagarla
 * al abrir dejaría a `ConfigSheet` sin señal que leer.
 */
export const pedidoDeConfiguracion = $state({ nuevoTipo: false });

export function pedirConfigurarNuevoTipo() {
	pedidoDeConfiguracion.nuevoTipo = true;
}
