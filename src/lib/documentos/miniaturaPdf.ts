/**
 * Miniatura de un PDF: su primera página pintada como imagen (2026-10-02).
 *
 * Existe para que la vista previa de Expedientes, Detalle y Registro de OT
 * muestre los PDF igual que las imágenes. Antes solo salía el ícono de archivo.
 *
 * Lo que cuida, porque un expediente puede tener muchos PDF a la vez:
 *
 *   · pdfjs-dist se importa DINÁMICO: ~1 MB que solo baja quien llega a ver un
 *     PDF, y una sola vez. Misma versión y mismas razones que en el módulo de
 *     configuración (ver `RecortarEjemploCampo.svelte`: fijada en @4).
 *   · Se pinta UNA página, a un ancho acotado (`ANCHO_PX`), no el PDF entero
 *     ni a tamaño real. Un PDF de 40 páginas cuesta lo mismo que uno de 1.
 *   · Caché por archivo (`WeakMap`): abrir el Detalle del mismo PDF que ya se
 *     ve en la rejilla no lo vuelve a renderizar. Al soltarse el `File`, se va
 *     sola.
 *   · Máximo `SIMULTANEAS` renders a la vez: pdf.js trabaja en un worker, pero
 *     veinte tarjetas pidiendo a la vez saturaban el hilo principal con el
 *     pintado de canvas. Las demás esperan su turno en orden de llegada.
 *   · El resultado es un `Blob` JPEG, no un canvas vivo: quien lo use hace su
 *     object URL y lo revoca como con cualquier imagen (ver `usarVistaPrevia`).
 */

const ANCHO_PX = 900;
const SIMULTANEAS = 2;

const cache = new WeakMap<File, Promise<Blob>>();

let activas = 0;
const cola: (() => void)[] = [];

function turno(): Promise<void> {
	if (activas < SIMULTANEAS) {
		activas++;
		return Promise.resolve();
	}
	return new Promise((listo) => cola.push(listo));
}

function soltarTurno() {
	const siguiente = cola.shift();
	if (siguiente) siguiente();
	else activas--;
}

async function renderizar(archivo: File): Promise<Blob> {
	await turno();
	try {
		const pdfjsLib = await import('pdfjs-dist');
		pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
			'pdfjs-dist/build/pdf.worker.min.mjs',
			import.meta.url
		).href;
		const documento = await pdfjsLib.getDocument({ data: await archivo.arrayBuffer() }).promise;
		try {
			const pagina = await documento.getPage(1);
			const base = pagina.getViewport({ scale: 1 });
			const viewport = pagina.getViewport({ scale: ANCHO_PX / base.width });
			const canvas = document.createElement('canvas');
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('sin contexto 2d');
			await pagina.render({ canvasContext: ctx, viewport }).promise;
			const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
			if (!blob) throw new Error('canvas vacío');
			return blob;
		} finally {
			await documento.destroy();
		}
	} finally {
		soltarTurno();
	}
}

/** La primera página del PDF como imagen. Falla (rechaza) si el PDF no se puede
 *  abrir; quien llama decide qué mostrar en su lugar. */
export function miniaturaDePdf(archivo: File): Promise<Blob> {
	let promesa = cache.get(archivo);
	if (!promesa) {
		promesa = renderizar(archivo);
		// Un PDF que falló no se queda cacheado como fallo: a la siguiente se
		// vuelve a intentar (pudo ser memoria, no el archivo).
		promesa.catch(() => cache.delete(archivo));
		cache.set(archivo, promesa);
	}
	return promesa;
}
