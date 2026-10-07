/**
 * BFF: crear una organización (HU02). Reenvía a nexus_back con el JWT de la
 * cookie, porque allá solo pasa un administrador de plataforma.
 *
 * La respuesta trae la **contraseña temporal** del administrador nuevo: no hay
 * correo en este sprint, así que la pantalla se la muestra al super admin una
 * sola vez. De ahí el `no-store`.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const datos = await request.json().catch(() => null);
	if (!datos || typeof datos !== 'object') {
		return json({ codigo: 'datos_invalidos', mensaje: 'Faltan los datos del registro.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/organizaciones/'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify(datos),
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
		return json(error, { status: respuesta.status, headers: { 'Cache-Control': 'no-store' } });
	}
	return json(cuerpo, { status: 201, headers: { 'Cache-Control': 'no-store' } });
};
