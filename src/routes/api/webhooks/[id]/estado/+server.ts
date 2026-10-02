/**
 * BFF: activa o desactiva un webhook del cliente. Pedir el estado que ya tiene
 * no es error: nexus_back contesta igual.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TENANT_CLIENTE, TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params, request }) => {
	const id = params.id ?? '';
	const datos = await request.json().catch(() => null);
	const estado = datos?.estado;
	if (!id) return json({ mensaje: 'Falta el webhook.' }, { status: 400 });
	if (estado !== 'activo' && estado !== 'inactivo') {
		return json({ mensaje: 'El estado tiene que ser activo o inactivo.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/webhooks/${encodeURIComponent(id)}/estado`), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant: TENANT_CLIENTE, estado }),
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
