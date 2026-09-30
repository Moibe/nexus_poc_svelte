/**
 * BFF: las API Keys de cliente — listarlas (GET) y emitir una nueva (POST).
 *
 * Las genera y las guarda nexus_back (`/llaves/`), no el navegador: desde el
 * 2026-09-30 son llaves de verdad, que un cliente usa para mandar documentos a
 * `POST /bandeja/`. El tenant lo fija el servidor (`TENANT_CLIENTE`), no el
 * navegador, igual que en la bandeja.
 *
 * El POST devuelve el SECRET, una sola vez. Por eso la respuesta lleva
 * `Cache-Control: no-store`, como la de nexus_back: que ni el navegador ni un
 * intermediario la conserven.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TENANT_CLIENTE, TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

function motivoDe(cuerpo: unknown, status: number): string {
	const detalle = (cuerpo as { detail?: unknown } | null)?.detail;
	return typeof detalle === 'string' ? detalle : `nexus_back respondió ${status}.`;
}

export const GET: RequestHandler = async () => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/llaves/?tenant=${encodeURIComponent(TENANT_CLIENTE)}`), {
			headers: cabecerasNexus(),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: motivoDe(cuerpo, respuesta.status) }, { status: respuesta.status });
	return json({ llaves: Array.isArray(cuerpo?.llaves) ? cuerpo.llaves : [] });
};

export const POST: RequestHandler = async ({ request }) => {
	const datos = await request.json().catch(() => null);
	const nombre = typeof datos?.nombre === 'string' ? datos.nombre : '';
	const descripcion = typeof datos?.descripcion === 'string' ? datos.descripcion : '';
	const dias = Number(datos?.dias);
	if (!nombre.trim() || !descripcion.trim() || !Number.isInteger(dias)) {
		return json({ mensaje: 'Faltan el nombre, la descripción o la vigencia.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/llaves/'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant: TENANT_CLIENTE, nombre, descripcion, dias }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: motivoDe(cuerpo, respuesta.status) }, { status: respuesta.status });
	if (typeof cuerpo?.secret !== 'string' || typeof cuerpo?.llave?.id !== 'string') {
		return json({ mensaje: 'nexus_back respondió sin la llave.' }, { status: 502 });
	}
	return json(
		{ secret: cuerpo.secret, llave: cuerpo.llave },
		{ status: 201, headers: { 'Cache-Control': 'no-store' } }
	);
};
