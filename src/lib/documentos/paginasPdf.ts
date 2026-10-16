/**
 * Las páginas de un PDF como imágenes, una por una y a pedido (2026-10-16).
 *
 * Existe para la interfaz de etiquetado (Calibración): hasta ahora un documento de ejemplo era UNA imagen —la página 1 del PDF
 * pintada al subirlo— y servía para una INE o un pasaporte. Un acta constitutiva tiene ~20 páginas y el dato que se quiere
 * marcar casi nunca está en la primera. Subir 20 imágenes por documento sería caro y no serviría para los que ya están
 * guardados, así que las páginas se pintan DESDE EL PDF ORIGINAL (que el almacén ya guarda) cuando alguien las pide:
 *
 *   · `abrirPdf` abre los bytes con pdf.js y devuelve cuántas páginas tiene y cómo pintar cada una (PNG).
 *   · `pdfDeEjemplo` lo hace sobre un documento de ejemplo ya guardado: baja el original del almacén UNA vez y recuerda los
 *     últimos documentos abiertos, para que moverse entre páginas, ver un recorte y volver no vuelvan a bajarlo ni a abrirlo.
 *
 * pdfjs-dist se importa DINÁMICO (~1 MB que solo baja quien llega a etiquetar un PDF) y está fijado en @4: Node del server
 * (>=20, no >=22) y la CVE de ejecución de JS arbitraria en @5.6.83–6.2.107 (GHSA-hq66-cqwq-w95j). Mismas razones que en
 * `miniaturaPdf.ts`; no subirlo sin revisar las dos.
 *
 * Lo que sale es un `Blob` PNG, no un canvas vivo: quien lo use hace su object URL y lo revoca (ver
 * `usarPaginaDeEjemplo`). Las COORDENADAS de un recorte son porcentaje de la página, así que no dependen del ancho en el que
 * se pintó: la misma marca vale sobre cualquier tamaño.
 */
import type { DocumentoEjemploInstancia } from '$lib/state/configuracion.svelte';

/** Ancho con el que se pinta una página para recortarla: el mismo que daba la escala 1.75 sobre una carta (612 pt). */
export const ANCHO_PAGINA_PX = 1071;

/** Cuántos PDF se recuerdan abiertos a la vez. Uno solo se etiqueta a la vez; unos pocos más cubren cambiar de chip y volver. */
const MAX_ABIERTOS = 3;

export type PdfAbierto = {
	numPaginas: number;
	/** La página `n` (de 1 a `numPaginas`) como PNG. Pintarla dos veces cuesta una: se recuerda. */
	renderizar(n: number, anchoPx?: number): Promise<Blob>;
	/** Suelta el PDF de la memoria. Después de esto `renderizar` ya no sirve. */
	cerrar(): Promise<void>;
};

export async function abrirPdf(bytes: ArrayBuffer): Promise<PdfAbierto> {
	const pdfjsLib = await import('pdfjs-dist');
	pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
		'pdfjs-dist/build/pdf.worker.min.mjs',
		import.meta.url
	).href;
	const documento = await pdfjsLib.getDocument({ data: bytes }).promise;
	const pintadas = new Map<string, Promise<Blob>>();

	async function pintar(n: number, anchoPx: number): Promise<Blob> {
		const pagina = await documento.getPage(n);
		const base = pagina.getViewport({ scale: 1 });
		const viewport = pagina.getViewport({ scale: anchoPx / base.width });
		const canvas = globalThis.document.createElement('canvas');
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('sin contexto 2d');
		await pagina.render({ canvasContext: ctx, viewport }).promise;
		const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
		if (!blob) throw new Error('canvas vacío');
		return blob;
	}

	return {
		numPaginas: documento.numPages,
		renderizar(n, anchoPx = ANCHO_PAGINA_PX) {
			if (!Number.isInteger(n) || n < 1 || n > documento.numPages) {
				return Promise.reject(new Error(`La página ${n} no existe (el PDF tiene ${documento.numPages}).`));
			}
			const llave = `${n}@${anchoPx}`;
			let promesa = pintadas.get(llave);
			if (!promesa) {
				promesa = pintar(n, anchoPx);
				// Una página que falló no se queda guardada como fallo: a la siguiente se vuelve a intentar.
				promesa.catch(() => pintadas.delete(llave));
				pintadas.set(llave, promesa);
			}
			return promesa;
		},
		async cerrar() {
			pintadas.clear();
			await documento.destroy();
		}
	};
}

const abiertos = new Map<string, Promise<PdfAbierto>>();

/**
 * El PDF original de un documento de ejemplo, abierto. Rechaza si el documento no tiene original (un PDF subido antes del
 * 2026-09-24 conserva solo su página 1 como imagen: ver `esPdfSinOriginal`) o si el almacén no lo entrega.
 */
export function pdfDeEjemplo(doc: Pick<DocumentoEjemploInstancia, 'rutaRelativa' | 'mime'>): Promise<PdfAbierto> {
	const ruta = doc.rutaRelativa;
	if (!ruta) return Promise.reject(new Error('Este documento no conserva su PDF original.'));

	const existente = abiertos.get(ruta);
	if (existente) {
		// Se vuelve a poner al final: el que se usó hace menos es el último en salir.
		abiertos.delete(ruta);
		abiertos.set(ruta, existente);
		return existente;
	}

	const promesa = (async () => {
		const r = await fetch(`/api/archivos/${ruta}?mime=${encodeURIComponent(doc.mime || 'application/pdf')}`);
		if (!r.ok) throw new Error(`El almacén respondió ${r.status}.`);
		return abrirPdf(await r.arrayBuffer());
	})();
	// Uno que no se pudo abrir no se recuerda: reintentar puede funcionar (el almacén estaba caído un momento).
	promesa.catch(() => abiertos.delete(ruta));
	abiertos.set(ruta, promesa);

	while (abiertos.size > MAX_ABIERTOS) {
		const [masViejo, pdf] = abiertos.entries().next().value as [string, Promise<PdfAbierto>];
		abiertos.delete(masViejo);
		pdf.then((p) => p.cerrar()).catch(() => undefined);
	}
	return promesa;
}
