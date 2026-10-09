/**
 * BFF: el historial de intentos de un webhook —validaciones y entregas de
 * avisos—, del más reciente al más viejo. El tenant lo fija el servidor.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, tenantDe, urlNexus } from '$lib/server/nexus';

export const GET: RequestHandler = async ({ params, locals }) => {
	const id = params.id ?? '';
	if (!id) return json({ mensaje: 'Falta el webhook.' }, { status: 400 });

	let respuesta: Response;
	try {
		const q = new URLSearchParams({ tenant: tenantDe(locals), limite: '50' });
		respuesta = await fetch(urlNexus(`/webhooks/${encodeURIComponent(id)}/intentos?${q}`), {
			headers: cabecerasNexus(),
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
	return json({ intentos: Array.isArray(cuerpo?.intentos) ? cuerpo.intentos : [] }, { headers: { 'Cache-Control': 'no-store' } });
};
