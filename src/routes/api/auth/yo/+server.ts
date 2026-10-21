/** BFF: mis datos completos (HU12). El JWT de la cookie solo trae lo mínimo
 *  para pintar la barra; el perfil necesita teléfono, apellidos separados y
 *  datos de recuperación, que viven en el servidor. */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const GET: RequestHandler = async ({ cookies }) => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/auth/yo'), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ codigo: 'sin_servidor', mensaje: 'No se pudo contactar al servidor.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ codigo: 'error', mensaje: 'No se pudo cargar tu perfil.' }, { status: respuesta.status });
	}
	return json(cuerpo);
};
