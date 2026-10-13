/**
 * BFF: los usuarios de una organización, para el administrador de plataforma
 * (la lista de la pantalla Organizaciones). Reenvía con el JWT de la cookie:
 * allá solo pasa un administrador de plataforma, y el `guid` de la URL es lo
 * único que el navegador decide.
 *
 * Son datos personales (nombre, correo, teléfono): `no-store`, para que ni el
 * caché de la página ni el del navegador los conserven.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const GET: RequestHandler = async ({ params, cookies }) => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/organizaciones/${encodeURIComponent(params.guid ?? '')}/usuarios`), {
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
		return json(error, { status: respuesta.status, headers: { 'Cache-Control': 'no-store' } });
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
