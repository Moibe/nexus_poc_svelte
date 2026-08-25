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

export type BorradorTipoDocumental = {
	nombre: string;
	descripcion: string;
	vertical: string;
	/** En qué paso del wizard se quedó (1-3). */
	paso: number;
	/** ISO-8601 de la última vez que se persistió, tal como venía al rehidratar.
	 *  No se actualiza en memoria al guardar — el valor fresco va al payload. */
	actualizadoEn: string | null;
};

const VACIO: BorradorTipoDocumental = {
	nombre: '',
	descripcion: '',
	vertical: '',
	paso: 1,
	actualizadoEn: null
};

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
			paso: Number.isInteger(datos.paso) && datos.paso >= 1 && datos.paso <= 3 ? datos.paso : 1,
			actualizadoEn: typeof datos.actualizadoEn === 'string' ? datos.actualizadoEn : null
		};
	} catch {
		return null;
	}
}

export const borradorTipoDocumental = $state<BorradorTipoDocumental>(leer() ?? { ...VACIO });

/** ¿Hay algo capturado que valga la pena conservar? */
export function hayBorrador(): boolean {
	return (
		borradorTipoDocumental.nombre.trim() !== '' ||
		borradorTipoDocumental.descripcion.trim() !== '' ||
		borradorTipoDocumental.vertical !== ''
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
	Object.assign(borradorTipoDocumental, VACIO);
	const store = almacen();
	if (!store) return;
	try {
		store.removeItem(LLAVE);
	} catch {
		/* mismo caso que arriba */
	}
}
