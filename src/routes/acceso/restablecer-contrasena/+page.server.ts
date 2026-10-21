/**
 * HU10 · "Configura tu nueva contraseña", a la que se llega desde el enlace del
 * correo (`?t=<token>`).
 *
 * Antes de pintar nada se le pregunta a nexus_back si el enlace todavía sirve,
 * SIN gastarlo (criterios CA-4 y CA-8): si no sirve —no existe, ya se usó,
 * venció, o su cuenta ya no puede restablecer— se va a "Enlace de recuperación
 * expirado". Ese aviso es UNO solo para todos los casos, como en el diseño:
 * distinguirlos le diría a un tercero qué enlaces existieron alguna vez.
 *
 * Es el PRIMER `+page.server.ts` de `/acceso`. Llama al back directo, igual
 * que `usuarios/+page.server.ts`, para que el token no dé un salto de más por
 * el navegador.
 *
 * El token vuelve en `data` solo para que el formulario lo pueda mandar: ya
 * está en la barra de direcciones, no se expone nada nuevo.
 */

import { error, redirect } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({
		// Lo que se ve aquí depende de un enlace que se gasta: que nada lo guarde.
		'Cache-Control': 'no-store',
		// Con el token en la URL, que al salir de esta página no viaje en el
		// `Referer` a ningún otro sitio.
		'Referrer-Policy': 'no-referrer'
	});

	const token = url.searchParams.get('t') ?? '';
	if (!token) redirect(303, '/acceso/enlace-expirado');

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/auth/recuperacion/revisar'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ token }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		// Sin servidor NO es "enlace expirado": el enlace puede estar perfecto.
		error(504, 'No se pudo contactar al servidor. Intenta de nuevo.');
	}
	// `redirect` y `error` lanzan, por eso van fuera del try: dentro, el catch
	// de arriba se los tragaría.
	if (respuesta.status === 410) redirect(303, '/acceso/enlace-expirado');
	if (!respuesta.ok) error(respuesta.status, 'No se pudo comprobar el enlace. Intenta de nuevo.');

	return { token };
};
