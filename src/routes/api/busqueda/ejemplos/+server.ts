/**
 * BFF: aprobar una respuesta como EJEMPLO de la organización (NEX-609, 2026-11-23). Desde la siguiente pregunta, la búsqueda de esa organización (y solo
 * de esa) lo usa, y la misma pregunta reusa su consulta sin preguntarle al modelo. Solo quien administra la organización (`guardia-de-rutas.ts` y,
 * otra vez, nexus_back: `POST /busqueda/ejemplos`). Los 404/409 (`no_valorable`, `ya_es_ejemplo`) se reenvían con su mensaje y su código.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { esIdDePregunta } from '$lib/busqueda/busqueda';
import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	if (!esIdDePregunta(datos?.preguntaId)) return json({ mensaje: 'Esa pregunta no existe.' }, { status: 404 });
	return reenviarANexus(cookies, 'POST', '/busqueda/ejemplos', { tenant: tenantDe(locals), preguntaId: datos.preguntaId });
};
