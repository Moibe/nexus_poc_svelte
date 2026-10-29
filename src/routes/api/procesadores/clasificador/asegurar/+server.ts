/**
 * BFF: `POST /procesadores/clasificador/asegurar` de nexus_back — compara lo que el Classifier de la organización tiene en Document AI
 * con sus tipos activos del registro y lo sincroniza solo si difieren (o lo crea, si todavía no tiene). El front lo llama una vez por
 * sesión, antes de clasificar.
 *
 * Sin cuerpo: todo sale del registro del servidor. El tenant lo fija el servidor desde la sesión (`tenantDe`) y se reenvía el JWT de la
 * persona (HU11), igual que en tipos documentales: cada organización tiene SU clasificador (desde el 2026-10-26). La respuesta
 * (`{ sincronizado, motivo }`) se devuelve tal cual.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/procesadores/clasificador/asegurar?tenant=${encodeURIComponent(tenant)}`), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	}
	return json(cuerpo);
};
