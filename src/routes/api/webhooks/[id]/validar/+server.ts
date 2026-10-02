/**
 * BFF: valida la conexión de un webhook. nexus_back le manda al endpoint un
 * aviso de prueba firmado y lo da por validado si responde 2xx.
 *
 * Que el endpoint no responda bien NO es un error de esta ruta: contesta 200 con
 * `validado: false` y el motivo, que la pantalla muestra en la tarjeta. Los
 * errores son lo demás (no existe, demasiados intentos, el back no contesta).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TENANT_CLIENTE, TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ params }) => {
	const id = params.id ?? '';
	if (!id) return json({ mensaje: 'Falta el webhook.' }, { status: 400 });

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/webhooks/${encodeURIComponent(id)}/validar`), {
			method: 'POST',
			headers: cabecerasNexus({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant: TENANT_CLIENTE }),
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
	if (cuerpo?.validado === true) return json({ validado: true, webhook: cuerpo.webhook ?? null });
	return json({
		validado: false,
		motivo: typeof cuerpo?.motivo === 'string' ? cuerpo.motivo : 'El endpoint no respondió como se esperaba.',
		codigo: typeof cuerpo?.codigo === 'number' ? cuerpo.codigo : null,
		intentos: typeof cuerpo?.intentos === 'number' ? cuerpo.intentos : null,
		webhook: cuerpo?.webhook ?? null
	});
};
