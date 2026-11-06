/**
 * Los DATOS EXTRAÍDOS de un documento tal como los devuelve nexus_back (`GET /documentos/{id}/datos`, migración 0007) y el INFORME en PDF que
 * se arma con ellos (2026-11-06).
 *
 * Moibe, 2026-11-06: «"Ver JPG" no va, o sea no es que quiera ver el archivo, quiero ver los resultados de extracción pero en pdf, como lo
 * hacíamos en las bandejas». Las bandejas bajan un PDF del resultado del procesamiento (`informeDocumento.ts` → `descargar.ts`); aquí se arma el
 * MISMO informe —las secciones «Información», «Procesamiento OCR» y «Campos extraídos» y los recuadros de aviso al final— pero a partir de los
 * datos que el servidor guardó, que es lo único que un documento de un expediente tiene (no es un `DocumentoEnPipeline`). Lo que se descarga
 * sigue siendo `descargarPdf`, que recibe un `Informe` ya formateado y no sabe qué es un documento.
 *
 * Sin dependencias de Svelte (solo `expedientes.ts` y `types/ine.ts`, ambos puros) para poder probarlo suelto con `node --experimental-strip-types`.
 */
import type { Informe } from '$lib/documentos/descargar';
import { fechaCorta, formatearTamano, formatoDe, type DocumentoDeExpediente } from '$lib/expedientes/expedientes';
import { calidadDe } from '$lib/types/ine';

export type Campo = {
	ruta: string;
	nombre: string;
	registro: number | null;
	valor: string | null;
	valorCrudo: string | null;
	motivoSinValor: string | null;
	confianza: number | null;
	pagina: number | null;
	corregido: boolean;
};

export type Datos = {
	clasificacion: { categoria: string | null; tipoDocumental: { id: string; nombre: string } | null; confianza: number | null } | null;
	extraccion: {
		tipoDocumental: { id: string; nombre: string | null; revision: number | null };
		estado: 'ok' | 'no_reconocido' | 'error';
		error: string | null;
		confianzaPromedio: number | null;
		terminadaEn: string | null;
		totalCorridas: number;
	} | null;
	campos: Campo[];
};

/** Lo que se dice de un campo que no trae valor. */
export const MOTIVOS_SIN_VALOR: Record<string, string> = {
	not_present: 'No apareció',
	illegible: 'Ilegible',
	below_threshold: 'Confianza insuficiente',
	extraction_error: 'Falló la extracción'
};

/** `socios[2].nombre` → «socios 2 · nombre»: la ruta se lee mejor sin corchetes. */
export const legible = (ruta: string): string => ruta.replace(/\[(\d+)\]/g, ' $1').replaceAll('.', ' · ').replaceAll('_', ' ');

/** «06/11/2026 · 14:05 h», en la hora de quien mira (la misma forma que el informe de las bandejas). Sin fecha, o ilegible, «—». */
export function fechaHoraDe(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	const dos = (n: number) => String(n).padStart(2, '0');
	return `${fechaCorta(iso)} · ${dos(d.getHours())}:${dos(d.getMinutes())} h`;
}

/** Cómo entró el documento, en palabras. */
const CANAL: Record<string, string> = { API: 'API', MANUAL: 'Carga manual' };

/** El estado de la extracción, en palabras. */
export function estadoDeExtraccion(datos: Datos): string {
	const e = datos.extraccion;
	if (e) return e.estado === 'ok' ? 'Datos extraídos' : e.estado === 'no_reconocido' ? 'No se reconocieron sus campos' : 'Falló la extracción';
	return datos.clasificacion?.tipoDocumental ? 'Clasificado, sin datos extraídos' : 'Sin procesar';
}

const primeraMayuscula = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/**
 * Un campo, en un renglón del informe: el valor (o por qué no lo hay), su confianza con la calidad de la lectura, lo que leyó el extractor si
 * el valor se normalizó o se corrigió, y la página. La confianza se omite cuando es nula en vez de imprimir «0 %»: «no lo sé» no es «cero».
 */
function filaDeCampo(c: Campo): { etiqueta: string; valor: string } {
	const partes: string[] = [c.valor === null || c.valor === '' ? (MOTIVOS_SIN_VALOR[c.motivoSinValor ?? ''] ?? 'Sin valor') : c.valor];
	if (c.valor !== null && c.corregido) partes[0] += ' (corregido)';
	if (c.confianza !== null && c.confianza !== undefined) {
		const cal = calidadDe(c.confianza);
		partes.push(`${c.confianza.toFixed(2)} %${cal ? ` · ${cal}` : ''}`);
	}
	if (c.valorCrudo && c.valorCrudo !== c.valor) partes.push(`leído como: ${c.valorCrudo}`);
	if (c.pagina !== null && c.pagina !== undefined) partes.push(`pág. ${c.pagina}`);
	return { etiqueta: primeraMayuscula(legible(c.ruta)), valor: partes.join('  —  ') };
}

/**
 * El informe de los resultados de extracción de UN documento de un expediente. `expediente` es el nombre del expediente donde vive (sale en el
 * subtítulo). Tolera una respuesta a medias (sin `campos`, sin `extraccion`): cuenta lo que haya y dice que lo demás no hay.
 */
export function construirInformeDeDatos(documento: DocumentoDeExpediente, datos: Datos, expediente: string): Informe {
	const campos = Array.isArray(datos.campos) ? datos.campos : [];
	const e = datos.extraccion ?? null;
	const tipo = e ? (e.tipoDocumental.nombre ?? 'Tipo documental eliminado') : (datos.clasificacion?.tipoDocumental?.nombre ?? null);
	const confianza = e?.confianzaPromedio ?? null;
	const calidad = calidadDe(confianza);

	const avisos: Informe['avisos'] = [];
	if (e?.estado === 'error') {
		avisos.push({
			titulo: 'No se pudo procesar',
			texto: `El último intento de extracción falló: ${e.error ?? 'sin detalle'}.${campos.length ? ' Los campos de abajo son los de la extracción anterior.' : ''}`
		});
	} else if (e?.estado === 'no_reconocido') {
		avisos.push({ titulo: 'No se reconocieron sus campos', texto: 'El extractor no reconoció los campos de este documento.' });
	}

	return {
		titulo: 'Resultados de la extracción',
		subtitulo: `${documento.nombreOriginal} — ${formatoDe(documento)} • ${formatearTamano(documento.tamanoBytes)} • Expediente «${expediente}»`,
		secciones: [
			{
				titulo: 'Información',
				filas: [
					{ etiqueta: 'Nombre de archivo', valor: documento.nombreOriginal },
					{ etiqueta: 'Expediente', valor: expediente },
					...(tipo ? [{ etiqueta: 'Tipo documental', valor: tipo }] : []),
					{ etiqueta: 'Estado de la extracción', valor: estadoDeExtraccion(datos) },
					{ etiqueta: 'Fecha y hora de ingesta', valor: fechaHoraDe(documento.recibidoEn) },
					{ etiqueta: 'Fuente de ingesta', valor: CANAL[documento.canal] ?? documento.canal ?? '—' },
					{ etiqueta: 'Tamaño del archivo', valor: formatearTamano(documento.tamanoBytes) },
					{ etiqueta: 'Formato', valor: formatoDe(documento) },
					{ etiqueta: 'Hash SHA-256', valor: documento.sha256 ?? '—' }
				]
			},
			{
				titulo: 'Procesamiento OCR',
				filas: [
					{ etiqueta: 'Fecha y hora de ejecución', valor: fechaHoraDe(e?.terminadaEn) },
					{ etiqueta: 'Nivel de confianza obtenida', valor: confianza === null ? '—' : `${confianza.toFixed(2)} %` },
					{ etiqueta: 'Calidad de la lectura', valor: calidad ?? '—' },
					{ etiqueta: 'Revisión del tipo documental', valor: e?.tipoDocumental.revision != null ? String(e.tipoDocumental.revision) : '—' },
					{ etiqueta: 'Veces procesado', valor: e ? String(e.totalCorridas) : '0' }
				]
			},
			{
				titulo: campos.length > 0 ? `Campos extraídos (${campos.length})` : 'Campos extraídos',
				filas: campos.length > 0 ? campos.map(filaDeCampo) : [{ etiqueta: 'Campos', valor: 'No se extrajo ningún campo de este documento.' }]
			}
		],
		avisos
	};
}
