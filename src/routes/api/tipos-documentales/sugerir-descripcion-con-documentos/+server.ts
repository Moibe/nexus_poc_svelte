/**
 * BFF: «Sugerir descripción» CON documentos de ejemplo (2026-11-07, Moibe: «va», sobre usar los ejemplos también para sugerir la descripción). Reenvía el nombre del tipo y
 * de 1 a 3 documentos a `POST /tipos-documentales/sugerir-descripcion-con-documentos` de nexus_back, que se los pasa a Gemini (Vertex AI) para que describa lo que de
 * verdad traen, y devuelve `{ descripcion, modelo, documentos }`. No guarda nada —ni la descripción ni los documentos—: la persona revisa el texto antes de usarlo.
 *
 * Mismas reglas que la sugerencia sin documentos (`../sugerir-descripcion`): el `tenant` lo fija el servidor desde la sesión y se reenvía el JWT para que nexus_back
 * compruebe el rol (el que edita tipos); el guardia de rutas le pone el mismo tope de frecuencia (cada llamada cuesta, y con documentos cuesta más). Los textos de
 * 400, 413, 429, 502 y 503 de nexus_back están escritos para mostrarse tal cual y se pasan tal cual; los demás 5xx siguen escondidos (NEX-567).
 *
 * Gemini solo lee PDF, JPG y PNG (el TIFF que sí acepta Document AI, no) y la petición lleva los documentos EN el cuerpo: por eso son 3 como máximo y 18 MB entre todos.
 * Aquí se revisan la firma de cada archivo (no su nombre ni lo que dijo el navegador, NEX-563) y esos topes antes de molestar al back.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { rechazarSiNoEsDocumento } from '$lib/server/subidas';
import { cabecerasConSesion } from '$lib/server/sesion';

const MAX_DOCUMENTOS = 3;
const MAX_BYTES_TOTAL = 18 * 1024 * 1024;
const MAX_NOMBRE = 200;
const FORMATOS = new Set(['application/pdf', 'image/jpeg', 'image/png']);
/** Los estados cuyo texto el back escribió para mostrarse tal cual. */
const CON_TEXTO_PROPIO = new Set([400, 413, 429, 502, 503]);

const fallo = (mensaje: string, status: number) => json({ mensaje }, { status });

export const POST: RequestHandler = async ({ cookies, locals, request }) => {
	let entrada: FormData;
	try {
		entrada = await request.formData();
	} catch (err) {
		const status = (err as { status?: number } | null)?.status;
		if (status === 413) return fallo('Los documentos pesan demasiado: entre todos, a lo más 18 MB.', 413);
		return fallo('La petición no traía un formulario válido.', 400);
	}

	const nombre = typeof entrada.get('nombre') === 'string' ? String(entrada.get('nombre')).trim() : '';
	if (nombre === '') return fallo('Escribe primero el nombre del tipo documental.', 400);
	const tipoId = String(entrada.get('tipoId') ?? '').trim();

	const archivos = entrada.getAll('archivos').filter((a): a is File => a instanceof File);
	if (archivos.length === 0) return fallo('Elige al menos un documento de ejemplo.', 400);
	if (archivos.length > MAX_DOCUMENTOS) return fallo(`Son demasiados documentos: elige hasta ${MAX_DOCUMENTOS}.`, 400);
	let total = 0;
	for (const archivo of archivos) {
		if (archivo.size === 0) return fallo(`«${archivo.name}» llegó vacío.`, 400);
		if (!FORMATOS.has(archivo.type)) return fallo('Para sugerir la descripción con documentos usa PDF, JPG o PNG.', 400);
		total += archivo.size;
		const noEsDocumento = await rechazarSiNoEsDocumento(archivo);
		if (noEsDocumento) return noEsDocumento;
	}
	if (total > MAX_BYTES_TOTAL) return fallo('Los documentos pesan demasiado: entre todos, a lo más 18 MB.', 413);

	const salida = new FormData();
	salida.append('tenant', tenantDe(locals));
	salida.append('nombre', nombre.slice(0, MAX_NOMBRE));
	if (tipoId) salida.append('tipoId', tipoId);
	for (const archivo of archivos) salida.append('archivos', archivo, archivo.name);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/tipos-documentales/sugerir-descripcion-con-documentos'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies),
			body: salida,
			// Por encima de los 30 s que nexus_back le espera a Gemini, con holgura para subir los documentos y listar los tipos.
			signal: AbortSignal.timeout(Math.max(TIMEOUT_MS, 60_000))
		});
	} catch {
		return fallo('No se pudo generar la sugerencia. Intenta de nuevo o escribe la descripción a mano.', 504);
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = (cuerpo as { detail?: unknown } | null)?.detail;
		const mensaje = CON_TEXTO_PROPIO.has(respuesta.status) && typeof detalle === 'string' ? detalle : mensajeDeError(cuerpo, respuesta.status);
		return fallo(mensaje, respuesta.status);
	}
	const descripcion = (cuerpo as { descripcion?: unknown } | null)?.descripcion;
	if (typeof descripcion !== 'string' || descripcion.trim() === '') {
		return fallo('El servidor no devolvió una descripción. Intenta de nuevo o escríbela a mano.', 502);
	}
	const { modelo, documentos } = cuerpo as { modelo?: unknown; documentos?: unknown };
	return json({ descripcion, modelo, documentos }, { headers: { 'Cache-Control': 'no-store' } });
};
