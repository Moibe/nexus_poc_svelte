/**
 * BFF: guardar (PUT) o quitar (DELETE) las etiquetas de UN documento de ejemplo de un tipo (2026-11-23, «Ejemplo documental»). El PUT lleva
 * `{ campos, base }`: por campo el valor correcto (o null si no aparece en el documento) y lo que devolvió `leer` en `base`. El tenant sale de
 * la sesión.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { pedirANexus, segmento } from '$lib/server/etiquetado';
import { tenantDe } from '$lib/server/nexus';

export const PUT: RequestHandler = async ({ params, cookies, locals, request }) => {
	const tipo = segmento(params.id);
	const ejemplo = segmento(params.ejemplo);
	if (!tipo || !ejemplo) return json({ mensaje: 'El tipo o el documento de ejemplo no es válido.' }, { status: 400 });
	const datos = await request.json().catch(() => null);
	if (!Array.isArray(datos?.campos)) return json({ mensaje: 'Faltan las etiquetas del documento.' }, { status: 400 });
	const base = typeof datos.base === 'string' && datos.base ? datos.base : null;
	return pedirANexus(cookies, `/tipos-documentales/${tipo}/ejemplos/${ejemplo}/etiquetas`, {
		metodo: 'PUT',
		cuerpo: { tenant: tenantDe(locals), campos: datos.campos, base }
	});
};

export const DELETE: RequestHandler = async ({ params, cookies, locals }) => {
	const tipo = segmento(params.id);
	const ejemplo = segmento(params.ejemplo);
	if (!tipo || !ejemplo) return json({ mensaje: 'El tipo o el documento de ejemplo no es válido.' }, { status: 400 });
	return pedirANexus(cookies, `/tipos-documentales/${tipo}/ejemplos/${ejemplo}/etiquetas?tenant=${encodeURIComponent(tenantDe(locals))}`, {
		metodo: 'DELETE'
	});
};
