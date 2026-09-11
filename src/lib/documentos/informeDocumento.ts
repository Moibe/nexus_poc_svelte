/**
 * El `Informe` de un documento procesado: lo que "Descargar" convierte en PDF.
 *
 * POR QUÉ VIVE AQUÍ Y NO EN CADA PANEL. `descargar.ts` recibe un `Informe`
 * genérico a propósito, para que el panel sea el dueño del formato de cada
 * dato y el PDF no pueda divergir de la pantalla. Eso valía mientras UN solo
 * panel descargaba. Desde el 2026-09-11 descargan los dos —"Detalle" y
 * "Registro de OT"— y **bajan lo mismo**, por decisión explícita del usuario:
 * con el armado duplicado en dos archivos, "lo mismo" duraría hasta el primer
 * cambio que alguien hiciera en uno solo. Así que el informe se arma una vez y
 * los dos paneles lo piden.
 *
 * Lo único que cambia entre paneles es el `titulo`, que es de dónde se bajó.
 *
 * `descargar.ts` NO se toca: sigue recibiendo un `Informe` ya formateado y sin
 * saber qué es un documento.
 */
import { formatearTamano } from '$lib/state/bandeja.svelte';
import { etiquetaDe, type DocumentoEnPipeline } from '$lib/state/pipeline.svelte';
import { calidadDe, camposDe, type CampoExtraido } from '$lib/types/ine';
import type { AvisoInforme, Informe, SeccionInforme } from './descargar';

/** Placeholder, igual que en los paneles: no hay autenticación todavía, así
 *  que "el usuario que procesó este documento" no existe como dato real. */
const USUARIO = 'Moisés Briseño Estrello';

export function fechaHora(fecha: Date | null | undefined): string {
	if (!fecha) return '—';
	const dia = String(fecha.getDate()).padStart(2, '0');
	const mes = String(fecha.getMonth() + 1).padStart(2, '0');
	const hh = String(fecha.getHours()).padStart(2, '0');
	const mm = String(fecha.getMinutes()).padStart(2, '0');
	return `${dia}/${mes}/${fecha.getFullYear()} · ${hh}:${mm} h`;
}

/** `procesado_en` viene en ISO-8601 UTC; se muestra en la hora local de quien
 *  mira, que es lo que espera cualquiera leyendo una pantalla. */
export function fechaHoraIso(iso: string | undefined): string | null {
	if (!iso) return null;
	const fecha = new Date(iso);
	return Number.isNaN(fecha.getTime()) ? null : fechaHora(fecha);
}

/**
 * Un campo extraído, en un renglón de informe.
 *
 * El valor sale de `value_normalized ?? value_raw` porque el normalizado puede
 * llegar como cadena vacía (el back filtra por `is not None`, no por `if not`).
 * La confianza se omite cuando es nula en vez de imprimir "0.00 %": el back
 * manda null cuando Document AI no la reporta, y confundir "no lo sé" con
 * "cero" ya causó un incidente. El crudo sólo aparece cuando la normalización
 * lo cambió; si es idéntico, repetirlo es ruido.
 */
function filaDeCampo(nombre: string, campo: CampoExtraido) {
	const valor = campo.value_normalized ?? campo.value_raw ?? '';
	const partes = [valor || '—'];
	if (campo.confianza !== null) {
		const cal = calidadDe(campo.confianza);
		partes.push(`${campo.confianza.toFixed(2)} %${cal ? ` · ${cal}` : ''}`);
	}
	if (
		campo.value_raw !== null &&
		campo.value_raw !== '' &&
		campo.value_raw !== campo.value_normalized
	) {
		partes.push(`crudo: ${campo.value_raw}`);
	}
	return { etiqueta: nombre, valor: partes.join('  —  ') };
}

/** Los mismos recuadros de aviso que pintan los paneles, en el mismo orden.
 *  Si se agrega uno en pantalla, va aquí también: el PDF sólo cuenta lo que
 *  esta lista traiga. */
function avisosDe(documento: DocumentoEnPipeline): AvisoInforme[] {
	const lista: AvisoInforme[] = [];
	if (documento.error) {
		lista.push({ titulo: 'No se pudo procesar', texto: documento.error });
	}
	if (documento.resultado?._metadata?.quality_alert) {
		lista.push({
			titulo: 'No se reconocieron sus campos',
			texto:
				documento.resultado._metadata.motivo ??
				'Document AI respondió sin campos para este documento.'
		});
	}
	if (documento.estado === 'no_configurado') {
		lista.push({
			titulo: 'Tipo documental no configurado',
			texto:
				'El clasificador no encontró ningún tipo documental activo que corresponda a este documento.'
		});
	}
	if (documento.estado === 'pendiente_revision') {
		lista.push({
			titulo: 'Pendiente de revisión humana',
			texto:
				'Su tipo documental no está configurado y se eligió continuar sin configurarlo, así que no se le extrajo ningún dato.'
		});
	}
	return lista;
}

/** La sección de campos. Aparece aunque no haya ninguno: omitirla se leería
 *  como que se olvidó de ponerla, no como que no hubo nada que extraer. */
function seccionCampos(documento: DocumentoEnPipeline): SeccionInforme[] {
	if (!documento.resultado) return [];
	const campos = camposDe(documento.resultado);
	return [
		{
			titulo: campos.length > 0 ? `Campos extraídos (${campos.length})` : 'Campos extraídos',
			filas:
				campos.length > 0
					? campos.map(([nombre, campo]) => filaDeCampo(nombre, campo))
					: [{ etiqueta: 'Campos', valor: 'No se extrajo ningún campo de este documento.' }]
		}
	];
}

export function construirInforme(documento: DocumentoEnPipeline, titulo: string): Informe {
	const etiqueta = etiquetaDe(documento);
	const confianza = documento.resultado?.confianza_promedio ?? null;
	const calidad = calidadDe(confianza);

	return {
		titulo,
		subtitulo: `${documento.nombre} — ${documento.extension} • ${formatearTamano(
			documento.tamanioBytes
		)}`,
		secciones: [
			{
				titulo: 'Información',
				filas: [
					{ etiqueta: 'Nombre de archivo', valor: documento.nombre },
					// Condicional igual que en pantalla: con `otro` no hay tipo que
					// nombrar y el renglón sobra.
					...(documento.tipoDetectado
						? [{ etiqueta: 'Documento detectado', valor: documento.tipoDetectado }]
						: []),
					{ etiqueta: 'Estado actual', valor: etiqueta?.texto ?? '—' },
					{ etiqueta: 'Fecha y hora de ingesta', valor: fechaHora(documento.agregadoEn) },
					{ etiqueta: 'Fuente de ingesta', valor: documento.origen },
					{ etiqueta: 'Tamaño del archivo', valor: formatearTamano(documento.tamanioBytes) },
					{ etiqueta: 'Formato', valor: documento.extension },
					{ etiqueta: 'Hash SHA-256', valor: documento.hashSha256 ?? '—' },
					{ etiqueta: 'Usuario', valor: USUARIO }
				]
			},
			{
				titulo: 'Procesamiento OCR',
				filas: [
					{
						etiqueta: 'Fecha y hora de ejecución',
						valor:
							fechaHoraIso(documento.resultado?._metadata?.procesado_en) ??
							fechaHora(documento.terminadoEn)
					},
					{
						etiqueta: 'Nivel de confianza obtenida',
						valor: confianza === null ? '—' : `${confianza.toFixed(2)} %`
					},
					{ etiqueta: 'Calidad de la lectura', valor: calidad ?? '—' },
					{
						etiqueta: 'Versión del modelo',
						valor: documento.resultado?._metadata?.engine_version ?? 'sin fijar'
					}
				]
			},
			...seccionCampos(documento)
		],
		avisos: avisosDe(documento)
	};
}
