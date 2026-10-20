/**
 * BFF: los procesos del motor de reglas de la organización de quien pide — listarlos (GET).
 *
 * Un proceso es un conjunto de reglas que corre sobre un expediente; aquí vive su dibujo (nodos y cables del lienzo), por
 * organización, en nexus_back (`/procesos`). El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador, y se
 * reenvía el JWT de la persona para que nexus_back lo compruebe (HU11), igual que en los tipos documentales.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const ESPERA_MS = 30_000;

export const GET: RequestHandler = async ({ cookies, locals }) => {
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/procesos/?tenant=${encodeURIComponent(tenant)}`), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	return json({ procesos: Array.isArray(cuerpo?.procesos) ? cuerpo.procesos : [] }, { headers: { 'Cache-Control': 'no-store' } });
};
