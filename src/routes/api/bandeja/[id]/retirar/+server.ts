/**
 * BFF: saca de la bandeja una entrada que llegó por la API, porque pasó al
 * pipeline o porque se descartó — para que no reaparezca en la siguiente
 * consulta ni al refrescar. El archivo NO se borra del almacén.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, tenantDe, urlNexus } from '$lib/server/nexus';

const MOTIVOS = new Set(['pipeline', 'descartado']);

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const id = params.id ?? '';
	const datos = await request.json().catch(() => null);
	const motivo = typeof datos?.motivo === 'string' ? datos.motivo : '';
	if (!id || !MOTIVOS.has(motivo)) {
		return json({ mensaje: 'Falta la entrada o el motivo (pipeline | descartado).' }, { status: 400 });
	}

	const cuerpo = new FormData();
	cuerpo.append('tenant', tenantDe(locals));
	cuerpo.append('motivo', motivo);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/bandeja/${encodeURIComponent(id)}/retirar`), {
			method: 'POST',
			headers: cabecerasNexus(),
			body: cuerpo,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const respuestaJson = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json(
			{ mensaje: typeof respuestaJson?.detail === 'string' ? respuestaJson.detail : `nexus_back respondió ${respuesta.status}.` },
			{ status: respuesta.status }
		);
	}
	return json({ retirada: true });
};
