/**
 * BFF: iniciar sesión. Reenvía correo y contraseña a nexus_back (`/auth/login`)
 * con la IP y el user-agent del navegador, y si entra, guarda la sesión en las
 * cookies httpOnly. Al navegador le llega solo el usuario, nunca un token.
 *
 * Los errores pasan con su `codigo`, que es lo que el formulario usa para
 * elegir el texto o la pantalla del diseño (ver `routers/auth.py` del back).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { esConexionSegura, leerJsonAcotado } from '$lib/server/seguridad';
import { identificadorDeNavegador } from '$lib/server/navegador';
import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';
import { guardarSesion, type SesionEmitida } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, url }) => {
	// Sin sesión nadie debe poder obligar al servidor a cargar 25 MB (el límite global es por las subidas): estas rutas aceptan unos cuantos cientos de
	// bytes, y un cuerpo mayor de 4 KB se rechaza con 413 sin leerlo completo (NEX-566).
	const lectura = await leerJsonAcotado(request, 4096);
	if (!lectura.ok && lectura.status === 413) {
		return json({ codigo: 'cuerpo_muy_grande', mensaje: 'La petición es demasiado grande.' }, { status: 413 });
	}
	const datos = lectura.ok ? (lectura.datos as Record<string, unknown> | null) : null;
	const email = typeof datos?.email === 'string' ? datos.email.trim() : '';
	const password = typeof datos?.password === 'string' ? datos.password : '';
	if (!email || !password) {
		return json({ codigo: 'faltan_datos', mensaje: 'Escribe tu correo y tu contraseña.' }, { status: 400 });
	}

	// Contra este identificador cuenta el back los cinco intentos fallidos, sean
	// de correo o de contraseña (ver `$lib/server/navegador`).
	const navegador = identificadorDeNavegador(cookies, url, request.headers);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/auth/login'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				email,
				password,
				ip: getClientAddress(),
				userAgent: request.headers.get('user-agent'),
				origen: navegador
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
	const sesion = cuerpo as SesionEmitida;
	// `Secure` según la conexión REAL de la persona (NEX-547): tras el proxy que termina el TLS el proceso ve «http:» aunque entre por HTTPS.
	guardarSesion(cookies, sesion, esConexionSegura(url, request.headers));
	return json({ usuario: sesion.usuario }, { headers: { 'Cache-Control': 'no-store' } });
};
