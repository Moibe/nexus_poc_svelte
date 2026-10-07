/** BFF: cerrar sesión. Revoca el refresh token en nexus_back y borra las dos
 *  cookies. Nunca falla hacia el usuario: si el back no contesta, las cookies
 *  se van igual y la sesión vence sola allá. */

import type { RequestHandler } from '@sveltejs/kit';

import { COOKIE_REFRESH, borrarSesion, cerrarSesionEnBack } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ cookies }) => {
	await cerrarSesionEnBack(cookies.get(COOKIE_REFRESH));
	borrarSesion(cookies);
	return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
