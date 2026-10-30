/**
 * BFF: «Generar a partir de un documento» del paso 2 del alta de un tipo documental. Reenvía el documento de ejemplo a
 * `POST /procesadores/generar-campos` de nexus_back, que se lo pasa a Document AI y devuelve los campos que propone (`{ campos }`,
 * ya en la forma del paso 2). No guarda nada: la persona revisa la propuesta y agrega los que quiera.
 *
 * Mismo patrón que `/api/documentos`: el `tenant` NO lo manda el navegador, lo fija el servidor desde la sesión (`tenantDe`), y se
 * reenvía el JWT de la persona para que nexus_back compruebe que su rol administra tipos documentales.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

// Los mismos tres números alineados que el resto de las subidas: el dropzone, este guardia y MAX_SUBIDA_MB en el .env del back.
const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const LIMITE_TEXTO = `${MAX_MB + 5}M`;

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

export const POST: RequestHandler = async ({ cookies, locals, request }) => {
	const tenant = tenantDe(locals);
	let entrada: FormData;
	try {
		entrada = await request.formData();
	} catch (err) {
		// Ver el comentario gemelo en `/api/archivos`.
		const status = (err as { status?: number } | null)?.status;
		if (status === 413) {
			return fallo(
				`El archivo excede el límite de subida del servidor. Súbele BODY_SIZE_LIMIT en el .env del server (hoy debería ser ${LIMITE_TEXTO}).`,
				413
			);
		}
		return fallo('La petición no traía un formulario válido.', 400);
	}

	const archivo = entrada.get('archivo');
	if (!(archivo instanceof File)) return fallo('Falta el documento de ejemplo.', 400);
	if (archivo.size === 0) return fallo('El archivo llegó vacío.', 400);
	if (archivo.size > MAX_BYTES) return fallo(`El archivo excede el límite de ${MAX_MB} MB.`, 413);

	const salida = new FormData();
	salida.append('archivo', archivo, archivo.name);
	salida.append('tenant', tenant);
	// El nombre y la descripción del paso 1, si ya se capturaron: le dan contexto al modelo.
	for (const llave of ['nombre', 'descripcion'] as const) {
		const valor = entrada.get(llave);
		if (typeof valor === 'string' && valor.trim() !== '') salida.append(llave, valor.trim().slice(0, llave === 'nombre' ? 200 : 2000));
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/procesadores/generar-campos'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'Proponer los campos tardó demasiado y se canceló. Intenta de nuevo o prueba con un documento más corto.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	const texto = await respuesta.text().catch(() => '');
	if (!respuesta.ok) {
		let mensaje = mensajeDeError(null, respuesta.status);
		try {
			mensaje = mensajeDeError(JSON.parse(texto), respuesta.status);
		} catch {
			/* respuesta no-JSON: se queda el mensaje genérico */
		}
		return fallo(mensaje, respuesta.status);
	}

	try {
		return json(JSON.parse(texto));
	} catch {
		return fallo('nexus_back respondió algo que no es JSON.', 502);
	}
};
