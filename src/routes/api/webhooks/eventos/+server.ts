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

import { TENANT_CLIENTE, TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

const texto = (x: unknown): string | null => (typeof x === 'string' && x.trim() !== '' ? x : null);

export const POST: RequestHandler = async ({ request }) => {
	const datos = await request.json().catch(() => null);
	const tipo = texto(datos?.tipo);
	const entradaId = texto(datos?.entradaId);
	if (!tipo || !entradaId) return json({ mensaje: 'Faltan el tipo o la entrada.' }, { status: 400 });

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/webhooks/eventos'), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				tenant: TENANT_CLIENTE,
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
		const detalle = cuerpo?.detail;
		return json(
			{ mensaje: typeof detalle === 'string' ? detalle : `nexus_back respondió ${respuesta.status}.` },
			{ status: respuesta.status }
		);
	}
	return json(cuerpo);
};
