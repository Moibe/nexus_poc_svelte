/**
 * BFF: reenvía un documento a `POST /ia/ine` de nexus_back.
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
 *  puede dispararlas desde el navegador, así que el guardia de tamaño va aquí
 *  además del que ya tiene la API.
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

	// El nombre del campo cambia a `imagen` porque así lo declara el endpoint de
	// nexus_back. Del lado del navegador se llama `archivo` porque ahí ya no
	// siempre es una imagen (Document AI también procesa PDF).
	const salida = new FormData();
	salida.append('imagen', archivo, archivo.name);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/ia/ine'), {
			method: 'POST',
			// Solo la llave: el Content-Type del multipart lo pone fetch, con su
			// boundary. Fijarlo a mano aquí rompería el parseo del lado de FastAPI.
			headers: cabecerasNexus(),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		// Los dos casos se ven igual desde aquí (no hubo respuesta HTTP) pero
		// significan cosas muy distintas para quien lee el mensaje, así que se
		// distinguen: si la API no está arriba se arregla reiniciándola; si fue
		// timeout, el trabajo puede haber terminado bien del otro lado.
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'La extracción tardó demasiado y se canceló del lado del navegador.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	// El cuerpo puede no ser JSON si algo se rompió antes de FastAPI (un proxy,
	// un 502 de infraestructura). Se lee como texto primero para no tirar un
	// error de parseo encima del error real.
	let texto: string;
	try {
		texto = await respuesta.text();
	} catch {
		// La conexión se cortó después de las cabeceras. Sin esto el handler
		// truena y el front recibe un 500 de SvelteKit sin `mensaje`, que es
		// justo la forma que el cliente no sabe leer.
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
		// FastAPI pone el mensaje en `detail`; se traduce a `mensaje` para que el
		// cliente tenga una sola forma de error sin importar de dónde venga.
		const detalle =
			typeof cuerpo === 'object' && cuerpo !== null && 'detail' in cuerpo
				? String((cuerpo as { detail: unknown }).detail)
				: `nexus_back respondió ${respuesta.status}.`;
		return fallo(detalle, respuesta.status);
	}

	return json(cuerpo);
};
