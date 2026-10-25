/**
 * Expediente · lectura de nexus_back desde los `load` de `/expediente` (2026-10-24): el listado de expedientes, el de tipos y el
 * expediente abierto piden lo mismo y fallan igual, así que lo hacen aquí en vez de repetirlo tres veces.
 *
 * Corre en el servidor, que es quien tiene el JWT en la cookie. La sesión que se cerró desde otro lado (HU05) manda al inicio de
 * sesión y no a una página de error; un id que no es de esta organización responde 404 igual que uno que no existe (HU11), y se
 * dice con el texto que cada pantalla pase.
 */

import { error, type Cookies } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion, irAlLogin, sesionCerrada } from '$lib/server/sesion';

export async function leerDeNexus(
	ruta: string,
	{ cookies, url }: { cookies: Cookies; url: URL },
	fallo: string,
	noExiste?: string
): Promise<Record<string, unknown> | null> {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(ruta), { headers: cabecerasConSesion(cookies), signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch {
		error(504, 'No se pudo contactar al servidor.');
	}
	const cuerpo = await respuesta.json().catch(() => null);

	if (respuesta.status === 401 && sesionCerrada(cuerpo)) irAlLogin(cookies, url);
	if (respuesta.status === 404 && noExiste) error(404, noExiste);
	if (!respuesta.ok) error(respuesta.status, fallo);
	return cuerpo as Record<string, unknown> | null;
}

/** La lista que viene bajo `clave` en la respuesta, o vacía si no vino una. */
export function listaDe<T>(cuerpo: Record<string, unknown> | null, clave: string): T[] {
	const valor = cuerpo?.[clave];
	return Array.isArray(valor) ? (valor as T[]) : [];
}
