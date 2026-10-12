/**
 * BFF: pedir el enlace para recuperar la contraseña (HU10).
 *
 * Reenvía el correo a nexus_back (`/auth/recuperacion/solicitar`) con la IP y
 * el user-agent del navegador y el identificador anónimo de este navegador,
 * que el back usa para limitar cuántos enlaces se pueden pedir.
 *
 * Responde LO MISMO exista la cuenta o no (criterio CA-2): aquí no se toma
 * ninguna decisión que dependa de eso. Los únicos errores que pasan son el del
 * correo mal escrito y el del límite de solicitudes.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { identificadorDeNavegador } from '$lib/server/navegador';
import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, url }) => {
	const datos = await request.json().catch(() => null);
	const correo = typeof datos?.correo === 'string' ? datos.correo.trim() : '';
	if (!correo) {
		return json({ codigo: 'faltan_datos', mensaje: 'Escribe tu correo electrónico.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/auth/recuperacion/solicitar'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				email: correo,
				ip: getClientAddress(),
				userAgent: request.headers.get('user-agent'),
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
	return json({ ok: true, mensaje: cuerpo?.mensaje }, { headers: { 'Cache-Control': 'no-store' } });
};
