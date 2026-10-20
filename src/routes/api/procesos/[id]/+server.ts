/**
 * BFF: guardar (PUT) y borrar (DELETE) UN proceso del motor de reglas de la organización de quien pide.
 *
 * El PUT lleva `{ revision, datos }`: la revisión sobre la que se editó (0 si el proceso es nuevo) y el proceso completo. Si otra
 * persona lo guardó antes, nexus_back responde 409 y aquí se devuelve con su `revisionActual`, para que la pantalla vuelva a
 * leerlo en vez de pisar lo de la otra persona. El tenant sale de la sesión, no de la petición (`tenantDe`).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const ESPERA_MS = 30_000;

/** El error de nexus_back como lo entiende la pantalla: el texto, y si es un conflicto, la revisión vigente. */
function fallo(cuerpo: unknown, status: number) {
	const detalle = (cuerpo as { detail?: { codigo?: unknown; revisionActual?: unknown } } | null)?.detail;
	return json(
		{
			mensaje: mensajeDeError(cuerpo, status),
			codigo: typeof detalle?.codigo === 'string' ? detalle.codigo : undefined,
			revisionActual: typeof detalle?.revisionActual === 'number' ? detalle.revisionActual : undefined
		},
		{ status }
	);
}

export const PUT: RequestHandler = async ({ params, cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.datos !== 'object' || datos.datos === null || !Number.isInteger(datos?.revision)) {
		return json({ mensaje: 'Faltan la revisión o los datos del proceso.' }, { status: 400 });
	}
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/procesos/${encodeURIComponent(params.id ?? '')}`), {
			method: 'PUT',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, revision: datos.revision, datos: datos.datos }),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return fallo(cuerpo, respuesta.status);
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};

export const DELETE: RequestHandler = async ({ params, cookies, locals }) => {
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/procesos/${encodeURIComponent(params.id ?? '')}?tenant=${encodeURIComponent(tenant)}`), {
			method: 'DELETE',
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return fallo(cuerpo, respuesta.status);
	return json({ eliminado: true });
};
