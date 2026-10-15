/**
 * BFF: saca de la bandeja una entrada que llegó por la API, porque pasó al
 * pipeline o porque se descartó — para que no reaparezca en la siguiente
 * consulta ni al refrescar. El archivo NO se borra del almacén.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const MOTIVOS = new Set(['pipeline', 'descartado']);

export const POST: RequestHandler = async ({ cookies, params, request, locals }) => {
	const id = params.id ?? '';
	const datos = await request.json().catch(() => null);
	const motivo = typeof datos?.motivo === 'string' ? datos.motivo : '';
	if (!id || !MOTIVOS.has(motivo)) {
		return json({ mensaje: 'Falta la entrada o el motivo (pipeline | descartado).' }, { status: 400 });
	}

	const tenant = tenantDe(locals);
	const cuerpo = new FormData();
	cuerpo.append('tenant', tenant);
	cuerpo.append('motivo', motivo);
	// Solo al descartar: lo que escribió la persona como porqué (opcional). El back lo recorta y le pone tope.
	const detalle = typeof datos?.detalle === 'string' ? datos.detalle.trim() : '';
	if (detalle) cuerpo.append('detalle', detalle.slice(0, 500));
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/bandeja/${encodeURIComponent(id)}/retirar`), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			body: cuerpo,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const respuestaJson = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json(
			{ mensaje: mensajeDeError(respuestaJson, respuesta.status) },
			{ status: respuesta.status }
		);
	}
	return json({ retirada: true });
};
