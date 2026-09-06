/**
 * BFF: reenvía un documento a `POST /ia/clasificar` de nexus_back.
 *
 * Mismo patrón que `/api/pipeline/ine` (mismo origen, sin CORS, la dirección
 * real de la API solo la conoce este handler). Se llama ANTES de `/ine` en el
 * pipeline: primero se clasifica a qué tipo documental pertenece el
 * documento, y solo si corresponde a INE se manda al extractor.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

// Mismos tres números alineados que `/api/pipeline/ine` (ver el comentario
// gemelo ahí): el dropzone de Figma, este guardia, y MAX_SUBIDA_MB en el .env
// de nexus_back.
const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const LIMITE_TEXTO = `${MAX_MB + 5}M`;

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

export const POST: RequestHandler = async ({ request }) => {
	let entrada: FormData;
	try {
		entrada = await request.formData();
	} catch (err) {
		// Ver el comentario gemelo en `/api/pipeline/ine`: adapter-node aborta el
		// cuerpo ANTES de que este handler lo vea si pesa más que
		// BODY_SIZE_LIMIT, y sin distinguir esto el mensaje culpa al formulario
		// cuando el archivo estaba bien.
		const status = (err as { status?: number } | null)?.status;
		if (status === 413) {
			return fallo(
				`El archivo excede el límite de subida del servidor. ` +
					`Súbele BODY_SIZE_LIMIT en el .env del server (hoy debería ser ${LIMITE_TEXTO}).`,
				413
			);
		}
		return fallo('La petición no traía un formulario válido.', 400);
	}

	const archivo = entrada.get('archivo');
	if (!(archivo instanceof File)) {
		return fallo('Falta el archivo a clasificar.', 400);
	}
	if (archivo.size === 0) {
		return fallo('El archivo llegó vacío.', 400);
	}
	if (archivo.size > MAX_BYTES) {
		return fallo(`El archivo excede el límite de ${MAX_MB} MB.`, 413);
	}

	const salida = new FormData();
	salida.append('archivo', archivo, archivo.name);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/ia/clasificar'), {
			method: 'POST',
			headers: cabecerasNexus(),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'La clasificación tardó demasiado y se canceló del lado del navegador.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	let texto: string;
	try {
		texto = await respuesta.text();
	} catch {
		return fallo('nexus_back cortó la conexión antes de mandar la respuesta.', 502);
	}

	let cuerpo: unknown;
	try {
		cuerpo = JSON.parse(texto);
	} catch {
		return fallo(
			`nexus_back respondió ${respuesta.status} con algo que no es JSON.`,
			respuesta.ok ? 502 : respuesta.status
		);
	}

	if (!respuesta.ok) {
		const detalle =
			typeof cuerpo === 'object' && cuerpo !== null && 'detail' in cuerpo
				? String((cuerpo as { detail: unknown }).detail)
				: `nexus_back respondió ${respuesta.status}.`;
		return fallo(detalle, respuesta.status);
	}

	return json(cuerpo);
};
