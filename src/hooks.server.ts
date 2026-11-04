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
 * Un JWT vigente NO basta (HU05, 2ª etapa, 2026-10-13): su sesión pudo cerrarse
 * (la persona, un administrador, un restablecimiento de contraseña) o la cuenta
 * desactivarse, y el JWT vale hasta que venza. Antes de dejar pasar se le
 * pregunta a nexus_back si la sesión sigue viva (`estadoDeSesion`, con la
 * respuesta guardada unos segundos). Si no, se tiran las cookies: las pantallas
 * van al login (o a "cuenta desactivada") y las rutas `/api/*` responden 401
 * `sesion_cerrada` (o 403 `desactivada`). Si el back no contesta se DEJA PASAR.
 *
 * Lo mismo con la renovación del JWT vencido: solo un rechazo EXPLÍCITO del back
 * (401 `sesion_invalida` o `sesion_vencida`) tira las cookies; si no contestó
 * (caído, 503, timeout) se conservan y se responde 503, para que la persona no
 * pierda una sesión que sigue valiendo cuando el back vuelva. Las peticiones con el
 * mismo refresh comparten una sola renovación (ver `renovarSesion`).
 *
 * Hasta el 2026-10-07 el front no tenía sesión: cualquiera con la URL veía y
 * operaba todo (ver la nota de seguridad que llevaba abierta desde el
 * 2026-10-01). Esto la cierra.
 */

import { error, json, redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

import { ORIGENES_DE_CONFIANZA } from '$lib/seguridad/origenes';
import { exigenciaDeRuta, esSubida } from '$lib/server/guardia-de-rutas';
import { frenarPorFrecuencia, topeDeSubidas } from '$lib/server/frecuencia';
import { esConexionSegura, esPeticionDeOrigenAjeno } from '$lib/server/seguridad';
import { puedeAdministrar, puedeOrganizar } from '$lib/usuarios/permisos';
import {
	COOKIE_ACCESO,
	COOKIE_REFRESH,
	borrarSesion,
	cabecerasParaBorrarSesion,
	estadoDeSesion,
	guardarSesion,
	renovarSesion,
	verificarToken
} from '$lib/server/sesion';

/** Se ven sin sesión. "Contraseña actualizada" va aquí porque al cambiarla en
 *  el primer acceso se cierran todas las sesiones, incluida la actual. */
const SIN_SESION = new Set([
	'/acceso/iniciar-sesion',
	'/acceso/bloqueada',
	'/acceso/desactivada',
	'/acceso/contrasena-actualizada',
	// HU06 CA-5: la contraseña temporal caducó.
	'/acceso/activacion-caducada',
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

/** Los orígenes de los que se aceptan peticiones que cambian algo: los de confianza más los que se agreguen en `ORIGENES_EXTRA` (separados por coma). */
const ORIGENES_PERMITIDOS: readonly string[] = [
	...ORIGENES_DE_CONFIANZA,
	...(env.ORIGENES_EXTRA ?? '')
		.split(',')
		.map((o) => o.trim())
		.filter(Boolean)
];

const SOLO_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

const puerta: Handle = async ({ event, resolve }) => {
	const ruta = event.url.pathname.replace(/\/+$/, '') || '/';
	const esApi = ruta.startsWith('/api/');

	// Una petición que cambia algo y viene de OTRO sitio no pasa (NEX-562), con o sin sesión: también la del login. SvelteKit solo revisa esto en
	// los formularios; aquí se cubre el JSON. `Origin` lo pone el navegador y una página ajena no lo puede cambiar.
	if (esApi && esPeticionDeOrigenAjeno(event.request.method, event.request.headers.get('origin'), event.url.origin, ORIGENES_PERMITIDOS)) {
		return json({ mensaje: 'La petición viene de un origen no permitido.', codigo: 'origen_no_permitido' }, { status: 403 });
	}

	const ip = (() => {
		try {
			return event.getClientAddress();
		} catch {
			return 'desconocida';
		}
	})();

	// Los endpoints del acceso no piden sesión: son los que la crean o cierran. Los que mandan un correo o prueban contraseñas llevan un tope por IP
	// (NEX-559 y NEX-548): sin sesión no hay a quién más contarle.
	if (ruta.startsWith('/api/auth/')) {
		const frenada = frenarPorFrecuencia(ruta, event.request.method, null, ip);
		if (frenada) return demasiadasPeticiones(frenada.reintentarEnSeg);
		return resolve(event);
	}

	// Detrás del proxy el proceso ve «http:» aunque la persona entre por HTTPS: se mira también `X-Forwarded-Proto` (NEX-547).
	const segura = esConexionSegura(event.url, event.request.headers);
	let token = event.cookies.get(COOKIE_ACCESO);
	let verificado = await verificarToken(token);
	let recienEmitida = false;
	let borradas = false; // se tiraron las cookies en esta petición
	let sinRespuesta = false; // el back no contestó al renovar: no se sabe si hay sesión
	if (!verificado) {
		const refresh = event.cookies.get(COOKIE_REFRESH);
		if (refresh) {
			const r = await renovarSesion(refresh, event.getClientAddress(), event.request.headers.get('user-agent'));
			if (r.tipo === 'renovada') {
				guardarSesion(event.cookies, r.sesion, segura);
				token = r.sesion.accessToken;
				verificado = await verificarToken(token);
				// "Recién emitida" es SOLO la renovación que esta petición pidió o esperó. Si llegó con el
				// refresh viejo dentro de la gracia (`reutilizada`), la sesión nueva pudo cerrarse desde que
				// se emitió (cierre forzado, desactivación, restablecimiento): se le pregunta al back como
				// a cualquier otra, y si dice que no, `borrarSesion` pisa las cookies que se acaban de poner.
				recienEmitida = !r.reutilizada;
			} else if (r.tipo === 'rechazada') {
				// El back dijo que ese refresh ya no sirve: ahora sí, las cookies se van.
				borrarSesion(event.cookies, segura);
				borradas = true;
			} else {
				// No se pudo saber (back caído, 503, timeout): las cookies se quedan. El
				// refresh sigue valiendo y la siguiente petición renueva sola (salvo que el back
				// lo haya canjeado justo antes de que se agotara la espera: caso raro, ver
				// `renovarSesion`).
				sinRespuesta = true;
			}
		}
	}
	let usuario = verificado?.usuario ?? null;

	// ¿Su sesión sigue viva? Una sesión que el back acaba de emitir sí (no se pregunta).
	let sinSesionPor: 'cerrada' | 'desactivada' | null = null;
	let sesionSinComprobar = false; // el back no dijo si la sesión sigue viva (NEX-556)
	if (verificado && token && !recienEmitida) {
		const estado = await estadoDeSesion(token, verificado.usuario.guid, verificado.sesionGuid);
		if (estado === 'desconocida') sesionSinComprobar = true;
		if (estado === 'cerrada' || estado === 'inexistente') sinSesionPor = 'cerrada';
		else if (estado === 'desactivada') sinSesionPor = 'desactivada';
		if (sinSesionPor) {
			borrarSesion(event.cookies, segura);
			borradas = true;
			usuario = null;
		}
	}
	event.locals.usuario = usuario;

	if (!usuario) {
		if (SIN_SESION.has(ruta)) return resolve(event);
		if (sinRespuesta) {
			// Sin saber quién es no se puede servir nada protegido, pero tampoco decirle
			// "tu sesión terminó": no terminó, el servidor no contestó.
			const mensaje = 'No se pudo comprobar tu sesión porque el servidor no responde. Intenta de nuevo en unos segundos.';
			if (esApi) return json({ mensaje, codigo: 'sin_servidor' }, { status: 503 });
			error(503, mensaje);
		}
		// Una `Response` devuelta directamente no lleva las cookies que se borraron arriba:
		// se le ponen a mano (ver `cabecerasParaBorrarSesion`). Los `redirect` sí las llevan.
		const headers = borradas ? cabecerasParaBorrarSesion(event.cookies, segura) : undefined;
		if (sinSesionPor === 'desactivada') {
			if (esApi) return json({ mensaje: 'Tu cuenta está desactivada.', codigo: 'desactivada' }, { status: 403, headers });
			redirect(303, '/acceso/desactivada');
		}
		if (esApi) {
			return sinSesionPor === 'cerrada'
				? json({ mensaje: 'Tu sesión se cerró. Vuelve a iniciar sesión.', codigo: 'sesion_cerrada' }, { status: 401, headers })
				: json({ mensaje: 'Tu sesión terminó. Vuelve a iniciar sesión.', codigo: 'sin_sesion' }, { status: 401, headers });
		}
		const volver = ruta === '/' ? '' : `?volver=${encodeURIComponent(event.url.pathname + event.url.search)}`;
		redirect(303, `/acceso/iniciar-sesion${volver}`);
	}

	if (usuario.debeCambiarContrasena) {
		if (PRIMER_ACCESO.has(ruta)) return resolve(event);
		if (esApi) return json({ mensaje: 'Primero cambia tu contraseña.', codigo: 'debe_cambiar_contrasena' }, { status: 403 });
		redirect(303, '/acceso/bienvenido');
	}

	// Cierre en falso para lo que ESCRIBE (NEX-556): si el back no dijo si la sesión sigue viva, leer se deja pasar (la persona no pierde la pantalla
	// porque el back tarde), pero una petición que cambia algo no se atiende a ciegas: una sesión cerrada por un administrador o una cuenta
	// desactivada no pueden seguir escribiendo mientras el back no conteste. Es un 503 que se arregla solo al volver el back; las cookies se conservan.
	if (esApi && sesionSinComprobar && !SOLO_LECTURA.has(event.request.method)) {
		return json(
			{ mensaje: 'No se pudo comprobar tu sesión porque el servidor no responde. Intenta de nuevo en unos segundos.', codigo: 'sin_servidor' },
			{ status: 503 }
		);
	}

	// El rol que exige la ruta (NEX-554): primera red, antes de llamar al back. El back repite la comprobación y es quien manda.
	const exige = esApi ? exigenciaDeRuta(ruta, event.request.method) : null;
	if (exige && !(exige === 'administrar' ? puedeAdministrar(usuario) : puedeOrganizar(usuario))) {
		return json({ mensaje: 'Tu rol no puede hacer esto.', codigo: 'sin_permiso' }, { status: 403 });
	}

	// Tope de frecuencia por persona y por IP en las rutas costosas o que mandan algo afuera (NEX-559). Después de comprobar el rol: lo que el rol no
	// puede hacer ni se cuenta.
	if (esApi) {
		const frenada = frenarPorFrecuencia(ruta, event.request.method, usuario.guid, ip);
		if (frenada) return demasiadasPeticiones(frenada.reintentarEnSeg);
	}

	// Va DESPUÉS del bloque de `debeCambiarContrasena`, a propósito: una cuenta
	// que todavía no hace su primer acceso se sigue yendo a "Bienvenido".
	if (CON_O_SIN_SESION.has(ruta)) return resolve(event);

	// Sesión completa: las pantallas de entrada ya no tienen sentido.
	if (SIN_SESION.has(ruta) || PRIMER_ACCESO.has(ruta)) redirect(303, '/');

	// Las subidas se cargan enteras en memoria (hasta 20 MB cada una): si ya hay las que el proceso aguanta, las demás esperan su turno con un 503 que
	// dice cuándo reintentar, en vez de arriesgar la memoria de todos (NEX-563).
	if (esSubida(ruta, event.request.method)) {
		const soltar = topeDeSubidas.entrar();
		if (!soltar) {
			return json(
				{ mensaje: 'Hay muchas subidas en curso. Intenta de nuevo en unos segundos.', codigo: 'subidas_en_curso' },
				{ status: 503, headers: { 'Retry-After': '5' } }
			);
		}
		try {
			return await resolve(event);
		} finally {
			soltar();
		}
	}
	return resolve(event);
};

function demasiadasPeticiones(reintentarEnSeg: number): Response {
	return json(
		{ mensaje: 'Demasiadas peticiones seguidas. Espera un momento e intenta de nuevo.', codigo: 'demasiadas_peticiones' },
		{ status: 429, headers: { 'Retry-After': String(reintentarEnSeg) } }
	);
}

/**
 * Lo que sirve la app —páginas y datos— no se guarda en el caché del navegador
 * (`no-store`), salvo lo que un endpoint pida a propósito.
 *
 * Sin esto, al cerrar sesión y dar "Atrás" el navegador reabre la pantalla
 * protegida desde su caché (el historial NO revalida) y la muestra con los
 * datos y el nombre de quien ya se fue, sin preguntarle nada al servidor. Con
 * `no-store` la vuelve a pedir, y la puerta de arriba lo manda al login. Medido
 * el 2026-10-12 (HU05) con `probar-boton-atras.mjs`.
 */
export const handle: Handle = async (entrada) => {
	const respuesta = await puerta(entrada);
	try {
		if (!respuesta.headers.has('cache-control')) respuesta.headers.set('cache-control', 'no-store');
		for (const [nombre, valor] of Object.entries(CABECERAS_DE_SEGURIDAD)) {
			if (!respuesta.headers.has(nombre)) respuesta.headers.set(nombre, valor);
		}
		// La CSP la pone SvelteKit (`kit.csp` en `vite.config.ts`, con nonce). Válvula (NEX-557): con `CSP_SOLO_REPORTE=1` en el `.env` del servidor
		// la misma política se manda en modo reporte —el navegador anota y no bloquea—, por si una pantalla se rompe en un ambiente y hay que
		// aflojarla ya, sin reconstruir.
		if (env.CSP_SOLO_REPORTE === '1') {
			const csp = respuesta.headers.get('content-security-policy');
			if (csp) {
				respuesta.headers.delete('content-security-policy');
				respuesta.headers.set('content-security-policy-report-only', csp);
			}
		}
	} catch {
		// Cabeceras inmutables (una respuesta reenviada tal cual): se deja como está.
	}
	return respuesta;
};

/**
 * Cabeceras de seguridad (NEX-474, auditoría de QA, 2026-10-22). Se ponen aquí, en la propia aplicación, para que viajen con
 * cualquier proxy que haya delante. `Strict-Transport-Security` NO va aquí: lo pone el proxy y esta app también se sirve por HTTP
 * plano en la red de CSI, donde esa cabecera no tiene sentido.
 *
 *  - `nosniff`: el navegador no adivina el tipo de lo que descarga.
 *  - `X-Frame-Options: DENY`: nadie puede meter la app en un marco (clickjacking). La app no usa iframes.
 *  - `Referrer-Policy`: a otro sitio solo se le dice el origen, no la ruta.
 *  - `Permissions-Policy`: la app no usa cámara, micrófono, ubicación ni pagos; se apagan.
 */
const CABECERAS_DE_SEGURIDAD: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
};

/**
 * Lo que le llega a la persona cuando algo truena en el servidor sin que nadie lo haya previsto (NEX-567): un mensaje genérico con un código
 * de referencia, y el detalle completo —con el mismo código— en la bitácora del servidor. Así un error interno no filtra rutas, nombres ni
 * estados del almacén, pero el equipo puede encontrarlo. Los errores que SvelteKit marca como esperados (404, 403, `error(…)` de una ruta)
 * conservan su mensaje: no pasan por aquí.
 */
export const handleError: HandleServerError = ({ error, event, status }) => {
	const referencia = crypto.randomUUID().slice(0, 8);
	console.error(`[error ${referencia}] ${event.request.method} ${event.url.pathname} (${status})`, error);
	return { message: `Ocurrió un error inesperado. Si sigue pasando, avisa con este código: ${referencia}.`, referencia };
};
