/**
 * BFF: registra como DOCUMENTO de la organización lo que la persona carga a mano en el Pipeline: reenvía el archivo a
 * `POST /expedientes/documentos` de nexus_back, que guarda los bytes en el almacén y anota el documento con `canal: MANUAL`.
 *
 * Es lo que hace que «Archivos procesados» muestre también lo que se cargó a mano, y que siga ahí al recargar la página: lo que
 * llega por la API ya nace como documento en el servidor; lo que se carga aquí vivía solo en la memoria del navegador.
 *
 * Mismo patrón que `/api/archivos`: el `tenant` NO lo manda el navegador, lo fija el servidor desde la sesión (`tenantDe`), y se
 * reenvía el JWT de la persona para que nexus_back compruebe que puede escribir ahí (HU11).
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
		// Ver el comentario gemelo en `/api/archivos`: adapter-node aborta el cuerpo antes de que este handler lo vea si pesa más
		// que BODY_SIZE_LIMIT, y sin distinguirlo el mensaje culparía al formulario cuando el archivo estaba bien.
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
	if (!(archivo instanceof File)) return fallo('Falta el archivo a registrar.', 400);
	if (archivo.size === 0) return fallo('El archivo llegó vacío.', 400);
	if (archivo.size > MAX_BYTES) return fallo(`El archivo excede el límite de ${MAX_MB} MB.`, 413);

	const salida = new FormData();
	salida.append('archivo', archivo, archivo.name);
	salida.append('tenant', tenant);
	// El hash que ya calcula el navegador para detectar duplicados: viaja para VERIFICAR la transferencia, no para nombrar el objeto.
	const sha256 = entrada.get('sha256');
	if (typeof sha256 === 'string' && sha256 !== '') salida.append('sha256', sha256);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/expedientes/documentos'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'El registro del documento tardó demasiado y se canceló del lado del navegador.'
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
		return json(JSON.parse(texto), { status: 201 });
	} catch {
		return fallo('nexus_back respondió algo que no es JSON.', 502);
	}
};
