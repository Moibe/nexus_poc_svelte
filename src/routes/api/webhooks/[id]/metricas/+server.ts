/**
 * BFF: métricas de entregas de un webhook en un periodo. `desde` y `hasta` son
 * dos instantes ISO 8601 con zona, `[desde, hasta)`, igual que en las API Keys
 * (ver `$lib/metricas/periodo`).
 *
 * HOY CONTESTA SIEMPRE VACÍO, y es lo verdadero: todavía no hay backend que
 * envíe webhooks, así que no existe ninguna entrega que contar (ver el
 * docstring de `$lib/state/webhooks.svelte.ts`). El formato ya es el
 * definitivo; el día que exista el backend este archivo pasa a reenviar a
 * nexus_back —como `/api/llaves/[id]/metricas`— y la pantalla no cambia.
 *
 * Existe ya, y no como un valor fijo dentro del componente, para que la costura
 * quede donde va y para poder probar la pantalla con cifras (interceptando esta
 * ruta) sin tocar el código.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { periodoValido } from '$lib/metricas/periodo';

const SIN_ENTREGAS = {
	solicitudes: 0,
	errores: 0,
	tasaError: null,
	p50Ms: null,
	p90Ms: null,
	p99Ms: null
};

export const GET: RequestHandler = ({ params, url }) => {
	const id = params.id ?? '';
	const desde = url.searchParams.get('desde') ?? '';
	const hasta = url.searchParams.get('hasta') ?? '';
	if (!id || !periodoValido(desde, hasta)) {
		return json(
			{ mensaje: 'Faltan el webhook o el periodo (desde y hasta, instantes ISO 8601 con zona, el fin después del inicio).' },
			{ status: 400 }
		);
	}
	return json(
		{ desde, hasta, actual: SIN_ENTREGAS, anterior: SIN_ENTREGAS },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
