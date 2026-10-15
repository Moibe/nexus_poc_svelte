/**
 * BFF: los tipos documentales de la organización de quien pide — listarlos (GET).
 *
 * Antes la biblioteca de Configuración vivía en el `localStorage` de cada navegador; ahora vive en nexus_back
 * (`/tipos-documentales`), por organización. El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el
 * navegador, y se reenvía el JWT de la persona para que nexus_back lo compruebe (HU11), igual que en llaves y webhooks.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const ESPERA_MS = 30_000;

export const GET: RequestHandler = async ({ cookies, locals }) => {
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/tipos-documentales/?tenant=${encodeURIComponent(tenant)}`), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	return json({ tipos: Array.isArray(cuerpo?.tipos) ? cuerpo.tipos : [] }, { headers: { 'Cache-Control': 'no-store' } });
};
