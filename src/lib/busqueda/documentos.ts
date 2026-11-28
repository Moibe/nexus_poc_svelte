/**
 * Buscar en documentos · lo puro de la pantalla (épica 14, HU-096 a HU-098; back `POST /busqueda/documentos`, 0022).
 *
 * La búsqueda devuelve FRAGMENTOS de los documentos de la organización (su texto por página o sus datos extraídos) con su parecido a la consulta. No
 * redacta nada: la pantalla enseña el pasaje con las palabras de la consulta resaltadas (los tramos los calcula el back), la página, el tipo, la fecha
 * de procesamiento, el expediente y los datos de esa página. Aquí: armar lo que se manda, partir el pasaje para resaltarlo sin `{@html}` y los textos.
 */

export const MAX_CONSULTA = 500;
/** Cuántos resultados por bloque (el back acepta hasta 20). «Cargar más» pide el siguiente bloque. */
export const POR_BLOQUE = 10;
export const MAX_RESULTADOS = 200;
export const ORDENES = ['relevancia', 'fecha'] as const;
export type Orden = (typeof ORDENES)[number];

export type CampoDePagina = { campo: string; nombre: string; valor: string; confianza: number | null };

export type ResultadoDocumento = {
	fragmento: string;
	documento: string;
	archivo: string;
	tipoDocumentalId: string;
	tipoDocumental: string | null;
	procesadoEn: string | null;
	pagina: number | null;
	clase: 'texto' | 'campos';
	score: number;
	pasaje: string;
	resaltado: [number, number][];
	pasajeAlInicio: boolean;
	pasajeAlFinal: boolean;
	expedientes: { id: string; nombre: string }[];
	campos: CampoDePagina[];
};

export type RespuestaDocumentos = {
	resultados: ResultadoDocumento[];
	total: number;
	inicio: number;
	limite: number;
	hayMas: boolean;
	orden: Orden;
	minimo: number;
	vectorReusado: boolean;
	milisegundos: number;
	mensaje: string | null;
};

export type FiltrosDocumentos = { tipos: string[]; desde: Date | null; hasta: Date | null };

export type EstadoDelIndice = { indexados: number; pendientes: number; inconsistentes: number; conAlerta: number; fragmentos: number };

export const filtrosVacios = (): FiltrosDocumentos => ({ tipos: [], desde: null, hasta: null });

/** ¿Algún filtro acota? El rango solo cuenta con sus dos extremos (así lo entrega el selector). */
export function hayFiltros(f: FiltrosDocumentos): boolean {
	return f.tipos.length > 0 || Boolean(f.desde && f.hasta);
}

/** `AAAA-MM-DD` de una fecha LOCAL (la del calendario), sin pasar por UTC: medianoche en México no debe volverse el día anterior. */
export function diaLocal(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function limpiarConsulta(texto: string): string {
	return texto.replace(/\s+/g, ' ').trim();
}

/** Lo que se le manda al BFF. */
export function cuerpoDeBusqueda(consulta: string, filtros: FiltrosDocumentos, orden: Orden, inicio: number, limite = POR_BLOQUE) {
	const conRango = Boolean(filtros.desde && filtros.hasta);
	return {
		consulta: limpiarConsulta(consulta),
		tipos: [...filtros.tipos],
		...(conRango ? { desde: diaLocal(filtros.desde!), hasta: diaLocal(filtros.hasta!) } : {}),
		orden,
		inicio,
		limite
	};
}

/**
 * El pasaje en trozos `{texto, marcado}` para pintarlo con `<mark>` sin `{@html}`. Los tramos vienen del back (`[inicio, fin)` del pasaje); uno que se
 * sale, se encima con el anterior o está vacío se ignora: el texto sale completo igual.
 */
export function partesDelPasaje(texto: string, resaltado: [number, number][]): { texto: string; marcado: boolean }[] {
	const partes: { texto: string; marcado: boolean }[] = [];
	let cursor = 0;
	const tramos = [...(resaltado ?? [])]
		.filter((t) => Array.isArray(t) && Number.isInteger(t[0]) && Number.isInteger(t[1]) && t[0] < t[1] && t[0] >= 0 && t[1] <= texto.length)
		.sort((a, b) => a[0] - b[0]);
	for (const [a, b] of tramos) {
		if (a < cursor) continue;
		if (a > cursor) partes.push({ texto: texto.slice(cursor, a), marcado: false });
		partes.push({ texto: texto.slice(a, b), marcado: true });
		cursor = b;
	}
	if (cursor < texto.length) partes.push({ texto: texto.slice(cursor), marcado: false });
	return partes;
}

/** El parecido redondeado a 2 decimales (HU-097 CA-1). */
export function parecido(score: number): string {
	return Number.isFinite(score) ? score.toFixed(2) : '—';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «28 nov 2026» en la hora de quien lo lee. */
export function fechaCorta(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** «Confianza 93 %» o vacío. */
export function confianzaComoTexto(c: number | null): string {
	return typeof c === 'number' && Number.isFinite(c) ? `${Math.round(c)} %` : '';
}

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-MX')} ${n === 1 ? uno : varios}`;

/** «1,234 documentos listos para buscar · 3 en espera» (o lo que corresponda). Sin nada indexado lo dice. */
export function textoDelIndice(e: EstadoDelIndice | null): string {
	if (!e) return '';
	const listos = e.indexados;
	const espera = e.pendientes + e.inconsistentes;
	if (!listos && !espera) return 'Todavía no hay documentos listos para buscar: cada documento entra solo en cuanto se extraen sus datos.';
	const partes = [plural(listos, 'documento listo para buscar', 'documentos listos para buscar')];
	if (espera) partes.push(plural(espera, 'en espera', 'en espera'));
	return partes.join(' · ');
}

/** «Mostrando 10 de 37 resultados». */
export function textoDeTotal(mostrados: number, total: number): string {
	if (!total) return '';
	return mostrados >= total ? plural(total, 'resultado', 'resultados') : `Mostrando ${mostrados} de ${plural(total, 'resultado', 'resultados')}`;
}

/** Los ids que tienen la forma de un id de documento, de expediente o de tipo (lo que el BFF acepta reenviar). */
export const esIdDeDocumento = (v: unknown): v is string => typeof v === 'string' && /^documento-[0-9a-f]{32}$/.test(v);
export const esIdDeTipo = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(v);
export const esDia = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
