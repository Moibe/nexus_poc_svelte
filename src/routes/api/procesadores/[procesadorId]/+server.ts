/**
 * BFF de un procesador concreto de Document AI. Dos verbos, con vidas muy
 * distintas:
 *
 *  - `GET`: lo CONSULTA (nombre visible, versión default, estado). Lectura
 *    pura y gratis; la usa la ficha del tipo documental para mostrar el
 *    nombre de procesadores activados antes de que "Activar" empezara a
 *    devolverlo.
 *  - `DELETE`: lo BORRA en Google, con su dataset y su esquema.
 *
 * El DELETE solo borra en GOOGLE. Borrar la entrada de la Biblioteca es
 * responsabilidad de quien llama (`eliminarTipoDocumental` en el state): así,
 * si el borrado en Document AI falla, el tipo documental sigue existiendo
 * localmente y se puede reintentar — nunca queda un procesador huérfano en
 * GCP sin ningún registro que lo señale.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

/** Lee la respuesta de nexus_back con la misma red de seguridad que el resto
 *  de los BFF: texto primero (un 502 de infraestructura devuelve HTML, no
 *  JSON) y `detail` de FastAPI traducido a `mensaje`, que es la forma que el
 *  cliente sabe leer. */
async function reenviar(respuesta: Response) {
	let texto: string;
	try {
		texto = await respuesta.text();
	} catch {
		return fallo('La conexión con la API se cortó a media respuesta.', 502);
	}

	let datos: Record<string, unknown>;
	try {
		datos = JSON.parse(texto);
	} catch {
		return fallo(`La API devolvió algo que no es JSON (HTTP ${respuesta.status}).`, 502);
	}

	if (!respuesta.ok) {
		const detalle = typeof datos.detail === 'string' ? datos.detail : `HTTP ${respuesta.status}`;
		return fallo(detalle, respuesta.status);
	}

	return json(datos);
}

export const GET: RequestHandler = async ({ params }) => {
	const { procesadorId } = params;
	if (!procesadorId) {
		return fallo('Falta el id del procesador.', 400);
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/procesadores/${encodeURIComponent(procesadorId)}`), {
			headers: cabecerasNexus(),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'La consulta del procesador tardó demasiado y se canceló.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	return reenviar(respuesta);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { procesadorId } = params;
	if (!procesadorId) {
		return fallo('Falta el id del procesador.', 400);
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/procesadores/${encodeURIComponent(procesadorId)}`), {
			method: 'DELETE',
			headers: cabecerasNexus(),
			// El borrado incluye la misma operación de larga duración que la
			// activación (borrar el dataset); mismo margen que allá.
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'El borrado tardó demasiado y se canceló. Puede que ya se haya completado del lado de Document AI: reintentar es seguro.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	return reenviar(respuesta);
};
