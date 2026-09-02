/**
 * BFF: reenvía el borrado de un procesador a `DELETE /procesadores/{id}` de
 * nexus_back, que borra el Custom Extractor de Document AI (su dataset y su
 * esquema con él). Mismo patrón que /api/procesadores/activar.
 *
 * Este endpoint solo borra en GOOGLE. Borrar la entrada de la Biblioteca es
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
};
