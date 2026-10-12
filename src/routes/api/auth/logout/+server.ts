/** BFF: cerrar sesión. Revoca el refresh token en nexus_back y borra las dos
 *  cookies. Nunca falla hacia el usuario: las cookies se van aunque el back no
 *  conteste. Si no contestó, la sesión sigue viva allá hasta que venza (7 días):
 *  se deja dicho en el log, porque la persona ve "listo" y no se enteraría. */

import type { RequestHandler } from '@sveltejs/kit';

import { COOKIE_REFRESH, borrarSesion, cerrarSesionEnBack } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ cookies, request, getClientAddress, url }) => {
	const cerrada = await cerrarSesionEnBack(
		cookies.get(COOKIE_REFRESH),
		getClientAddress(),
		request.headers.get('user-agent')
	);
	if (!cerrada) {
		console.warn('[sesion] el cierre NO quedó registrado en nexus_back: su sesión sigue viva allá hasta que venza');
	}
	// El mismo `secure` con que se crearon: ver `borrarSesion`.
	borrarSesion(cookies, url.protocol === 'https:');
	return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
