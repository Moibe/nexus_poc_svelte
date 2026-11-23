/**
 * BFF: medir la precisión de un tipo con sus documentos etiquetados (POST) y su historial de mediciones (GET) (2026-11-23, «Ejemplo
 * documental»). Medir vuelve a extraer cada documento etiquetado (hasta 25): cuesta una extracción por documento y tarda. El tenant sale de la
 * sesión.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { ESPERA_MEDIR_MS, pedirANexus, segmento } from '$lib/server/etiquetado';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params, cookies, locals }) => {
	const tipo = segmento(params.id);
	if (!tipo) return json({ mensaje: 'El tipo documental no es válido.' }, { status: 400 });
	return pedirANexus(cookies, `/tipos-documentales/${tipo}/mediciones`, {
		metodo: 'POST',
		cuerpo: { tenant: tenantDe(locals) },
		espera: ESPERA_MEDIR_MS
	});
};

export const GET: RequestHandler = async ({ params, cookies, locals, url }) => {
	const tipo = segmento(params.id);
	if (!tipo) return json({ mensaje: 'El tipo documental no es válido.' }, { status: 400 });
	const limite = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limite') ?? '10', 10) || 10));
	return pedirANexus(cookies, `/tipos-documentales/${tipo}/mediciones?tenant=${encodeURIComponent(tenantDe(locals))}&limite=${limite}`, {
		metodo: 'GET'
	});
};
