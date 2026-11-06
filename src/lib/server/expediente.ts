/**
 * Expediente · lectura de nexus_back desde los `load` de `/expediente`, de Configuración › Grupos y de Archivos procesados (2026-10-24): el
 * listado de expedientes, el de grupos y el expediente abierto piden lo mismo y fallan igual, así que lo hacen aquí en vez de repetirlo.
 *
 * Corre en el servidor, que es quien tiene el JWT en la cookie. La sesión que se cerró desde otro lado (HU05) manda al inicio de
 * sesión y no a una página de error; un id que no es de esta organización responde 404 igual que uno que no existe (HU11), y se
 * dice con el texto que cada pantalla pase.
 */

import { error, json, type Cookies } from '@sveltejs/kit';

import { mensajeDeError, TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion, irAlLogin, sesionCerrada } from '$lib/server/sesion';

const ESPERA_ESCRITURA_MS = 30_000;

/**
 * Lo que hacen los BFF que ESCRIBEN en un expediente o en un grupo (crear un expediente, asignarle grupo, los grupos mismos): reenviar a
 * nexus_back con el JWT de la persona y devolver lo que diga, con su mismo estado. Un error se devuelve como `{ mensaje }`
 * (el texto que trae nexus_back, o uno genérico), que es lo que leen las pantallas, más su `codigo` si lo trae (`ya_existe`,
 * `con_expedientes`…: algunas pantallas dicen esos casos con sus palabras). La ruta ya trae el `?tenant=` cuando va en la URL;
 * el tenant lo fija siempre quien llama desde la sesión (`tenantDe`), nunca el navegador (HU11).
 */
export async function reenviarANexus(cookies: Cookies, metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<Response> {
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
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(datos, respuesta.status), codigo: codigoDe(datos) }, { status: respuesta.status });
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
