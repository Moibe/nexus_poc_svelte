/**
 * BFF: `POST /procesadores/clasificador/asegurar` de nexus_back — compara lo que el Classifier tiene en Document AI con los
 * tipos activos del registro y lo sincroniza solo si difieren. El front lo llama una vez por sesión, antes de clasificar.
 *
 * Sin cuerpo: todo sale del registro del servidor. La respuesta (`{ sincronizado, motivo }`) se devuelve tal cual.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const POST: RequestHandler = async () => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/procesadores/clasificador/asegurar'), {
			method: 'POST',
			headers: cabecerasNexus(),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = typeof cuerpo?.detail === 'string' ? cuerpo.detail : `HTTP ${respuesta.status}`;
		return json({ mensaje: detalle }, { status: respuesta.status });
	}
	return json(cuerpo);
};
