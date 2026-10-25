/**
 * BFF: editar (PATCH) y borrar (DELETE) un tipo de expediente de la organización de quien pide.
 *
 * Editar cambia el nombre, el esquema (los tipos documentales del tipo) o los dos en una llamada: lo que no viene no se toca, y al menos uno
 * tiene que venir. El esquema nuevo REEMPLAZA al anterior y, como al crear, pide al menos un tipo documental (nexus_back lo exige también y
 * comprueba que sean de la organización). Si algo falla no cambia nada, ni el nombre ni el esquema.
 *
 * Quien edita y borra es quien administra (Administrador y Supervisor): el servidor responde 403 `sin_permiso` a los demás roles y 404 si
 * el tipo no es de esta organización (igual que uno que no existe), y aquí se reenvía tal cual. Dos respuestas llevan su `codigo` para que la
 * pantalla las diga con sus palabras: `ya_existe` (409, otro tipo ya se llama así) y `con_expedientes` (409, un tipo con expedientes no se
 * borra). El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador, y se reenvía el JWT de la persona (HU11).
 *
 * Crear un tipo y listarlos no pasa por aquí: lo primero es `../+server.ts` y lo segundo lo pide el `load` de `/configuracion/tipos-expediente`.
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
	const cambios: { nombre?: string; tiposDocumentales?: string[] } = {};
	if (datos?.nombre !== undefined) {
		if (typeof datos.nombre !== 'string' || !datos.nombre.trim()) {
			return json({ mensaje: 'Escribe el nombre del tipo de expediente.' }, { status: 400 });
		}
		cambios.nombre = datos.nombre;
	}
	if (datos?.tiposDocumentales !== undefined) {
		const ids: unknown = datos.tiposDocumentales;
		if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
			return json({ mensaje: 'Elige al menos un tipo documental para el esquema.' }, { status: 400 });
		}
		cambios.tiposDocumentales = ids;
	}
	if (cambios.nombre === undefined && cambios.tiposDocumentales === undefined) {
		return json({ mensaje: 'Indica qué cambiar: el nombre o los tipos documentales.' }, { status: 400 });
	}
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(rutaDelTipo(params.id)), {
			method: 'PATCH',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, ...cambios }),
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
