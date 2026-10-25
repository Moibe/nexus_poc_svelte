/**
 * ¿El documento está en blanco? (2026-10-21, incidencia de QA en HU 21 CA 2.)
 *
 * Un PDF en blanco pasa todas las revisiones de `validar.ts` —tiene su encabezado, su %%EOF y no está cifrado— y llegaba hasta
 * «Listo», de ahí al Pipeline documental y, ya allá, a Document AI, que cobra la página para no encontrar nada. La bandeja tiene
 * que decirlo ANTES: «Documento sin contenido procesable».
 *
 * Cómo se decide, página por página y parando en la primera que tenga algo:
 *
 *   1. Texto: si pdf.js saca una sola letra o número, la página tiene contenido. Es lo barato y lo más común (PDF de Word, de un
 *      sistema, de «imprimir a PDF»).
 *   2. Si no hay texto, la página se PINTA chica (`ANCHO_PRUEBA_PX`) y se mira si hay algo que no sea fondo. Cubre el PDF que es
 *      una foto o un escaneo (sin texto, solo imagen) y el que dibuja líneas o sellos. Una página escaneada «en blanco» trae
 *      ruido de papel y de sensor, no tinta: por eso se compara contra el color del fondo con una tolerancia, no contra blanco
 *      puro.
 *
 * Lo que NO se hace, a propósito:
 *
 *   · Ante la duda, tiene contenido. Un PDF que pdf.js no abre, una imagen que el navegador no decodifica (TIFF, casi siempre) o
 *     un documento de más de `MAX_PAGINAS_REVISADAS` páginas con las primeras en blanco NO se marcan: la bandeja marcaba esos
 *     archivos como buenos antes de este cambio y el pipeline ya tiene su propio manejo de fallos. El costo de equivocarse hacia
 *     el otro lado es rechazar un documento bueno, que es peor que dejar pasar uno vacío.
 *   · No se revisa si la hoja «parece» una hoja de verdad: una página con una sola raya o un solo punto de tinta TIENE contenido.
 *     El umbral (`FRACCION_MINIMA_DE_TINTA`) deja pasar el ruido, no una marca real.
 *
 * pdfjs-dist se importa DINÁMICO (~1 MB, solo baja quien sube un PDF) y está fijado en @4: mismas razones que en
 * `miniaturaPdf.ts`; no subirlo sin revisarlas.
 */

/** Ancho al que se pinta una página para mirarla. Basta para ver una línea de texto de un escaneo; más ancho solo cuesta tiempo. */
const ANCHO_PRUEBA_PX = 240;

/** Un documento de más páginas que esto, con todas las revisadas en blanco, se deja pasar (ver «ante la duda»). */
const MAX_PAGINAS_REVISADAS = 40;

/** Cuánto tiene que apartarse un píxel del color del fondo (0-255, en luminosidad) para contar como tinta. El ruido de un escaneo
 *  de papel blanco queda muy por debajo; el texto, un sello o una raya, muy por encima. */
const TOLERANCIA_DE_FONDO = 40;

/** Qué parte de los píxeles tiene que ser tinta para que la página cuente como con contenido. 0.0002 son ~15 píxeles de 76 800
 *  (240×320): menos que una letra a ese tamaño, más que una mota de polvo. */
const FRACCION_MINIMA_DE_TINTA = 0.0002;

/**
 * ¿La imagen de este canvas es solo fondo? Se toma como fondo la luminosidad que MÁS se repite (no el promedio: una página con
 * un sello grande desplazaría el promedio) y se cuentan los píxeles que se apartan de ella.
 *
 * Separada y exportada para poder probarla sin un navegador: recibe los píxeles RGBA tal cual los entrega `getImageData`.
 */
export function esSoloFondo(rgba: Uint8ClampedArray | Uint8Array): boolean {
	const total = Math.floor(rgba.length / 4);
	if (total === 0) return true;

	// Un píxel transparente es fondo: un PNG con transparencia total sobre el que no hay nada. Se pinta sobre blanco para que un
	// canvas sin fondo (negro transparente) no se confunda con tinta.
	const luminosidades = new Uint8Array(total);
	const cuenta = new Uint32Array(256);
	for (let i = 0; i < total; i++) {
		const o = i * 4;
		const alfa = rgba[o + 3] / 255;
		const r = rgba[o] * alfa + 255 * (1 - alfa);
		const g = rgba[o + 1] * alfa + 255 * (1 - alfa);
		const b = rgba[o + 2] * alfa + 255 * (1 - alfa);
		const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
		luminosidades[i] = l;
		cuenta[l]++;
	}

	let fondo = 0;
	for (let l = 1; l < 256; l++) if (cuenta[l] > cuenta[fondo]) fondo = l;

	let tinta = 0;
	for (let i = 0; i < total; i++) if (Math.abs(luminosidades[i] - fondo) > TOLERANCIA_DE_FONDO) tinta++;
	return tinta / total < FRACCION_MINIMA_DE_TINTA;
}

/** Los píxeles de un canvas, o null si el navegador no da contexto 2d (no se puede revisar: se deja pasar). */
function pixelesDe(canvas: HTMLCanvasElement): Uint8ClampedArray | null {
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return null;
	return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

/** ¿Este PDF no tiene nada que leer? `false` también cuando no se pudo averiguar. */
export async function pdfEnBlanco(bytes: ArrayBuffer): Promise<boolean> {
	try {
		const pdfjsLib = await import('pdfjs-dist');
		pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
			'pdfjs-dist/build/pdf.worker.min.mjs',
			import.meta.url
		).href;
		// pdf.js se queda con el ArrayBuffer que recibe (lo transfiere al worker y lo deja vacío): se le da una copia, porque
		// quien llama sigue necesitando los bytes para la huella.
		const documento = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
		try {
			const hasta = Math.min(documento.numPages, MAX_PAGINAS_REVISADAS);
			for (let n = 1; n <= hasta; n++) {
				const pagina = await documento.getPage(n);

				const texto = await pagina.getTextContent();
				if (texto.items.some((item) => 'str' in item && /\S/.test(item.str))) return false;

				const base = pagina.getViewport({ scale: 1 });
				const viewport = pagina.getViewport({ scale: ANCHO_PRUEBA_PX / base.width });
				const canvas = globalThis.document.createElement('canvas');
				canvas.width = Math.max(1, Math.ceil(viewport.width));
				canvas.height = Math.max(1, Math.ceil(viewport.height));
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				if (!ctx) return false;
				// pdf.js pinta sobre lo que haya: un fondo blanco explícito evita que lo transparente se lea como negro.
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				await pagina.render({ canvasContext: ctx, viewport }).promise;
				const pixeles = pixelesDe(canvas);
				if (!pixeles || !esSoloFondo(pixeles)) return false;
			}
			// Todas las páginas revisadas están en blanco. Si el documento es más largo que lo que se revisó, no se sabe.
			return documento.numPages <= MAX_PAGINAS_REVISADAS;
		} finally {
			await documento.destroy();
		}
	} catch {
		return false;
	}
}

/** ¿Esta imagen es solo fondo? `false` también cuando el navegador no la decodifica (TIFF, sobre todo). */
export async function imagenEnBlanco(archivo: File): Promise<boolean> {
	try {
		const mapa = await createImageBitmap(archivo);
		try {
			const escala = Math.min(1, ANCHO_PRUEBA_PX / mapa.width);
			const canvas = globalThis.document.createElement('canvas');
			canvas.width = Math.max(1, Math.round(mapa.width * escala));
			canvas.height = Math.max(1, Math.round(mapa.height * escala));
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) return false;
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(mapa, 0, 0, canvas.width, canvas.height);
			const pixeles = pixelesDe(canvas);
			return pixeles ? esSoloFondo(pixeles) : false;
		} finally {
			mapa.close();
		}
	} catch {
		return false;
	}
}

/**
 * ¿El archivo no tiene contenido procesable? Solo PDF, JPG y PNG: el TIFF no lo decodifica el navegador y se deja pasar.
 * `extension` va en minúsculas y sin punto.
 */
export async function sinContenidoProcesable(
	archivo: File,
	bytes: ArrayBuffer,
	extension: string
): Promise<boolean> {
	switch (extension) {
		case 'pdf':
			return pdfEnBlanco(bytes);
		case 'jpg':
		case 'jpeg':
		case 'png':
			return imagenEnBlanco(archivo);
		default:
			return false;
	}
}
