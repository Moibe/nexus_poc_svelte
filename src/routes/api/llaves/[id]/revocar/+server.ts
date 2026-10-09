/**
 * BFF: revoca una API Key de cliente. Deja de servir de inmediato, y no se
 * puede reactivar: su secret no existe en ningún lado.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, tenantDe, urlNexus } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params, locals }) => {
	const id = params.id ?? '';
	if (!id) return json({ mensaje: 'Falta la llave a revocar.' }, { status: 400 });

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/llaves/${encodeURIComponent(id)}/revocar`), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant: tenantDe(locals) }),
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
	return json({ revocada: true });
};
