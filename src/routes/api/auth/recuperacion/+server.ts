/**
 * BFF: pedir el enlace para recuperar la contraseña (HU10).
 *
 * Reenvía el correo a nexus_back (`/auth/recuperacion/solicitar`) con la IP y
 * el user-agent del navegador y el identificador anónimo de este navegador,
 * que el back usa para limitar cuántos enlaces se pueden pedir.
 *
 * Aquí no se toma ninguna decisión que dependa de si la cuenta existe: se pasa lo que conteste el back. Hasta el
 * 2026-10-20 (criterio CA-2) contestaba LO MISMO exista la cuenta o no; ahora, mientras
 * `RECUPERACION_DICE_SI_EXISTE` esté encendida en el back, un correo sin cuenta pasa como `correo_no_existe` (404),
 * que es el error del Figma. Los demás errores que pasan son el del correo mal escrito y el del límite de solicitudes.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { leerJsonAcotado } from '$lib/server/seguridad';
import { identificadorDeNavegador } from '$lib/server/navegador';
import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, url }) => {
	// Sin sesión nadie debe poder obligar al servidor a cargar 25 MB (el límite global es por las subidas): estas rutas aceptan unos cuantos cientos de
	// bytes, y un cuerpo mayor de 4 KB se rechaza con 413 sin leerlo completo (NEX-566).
	const lectura = await leerJsonAcotado(request, 4096);
	if (!lectura.ok && lectura.status === 413) {
		return json({ codigo: 'cuerpo_muy_grande', mensaje: 'La petición es demasiado grande.' }, { status: 413 });
	}
	const datos = lectura.ok ? (lectura.datos as Record<string, unknown> | null) : null;
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
				origen: identificadorDeNavegador(cookies, url, request.headers)
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
