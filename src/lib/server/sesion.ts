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
 * en el .env de los dos procesos), sin llamar a nexus_back en cada petición.
 * Los claims son los que emite `servicios/auth.py` del back: `sub` (guid),
 * `sid` (sesión), `eml`, `nom`, `adm` (admin de plataforma) y `dcc` (debe
 * cambiar la contraseña: el primer acceso).
 */

import type { Cookies } from '@sveltejs/kit';
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

/** El usuario que dice un JWT de acceso válido y vigente, o `null`. */
export async function usuarioDeToken(token: string | undefined): Promise<Usuario | null> {
	const clave = secreto();
	if (!token || !clave) return null;
	try {
		const { payload } = await jwtVerify(token, clave, { algorithms: ['HS256'], issuer: 'nexusdoc' });
		if (typeof payload.sub !== 'string') return null;
		return {
			guid: payload.sub,
			email: String(payload.eml ?? ''),
			nombre: String(payload.nom ?? ''),
			esAdminPlataforma: payload.adm === true,
			debeCambiarContrasena: payload.dcc === true,
			rol: typeof payload.rol === 'string' ? payload.rol : null,
			tenantGuid: typeof payload.tnt === 'string' ? payload.tnt : null
		};
	} catch {
		return null;
	}
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
 * Renueva la sesión con el refresh token. Devuelve la sesión nueva, o `null`
 * si nexus_back la rechazó (revocada, vencida, usuario desactivado) o no
 * contestó: en ambos casos el usuario tiene que volver a entrar.
 */
export async function renovarSesion(
	refresh: string,
	ip: string,
	userAgent: string | null
): Promise<SesionEmitida | null> {
	try {
		const r = await fetch(urlNexus('/auth/refresh'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ refreshToken: refresh, ip, userAgent }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!r.ok) return null;
		return (await r.json()) as SesionEmitida;
	} catch {
		return null;
	}
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
