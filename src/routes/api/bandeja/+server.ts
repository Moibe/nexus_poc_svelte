/**
 * BFF: lo que está pendiente en la bandeja de preparación porque llegó por la
 * API de clientes (`POST /bandeja/` de nexus_back).
 *
 * La bandeja lo consulta cada pocos segundos (ver `sincronizarEntradasApi` en
 * `bandeja.svelte.ts`). El tenant NO lo manda el navegador: lo fija el
 * servidor (`TENANT_BANDEJA`), para que nadie pueda pedir la bandeja de otro
 * cliente cambiando un parámetro.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TENANT_BANDEJA, TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const GET: RequestHandler = async () => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/bandeja/?tenant=${encodeURIComponent(TENANT_BANDEJA)}`), {
			headers: cabecerasNexus(),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json(
			{ mensaje: typeof cuerpo?.detail === 'string' ? cuerpo.detail : `nexus_back respondió ${respuesta.status}.` },
			{ status: respuesta.status }
		);
	}
	return json({ entradas: Array.isArray(cuerpo?.entradas) ? cuerpo.entradas : [] });
};
