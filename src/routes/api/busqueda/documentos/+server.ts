/**
 * BFF: buscar en el texto de los documentos (épica 14, HU-096 a HU-098). Reenvía la consulta, los filtros, el orden y la página a nexus_back
 * (`POST /busqueda/documentos`) con el tenant de la sesión (`tenantDe`, nunca el navegador) y el JWT de la persona (HU11). Cualquier rol de la
 * organización: solo lee, y el back lee con la conexión que solo ve esa organización.
 *
 * Aquí se rechaza lo que no tiene forma (una consulta vacía o larga, un tipo o una fecha raros, un orden desconocido) antes de llegar al back. Los 400,
 * 422 y 503 del back traen un texto para la persona y se reenvían tal cual; los demás 5xx se esconden (`mensajeDeError`, NEX-567).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { MAX_CONSULTA, MAX_RESULTADOS, ORDENES, esDia, esIdDeTipo, limpiarConsulta } from '$lib/busqueda/documentos';
import { codigoDe } from '$lib/server/expediente';
import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const ESPERA_MS = 30_000;

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	const crudo = typeof datos?.consulta === 'string' ? datos.consulta : '';
	const consulta = limpiarConsulta(crudo);
	if (!consulta) return json({ mensaje: 'Escribe qué quieres buscar.' }, { status: 400 });
	if (consulta.length > MAX_CONSULTA) return json({ mensaje: `La búsqueda es demasiado larga: hasta ${MAX_CONSULTA} caracteres.` }, { status: 400 });
	const tipos = Array.isArray(datos.tipos) ? datos.tipos : [];
	if (tipos.length > 50 || !tipos.every(esIdDeTipo)) return json({ mensaje: 'El filtro de tipos documentales no es válido.' }, { status: 400 });
	const desde = datos.desde ?? null;
	const hasta = datos.hasta ?? null;
	if ((desde !== null && !esDia(desde)) || (hasta !== null && !esDia(hasta)) || (desde && hasta && desde > hasta)) {
		return json({ mensaje: 'El rango de fechas no es válido.' }, { status: 400 });
	}
	const orden = datos.orden ?? 'relevancia';
	if (!ORDENES.includes(orden)) return json({ mensaje: 'El orden no es válido.' }, { status: 400 });
	const inicio = datos.inicio ?? 0;
	const limite = datos.limite ?? 10;
	if (!Number.isInteger(inicio) || inicio < 0 || inicio > MAX_RESULTADOS || !Number.isInteger(limite) || limite < 1 || limite > 20) {
		return json({ mensaje: 'La página pedida no es válida.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/busqueda/documentos'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				tenant: tenantDe(locals),
				consulta,
				tipos,
				...(desde ? { desde } : {}),
				...(hasta ? { hasta } : {}),
				orden,
				inicio,
				limite
			}),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return json({ mensaje: esTimeout ? 'La búsqueda tardó demasiado. Intenta de nuevo.' : 'No se pudo contactar al servidor.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = (cuerpo as { detail?: { mensaje?: unknown } } | null)?.detail;
		const curado = [400, 422, 503].includes(respuesta.status) && typeof detalle?.mensaje === 'string' ? detalle.mensaje : null;
		return json({ mensaje: curado ?? mensajeDeError(cuerpo, respuesta.status), codigo: codigoDe(cuerpo) }, { status: respuesta.status });
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
