/**
 * BFF: métricas de consumo de una API Key en un periodo. `desde` y `hasta` son
 * dos instantes ISO 8601 con zona, `[desde, hasta)` (ver `$lib/metricas/periodo`
 * para el porqué: fechas sueltas dejaban fuera lo de la tarde-noche). El tenant
 * lo fija el servidor, como en el resto de `/llaves`.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { periodoValido } from '$lib/metricas/periodo';
import { TENANT_CLIENTE, TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const GET: RequestHandler = async ({ params, url }) => {
	const id = params.id ?? '';
	const desde = url.searchParams.get('desde') ?? '';
	const hasta = url.searchParams.get('hasta') ?? '';
	if (!id || !periodoValido(desde, hasta)) {
		return json(
			{ mensaje: 'Faltan la llave o el periodo (desde y hasta, instantes ISO 8601 con zona, el fin después del inicio).' },
			{ status: 400 }
		);
	}

	let respuesta: Response;
	try {
		const q = new URLSearchParams({ tenant: TENANT_CLIENTE, desde, hasta });
		respuesta = await fetch(urlNexus(`/llaves/${encodeURIComponent(id)}/metricas?${q}`), {
			headers: cabecerasNexus(),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = cuerpo?.detail;
		return json(
			{ mensaje: typeof detalle === 'string' ? detalle : `nexus_back respondió ${respuesta.status}.` },
			{ status: respuesta.status }
		);
	}
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
