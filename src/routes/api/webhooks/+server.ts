/**
 * BFF: los webhooks del cliente — listarlos (GET) y registrar uno (POST).
 *
 * Los registra y los guarda nexus_back (`/webhooks/`) desde el 2026-10-01;
 * hasta ese día vivían en el `localStorage` de cada navegador. El tenant lo fija
 * el servidor (`TENANT_CLIENTE`), no el navegador, igual que en las API Keys.
 *
 * El POST devuelve el SECRET de firma, una sola vez. Por eso la respuesta lleva
 * `Cache-Control: no-store`, como la de nexus_back: que ni el navegador ni un
 * intermediario la conserven.
 *
 * Todavía no se envía ningún aviso: esto es el registro.
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
		respuesta = await fetch(urlNexus(`/webhooks/?tenant=${encodeURIComponent(TENANT_CLIENTE)}`), {
			headers: cabecerasNexus(),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: motivoDe(cuerpo, respuesta.status) }, { status: respuesta.status });
	return json({ webhooks: Array.isArray(cuerpo?.webhooks) ? cuerpo.webhooks : [] });
};

export const POST: RequestHandler = async ({ request }) => {
	const datos = await request.json().catch(() => null);
	const url = typeof datos?.url === 'string' ? datos.url : '';
	const eventos = Array.isArray(datos?.eventos)
		? datos.eventos.filter((e: unknown): e is string => typeof e === 'string')
		: [];
	if (!url.trim() || eventos.length === 0) {
		return json({ mensaje: 'Faltan la URL o los eventos de suscripción.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/webhooks/'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant: TENANT_CLIENTE, url, eventos }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: motivoDe(cuerpo, respuesta.status) }, { status: respuesta.status });
	if (typeof cuerpo?.secret !== 'string' || typeof cuerpo?.webhook?.id !== 'string') {
		return json({ mensaje: 'nexus_back respondió sin el webhook.' }, { status: 502 });
	}
	return json(
		{ secret: cuerpo.secret, webhook: cuerpo.webhook },
		{ status: 201, headers: { 'Cache-Control': 'no-store' } }
	);
};
