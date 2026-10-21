/**
 * BFF: el front avisa que un documento que llegó por la API terminó, para que
 * nexus_back se lo avise a los webhooks del cliente (ver
 * `$lib/state/avisosWebhook.ts`).
 *
 * El tenant lo fija el servidor, como en el resto de `/webhooks`. nexus_back no
 * le cree a ciegas: comprueba que la entrada sea de ese cliente y haya pasado al
 * pipeline, y acepta un resultado final por entrada.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const texto = (x: unknown): string | null => (typeof x === 'string' && x.trim() !== '' ? x : null);

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	const tipo = texto(datos?.tipo);
	const entradaId = texto(datos?.entradaId);
	if (!tipo || !entradaId) return json({ mensaje: 'Faltan el tipo o la entrada.' }, { status: 400 });

	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/webhooks/eventos'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				tenant,
				tipo,
				entradaId,
				tipoDocumental: texto(datos?.tipoDocumental),
				motivo: texto(datos?.motivo)
			}),
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
