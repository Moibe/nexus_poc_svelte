/**
 * BFF: proponer la descripción de un campo a partir de su recuadro sobre un documento de ejemplo (2026-11-11, Moibe: «sí, excelente, por favor
 * la 1»). Mover o dibujar el recuadro no cambia el esquema; la DESCRIPCIÓN del campo sí es lo que lee el extractor. Reenvía el documento, el campo
 * (`campo`, JSON `{nombre, tipoDato, descripcion}`), la `pagina`, la `caja` (JSON `[ymin, xmin, ymax, xmax]` de 0 a 1000) y, si vienen, el nombre y
 * la descripción del tipo a `POST /procesadores/describir-campo` de nexus_back, que devuelve `{ descripcion, valor }`. No guarda nada.
 *
 * Mismo patrón que `/api/procesadores/ubicar-campos`: el `tenant` lo fija el servidor desde la sesión (`tenantDe`) y se reenvía el JWT de la persona.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { rechazarSiNoEsDocumento } from '$lib/server/subidas';
import { cabecerasConSesion } from '$lib/server/sesion';

const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

/** Un texto del formulario, o `''` si no vino; `null` si se pasa de largo. */
function texto(entrada: FormData, nombre: string, tope: number): string | null {
	const v = entrada.get(nombre);
	if (typeof v !== 'string') return '';
	return v.length > tope ? null : v;
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
	const campo = texto(entrada, 'campo', 2000);
	const caja = texto(entrada, 'caja', 200);
	const pagina = texto(entrada, 'pagina', 6);
	const nombreTipo = texto(entrada, 'nombreTipo', 200);
	const descripcionTipo = texto(entrada, 'descripcionTipo', 2000);
	if (!campo || !caja) return fallo('Faltan el campo o su recuadro.', 400);
	if (pagina === null || nombreTipo === null || descripcionTipo === null) return fallo('La petición trae datos de más.', 400);

	const salida = new FormData();
	salida.append('archivo', archivo, archivo.name);
	salida.append('tenant', tenant);
	salida.append('campo', campo);
	salida.append('caja', caja);
	salida.append('pagina', pagina || '1');
	if (nombreTipo) salida.append('nombreTipo', nombreTipo);
	if (descripcionTipo) salida.append('descripcionTipo', descripcionTipo);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/procesadores/describir-campo'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(esTimeout ? 'Sugerir la descripción tardó demasiado y se canceló.' : 'No se pudo contactar a nexus_back.', 504);
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
};
