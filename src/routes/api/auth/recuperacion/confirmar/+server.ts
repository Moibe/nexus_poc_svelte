/**
 * BFF: poner la contraseña nueva con el enlace del correo (HU10).
 *
 * Reenvía a nexus_back (`/auth/recuperacion/confirmar`) SIN `Authorization`:
 * aquí no hay sesión, el token del correo es la credencial. Y al terminar bien
 * borra las cookies de sesión SIEMPRE: si la persona abrió el enlace estando
 * dentro, el back le cerró todas las sesiones (criterio CA-7) y las cookies
 * tienen que morir aquí también; si no había sesión, borrar no hace nada.
 *
 * Manda el identificador del navegador para que el back levante el bloqueo de
 * ESTE navegador: quien agotó sus cinco intentos y por eso vino aquí no debe
 * toparse con "cuenta bloqueada" al entrar con la contraseña nueva.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { identificadorDeNavegador } from '$lib/server/navegador';
import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';
import { borrarSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, url }) => {
	const datos = await request.json().catch(() => null);
	const token = typeof datos?.token === 'string' ? datos.token : '';
	const nueva = typeof datos?.nueva === 'string' ? datos.nueva : '';
	const confirmacion = typeof datos?.confirmacion === 'string' ? datos.confirmacion : '';
	if (!token || !nueva || !confirmacion) {
		return json({ codigo: 'faltan_datos', mensaje: 'Escribe y confirma tu nueva contraseña.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/auth/recuperacion/confirmar'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				token,
				nueva,
				confirmacion,
				ip: getClientAddress(),
				origen: identificadorDeNavegador(cookies, url)
			}),
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
	borrarSesion(cookies, url.protocol === 'https:');
	return json({ ok: true, sesionesCerradas: true }, { headers: { 'Cache-Control': 'no-store' } });
};
