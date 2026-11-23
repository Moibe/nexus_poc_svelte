/**
 * BFF: leer UN documento de ejemplo de un tipo para etiquetarlo (2026-11-23, «Ejemplo documental»). nexus_back lo extrae con la definición
 * actual del tipo y devuelve campo por campo lo que se leyó, con su caja. Cuesta una extracción de Document AI. El tenant sale de la sesión.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { ESPERA_LEER_MS, pedirANexus, segmento } from '$lib/server/etiquetado';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params, cookies, locals }) => {
	const tipo = segmento(params.id);
	const ejemplo = segmento(params.ejemplo);
	if (!tipo || !ejemplo) return json({ mensaje: 'El tipo o el documento de ejemplo no es válido.' }, { status: 400 });
	return pedirANexus(cookies, `/tipos-documentales/${tipo}/ejemplos/${ejemplo}/leer`, {
		metodo: 'POST',
		cuerpo: { tenant: tenantDe(locals) },
		espera: ESPERA_LEER_MS
	});
};
