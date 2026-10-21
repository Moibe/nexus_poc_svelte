/**
 * BFF: guardar el orden de la biblioteca (el que se arma arrastrando los tipos) de la organización de quien pide.
 * El tenant sale de la sesión (`tenantDe`); los ids que no sean de la organización los ignora nexus_back.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const PUT: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	if (!Array.isArray(datos?.ids) || !datos.ids.every((i: unknown) => typeof i === 'string')) {
		return json({ mensaje: 'Falta la lista de tipos documentales.' }, { status: 400 });
	}
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/tipos-documentales/orden'), {
			method: 'PUT',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, ids: datos.ids }),
			signal: AbortSignal.timeout(30_000)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	return json({ ok: true });
};
