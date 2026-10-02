/**
 * BFF: elimina un webhook del cliente. Deja de aparecer en el listado y su
 * secret deja de usarse. Eliminar uno que ya estaba eliminado no es error.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TENANT_CLIENTE, TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params }) => {
	const id = params.id ?? '';
	if (!id) return json({ mensaje: 'Falta el webhook.' }, { status: 400 });

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/webhooks/${encodeURIComponent(id)}/eliminar`), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant: TENANT_CLIENTE }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = cuerpo?.detail;
		return json(
			{ mensaje: typeof detalle === 'string' ? detalle : `nexus_back respondió ${respuesta.status}.` },
			{ status: respuesta.status }
		);
	}
	return json({ eliminado: true });
};
