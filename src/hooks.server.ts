/**
 * La puerta de la app (Sprint 1, HU03): nada se sirve sin sesión, salvo las
 * pantallas de acceso y sus endpoints.
 *
 * En cada petición:
 *   1. Se lee el JWT de la cookie `nx_acceso`. Si venció pero hay `nx_refresh`,
 *      se renueva contra nexus_back y se reponen las cookies: el usuario no se
 *      entera (el JWT dura 15 min; la sesión, 7 días).
 *   2. Sin sesión: las páginas van a `/acceso/iniciar-sesion?volver=<ruta>` y
 *      las rutas `/api/*` responden 401 (el navegador no debe seguir
 *      redirecciones en un fetch de datos).
 *   3. Con sesión pero `debeCambiarContrasena` (primer acceso, HU04): solo se
 *      puede estar en "Bienvenido" y "Configura tu nueva contraseña". Todo lo
 *      demás manda ahí.
 *   4. Con sesión completa, las pantallas de entrada mandan al inicio.
 *   5. Las pantallas de recuperar la contraseña (HU10) se abren SIN sesión,
 *      porque quien las usa no puede entrar. Las que abre el ENLACE del correo
 *      (`restablecer-contrasena` y `enlace-expirado`) además se abren CON
 *      sesión: quien tenga el navegador abierto y dentro de su cuenta y pique
 *      el enlace no debe ser rebotado al inicio, o el enlace se moriría en
 *      silencio.
 *
 * Hasta el 2026-10-07 el front no tenía sesión: cualquiera con la URL veía y
 * operaba todo (ver la nota de seguridad que llevaba abierta desde el
 * 2026-10-01). Esto la cierra.
 */

import { json, redirect, type Handle } from '@sveltejs/kit';

import {
	COOKIE_ACCESO,
	COOKIE_REFRESH,
	borrarSesion,
	guardarSesion,
	renovarSesion,
	usuarioDeToken
} from '$lib/server/sesion';

/** Se ven sin sesión. "Contraseña actualizada" va aquí porque al cambiarla en
 *  el primer acceso se cierran todas las sesiones, incluida la actual. */
const SIN_SESION = new Set([
	'/acceso/iniciar-sesion',
	'/acceso/bloqueada',
	'/acceso/desactivada',
	'/acceso/contrasena-actualizada',
	// HU10: recuperar la contraseña.
	'/acceso/recuperar',
	'/acceso/restablecer-contrasena',
	'/acceso/enlace-expirado'
]);
/** Las que abre el enlace del correo: se ven con o sin sesión (nota 5 arriba).
 *  Todas están también en `SIN_SESION`. */
const CON_O_SIN_SESION = new Set(['/acceso/restablecer-contrasena', '/acceso/enlace-expirado']);
/** Lo único que puede ver quien todavía debe cambiar su contraseña. */
const PRIMER_ACCESO = new Set(['/acceso/bienvenido', '/acceso/nueva-contrasena']);

export const handle: Handle = async ({ event, resolve }) => {
	const ruta = event.url.pathname.replace(/\/+$/, '') || '/';

	// Los endpoints del acceso no piden sesión: son los que la crean o cierran.
	if (ruta.startsWith('/api/auth/')) return resolve(event);

	let usuario = await usuarioDeToken(event.cookies.get(COOKIE_ACCESO));
	if (!usuario) {
		const refresh = event.cookies.get(COOKIE_REFRESH);
		if (refresh) {
			const renovada = await renovarSesion(refresh, event.getClientAddress(), event.request.headers.get('user-agent'));
			if (renovada) {
				guardarSesion(event.cookies, renovada, event.url.protocol === 'https:');
				usuario = await usuarioDeToken(renovada.accessToken);
			} else {
				borrarSesion(event.cookies);
			}
		}
	}
	event.locals.usuario = usuario;

	const esApi = ruta.startsWith('/api/');
	if (!usuario) {
		if (SIN_SESION.has(ruta)) return resolve(event);
		if (esApi) return json({ mensaje: 'Tu sesión terminó. Vuelve a iniciar sesión.', codigo: 'sin_sesion' }, { status: 401 });
		const volver = ruta === '/' ? '' : `?volver=${encodeURIComponent(event.url.pathname + event.url.search)}`;
		redirect(303, `/acceso/iniciar-sesion${volver}`);
	}

	if (usuario.debeCambiarContrasena) {
		if (PRIMER_ACCESO.has(ruta)) return resolve(event);
		if (esApi) return json({ mensaje: 'Primero cambia tu contraseña.', codigo: 'debe_cambiar_contrasena' }, { status: 403 });
		redirect(303, '/acceso/bienvenido');
	}

	// Va DESPUÉS del bloque de `debeCambiarContrasena`, a propósito: una cuenta
	// que todavía no hace su primer acceso se sigue yendo a "Bienvenido".
	if (CON_O_SIN_SESION.has(ruta)) return resolve(event);

	// Sesión completa: las pantallas de entrada ya no tienen sentido.
	if (SIN_SESION.has(ruta) || PRIMER_ACCESO.has(ruta)) redirect(303, '/');
	return resolve(event);
};
