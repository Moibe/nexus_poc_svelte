/**
 * BFF: reenviar la invitación de un usuario que no ha hecho su primer acceso
 * (HU06, CA-6). Le genera una contraseña temporal nueva —la anterior deja de
 * servir— y le manda la bienvenida; si el correo no salió, la respuesta trae la
 * contraseña para que se le entregue a mano (una sola vez).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ params, cookies }) => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/usuarios/${encodeURIComponent(params.guid ?? '')}/reenviar-invitacion`), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ codigo: 'sin_servidor', mensaje: 'No se pudo contactar al servidor. Intenta de nuevo.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = cuerpo?.detail;
		const error =
			detalle && typeof detalle === 'object'
				? detalle
				: { codigo: 'error', mensaje: typeof detalle === 'string' ? detalle : `El servidor respondió ${respuesta.status}.` };
		return json(error, { status: respuesta.status });
	}
	// Trae una contraseña temporal cuando el correo no salió: que nadie la guarde.
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
