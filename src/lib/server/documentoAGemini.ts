/**
 * Lo que comparten los BFF que mandan un documento de ejemplo a Gemini a través de nexus_back para trabajar con los recuadros de los campos
 * (2026-11-12): completar UN campo desde su recuadro (`describir-campo`), completar varios (`describir-campos`) y proponer uno nuevo desde un
 * recuadro dibujado (`proponer-campo`).
 *
 * Valida el documento (que venga, su tamaño y que sea un documento), toma SOLO los textos que la ruta admite y con su tope, fija el `tenant`
 * desde la sesión (`tenantDe`, nunca del navegador) y reenvía con el JWT de la persona (`cabecerasConSesion`). Lo que dicen esos textos lo
 * valida nexus_back. No guarda nada.
 */

import { json, type RequestEvent } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { rechazarSiNoEsDocumento } from '$lib/server/subidas';
import { cabecerasConSesion } from '$lib/server/sesion';

const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/** Un texto del formulario que la ruta admite: su largo máximo, si es obligatorio y qué mandar si no viene. */
export type TextoAdmitido = { tope: number; requerido?: boolean; porOmision?: string };

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

export async function reenviarDocumentoAGemini(
	{ cookies, locals, request }: Pick<RequestEvent, 'cookies' | 'locals' | 'request'>,
	opciones: {
		/** La ruta de nexus_back, p. ej. `/procesadores/describir-campos`. */
		ruta: string;
		textos: Record<string, TextoAdmitido>;
		/** El mensaje cuando falta un texto obligatorio. */
		faltan: string;
		/** El mensaje cuando nexus_back no contesta a tiempo. */
		tardo: string;
	}
): Promise<Response> {
	const tenant = tenantDe(locals);
	let entrada: FormData;
	try {
		entrada = await request.formData();
	} catch (err) {
		const status = (err as { status?: number } | null)?.status;
		if (status === 413) return fallo('El archivo excede el límite de subida del servidor.', 413);
		return fallo('La petición no traía un formulario válido.', 400);
	}

	const archivo = entrada.get('archivo');
	if (!(archivo instanceof File)) return fallo('Falta el documento de ejemplo.', 400);
	if (archivo.size === 0) return fallo('El archivo llegó vacío.', 400);
	if (archivo.size > MAX_BYTES) return fallo(`El archivo excede el límite de ${MAX_MB} MB.`, 413);
	const noEsDocumento = await rechazarSiNoEsDocumento(archivo);
	if (noEsDocumento) return noEsDocumento;

	const salida = new FormData();
	salida.append('archivo', archivo, archivo.name);
	salida.append('tenant', tenant);
	for (const [nombre, regla] of Object.entries(opciones.textos)) {
		const crudo = entrada.get(nombre);
		const valor = typeof crudo === 'string' ? crudo : '';
		if (valor.length > regla.tope) return fallo('La petición trae datos de más.', 400);
		if (regla.requerido && valor.trim() === '') return fallo(opciones.faltan, 400);
		if (valor !== '') salida.append(nombre, valor);
		else if (regla.porOmision !== undefined) salida.append(nombre, regla.porOmision);
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(opciones.ruta), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(esTimeout ? opciones.tardo : 'No se pudo contactar a nexus_back.', 504);
	}

	const cuerpo = await respuesta.text().catch(() => '');
	if (!respuesta.ok) {
		let mensaje = mensajeDeError(null, respuesta.status);
		try {
			mensaje = mensajeDeError(JSON.parse(cuerpo), respuesta.status);
		} catch {
			/* respuesta no-JSON: se queda el mensaje genérico */
		}
		return fallo(mensaje, respuesta.status);
	}
	try {
		return json(JSON.parse(cuerpo));
	} catch {
		return fallo('nexus_back respondió algo que no es JSON.', 502);
	}
}
