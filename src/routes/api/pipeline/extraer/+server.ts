/**
 * BFF: reenvía un documento a `POST /ia/extraer` de nexus_back — la versión
 * GENÉRICA de `/api/pipeline/ine`, que extrae con el Custom Extractor de un
 * tipo documental cualquiera en vez del de INE, que está fijo en el `.env`.
 *
 * Mismo patrón y mismos guardias que `/api/pipeline/ine` (ver ahí los
 * comentarios largos sobre BODY_SIZE_LIMIT y por qué el error de 413 se
 * distingue): lo único que cambia es que además del archivo viaja el
 * `procesador` (y opcionalmente su `version`), que el front saca del tipo
 * documental al que el clasificador mapeó el documento.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

/** Los mismos 20 MB de `/api/pipeline/ine`, por la misma razón: el texto del
 *  dropzone, este guardia y `MAX_SUBIDA_MB` del back tienen que decir lo
 *  mismo, o aparece una franja de archivos que la UI promete y el back
 *  rechaza. */
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
		return fallo('Falta el archivo a procesar.', 400);
	}
	if (archivo.size === 0) {
		return fallo('El archivo llegó vacío.', 400);
	}
	if (archivo.size > MAX_BYTES) {
		return fallo(`El archivo excede el límite de ${MAX_MB} MB.`, 413);
	}

	const procesador = String(entrada.get('procesador') ?? '').trim();
	if (!procesador) {
		// Sin procesador no hay nada que intentar, y el mensaje dice la causa
		// real en vez de dejar que el back responda un 422 más opaco.
		return fallo('Falta el procesador con el que extraer este tipo documental.', 400);
	}

	const salida = new FormData();
	// `imagen` es como lo declara nexus_back; del lado del navegador se llama
	// `archivo` porque ahí ya no siempre es una imagen. Mismo desfase que en
	// `/api/pipeline/ine`.
	salida.append('imagen', archivo, archivo.name);
	salida.append('procesador', procesador);
	const version = String(entrada.get('version') ?? '').trim();
	if (version) salida.append('version', version);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/ia/extraer'), {
			method: 'POST',
			headers: cabecerasNexus(),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'La extracción tardó demasiado y se canceló del lado del navegador.'
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
