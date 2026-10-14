/**
 * BFF: las API Keys de cliente — listarlas (GET) y emitir una nueva (POST).
 *
 * Las genera y las guarda nexus_back (`/llaves/`), no el navegador: desde el
 * 2026-09-30 son llaves de verdad, que un cliente usa para mandar documentos a
 * `POST /bandeja/`. El tenant lo fija el servidor desde la sesión (`tenantDe`), no el
 * navegador, igual que en la bandeja, y se reenvía el JWT de la persona para que
 * nexus_back lo compruebe (HU11).
 *
 * El POST devuelve el SECRET, una sola vez. Por eso la respuesta lleva
 * `Cache-Control: no-store`, como la de nexus_back: que ni el navegador ni un
 * intermediario la conserven.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const GET: RequestHandler = async ({ cookies, locals }) => {
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/llaves/?tenant=${encodeURIComponent(tenant)}`), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	return json({ llaves: Array.isArray(cuerpo?.llaves) ? cuerpo.llaves : [] });
};

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	const nombre = typeof datos?.nombre === 'string' ? datos.nombre : '';
	const descripcion = typeof datos?.descripcion === 'string' ? datos.descripcion : '';
	const dias = Number(datos?.dias);
	if (!nombre.trim() || !descripcion.trim() || !Number.isInteger(dias)) {
		return json({ mensaje: 'Faltan el nombre, la descripción o la vigencia.' }, { status: 400 });
	}

	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/llaves/'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, nombre, descripcion, dias }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	if (typeof cuerpo?.secret !== 'string' || typeof cuerpo?.llave?.id !== 'string') {
		return json({ mensaje: 'nexus_back respondió sin la llave.' }, { status: 502 });
	}
	return json(
		{ secret: cuerpo.secret, llave: cuerpo.llave },
		{ status: 201, headers: { 'Cache-Control': 'no-store' } }
	);
};
