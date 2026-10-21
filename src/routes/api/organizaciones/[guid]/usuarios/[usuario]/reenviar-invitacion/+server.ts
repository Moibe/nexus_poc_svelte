/**
 * BFF: el administrador de plataforma reenvía la invitación de un usuario de
 * cualquier organización (HU06, CA-6) —sobre todo la del administrador de una
 * organización, que no tiene a nadie por encima dentro de la suya—. Es la
 * hermana de `/api/usuarios/[guid]/reenviar-invitacion`: la URL nombra la
 * organización para que el permiso diga lo mismo que lo que se ejecuta.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ params, cookies }) => {
	const ruta = `/organizaciones/${encodeURIComponent(params.guid ?? '')}/usuarios/${encodeURIComponent(params.usuario ?? '')}/reenviar-invitacion`;
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(ruta), {
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
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
