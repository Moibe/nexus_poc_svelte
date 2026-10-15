/**
 * Filtros y paginación de la Bandeja de preparación (Figma: «Filtrar documentos» y «Registros 8 de 15 · Anterior · 1 · Siguiente»).
 *
 * ## Dónde se filtra
 *
 * En el navegador. La lista completa YA vive aquí (lo subido a mano solo existe en esta pestaña, y lo que llega por la API se
 * trae entero cada 10 s), así que filtrar y paginar sobre ella es lo honesto hoy. El día que la fuente sea una consulta con
 * página y filtros en el servidor, cambia `filasDe`; el modal y la paginación se quedan.
 *
 * ## La vista por omisión es la bandeja ACTIVA
 *
 * Sin filtros se ve lo de siempre. Un descartado sale de la bandeja activa (el aviso del Figma lo dice así: «removido de la
 * bandeja activa y movido a la sección de descartados») y SOLO se ve si el filtro de Estado incluye «Descartado». Esa es la
 * «sección de descartados»: no hay una pantalla aparte en lo que se ha compartido del Figma.
 *
 * ## Los cuatro estados del filtro
 *
 * El Figma ofrece Pendiente, Duplicado, Descartado y Listo. Un documento de la bandeja está en uno de los seis estados
 * internos; se reparten así: `listo` → Listo, `duplicado` → Duplicado, y todo lo demás —en cola, calculando la huella, con
 * contraseña, corrupto— es Pendiente (todavía no está listo para procesar). Es una decisión mía: el diseño no dice dónde cae un
 * documento protegido o corrupto.
 */

import {
	documentosDescartados,
	documentosEnBandeja,
	type DocumentoDescartado,
	type DocumentoEnBandeja
} from '$lib/state/bandeja.svelte';

export type EstadoFiltro = 'pendiente' | 'duplicado' | 'descartado' | 'listo';
export type CanalFiltro = 'Manual' | 'SFTP' | 'SharePoint' | 'API REST';

/** Las opciones tal como las dibuja el Figma, en su orden. */
export const ESTADOS: { valor: EstadoFiltro; etiqueta: string }[] = [
	{ valor: 'pendiente', etiqueta: 'Pendiente' },
	{ valor: 'duplicado', etiqueta: 'Duplicado' },
	{ valor: 'descartado', etiqueta: 'Descartado' },
	{ valor: 'listo', etiqueta: 'Listo' }
];
/** SFTP y SharePoint todavía no tienen conector detrás: salen en el filtro porque el diseño los trae, y no darán resultados. */
export const CANALES: { valor: CanalFiltro; etiqueta: string }[] = [
	{ valor: 'Manual', etiqueta: 'Manual' },
	{ valor: 'SFTP', etiqueta: 'SFTP' },
	{ valor: 'SharePoint', etiqueta: 'SharePoint' },
	{ valor: 'API REST', etiqueta: 'API REST' }
];

export const POR_PAGINA = 8;

export type FiltrosAplicados = {
	estados: EstadoFiltro[];
	canales: CanalFiltro[];
	/** Primer y último día (inclusive), a la hora local. `null` = sin tope. */
	desde: Date | null;
	hasta: Date | null;
};

/** Los filtros que están puestos ahora. */
export const filtros = $state<FiltrosAplicados>({ estados: [], canales: [], desde: null, hasta: null });
/** La página que se ve, desde 1. */
export const vista = $state({ pagina: 1 });

export function estadoFiltrableDe(doc: DocumentoEnBandeja): EstadoFiltro {
	if (doc.estado === 'listo') return 'listo';
	if (doc.estado === 'duplicado') return 'duplicado';
	return 'pendiente';
}

/** Cuántos de los tres filtros (Estado, Canal, Fecha) están puestos: es el número de la insignia roja del botón «Filtros». */
export function cuantosFiltros(f: FiltrosAplicados = filtros): number {
	return (f.estados.length > 0 ? 1 : 0) + (f.canales.length > 0 ? 1 : 0) + (f.desde || f.hasta ? 1 : 0);
}

function principioDelDia(d: Date): number {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function enElRango(fecha: Date, f: FiltrosAplicados): boolean {
	const t = fecha.getTime();
	if (f.desde && t < principioDelDia(f.desde)) return false;
	if (f.hasta && t >= principioDelDia(f.hasta) + 24 * 3600 * 1000) return false;
	return true;
}

/** Una fila de la lista: un documento de la bandeja activa o uno descartado. */
export type Fila = { tipo: 'activo'; doc: DocumentoEnBandeja } | { tipo: 'descartado'; doc: DocumentoDescartado };

/** Lo que cumple los filtros: primero lo activo, luego lo descartado (si el filtro de Estado lo pide). */
export function filasDe(f: FiltrosAplicados = filtros): Fila[] {
	const pideEstado = f.estados.length > 0;
	const incluyeDescartados = f.estados.includes('descartado');
	const canalOk = (origen: string) => f.canales.length === 0 || (f.canales as string[]).includes(origen);

	const activas: Fila[] = documentosEnBandeja
		.filter((d) => (!pideEstado || f.estados.includes(estadoFiltrableDe(d))) && canalOk(d.origen) && enElRango(d.agregadoEn, f))
		.map((doc) => ({ tipo: 'activo', doc }));
	const descartadas: Fila[] = incluyeDescartados
		? documentosDescartados.filter((d) => canalOk(d.origen) && enElRango(d.agregadoEn, f)).map((doc) => ({ tipo: 'descartado', doc }))
		: [];
	return [...activas, ...descartadas];
}

/** Pone los filtros, vuelve a la página 1 y quita la selección de lo que el filtro dejó fuera de la vista: la barra de acciones
 *  actúa sobre lo seleccionado, y un documento que no se ve no debe poder descartarse ni mandarse al pipeline sin querer. */
export function aplicarFiltros(nuevos: FiltrosAplicados): void {
	filtros.estados = [...nuevos.estados];
	filtros.canales = [...nuevos.canales];
	filtros.desde = nuevos.desde;
	filtros.hasta = nuevos.hasta;
	vista.pagina = 1;
	const visibles = new Set(filasDe().filter((f) => f.tipo === 'activo').map((f) => f.doc.id));
	for (const d of documentosEnBandeja) if (d.seleccionado && !visibles.has(d.id)) d.seleccionado = false;
}

export function limpiarFiltros(): void {
	aplicarFiltros({ estados: [], canales: [], desde: null, hasta: null });
}

/** Cuántos documentos hay hoy en un estado (para la insignia roja de «Duplicado» en el desplegable). */
export function cuantosEn(estado: EstadoFiltro): number {
	if (estado === 'descartado') return documentosDescartados.length;
	return documentosEnBandeja.filter((d) => estadoFiltrableDe(d) === estado).length;
}
