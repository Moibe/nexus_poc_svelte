/**
 * BFF: reenvía un documento a `POST /ia/extraer` de nexus_back, que lo procesa
 * con el Custom Extractor del tipo documental al que pertenece — el
 * `procesadorId` que "Activar" le creó. Es el ÚNICO camino de extracción del
 * front desde el 2026-09-07: antes existía también `/api/pipeline/ine`,
 * atado al procesador INE legado del `.env`, y se quitó a pedido explícito
 * ("quiero que sea el que genuinamente le toca al procesador que construí").
 * Está en el historial de git si algún día hace falta comparar contra aquel.
 *
 * El navegador manda aquí (mismo origen, sin CORS) y este handler es el único
 * que conoce la dirección real de la API. Cuando haya autenticación, este es el
 * punto donde se inyecta el token — el cliente nunca lo ve.
 *
 * No transforma la respuesta: la devuelve tal cual. La forma que produce
 * nexus_back ya está alineada con el diccionario de datos, y traducirla aquí
 * solo agregaría un lugar más que actualizar cuando cambie.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

/** Cada llamada a Document AI cuesta dinero. Este handler es hoy el único que
 *  puede dispararlas desde el navegador para extraer, así que el guardia de
 *  tamaño va aquí además del que ya tiene la API.
 *
 *  Los 20 MB son los mismos tres números alineados a propósito: el texto del
 *  dropzone ("Max 20 MB", que viene de Figma), este guardia, y MAX_SUBIDA_MB en
 *  el .env de nexus_back. Si se desalinean, aparece una franja de archivos que
 *  la UI promete y el back rechaza. */
const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/** Lo que hay que poner en BODY_SIZE_LIMIT: por encima de MAX_MB, porque el
 *  cuerpo multipart pesa un poco más que el archivo (cabeceras y fronteras). */
const LIMITE_TEXTO = `${MAX_MB + 5}M`;

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

export const POST: RequestHandler = async ({ request }) => {
	let entrada: FormData;
	try {
		entrada = await request.formData();
	} catch (err) {
		// OJO, esto costó un diagnóstico equivocado: adapter-node aborta el cuerpo
		// con un SvelteKitError 413 ANTES de que este handler pueda mirarlo, si
		// pesa más que BODY_SIZE_LIMIT (default 512 KB). formData() truena, y si
		// se responde "formulario inválido" el mensaje apunta al lugar
		// equivocado — el archivo estaba perfecto, lo que falló fue el
		// transporte. Se distingue para que el error diga la verdad.
		//
		// No se reproduce en `npm run dev`: el dev server de Vite llama a
		// getRequest() SIN bodySizeLimit, así que ahí no hay tope. Solo aparece
		// contra el build (`node build/index.js`), que es lo que corre en el
		// server de CSI.
		const status = (err as { status?: number } | null)?.status;
		if (status === 413) {
			return fallo(
				`El archivo excede el límite de subida del servidor. ` +
					`Súbele BODY_SIZE_LIMIT en el .env del server (hoy debería ser ${LIMITE_TEXTO}).`,
				413
			);
		}
		return fallo('La petición no traía un formulario válido.', 400);
	}

	const archivo = entrada.get('archivo');
	if (!(archivo instanceof File)) {
		return fallo('Falta el archivo a procesar.', 400);
	}
	if (archivo.size === 0) {
		return fallo('El archivo llegó vacío.', 400);
	}
	if (archivo.size > MAX_BYTES) {
		return fallo(`El archivo excede el límite de ${MAX_MB} MB.`, 413);
	}

	const procesador = String(entrada.get('procesador') ?? '').trim();
	if (!procesador) {
		// Sin procesador no hay nada que intentar, y el mensaje dice la causa
		// real en vez de dejar que el back responda un 422 más opaco.
		return fallo('Falta el procesador con el que extraer este tipo documental.', 400);
	}

	const salida = new FormData();
	// `imagen` es como lo declara nexus_back (herencia de cuando el único
	// extractor era el de INE); del lado del navegador se llama `archivo`
	// porque ahí no siempre es una imagen — Document AI también procesa PDF.
	salida.append('imagen', archivo, archivo.name);
	salida.append('procesador', procesador);
	const version = String(entrada.get('version') ?? '').trim();
	if (version) salida.append('version', version);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/ia/extraer'), {
			method: 'POST',
			headers: cabecerasNexus(),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'La extracción tardó demasiado y se canceló del lado del navegador.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	let texto: string;
	try {
		texto = await respuesta.text();
	} catch {
		return fallo('nexus_back cortó la conexión antes de mandar la respuesta.', 502);
	}

	let cuerpo: unknown;
	try {
		cuerpo = JSON.parse(texto);
	} catch {
		return fallo(
			`nexus_back respondió ${respuesta.status} con algo que no es JSON.`,
			respuesta.ok ? 502 : respuesta.status
		);
	}

	if (!respuesta.ok) {
		const detalle =
			typeof cuerpo === 'object' && cuerpo !== null && 'detail' in cuerpo
				? String((cuerpo as { detail: unknown }).detail)
				: `nexus_back respondió ${respuesta.status}.`;
		return fallo(detalle, respuesta.status);
	}

	return json(cuerpo);
};
