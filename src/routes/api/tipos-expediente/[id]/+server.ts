/**
 * BFF: renombrar (PATCH) y borrar (DELETE) un tipo de expediente de la organización de quien pide.
 *
 * Quien renombra y borra es quien administra (Administrador y Supervisor): el servidor responde 403 `sin_permiso` a los demás roles y 404 si
 * el tipo no es de esta organización (igual que uno que no existe), y aquí se reenvía tal cual. Dos respuestas llevan su `codigo` para que la
 * pantalla las diga con sus palabras: `ya_existe` (409, otro tipo ya se llama así) y `con_expedientes` (409, un tipo con expedientes no se
 * borra). El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador, y se reenvía el JWT de la persona (HU11).
 *
 * Crear un tipo y listarlos no pasa por aquí: lo primero es `../+server.ts` y lo segundo lo pide el `load` de `/expediente/tipos`.
 */

import { json } from '@sveltejs/kit';

import { codigoDe } from '$lib/server/expediente';
import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';
import type { RequestHandler } from './$types';

const ESPERA_MS = 30_000;

function rutaDelTipo(id: string): string {
	return `/tipos-expediente/${encodeURIComponent(id)}`;
}

export const PATCH: RequestHandler = async ({ cookies, request, locals, params }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.nombre !== 'string' || !datos.nombre.trim()) {
		return json({ mensaje: 'Escribe el nombre del tipo de expediente.' }, { status: 400 });
	}
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(rutaDelTipo(params.id)), {
			method: 'PATCH',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, nombre: datos.nombre }),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ mensaje: mensajeDeError(cuerpo, respuesta.status), codigo: codigoDe(cuerpo) }, { status: respuesta.status });
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};

export const DELETE: RequestHandler = async ({ cookies, locals, params }) => {
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`${rutaDelTipo(params.id)}?tenant=${encodeURIComponent(tenant)}`), {
			method: 'DELETE',
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ mensaje: mensajeDeError(cuerpo, respuesta.status), codigo: codigoDe(cuerpo) }, { status: respuesta.status });
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
