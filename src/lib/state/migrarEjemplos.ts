/**
 * Saca del `localStorage` los bytes de los ejemplos documentales viejos.
 *
 * Hasta el 2026-09-24 cada ejemplo guardaba su archivo entero en base64 dentro
 * del catálogo (`dataUrl`), y eso llenaba la cuota: ~2.67 bytes de cuota por
 * byte de archivo. Desde entonces los nuevos se suben al almacén y el catálogo
 * guarda solo un puntero — pero lo que ya estaba capturado seguía ahí,
 * ocupando lo mismo. Esto lo migra: sube esos bytes al almacén y los cambia
 * por su puntero, conservando el `id` del documento y con él sus recortes.
 *
 * CUÁNDO CORRE. Al abrir Configuración (`ConfigSheet.svelte`), que es donde se
 * ven los ejemplos. En segundo plano y sin avisar: no hay nada que decidir, y
 * mientras no termine el documento se sigue pintando de sus bytes viejos. Si
 * el almacén no contesta, se detiene sin tocar nada y lo intenta la próxima
 * vez que se abra. Con todo migrado no hace nada — ni una petición.
 *
 * LOS PDF VIEJOS NO RECUPERAN SU ORIGINAL. De un PDF solo se guardaba el
 * raster de la página 1, así que eso es lo único que hay para subir. Se
 * guarda como VISTA y no como original, a propósito — ver `esPdfSinOriginal`.
 * La excepción es el PDF que pdf.js no pudo abrir (con contraseña, corrupto):
 * ese se guardaba entero, y migra como el original que es.
 */

import { subirAlAlmacen } from '$lib/almacen/subir';
import {
	ejemplosLegados,
	pasarEjemploAlAlmacen,
	sigueSiendoLegado,
	TENANT_OPERADOR
} from '$lib/state/configuracion.svelte';

/** ¿Empiezan los bytes con esta firma, a partir de `desde`? */
function empiezaCon(b: Uint8Array, firma: number[], desde = 0): boolean {
	return b.length >= desde + firma.length && firma.every((x, i) => b[desde + i] === x);
}

/**
 * El tipo REAL de los bytes, leído de su firma.
 *
 * No se confía en la cabecera del `data:`: salía de `File.type`, que el
 * navegador llena con lo que infiere del nombre y puede venir vacío (y
 * entonces la cabecera dice `application/octet-stream`) o mentir (un WebP
 * renombrado a `.jpg` llega como `image/jpeg`). El back acepta o rechaza por
 * el tipo declarado, así que declarar el correcto es lo que decide si entra.
 *
 * Son exactamente los formatos de `MIME_SOPORTADOS` en nexus_back, y todos
 * pudieron llegar al catálogo viejo: hasta el 2026-09-22 el modal no revisaba
 * la extensión de lo que se soltaba arrastrando, y una imagen se guardaba tal
 * cual. Lo que no esté aquí (HEIC, SVG, AVIF) el back lo rechazaría igual.
 */
function mimeDeFirma(b: Uint8Array): string | null {
	if (empiezaCon(b, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
	if (empiezaCon(b, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (empiezaCon(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
	if (empiezaCon(b, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'; // GIF8
	if (empiezaCon(b, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(b, [0x57, 0x45, 0x42, 0x50], 8)) {
		return 'image/webp'; // RIFF....WEBP
	}
	if (empiezaCon(b, [0x49, 0x49, 0x2a, 0x00]) || empiezaCon(b, [0x4d, 0x4d, 0x00, 0x2a])) {
		return 'image/tiff';
	}
	if (empiezaCon(b, [0x42, 0x4d])) return 'image/bmp'; // BM
	return null;
}

/** Los bytes de un `data:...;base64,...` con su tipo real, o `null` si no
 *  tiene esa forma o no es algo que el almacén acepte. `atob` y no
 *  `fetch(dataUrl)`: no depende de que la política de contenido del sitio
 *  permita `data:`. */
function bytesDeDataUrl(dataUrl: string): { archivo: Blob; mime: string } | null {
	const coma = dataUrl.indexOf(',');
	if (!dataUrl.startsWith('data:') || coma === -1) return null;
	if (!dataUrl.slice(0, coma).endsWith(';base64')) return null;
	let binario: string;
	try {
		binario = atob(dataUrl.slice(coma + 1));
	} catch {
		return null;
	}
	const bytes = new Uint8Array(binario.length);
	for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
	const mime = mimeDeFirma(bytes);
	return mime ? { archivo: new Blob([bytes], { type: mime }), mime } : null;
}

/**
 * Un rechazo que es de ESTE archivo y no del servicio: formato no admitido
 * (400/415), demasiado grande (413), o algo que el back no pudo procesar
 * (422). Reintentarlo no va a cambiar nada, pero los demás ejemplos sí pueden
 * pasar.
 *
 * Todo lo demás detiene la corrida: red caída, 5xx, el 503 del NAS
 * desmontado, 408/429 — y también 401/403/404, que NO hablan del archivo sino
 * del servicio (la llave de API mal puesta, el CSRF, un back sin la ruta). Si
 * esos contaran como del archivo, cada apertura de Configuración subiría
 * TODOS los legados para recibir el mismo rechazo en cada uno.
 */
function esRechazoDelArchivo(status: number): boolean {
	return status === 400 || status === 413 || status === 415 || status === 422;
}

let enCurso: Promise<void> | null = null;

/** Migra lo que falte. Llamarlo mientras ya corre devuelve la misma corrida
 *  en vez de empezar otra: dos a la vez subirían cada archivo dos veces. */
export function migrarEjemplosAlAlmacen(): Promise<void> {
	enCurso ??= recorrer().finally(() => {
		enCurso = null;
	});
	return enCurso;
}

async function recorrer(): Promise<void> {
	// Uno por uno, a propósito: son pocos, y en paralelo un almacén caído
	// recibiría N peticiones fallidas en vez de una.
	for (const legado of ejemplosLegados()) {
		// Mientras se subía el anterior, este pudo haberse quitado.
		if (!sigueSiendoLegado(legado)) continue;

		const bytes = bytesDeDataUrl(legado.dataUrl);
		if (!bytes) {
			console.warn(`[migración de ejemplos] "${legado.nombre}" no es un formato reconocible; se deja como está.`);
			continue;
		}

		// Un PDF cuyos bytes son una IMAGEN es el raster de su página 1: eso es
		// una vista. Si los bytes son el PDF mismo, es el original.
		const esVista = legado.tipo === 'PDF' && bytes.mime.startsWith('image/');
		const r = await subirAlAlmacen(
			bytes.archivo,
			esVista ? `${legado.nombre}.png` : legado.nombre,
			TENANT_OPERADOR
		);
		if (!r.ok) {
			console.warn(`[migración de ejemplos] "${legado.nombre}": ${r.mensaje}`);
			if (esRechazoDelArchivo(r.status)) continue;
			return;
		}

		pasarEjemploAlAlmacen(
			legado,
			esVista ? { rutaVista: r.puntero.rutaRelativa, mimeVista: r.puntero.mime } : r.puntero
		);
	}
}
