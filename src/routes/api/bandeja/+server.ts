/**
 * BFF: lo que está pendiente en la bandeja de preparación porque llegó por la
 * API de clientes (`POST /bandeja/` de nexus_back).
 *
 * La bandeja lo consulta cada pocos segundos (ver `sincronizarEntradasApi` en
 * `bandeja.svelte.ts`). El tenant NO lo manda el navegador: lo fija el
 * servidor, desde la organización de la sesión (`tenantDe`), para que nadie pueda pedir la bandeja de otro
 * cliente cambiando un parámetro.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, tenantDe, urlNexus } from '$lib/server/nexus';

export const GET: RequestHandler = async ({ locals }) => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/bandeja/?tenant=${encodeURIComponent(tenantDe(locals))}`), {
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
