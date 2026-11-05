/**
 * BFF: «Sugerir descripción» del paso 1 del alta de un tipo documental (2026-11-05, pedido de Moibe). Reenvía el nombre del tipo a
 * `POST /tipos-documentales/sugerir-descripcion` de nexus_back, que se lo pide a Gemini (Vertex AI) junto con los nombres de los demás tipos de la
 * organización, y devuelve `{ descripcion, modelo }`. No guarda nada: la persona revisa el texto antes de usarlo.
 *
 * El `tenant` NO lo manda el navegador: lo fija el servidor desde la sesión (`tenantDe`), y se reenvía el JWT de la persona para que nexus_back
 * compruebe su rol (el mismo que guarda tipos). El guardia de rutas ya exige ese rol para cualquier escritura bajo `/api/tipos-documentales`, y
 * esta ruta tiene su tope de frecuencia (cada llamada cuesta, ver `LIMITES` en `guardia-de-rutas.ts`).
 *
 * Los errores 429, 502 y 503 de nexus_back traen un texto PENSADO para mostrarse («La sugerencia con IA no está disponible en este servidor…»): el
 * back nunca mete ahí el proyecto de Google ni lo que contestó Google (va a su log). Por eso aquí se pasan tal cual, a diferencia de otros 5xx, donde
 * `mensajeDeError` esconde el detalle (NEX-567).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

// Por encima de los 30 s que nexus_back le espera a Gemini (GEMINI_TIMEOUT), con holgura para listar los tipos y el ida y vuelta.
const ESPERA_MS = 45_000;
const MAX_NOMBRE = 200;

/** Los estados cuyo texto el back escribió para mostrarse tal cual. */
const CON_TEXTO_PROPIO = new Set([429, 502, 503]);

export const POST: RequestHandler = async ({ cookies, locals, request }) => {
	const entrada = await request.json().catch(() => null);
	const nombre = typeof entrada?.nombre === 'string' ? entrada.nombre.trim() : '';
	if (nombre === '') return json({ mensaje: 'Escribe primero el nombre del tipo documental.' }, { status: 400 });
	const tipoId = typeof entrada?.tipoId === 'string' && entrada.tipoId !== '' ? entrada.tipoId : undefined;

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/tipos-documentales/sugerir-descripcion'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant: tenantDe(locals), nombre: nombre.slice(0, MAX_NOMBRE), ...(tipoId ? { tipoId } : {}) }),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo generar la sugerencia. Intenta de nuevo o escribe la descripción a mano.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = (cuerpo as { detail?: unknown } | null)?.detail;
		const mensaje = CON_TEXTO_PROPIO.has(respuesta.status) && typeof detalle === 'string' ? detalle : mensajeDeError(cuerpo, respuesta.status);
		return json({ mensaje }, { status: respuesta.status });
	}
	const descripcion = (cuerpo as { descripcion?: unknown } | null)?.descripcion;
	if (typeof descripcion !== 'string' || descripcion.trim() === '') {
		return json({ mensaje: 'El servidor no devolvió una descripción. Intenta de nuevo o escríbela a mano.' }, { status: 502 });
	}
	return json({ descripcion, modelo: (cuerpo as { modelo?: unknown }).modelo }, { headers: { 'Cache-Control': 'no-store' } });
};
