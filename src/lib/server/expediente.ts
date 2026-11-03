/**
 * Expediente · lectura de nexus_back desde los `load` de `/expediente` (2026-10-24): el listado de expedientes, el de tipos y el
 * expediente abierto piden lo mismo y fallan igual, así que lo hacen aquí en vez de repetirlo tres veces.
 *
 * Corre en el servidor, que es quien tiene el JWT en la cookie. La sesión que se cerró desde otro lado (HU05) manda al inicio de
 * sesión y no a una página de error; un id que no es de esta organización responde 404 igual que uno que no existe (HU11), y se
 * dice con el texto que cada pantalla pase.
 */

import { error, isRedirect, json, type Cookies } from '@sveltejs/kit';

import { opcionesDeTiposDocumentales, type TipoDocumentalOpcion } from '$lib/expedientes/tipos';
import { mensajeDeError, TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion, irAlLogin, sesionCerrada } from '$lib/server/sesion';

const ESPERA_ESCRITURA_MS = 30_000;

/**
 * Lo que hacen todos los BFF que ESCRIBEN en un expediente (crearlo, sus expedientes virtuales y lo que se mete y se saca de ellos):
 * reenviar a nexus_back con el JWT de la persona y devolver lo que diga, con su mismo estado. Un error se devuelve como `{ mensaje }`
 * (el texto que trae nexus_back, o uno genérico), que es lo que leen las pantallas. La ruta ya trae el `?tenant=` cuando va en la URL;
 * el tenant lo fija siempre quien llama desde la sesión (`tenantDe`), nunca el navegador (HU11).
 */
export async function reenviarANexus(cookies: Cookies, metodo: 'POST' | 'PUT' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<Response> {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(ruta), {
			method: metodo,
			headers: cabecerasConSesion(cookies, cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
			body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
			signal: AbortSignal.timeout(ESPERA_ESCRITURA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const datos = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(datos, respuesta.status) }, { status: respuesta.status });
	return json(datos, { status: respuesta.status, headers: { 'Cache-Control': 'no-store' } });
}

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
