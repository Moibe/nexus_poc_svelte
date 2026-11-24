/**
 * BFF: quitar un ejemplo aprobado de la organización (NEX-609, 2026-11-23). Deja de usarse desde la siguiente pregunta. Solo quien administra la
 * organización (`guardia-de-rutas.ts` y nexus_back: `DELETE /busqueda/ejemplos/{id}`).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { esIdDeEjemplo } from '$lib/busqueda/busqueda';
import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const DELETE: RequestHandler = async ({ params, cookies, locals }) => {
	if (!esIdDeEjemplo(params.id)) return json({ mensaje: 'Ese ejemplo no existe.' }, { status: 404 });
	return reenviarANexus(cookies, 'DELETE', `/busqueda/ejemplos/${params.id}?tenant=${encodeURIComponent(tenantDe(locals))}`);
};
