/**
 * Estado del Pipeline documental (el tercer panel del Home).
 *
 * Un documento llega aquí cuando el usuario le da "Iniciar pipeline" en la
 * Bandeja de preparación. El movimiento es INMEDIATO: sale de la bandeja y
 * aparece aquí en cola, aunque la extracción tarde. Así lo muestra Figma
 * (HU001|106: la bandeja queda vacía y todo está del lado derecho) y además es
 * más honesto — el documento ya salió de "preparación", ya no se puede editar
 * ni descartar como si nada hubiera pasado.
 *
 * PROVISIONAL igual que la bandeja: vive solo en memoria del navegador. Cuando
 * exista SQL Server, cada corrida de aquí se convierte en un `extraction_run`
 * con sus `entity_fact`, y este módulo pasa a leer de la base en vez de
 * guardar el resultado en RAM.
 */

import {
	documentosEnBandeja,
	moverDocumentoAlPipeline,
	type DocumentoEnBandeja
} from './bandeja.svelte';
import type { ResultadoIne } from '$lib/types/ine';

export type EstadoPipeline =
	| 'en_cola' // esperando turno; ver NOTA sobre por qué se procesa de a uno
	| 'procesando'
	| 'procesado' // extracción exitosa
	| 'no_reconocido' // la API respondió bien pero el documento no es una INE
	| 'no_soportado' // formato que Document AI no procesa (DOCX, XLSX)
	| 'fallido'; // error de red, timeout o error del servicio

export type DocumentoEnPipeline = {
	id: string;
	nombre: string;
	extension: string;
	tamanioBytes: number;
	origen: 'Manual';
	agregadoEn: Date;
	hashSha256: string | null;
	archivo: File;
	seleccionado: boolean;

	estado: EstadoPipeline;
	/** Venía marcado como duplicado en la bandeja y aun así se mandó a procesar.
	 *  Figma lo etiqueta "Duplicado procesado de forma explícita". */
	eraDuplicado: boolean;
	enviadoEn: Date;
	terminadoEn: Date | null;
	resultado: ResultadoIne | null;
	error: string | null;
};

/**
 * Lo que Document AI acepta, por extensión de la bandeja.
 *
 * DOCX y XLSX NO están: la bandeja los admite (se pueden almacenar y luego
 * ingerirlos por otra vía), pero Document AI no los procesa. En vez de mandarlos
 * y recibir un error del proveedor, se marcan `no_soportado` sin gastar la
 * llamada — que además cuesta dinero.
 */
const MIME_POR_EXTENSION: Record<string, string> = {
	PDF: 'application/pdf',
	JPG: 'image/jpeg',
	JPEG: 'image/jpeg',
	TIFF: 'image/tiff'
};

export const documentosEnPipeline = $state<DocumentoEnPipeline[]>([]);

/**
 * Candado del lote en curso. Vive en el MÓDULO y no en el componente de la
 * barra flotante a propósito: esa barra se desmonta en cuanto la selección
 * queda vacía —que es justo lo que pasa al mover los documentos al pipeline—
 * así que un `let enviando` local se perdía al instante y no impedía nada. Con
 * el candado aquí, seleccionar más archivos y volver a picar "Iniciar
 * pipeline" mientras el primer lote corre ya no arranca un segundo lote en
 * paralelo (que serían llamadas simultáneas a Document AI, o sea costo).
 */
let loteEnCurso = $state(false);

export function hayLoteEnCurso(): boolean {
	return loteEnCurso;
}

/** Solo lo que se puede mandar: un archivo que sigue subiendo no tiene bytes
 *  confirmados, y uno protegido o corrupto no se va a poder abrir del otro
 *  lado. Un duplicado SÍ se puede mandar a propósito — es una decisión del
 *  usuario, y así lo contempla el diseño. */
export function sePuedeProcesar(doc: DocumentoEnBandeja): boolean {
	return doc.estado === 'listo' || doc.estado === 'duplicado';
}

/**
 * Manda a la API los documentos seleccionados en la Bandeja.
 *
 * NOTA sobre el orden: los documentos se procesan de UNO EN UNO, no en
 * paralelo. Cada llamada a Document AI se cobra y tiene límite de tasa; si
 * alguien selecciona veinte archivos, veinte llamadas simultáneas son un pico
 * de costo y un 429 casi seguro. La cola se ve en la UI (`en_cola`) para que la
 * espera sea explícita en vez de parecer que la app se colgó.
 */
export async function iniciarPipeline() {
	if (loteEnCurso) return;
	const elegibles = documentosEnBandeja.filter((d) => d.seleccionado && sePuedeProcesar(d));
	if (elegibles.length === 0) return;
	loteEnCurso = true;

	// Se mueven TODOS primero y después se procesan: si se hiciera de a uno, la
	// bandeja se iría vaciando poco a poco y el usuario vería saltar las filas
	// mientras las mira.
	const recienLlegados: DocumentoEnPipeline[] = [];
	for (const doc of elegibles) {
		const entrada: DocumentoEnPipeline = {
			id: doc.id,
			nombre: doc.nombre,
			extension: doc.extension,
			tamanioBytes: doc.tamanioBytes,
			origen: doc.origen,
			agregadoEn: doc.agregadoEn,
			hashSha256: doc.hashSha256,
			archivo: doc.archivo,
			seleccionado: false,
			estado: 'en_cola',
			eraDuplicado: doc.estado === 'duplicado',
			enviadoEn: new Date(),
			terminadoEn: null,
			resultado: null,
			error: null
		};
		documentosEnPipeline.push(entrada);
		recienLlegados.push(entrada);
		moverDocumentoAlPipeline(doc.id);
	}

	try {
		for (const entrada of recienLlegados) {
			await procesarUno(entrada.id);
		}
	} finally {
		loteEnCurso = false;
	}
}

async function procesarUno(id: string) {
	const doc = documentosEnPipeline.find((d) => d.id === id);
	if (!doc) return; // lo quitaron mientras esperaba turno

	const mime = MIME_POR_EXTENSION[doc.extension];
	if (!mime) {
		doc.estado = 'no_soportado';
		doc.terminadoEn = new Date();
		doc.error = `Document AI no procesa archivos ${doc.extension}. Se aceptan PDF, JPG, JPEG y TIFF.`;
		return;
	}

	doc.estado = 'procesando';

	// Se reconstruye el File con el MIME correcto en vez de mandar el original:
	// el navegador deja `File.type` vacío para extensiones que no conoce (pasa
	// seguido con .tiff), y el back valida justamente ese header. Sin esto, un
	// TIFF válido se rechazaría con "formato no soportado" sin motivo real.
	const cuerpo = new FormData();
	cuerpo.append('archivo', new File([doc.archivo], doc.nombre, { type: mime }));

	try {
		const respuesta = await fetch('/api/pipeline/ine', { method: 'POST', body: cuerpo });

		// Se parsea con red: no todo error llega del BFF con forma {mensaje}. Un
		// 502 de infraestructura o una página de error devuelven HTML, y hacer
		// .json() a ciegas convertía eso en un SyntaxError de parseo que tapaba
		// el error real con un mensaje sobre JSON.
		let datos: { mensaje?: string; _metadata?: { quality_alert?: boolean } } | null = null;
		try {
			datos = await respuesta.json();
		} catch {
			datos = null;
		}

		const vivo = documentosEnPipeline.find((d) => d.id === id);
		if (!vivo) return; // lo quitaron mientras se procesaba

		vivo.terminadoEn = new Date();

		if (!respuesta.ok || datos === null) {
			vivo.estado = 'fallido';
			vivo.error = datos?.mensaje ?? `La API respondió ${respuesta.status}.`;
			return;
		}

		vivo.resultado = datos as ResultadoIne;
		// `quality_alert` no es un error: la API funcionó y su respuesta es que
		// el documento no se reconoció como INE. Se distingue de `fallido` para
		// que el usuario sepa que no tiene nada que reintentar.
		vivo.estado = datos?._metadata?.quality_alert ? 'no_reconocido' : 'procesado';
	} catch (err) {
		const vivo = documentosEnPipeline.find((d) => d.id === id);
		if (!vivo) return;
		vivo.estado = 'fallido';
		vivo.terminadoEn = new Date();
		vivo.error = err instanceof Error ? err.message : 'Error desconocido al llamar a la API.';
	}
}

export function alternarSeleccionPipeline(id: string) {
	const doc = documentosEnPipeline.find((d) => d.id === id);
	if (doc) doc.seleccionado = !doc.seleccionado;
}

export function quitarDelPipeline(id: string) {
	const indice = documentosEnPipeline.findIndex((d) => d.id === id);
	if (indice !== -1) documentosEnPipeline.splice(indice, 1);
}

/** Texto y color de cada estado, en un solo lugar, para que la fila y el modal
 *  de detalle no se contradigan. */
export const ETIQUETA_ESTADO: Record<EstadoPipeline, { texto: string; tono: 'ok' | 'error' | 'proceso' }> = {
	en_cola: { texto: 'En cola', tono: 'proceso' },
	procesando: { texto: 'Procesando', tono: 'proceso' },
	procesado: { texto: 'Listo', tono: 'ok' },
	no_reconocido: { texto: 'No se reconoció como INE', tono: 'error' },
	no_soportado: { texto: 'Formato no procesable', tono: 'error' },
	fallido: { texto: 'Falló el procesamiento', tono: 'error' }
};
