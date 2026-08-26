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

export type CampoBorrador = {
	/** Solo para la llave del #each; no viaja a la base. */
	id: string;
	nombre: string;
	tipoDato: string;
	descripcion: string;
	obligatorio: boolean;
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
	/** En qué paso del wizard se quedó (1-3). */
	paso: number;
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
	return { id: idCampo(), nombre: '', tipoDato: '', descripcion: '', obligatorio: false };
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
		paso: 1,
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
		descripcion: typeof d.descripcion === 'string' ? d.descripcion : '',
		obligatorio: d.obligatorio === true
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
		return {
			nombre: typeof datos.nombre === 'string' ? datos.nombre : '',
			descripcion: typeof datos.descripcion === 'string' ? datos.descripcion : '',
			vertical: typeof datos.vertical === 'string' ? datos.vertical : '',
			campoEnCaptura: leerCampo(datos.campoEnCaptura) ?? campoVacio(),
			campos: Array.isArray(datos.campos)
				? (datos.campos.map(leerCampo).filter(Boolean) as CampoBorrador[])
				: [],
			paso: Number.isInteger(datos.paso) && datos.paso >= 1 && datos.paso <= 3 ? datos.paso : 1,
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

/** Mueve el formulario a la lista y lo deja en blanco. No hace nada si el campo
 *  no está completo — el botón que lo llama ya viene deshabilitado en ese caso,
 *  esto es el segundo cinturón. */
export function agregarCampoEnCaptura(): boolean {
	const c = borradorTipoDocumental.campoEnCaptura;
	if (!campoCompleto(c)) return false;
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

/** Un campo al que no se le ha tocado nada. Se ignoran al guardar. */
export function campoIntacto(c: CampoBorrador): boolean {
	return c.nombre.trim() === '' && c.tipoDato === '' && c.descripcion.trim() === '';
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
