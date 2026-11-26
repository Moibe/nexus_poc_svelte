/**
 * BFF: preguntar en lenguaje natural sobre los datos extraídos (NEX-607, 2026-11-23). Reenvía `{pregunta}` a nexus_back (`POST /busqueda/preguntar`) con
 * el tenant de la sesión (`tenantDe`, nunca el navegador) y el JWT de la persona (HU11). Cualquier rol de la organización puede preguntar: solo lee.
 *
 * La espera va por encima de lo que puede tardar el back: el modelo (hasta GEMINI_TIMEOUT, 30 s) dos veces si corrige, más la consulta (15 s) dos veces.
 *
 * Los errores llegan como `{ mensaje, codigo }`. Los 422 del back (`no_se_puede`, `consulta_invalida`, `tardo`) y el 429 traen un texto curado para la
 * persona y se reenvían tal cual; el 503 (sin configurar) también, porque dice lo justo («no está disponible en este servidor») sin nada interno. Los
 * demás 5xx se esconden como siempre (`mensajeDeError`, NEX-567).
 *
 * NEX-611: el navegador manda también `conversacion` (el id que devolvió la pregunta anterior) y se reenvía solo si tiene la forma de uno; el back lo
 * busca con la organización de la sesión y la persona del JWT, así que uno ajeno empieza una conversación nueva. Los errores devuelven en qué
 * conversación quedó la pregunta, para que la pantalla siga en ella.
 *
 * NEX-612: y `expediente` cuando se pregunta desde un expediente. Uno sin la forma de un id se rechaza aquí; el back comprueba que sea de la organización
 * de la sesión (404 `expediente_no_existe`, con su texto) y lo fija en la conexión: la respuesta solo trae lo de ese expediente.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { MAX_PREGUNTA, esIdDeConversacion, limpiarPregunta } from '$lib/busqueda/busqueda';
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
	const conversacion = esIdDeConversacion(datos.conversacion) ? datos.conversacion : null;
	// NEX-612: preguntar desde un expediente. El back comprueba que sea de la organización de la sesión (404 si no) y lo fija en la conexión.
	if (datos.expediente !== undefined && datos.expediente !== null && (typeof datos.expediente !== 'string' || !/^expediente-[0-9a-f]{32}$/.test(datos.expediente))) {
		return json({ mensaje: 'Ese expediente no existe.', codigo: 'expediente_no_existe' }, { status: 404 });
	}
	const expediente = typeof datos.expediente === 'string' ? datos.expediente : null;
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/busqueda/preguntar'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, pregunta, ...(conversacion ? { conversacion } : {}), ...(expediente ? { expediente } : {}) }),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return json({ mensaje: esTimeout ? 'Biblioratum tardó demasiado en contestar. Intenta una pregunta más acotada.' : 'No se pudo contactar al servidor.', codigo: esTimeout ? 'tardo' : undefined }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = (
			cuerpo as { detail?: { mensaje?: unknown; reintentarEn?: unknown; alcance?: unknown; tope?: unknown; ventana?: unknown; conversacion?: unknown; turno?: unknown } } | null
		)?.detail;
		const curado = [404, 422, 429, 503].includes(respuesta.status) && typeof detalle?.mensaje === 'string' ? detalle.mensaje : null;
		const codigo = codigoDe(cuerpo);
		// El tope de uso (NEX-609) dice además hasta cuándo: la pantalla lo pone en la hora de quien lo lee.
		const tope =
			codigo === 'tope' && typeof detalle?.reintentarEn === 'string'
				? { reintentarEn: detalle.reintentarEn, alcance: detalle.alcance, tope: detalle.tope, ventana: detalle.ventana }
				: {};
		// NEX-611: en qué conversación quedó (solo el id con su forma y el número).
		const enConversacion = esIdDeConversacion(detalle?.conversacion)
			? { conversacion: detalle.conversacion, turno: typeof detalle?.turno === 'number' ? detalle.turno : null }
			: {};
		return json({ mensaje: curado ?? mensajeDeError(cuerpo, respuesta.status), codigo, ...tope, ...enConversacion }, { status: respuesta.status });
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
