/**
 * BFF de un procesador concreto de Document AI: solo el verbo `DELETE`, que lo BORRA en Google, con su dataset y su esquema.
 *
 * Hubo también un `GET` que lo consultaba (nombre visible, versión default, estado) para que la ficha del tipo documental enseñara el nombre técnico del
 * procesador. Se quitó el 2026-11-07 (Moibe: «No guardes el nombre técnico», con Document AI transparente para el cliente final): nadie lo pide ya.
 *
 * El DELETE solo borra en GOOGLE. Borrar la entrada de la Biblioteca es
 * responsabilidad de quien llama (`eliminarTipoDocumental` en el state): así,
 * si el borrado en Document AI falla, el tipo documental sigue existiendo
 * localmente y se puede reintentar — nunca queda un procesador huérfano en
 * GCP sin ningún registro que lo señale.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

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

export const DELETE: RequestHandler = async ({ params, cookies, locals }) => {
	const { procesadorId } = params;
	if (!procesadorId) {
		return fallo('Falta el id del procesador.', 400);
	}
	const tenant = tenantDe(locals);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/procesadores/${encodeURIComponent(procesadorId)}?tenant=${encodeURIComponent(tenant)}`), {
			method: 'DELETE',
			headers: cabecerasConSesion(cookies),
			// El borrado incluye la misma operación de larga duración que la
			// activación (borrar el dataset); mismo margen que allá.
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'El borrado tardó demasiado y se canceló. Puede que ya se haya completado: reintentar es seguro.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	return reenviar(respuesta);
};
