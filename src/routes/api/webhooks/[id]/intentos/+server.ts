/**
 * BFF: el historial de intentos de un webhook —validaciones y entregas de
 * avisos—, del más reciente al más viejo. El tenant lo fija el servidor.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const GET: RequestHandler = async ({ cookies, params, locals }) => {
	const id = params.id ?? '';
	if (!id) return json({ mensaje: 'Falta el webhook.' }, { status: 400 });

	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		const q = new URLSearchParams({ tenant, limite: '50' });
		respuesta = await fetch(urlNexus(`/webhooks/${encodeURIComponent(id)}/intentos?${q}`), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	}
	return json({ intentos: Array.isArray(cuerpo?.intentos) ? cuerpo.intentos : [] }, { headers: { 'Cache-Control': 'no-store' } });
};
