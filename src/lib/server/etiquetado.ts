/**
 * Lo común a las rutas del BFF de «Ejemplo documental» (2026-11-23): los ejemplos etiquetados de un tipo y la medición de su precisión
 * (nexus_back: `routers/ejemplos_etiquetados.py`, bajo `/tipos-documentales/{id}`). El tenant sale de la sesión, nunca de la petición.
 */

import { json } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';

import { mensajeDeError, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

/** Leer un documento es UNA extracción; medir son hasta 25, cuatro a la vez. Por debajo de lo que espera el navegador. */
export const ESPERA_LEER_MS = 130_000;
export const ESPERA_MEDIR_MS = 280_000;
export const ESPERA_MS = 30_000;

/** Un segmento de ruta seguro para pegar en la URL de nexus_back (los ids los pone el navegador, pero aquí no se confía). */
export function segmento(valor: string | undefined): string | null {
	return valor && /^[A-Za-z0-9_-]{1,100}$/.test(valor) ? valor : null;
}

/** Llama a nexus_back y devuelve su respuesta como la entiende la pantalla: el cuerpo tal cual, o `{ mensaje }` con su estado. */
export async function pedirANexus(
	cookies: Cookies,
	ruta: string,
	opciones: { metodo: 'GET' | 'POST' | 'PUT' | 'DELETE'; cuerpo?: unknown; espera?: number }
): Promise<Response> {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(ruta), {
			method: opciones.metodo,
			headers: cabecerasConSesion(cookies, opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined),
			body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
			signal: AbortSignal.timeout(opciones.espera ?? ESPERA_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return json({ mensaje: esTimeout ? 'Biblioratum tardó demasiado en contestar.' : 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		// 429, 502 y 503 de estas rutas llevan un texto CURADO por nexus_back («Biblioratum no pudo leer este documento», «muy ocupado»…), sin nada
		// de Google: ese sí se le dice a la persona. Los demás 5xx se esconden como siempre (NEX-567, `mensajeDeError`).
		const detalle = (cuerpo as { detail?: unknown } | null)?.detail;
		const curado = [429, 502, 503].includes(respuesta.status) && typeof detalle === 'string' ? detalle : null;
		return json({ mensaje: curado ?? mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
}
