/**
 * BFF: lo que se sabe de un documento (`GET /expedientes/documentos/{id}/datos` de nexus_back): su última clasificación, su última corrida de
 * extracción y sus datos VIGENTES, un renglón por campo (migración 0007). La organización la fija la sesión.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { leerDeNexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const GET: RequestHandler = async ({ params, cookies, locals, url }) => {
	const ruta = `/expedientes/documentos/${encodeURIComponent(params.id ?? '')}/datos?tenant=${encodeURIComponent(tenantDe(locals))}`;
	return json(await leerDeNexus(ruta, { cookies, url }, 'No se pudieron leer los datos del documento.', 'Ese documento no existe.'));
};
