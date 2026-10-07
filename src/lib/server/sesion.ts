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
			debeCambiarContrasena: payload.dcc === true
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

export function borrarSesion(cookies: Cookies): void {
	cookies.delete(COOKIE_ACCESO, { path: '/' });
	cookies.delete(COOKIE_REFRESH, { path: '/' });
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

/** Avisa a nexus_back que la sesión termina. Nunca falla hacia quien llama. */
export async function cerrarSesionEnBack(refresh: string | undefined): Promise<void> {
	if (!refresh) return;
	try {
		await fetch(urlNexus('/auth/logout'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ refreshToken: refresh }),
			signal: AbortSignal.timeout(10_000)
		});
	} catch {
		/* la cookie se borra igual; la sesión vence sola en el back */
	}
}
