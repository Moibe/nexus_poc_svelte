/**
 * BFF: abrir una ejecución del historial (GET): sus valores finales, cómo salió cada regla y de qué documentos se tomó cada dato (2026-11-03).
 *
 * El historial es una foto inmutable: aquí solo se LEE, y nexus_back no tiene ninguna ruta que lo edite o lo borre. Una ejecución de otra
 * organización o que no existe contesta 404, sin distinguir (HU11). El tenant lo fija el servidor desde la sesión.
 */

import { json } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';
import type { RequestHandler } from './$types';

const ESPERA_MS = 30_000;

export const GET: RequestHandler = async ({ cookies, locals, params }) => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/ejecuciones/${encodeURIComponent(params.id)}?tenant=${encodeURIComponent(tenantDe(locals))}`), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
