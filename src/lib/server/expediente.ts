/**
 * Expediente · lectura de nexus_back desde los `load` de `/expediente` (2026-10-24): el listado de expedientes, el de tipos y el
 * expediente abierto piden lo mismo y fallan igual, así que lo hacen aquí en vez de repetirlo tres veces.
 *
 * Corre en el servidor, que es quien tiene el JWT en la cookie. La sesión que se cerró desde otro lado (HU05) manda al inicio de
 * sesión y no a una página de error; un id que no es de esta organización responde 404 igual que uno que no existe (HU11), y se
 * dice con el texto que cada pantalla pase.
 */

import { error, isRedirect, type Cookies } from '@sveltejs/kit';

import { opcionesDeTiposDocumentales, type TipoDocumentalOpcion } from '$lib/expedientes/tipos';
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

/**
 * Los tipos documentales de la organización, para elegir cuáles forman el esquema de un tipo de expediente al crearlo. Solo se piden
 * cuando quien mira puede crear tipos. Si no se pueden leer (el servidor tardó, falló), NO se rompe la pantalla: `fallo` lo dice y el
 * modal avisa y no deja crear sin esquema. La sesión que se cerró desde otro lado sí manda al inicio de sesión, como en cualquier lectura.
 */
export async function tiposDocumentalesParaEsquema(
	sesion: { cookies: Cookies; url: URL },
	tenant: string
): Promise<{ opciones: TipoDocumentalOpcion[]; fallo: boolean }> {
	try {
		const cuerpo = await leerDeNexus(`/tipos-documentales/?tenant=${encodeURIComponent(tenant)}`, sesion, 'No se pudieron cargar los tipos documentales.');
		return { opciones: opcionesDeTiposDocumentales(listaDe<unknown>(cuerpo, 'tipos')), fallo: false };
	} catch (e) {
		if (isRedirect(e)) throw e;
		return { opciones: [], fallo: true };
	}
}

/** El código con que nexus_back distingue un error (`detail.codigo`: `ya_existe`, `con_expedientes`, `sin_permiso`…), si lo trae. */
export function codigoDe(cuerpo: unknown): string | undefined {
	const detalle = (cuerpo as { detail?: { codigo?: unknown } } | null)?.detail;
	return typeof detalle?.codigo === 'string' ? detalle.codigo : undefined;
}

/** La lista que viene bajo `clave` en la respuesta, o vacía si no vino una. */
export function listaDe<T>(cuerpo: Record<string, unknown> | null, clave: string): T[] {
	const valor = cuerpo?.[clave];
	return Array.isArray(valor) ? (valor as T[]) : [];
}
