/**
 * El identificador anónimo de ESTE navegador.
 *
 * Lo ponen en una cookie las pantallas que un desconocido puede abrir sin
 * sesión (login y recuperación de contraseña), y el back lo usa para contar
 * cosas POR NAVEGADOR en vez de por cuenta:
 *
 *   - los cinco intentos del login, sean de correo o de contraseña (un correo
 *     que no existe no tiene cuenta donde anotarlos);
 *   - cuántos enlaces de recuperación se han pedido desde aquí.
 *
 * Por navegador y no por IP porque en la oficina todos salen por la misma y
 * cinco errores de cualquiera bloquearían a todos los demás.
 *
 * No identifica a nadie: es un número al azar que nace aquí, no sale de ningún
 * dato de la persona. Es `httpOnly`, así que la página no lo puede leer, y
 * dura un año.
 *
 * Una cookie la puede no mandar quien quiera (un script, `curl`), así que NO
 * es la defensa contra el abuso: es la comodidad. Los límites que de verdad
 * protegen no dependen de ella (ver `RECUPERACION_MAX_POR_IP_HORA` en el back).
 */

import type { Cookies } from '@sveltejs/kit';

/** El nombre de la cookie. Es el mismo para el login y la recuperación: es el
 *  mismo navegador. */
export const COOKIE_NAVEGADOR = 'nx_navegador';

/** Devuelve el identificador de este navegador, creándolo si es la primera vez. */
export function identificadorDeNavegador(cookies: Cookies, url: URL): string {
	let navegador = cookies.get(COOKIE_NAVEGADOR);
	if (!navegador) {
		navegador = crypto.randomUUID();
		cookies.set(COOKIE_NAVEGADOR, navegador, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 365
		});
	}
	return navegador;
}
