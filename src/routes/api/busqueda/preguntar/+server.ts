/**
 * BFF: preguntar en lenguaje natural sobre los datos extraídos (NEX-607, 2026-11-23). Reenvía `{pregunta}` a nexus_back (`POST /busqueda/preguntar`) con
 * el tenant de la sesión (`tenantDe`, nunca el navegador) y el JWT de la persona (HU11). Cualquier rol de la organización puede preguntar: solo lee.
 *
 * La espera va por encima de lo que puede tardar el back: el modelo (hasta GEMINI_TIMEOUT, 30 s) dos veces si corrige, más la consulta (15 s) dos veces.
 *
 * Los errores llegan como `{ mensaje, codigo }`. Los 422 del back (`no_se_puede`, `consulta_invalida`, `tardo`) y el 429 traen un texto curado para la
 * persona y se reenvían tal cual; el 503 (sin configurar) también, porque dice lo justo («no está disponible en este servidor») sin nada interno. Los
 * demás 5xx se esconden como siempre (`mensajeDeError`, NEX-567).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { MAX_PREGUNTA, limpiarPregunta } from '$lib/busqueda/busqueda';
import { codigoDe } from '$lib/server/expediente';
import { mensajeDeError, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';
import { tenantDe } from '$lib/server/nexus';

const ESPERA_MS = 100_000;

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	const pregunta = typeof datos?.pregunta === 'string' ? limpiarPregunta(datos.pregunta) : '';
	if (!pregunta) return json({ mensaje: 'Escribe una pregunta.' }, { status: 400 });
	if (typeof datos.pregunta === 'string' && datos.pregunta.trim().length > MAX_PREGUNTA) {
		return json({ mensaje: `La pregunta es demasiado larga: hasta ${MAX_PREGUNTA} caracteres.` }, { status: 400 });
	}
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/busqueda/preguntar'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, pregunta }),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return json({ mensaje: esTimeout ? 'Biblioratum tardó demasiado en contestar. Intenta una pregunta más acotada.' : 'No se pudo contactar al servidor.', codigo: esTimeout ? 'tardo' : undefined }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = (cuerpo as { detail?: { mensaje?: unknown; reintentarEn?: unknown; alcance?: unknown; tope?: unknown; ventana?: unknown } } | null)?.detail;
		const curado = [422, 429, 503].includes(respuesta.status) && typeof detalle?.mensaje === 'string' ? detalle.mensaje : null;
		const codigo = codigoDe(cuerpo);
		// El tope de uso (NEX-609) dice además hasta cuándo: la pantalla lo pone en la hora de quien lo lee.
		const tope =
			codigo === 'tope' && typeof detalle?.reintentarEn === 'string'
				? { reintentarEn: detalle.reintentarEn, alcance: detalle.alcance, tope: detalle.tope, ventana: detalle.ventana }
				: {};
		return json({ mensaje: curado ?? mensajeDeError(cuerpo, respuesta.status), codigo, ...tope }, { status: respuesta.status });
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
