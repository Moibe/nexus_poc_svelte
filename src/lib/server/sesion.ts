/**
 * La sesión del usuario en el front (Sprint 1, HU03).
 *
 * El navegador NUNCA ve un token: recibe dos cookies httpOnly que pone esta
 * capa server y que solo ella lee:
 *
 *   · `nx_acceso`  — el JWT de acceso que emitió nexus_back (vida corta).
 *   · `nx_refresh` — el refresh token (vida larga). Con él `hooks.server.ts`
 *     renueva el JWT sin que el usuario se entere.
 *
 * El JWT se verifica AQUÍ, con el mismo secreto que lo firmó (`AUTH_JWT_SECRET`
 * en el .env de los dos procesos). Los claims son los que emite
 * `servicios/auth.py` del back: `sub` (guid), `sid` (sesión), `eml`, `nom`,
 * `adm` (admin de plataforma) y `dcc` (debe cambiar la contraseña: el primer
 * acceso).
 *
 * Que el JWT valga NO prueba que su sesión siga abierta: se pudo cerrar (la
 * persona, un administrador, un restablecimiento) o la cuenta desactivarse, y el
 * JWT vale hasta que venza (15 minutos). Hasta el 2026-10-13 las rutas que decide
 * solo el front lo aceptaban igual. Ahora el guard le pregunta a nexus_back si la
 * sesión sigue viva (`estadoDeSesion`), guardando la respuesta unos segundos.
 */

import { redirect, type Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { jwtVerify } from 'jose';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const COOKIE_ACCESO = 'nx_acceso';
export const COOKIE_REFRESH = 'nx_refresh';

export type Usuario = {
	guid: string;
	email: string;
	nombre: string;
	esAdminPlataforma: boolean;
	debeCambiarContrasena: boolean;
	/** Su rol en la organización a la que pertenece, si pertenece a alguna
	 *  (HU07). El administrador de plataforma no tiene. */
	rol: string | null;
	/** El guid de su organización, o `null` si no pertenece a ninguna. Es lo
	 *  que aísla sus datos de los de las demás (HU11). */
	tenantGuid: string | null;
};

/** Lo que nexus_back devuelve en /auth/login y /auth/refresh. */
export type SesionEmitida = {
	accessToken: string;
	accessExpiraEn: string;
	refreshToken: string;
	refreshExpiraEn: string;
	usuario: {
		guid: string;
		email: string;
		nombre: string;
		apellidos: string;
		esAdminPlataforma: boolean;
		debeCambiarContrasena: boolean;
	};
};

function secreto(): Uint8Array | null {
	const s = env.AUTH_JWT_SECRET?.trim();
	return s && s.length >= 32 ? new TextEncoder().encode(s) : null;
}

/** Lo que dice un JWT de acceso válido y vigente: la persona y la sesión de la que salió. */
export type TokenVerificado = { usuario: Usuario; sesionGuid: string };

/**
 * Verifica un JWT de acceso (firma, emisor y vigencia). `null` si no vale.
 *
 * Exige `sid`, igual que el verificador del back (`require: [exp, sub, sid]`): un
 * token sin él no se puede preguntar si su sesión sigue viva, y aceptarlo dejaría
 * pasar sin la comprobación de la 2ª etapa de HU05.
 */
export async function verificarToken(token: string | undefined): Promise<TokenVerificado | null> {
	const clave = secreto();
	if (!token || !clave) return null;
	try {
		const { payload } = await jwtVerify(token, clave, {
			algorithms: ['HS256'],
			issuer: 'nexusdoc',
			requiredClaims: ['sub', 'sid', 'exp']
		});
		if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || !payload.sid) return null;
		return {
			usuario: {
				guid: payload.sub,
				email: String(payload.eml ?? ''),
				nombre: String(payload.nom ?? ''),
				esAdminPlataforma: payload.adm === true,
				debeCambiarContrasena: payload.dcc === true,
				rol: typeof payload.rol === 'string' ? payload.rol : null,
				tenantGuid: typeof payload.tnt === 'string' ? payload.tnt : null
			},
			// El guid de la sesión NO va en `Usuario`: ese objeto se publica al navegador.
			sesionGuid: payload.sid
		};
	} catch {
		return null;
	}
}

/** El usuario que dice un JWT de acceso válido y vigente, o `null`. */
export async function usuarioDeToken(token: string | undefined): Promise<Usuario | null> {
	return (await verificarToken(token))?.usuario ?? null;
}

/**
 * Lo que nexus_back dice de la sesión de un JWT (`GET /auth/sesion`):
 *   · `viva`        — sigue abierta.
 *   · `cerrada`     — se cerró (la persona, un administrador, un restablecimiento
 *                     de contraseña) o nunca existió: ante la duda se rechaza.
 *   · `desactivada` — la cuenta se desactivó.
 *   · `inexistente` — la persona ya no existe.
 *   · `desconocida` — no se pudo saber: el back no contestó, tardó o dijo otra
 *                     cosa. NO es una mala noticia: el guard deja pasar (ver abajo).
 */
export type EstadoSesion = 'viva' | 'cerrada' | 'desactivada' | 'inexistente' | 'desconocida';

/** Cuánto se guarda lo que contestó el back. Es lo máximo que tarda en notarse un
 *  cierre de sesión en las rutas que decide solo el front, a cambio de no
 *  preguntar en cada petición (la bandeja sola consulta cada 10 segundos). */
const VIGENCIA_COMPROBACION_MS = 3_000;
/** Si no se pudo saber, se vuelve a intentar pronto, pero no en cada petición: con
 *  el back colgado, cada una esperaría el timeout completo. */
const VIGENCIA_DESCONOCIDA_MS = 1_500;
const TIMEOUT_COMPROBACION_MS = 2_000;
const MAX_COMPROBACIONES = 1_000;

const comprobadas = new Map<string, { hasta: number; estado: Promise<EstadoSesion> }>();

async function consultarSesion(token: string): Promise<EstadoSesion> {
	try {
		const r = await fetch(urlNexus('/auth/sesion'), {
			headers: cabecerasNexus({ Authorization: `Bearer ${token}` }),
			signal: AbortSignal.timeout(TIMEOUT_COMPROBACION_MS)
		});
		if (r.ok) {
			const estado = ((await r.json().catch(() => null)) as { estado?: string } | null)?.estado;
			if (estado === 'viva' || estado === 'cerrada' || estado === 'desactivada' || estado === 'inexistente') return estado;
		}
		console.warn(`[sesion] /auth/sesion respondió ${r.status}: se deja pasar`);
	} catch (e) {
		console.warn(`[sesion] /auth/sesion no contestó (${e instanceof Error ? e.name : 'error'}): se deja pasar`);
	}
	return 'desconocida';
}

/**
 * ¿Sigue viva la sesión de este JWT? Se lo pregunta a nexus_back, que es quien
 * sabe: el guard no tiene dónde mirarlo.
 *
 * Se DEJA PASAR cuando no se puede saber (`desconocida`). Es a propósito: el
 * guard corre en cada petición, y un back caído, lento o mal configurado no debe
 * dejar a todo el mundo fuera de la app. Solo se rechaza con una respuesta
 * explícita del back. El costo es que, mientras el back no conteste, un cierre de
 * sesión no se nota —igual que antes de esta consulta—; lo que sí pasa por el
 * back (usuarios, organizaciones) lo sigue rechazando él mismo.
 *
 * La respuesta se guarda `VIGENCIA_COMPROBACION_MS`, y las peticiones que llegan
 * mientras se pregunta comparten la misma pregunta.
 */
export function estadoDeSesion(token: string, usuarioGuid: string, sesionGuid: string): Promise<EstadoSesion> {
	const ahora = Date.now();
	// Persona Y sesión: con solo la sesión, la respuesta "viva" de un token valdría 3 s
	// para cualquier otro token firmado con el mismo `sid`.
	const clave = `${usuarioGuid}:${sesionGuid}`;
	const guardada = comprobadas.get(clave);
	if (guardada && guardada.hasta > ahora) return guardada.estado;
	const entrada = { hasta: ahora + VIGENCIA_COMPROBACION_MS, estado: consultarSesion(token) };
	comprobadas.set(clave, entrada);
	void entrada.estado.then((estado) => {
		if (estado === 'desconocida') entrada.hasta = Date.now() + VIGENCIA_DESCONOCIDA_MS;
	});
	if (comprobadas.size > MAX_COMPROBACIONES) {
		for (const [clave, e] of comprobadas) if (e.hasta <= ahora) comprobadas.delete(clave);
	}
	return entrada.estado;
}

function segundosHasta(iso: string, minimo: number): number {
	const ms = new Date(iso).getTime() - Date.now();
	return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : minimo;
}

/** Guarda la sesión que emitió nexus_back en las dos cookies. */
export function guardarSesion(cookies: Cookies, sesion: SesionEmitida, segura: boolean): void {
	const base = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: segura };
	cookies.set(COOKIE_ACCESO, sesion.accessToken, { ...base, maxAge: segundosHasta(sesion.accessExpiraEn, 15 * 60) });
	cookies.set(COOKIE_REFRESH, sesion.refreshToken, { ...base, maxAge: segundosHasta(sesion.refreshExpiraEn, 7 * 24 * 3600) });
}

/**
 * Las cabeceras para llamar a nexus_back EN NOMBRE del usuario de la sesión:
 * la llave de servicio más su JWT como Bearer. Los endpoints que distinguen
 * por rol (organizaciones) necesitan las dos cosas; la llave sola solo dice
 * "esto viene del front", no quién pide.
 */
export function cabecerasConSesion(cookies: Cookies, extra?: HeadersInit): Headers {
	const cabeceras = cabecerasNexus(extra);
	const token = cookies.get(COOKIE_ACCESO);
	if (token) cabeceras.set('Authorization', `Bearer ${token}`);
	return cabeceras;
}

/**
 * Borra las dos cookies de sesión. `segura` es la MISMA que se le pasó a
 * `guardarSesion` (`url.protocol === 'https:'`), y no es un detalle.
 *
 * SvelteKit, si no se le dice nada, borra con el atributo `Secure` a todo host
 * que no sea `localhost`. Pero las cookies se CREARON sin `Secure` cuando el
 * sitio va por HTTP, y los navegadores IGNORAN un `Secure` que llega por HTTP
 * plano. Resultado, hasta el 2026-10-12: en el servidor de CSI, al que se entra
 * por `http://172.10.30.15:3400`, "Cerrar sesión" no borraba nada y dejaba la
 * sesión puesta. En `localhost` sí funcionaba, y como TODAS las pruebas corren
 * ahí, nadie lo vio (ver `probar-cookies-http.mjs`).
 *
 * Borrar con el mismo `secure` con que se creó funciona en los tres casos: HTTP
 * por IP, HTTPS por dominio y localhost.
 */
export function borrarSesion(cookies: Cookies, segura: boolean): void {
	cookies.delete(COOKIE_ACCESO, { path: '/', secure: segura });
	cookies.delete(COOKIE_REFRESH, { path: '/', secure: segura });
}

/**
 * Las cabeceras `Set-Cookie` que borran la sesión, para una respuesta que `handle`
 * devuelve DIRECTAMENTE (un `json(...)` en vez de `resolve(...)`).
 *
 * SvelteKit solo agrega a la respuesta las cookies que se tocaron con
 * `cookies.set/delete` cuando pasa por `resolve` o es un `redirect`; a una
 * `Response` devuelta tal cual no se las pone (medido el 2026-10-13). Sin esto, las
 * rutas `/api/*` contestaban 401 pero el navegador conservaba las cookies de una
 * sesión que ya no sirve, y cada petición volvía a gastar una renovación fallida
 * contra el back hasta que vencía el refresh (7 días).
 */
export function cabecerasParaBorrarSesion(cookies: Cookies, segura: boolean): Headers {
	const cabeceras = new Headers();
	for (const nombre of [COOKIE_ACCESO, COOKIE_REFRESH]) {
		cabeceras.append(
			'set-cookie',
			cookies.serialize(nombre, '', { path: '/', httpOnly: true, sameSite: 'lax', secure: segura, maxAge: 0 })
		);
	}
	return cabeceras;
}

/**
 * nexus_back dijo `sesion_cerrada`: el JWT todavía no vence, pero su SESIÓN ya
 * se cerró (la cerró la persona en otro dispositivo, un administrador, o se
 * restableció su contraseña; HU05). Se tiran las cookies y se manda al login,
 * con la ruta a la que iba para volver después.
 *
 * Sin esto, a quien le revocan la sesión le saldría una página de error en vez
 * de la pantalla de login. Solo para ESE código: un `sesion_invalida` ("el token
 * venció") es una carrera normal de vencimiento y no debe tirar el refresh, que
 * `hooks.server.ts` usa para renovar solo.
 */
export function sesionCerrada(cuerpo: unknown): boolean {
	return (cuerpo as { detail?: { codigo?: string } } | null)?.detail?.codigo === 'sesion_cerrada';
}

/** Cierra las cookies y redirige al login. No devuelve: `redirect` lanza. */
export function irAlLogin(cookies: Cookies, url: URL): never {
	borrarSesion(cookies, url.protocol === 'https:');
	redirect(303, `/acceso/iniciar-sesion?volver=${encodeURIComponent(url.pathname + url.search)}`);
}

/**
 * Lo que pasó al pedir una renovación. Importa distinguirlo:
 *   · `renovada`     — el back emitió una sesión nueva.
 *   · `rechazada`    — el back contestó EXPLÍCITAMENTE que ese refresh ya no sirve
 *                      (revocado, rotado, vencido, de una cuenta desactivada). Es lo
 *                      único que justifica tirar las cookies.
 *   · `sin_respuesta`— no se pudo saber: red, timeout, 5xx, 429, llave de servicio
 *                      mal puesta… Las cookies se CONSERVAN: el refresh sigue valiendo
 *                      y la siguiente petición renueva sola cuando el back vuelva.
 *                      Tirarlas aquí (como se hizo unas horas, el 2026-10-13) deja
 *                      sin sesión a quien estaba dentro cada vez que el back se
 *                      reinicia o el almacén se cae.
 */
export type ResultadoRenovacion =
	| { tipo: 'renovada'; sesion: SesionEmitida }
	| { tipo: 'rechazada' }
	| { tipo: 'sin_respuesta' };

/** Una renovación no necesita los 130 s de las llamadas pesadas: si el back no
 *  contesta en esto, se considera `sin_respuesta`. */
const TIMEOUT_RENOVACION_MS = 10_000;
/** Cuánto se recuerda el resultado de una renovación (ver `renovarSesion`). */
const RETENCION_RENOVACION_MS = 5_000;
const renovaciones = new Map<string, { hasta: number; resultado: Promise<ResultadoRenovacion> }>();

async function pedirRenovacion(refresh: string, ip: string, userAgent: string | null): Promise<ResultadoRenovacion> {
	try {
		const r = await fetch(urlNexus('/auth/refresh'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ refreshToken: refresh, ip, userAgent }),
			signal: AbortSignal.timeout(TIMEOUT_RENOVACION_MS)
		});
		if (r.ok) {
			const sesion = (await r.json().catch(() => null)) as SesionEmitida | null;
			if (sesion?.accessToken && sesion.refreshToken) return { tipo: 'renovada', sesion };
			console.warn('[sesion] /auth/refresh contestó 200 sin una sesión legible: no se tiran las cookies');
			return { tipo: 'sin_respuesta' };
		}
		const codigo = ((await r.json().catch(() => null)) as { detail?: { codigo?: string } } | null)?.detail?.codigo;
		if (r.status === 401 && (codigo === 'sesion_invalida' || codigo === 'sesion_vencida')) return { tipo: 'rechazada' };
		console.warn(`[sesion] /auth/refresh respondió ${r.status}${codigo ? ' ' + codigo : ''}: no se tiran las cookies`);
	} catch (e) {
		console.warn(`[sesion] /auth/refresh no contestó (${e instanceof Error ? e.name : 'error'}): no se tiran las cookies`);
	}
	return { tipo: 'sin_respuesta' };
}

/**
 * Renueva la sesión con el refresh token.
 *
 * Las peticiones que llegan con el MISMO refresh comparten UNA sola renovación. Un
 * refresh es de un solo uso: al vencer el JWT, el sondeo de la bandeja, una acción de
 * la persona y la precarga de una pantalla salen juntos con el mismo `nx_refresh`, y si
 * cada una renovara por su cuenta el back rotaría con la primera y rechazaría a las
 * demás —y esos rechazos tiraban las cookies recién emitidas—. Sin compartirla, con
 * ocho peticiones a la vez siete recibían 401 (`probar-renovacion.mjs`).
 *
 * El resultado se recuerda unos segundos: el navegador manda con el refresh VIEJO las
 * peticiones que salieron antes de recibir las cookies nuevas. Es la gracia que casi
 * todo esquema de rotación concede. Un `sin_respuesta` no se recuerda: el siguiente
 * intento debe volver a preguntar.
 *
 * La clave es el propio refresh: vive esos segundos en la memoria del servidor, igual
 * que las cookies de la sesión nueva que guarda el resultado.
 */
export function renovarSesion(refresh: string, ip: string, userAgent: string | null): Promise<ResultadoRenovacion> {
	const ahora = Date.now();
	const clave = refresh;
	const guardada = renovaciones.get(clave);
	if (guardada && guardada.hasta > ahora) return guardada.resultado;
	const entrada = { hasta: ahora + RETENCION_RENOVACION_MS, resultado: pedirRenovacion(refresh, ip, userAgent) };
	renovaciones.set(clave, entrada);
	void entrada.resultado.then((r) => {
		if (r.tipo === 'sin_respuesta' && renovaciones.get(clave) === entrada) renovaciones.delete(clave);
	});
	if (renovaciones.size > MAX_COMPROBACIONES) {
		for (const [k, e] of renovaciones) if (e.hasta <= ahora) renovaciones.delete(k);
	}
	return entrada.resultado;
}

/**
 * Avisa a nexus_back que la sesión termina. NUNCA falla hacia quien llama: la
 * persona pidió salir y las cookies se van igual. Devuelve si el back
 * confirmó, para que quien llama pueda dejarlo dicho en el log.
 *
 * Reintenta UNA vez si el back no contesta o responde con un error de
 * servidor. Antes no miraba el resultado: con el back caído, el front decía
 * "listo", borraba las cookies y la sesión seguía viva allá hasta 7 días, sin
 * un solo renglón que lo contara.
 */
export async function cerrarSesionEnBack(
	refresh: string | undefined,
	ip?: string,
	userAgent?: string | null
): Promise<boolean> {
	if (!refresh) return true;
	for (let intento = 1; intento <= 2; intento++) {
		try {
			const r = await fetch(urlNexus('/auth/logout'), {
				method: 'POST',
				headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
				body: JSON.stringify({ refreshToken: refresh, ip, userAgent }),
				signal: AbortSignal.timeout(10_000)
			});
			if (r.ok) return true;
			console.warn(`[sesion] /auth/logout respondió ${r.status} (intento ${intento} de 2)`);
			if (r.status < 500) return false; // un 4xx no se arregla reintentando
		} catch (e) {
			console.warn(`[sesion] no se pudo avisar el cierre de sesión al back (intento ${intento} de 2): ${String(e)}`);
		}
	}
	return false;
}
