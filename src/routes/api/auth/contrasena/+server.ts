/**
 * BFF: cambiar la contraseña (HU04 en el primer acceso; HU13 después).
 * Reenvía a nexus_back con el JWT de la cookie como Bearer. Si el back cerró
 * todas las sesiones (primer acceso), aquí se borran las cookies: el flujo del
 * diseño sigue en "Contraseña actualizada → Iniciar sesión".
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';
import { COOKIE_ACCESO, borrarSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get(COOKIE_ACCESO);
	if (!token) return json({ codigo: 'sin_sesion', mensaje: 'Tu sesión terminó. Vuelve a iniciar sesión.' }, { status: 401 });
	const datos = await request.json().catch(() => null);
	const cuerpo = {
		actual: typeof datos?.actual === 'string' ? datos.actual : undefined,
		nueva: typeof datos?.nueva === 'string' ? datos.nueva : '',
		confirmacion: typeof datos?.confirmacion === 'string' ? datos.confirmacion : ''
	};

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/auth/contrasena'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
			body: JSON.stringify(cuerpo),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ codigo: 'sin_servidor', mensaje: 'No se pudo contactar al servidor. Intenta de nuevo.' }, { status: 504 });
	}
	const resultado = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = resultado?.detail;
		const error =
			detalle && typeof detalle === 'object'
				? detalle
				: { codigo: 'error', mensaje: typeof detalle === 'string' ? detalle : `El servidor respondió ${respuesta.status}.` };
		return json(error, { status: respuesta.status, headers: { 'Cache-Control': 'no-store' } });
	}
	if (resultado?.sesionesCerradas) borrarSesion(cookies);
	return json(
		{ ok: true, sesionesCerradas: Boolean(resultado?.sesionesCerradas) },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
