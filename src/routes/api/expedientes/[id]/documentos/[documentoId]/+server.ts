/**
 * BFF: meter (PUT) o sacar (DELETE) un documento de un expediente de la organización de quien pide. Meter lo usa «Agregar a expediente» de
 * Archivos procesados (Figma Sprint 5, HUN2; 2026-10-29); sacar, «Quitar» en la tarjeta del documento dentro del expediente (2026-11-04).
 *
 * Sacar NO borra el documento: sigue siendo de la organización (en Archivos procesados) y en los demás expedientes donde esté; si era su único
 * expediente, vuelve al void. nexus_back lo saca también de los expedientes virtuales de ESTE expediente.
 *
 * Idempotente en nexus_back: si el documento ya estaba, responde `agregado: false`. Un documento puede estar en varios expedientes a la
 * vez, así que agregar NO lo saca de los que ya tenía. Quien organiza (Administrador, Supervisor, Analista y Operador) puede; a los
 * demás roles nexus_back les responde 403 `sin_permiso`, y 404 si el expediente o el documento no existen en esta organización; aquí
 * se reenvía tal cual. El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador (HU11).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const ESPERA_MS = 30_000;

/** Reenvía a nexus_back con el método que llegó (`PUT` mete, `DELETE` saca) y devuelve su respuesta tal cual, o su error como mensaje. */
async function reenviar(metodo: 'PUT' | 'DELETE', { cookies, locals, params }: Parameters<RequestHandler>[0]) {
	const tenant = encodeURIComponent(tenantDe(locals));
	const ruta = `/expedientes/${encodeURIComponent(params.id ?? '')}/documentos/${encodeURIComponent(params.documentoId ?? '')}?tenant=${tenant}`;
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(ruta), { method: metodo, headers: cabecerasConSesion(cookies), signal: AbortSignal.timeout(ESPERA_MS) });
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
}

export const PUT: RequestHandler = (evento) => reenviar('PUT', evento);

export const DELETE: RequestHandler = (evento) => reenviar('DELETE', evento);
