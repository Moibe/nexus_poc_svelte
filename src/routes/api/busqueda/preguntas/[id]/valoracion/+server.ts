/**
 * BFF: «¿Te sirvió?» sobre una respuesta de la búsqueda (NEX-609, 2026-11-23). Reenvía `{util}` a nexus_back
 * (`POST /busqueda/preguntas/{id}/valoracion`) con el tenant de la sesión y el JWT de la persona: el back solo deja valorar lo PROPIO y lo que salió bien
 * (404 o 409, que se reenvían tal cual con su mensaje). Cualquier rol.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { esIdDePregunta } from '$lib/busqueda/busqueda';
import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params, cookies, request, locals }) => {
	if (!esIdDePregunta(params.id)) return json({ mensaje: 'Esa pregunta no existe.' }, { status: 404 });
	const datos = await request.json().catch(() => null);
	if (typeof datos?.util !== 'boolean') return json({ mensaje: 'Di si te sirvió o no.' }, { status: 400 });
	return reenviarANexus(cookies, 'POST', `/busqueda/preguntas/${params.id}/valoracion`, { tenant: tenantDe(locals), util: datos.util });
};
