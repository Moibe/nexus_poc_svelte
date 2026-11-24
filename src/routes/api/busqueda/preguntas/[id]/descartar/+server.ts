/**
 * BFF: quitar una respuesta de «Por revisar» sin aprobarla como ejemplo (NEX-609, 2026-11-23). Solo quien administra la organización: lo exige
 * `guardia-de-rutas.ts` antes de llegar aquí y lo vuelve a exigir nexus_back (`POST /busqueda/preguntas/{id}/descartar`).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { esIdDePregunta } from '$lib/busqueda/busqueda';
import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params, cookies, locals }) => {
	if (!esIdDePregunta(params.id)) return json({ mensaje: 'Esa pregunta no existe.' }, { status: 404 });
	return reenviarANexus(cookies, 'POST', `/busqueda/preguntas/${params.id}/descartar`, { tenant: tenantDe(locals) });
};
