/**
 * BFF: activa o desactiva un webhook del cliente. Pedir el estado que ya tiene
 * no es error: nexus_back contesta igual.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ cookies, params, request, locals }) => {
	const id = params.id ?? '';
	const datos = await request.json().catch(() => null);
	const estado = datos?.estado;
	if (!id) return json({ mensaje: 'Falta el webhook.' }, { status: 400 });
	if (estado !== 'activo' && estado !== 'inactivo') {
		return json({ mensaje: 'El estado tiene que ser activo o inactivo.' }, { status: 400 });
	}

	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/webhooks/${encodeURIComponent(id)}/estado`), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, estado }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	}
	return json({ webhook: cuerpo?.webhook ?? null });
};
