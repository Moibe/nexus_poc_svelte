/**
 * BFF: elimina un webhook del cliente. Deja de aparecer en el listado y su
 * secret deja de usarse. Eliminar uno que ya estaba eliminado no es error.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ cookies, params, locals }) => {
	const id = params.id ?? '';
	if (!id) return json({ mensaje: 'Falta el webhook.' }, { status: 400 });

	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/webhooks/${encodeURIComponent(id)}/eliminar`), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	}
	return json({ eliminado: true });
};
