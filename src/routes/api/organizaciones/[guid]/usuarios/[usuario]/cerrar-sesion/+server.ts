/**
 * BFF: el administrador de plataforma cierra la sesión de un usuario de
 * cualquier organización (HU05, CA-4). Es la hermana de
 * `/api/usuarios/[guid]/cerrar-sesion`, que es la del administrador de una
 * organización sobre la suya: la URL nombra la organización para que el permiso
 * y lo que se ve en pantalla digan lo mismo que lo que se ejecuta.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const datos = await request.json().catch(() => null);

	const ruta = `/organizaciones/${encodeURIComponent(params.guid ?? '')}/usuarios/${encodeURIComponent(params.usuario ?? '')}/cerrar-sesion`;
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(ruta), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify(datos ?? {}),
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
	return json(cuerpo);
};
