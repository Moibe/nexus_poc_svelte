/**
 * BFF: las etiquetas de los documentos de ejemplo de un tipo (2026-11-23, «Ejemplo documental»). Solo las de los documentos que el tipo
 * todavía tiene. El tenant sale de la sesión.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { pedirANexus, segmento } from '$lib/server/etiquetado';
import { tenantDe } from '$lib/server/nexus';

export const GET: RequestHandler = async ({ params, cookies, locals }) => {
	const tipo = segmento(params.id);
	if (!tipo) return json({ mensaje: 'El tipo documental no es válido.' }, { status: 400 });
	return pedirANexus(cookies, `/tipos-documentales/${tipo}/etiquetas?tenant=${encodeURIComponent(tenantDe(locals))}`, { metodo: 'GET' });
};
