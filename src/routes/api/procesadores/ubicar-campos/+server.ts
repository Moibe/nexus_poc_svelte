/**
 * BFF: ubicar los campos propuestos sobre un documento de ejemplo (2026-11-11, Moibe: «que a un lado mostremos el documento y marcados
 * etiquetados los campos seleccionados»). Reenvía el documento y la lista de campos (`campos`, JSON `[{nombre, descripcion}]`) a
 * `POST /procesadores/ubicar-campos` de nexus_back, que le pregunta a Gemini dónde está cada uno y devuelve `{ ubicaciones: [{campo, pagina, caja, valor}] }`
 * (caja `[ymin, xmin, ymax, xmax]` de 0 a 1000). Es una ayuda visual: no guarda nada.
 *
 * Mismo patrón que `/api/procesadores/generar-campos`: el `tenant` lo fija el servidor desde la sesión (`tenantDe`) y se reenvía el JWT de la persona.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { rechazarSiNoEsDocumento } from '$lib/server/subidas';
import { cabecerasConSesion } from '$lib/server/sesion';

const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;
/** El tope del back para el JSON de campos. */
const MAX_CAMPOS_TEXTO = 40000;

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

export const POST: RequestHandler = async ({ cookies, locals, request }) => {
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
	const campos = entrada.get('campos');
	if (typeof campos !== 'string' || campos.trim() === '') return fallo('Faltan los campos a ubicar.', 400);
	if (campos.length > MAX_CAMPOS_TEXTO) return fallo('Son demasiados campos.', 400);

	const salida = new FormData();
	salida.append('archivo', archivo, archivo.name);
	salida.append('tenant', tenant);
	salida.append('campos', campos);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/procesadores/ubicar-campos'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(esTimeout ? 'Marcar los campos tardó demasiado y se canceló.' : 'No se pudo contactar a nexus_back.', 504);
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
