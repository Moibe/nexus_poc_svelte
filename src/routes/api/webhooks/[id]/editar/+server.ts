/**
 * BFF: le cambia la URL y los eventos a un webhook del cliente. Queda sin
 * validar (el endpoint pudo cambiar) y conserva su secret. El tenant lo fija el
 * servidor.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, tenantDe, urlNexus } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const id = params.id ?? '';
	const datos = await request.json().catch(() => null);
	const url = typeof datos?.url === 'string' ? datos.url : '';
	const eventos = Array.isArray(datos?.eventos)
		? datos.eventos.filter((e: unknown): e is string => typeof e === 'string')
		: [];
	if (!id || !url.trim() || eventos.length === 0) {
		return json({ mensaje: 'Faltan el webhook, la URL o los eventos de suscripción.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/webhooks/${encodeURIComponent(id)}/editar`), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant: tenantDe(locals), url, eventos }),
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
	return json({ webhook: cuerpo?.webhook ?? null });
};
