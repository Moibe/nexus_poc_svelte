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

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';

/** Cada llamada a Document AI cuesta dinero. Este handler es hoy el único que
 *  puede dispararlas desde el navegador, así que el guardia de tamaño va aquí
 *  además del que ya tiene la API. */
const MAX_BYTES = 20 * 1024 * 1024;

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

export const POST: RequestHandler = async ({ request }) => {
	let entrada: FormData;
	try {
		entrada = await request.formData();
	} catch {
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
		return fallo('El archivo excede el límite de 20 MB.', 413);
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
	const texto = await respuesta.text();
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
