/**
 * BFF: reenvía un archivo a `POST /archivos/` de nexus_back, que lo guarda en
 * el almacén y devuelve dónde quedó.
 *
 * Existe para que el catálogo de tipos documentales deje de guardar los BYTES
 * de cada ejemplo dentro de `localStorage`. Una foto de INE de 2 MB ocupaba
 * ahí ~5.3 MB de cuota —base64 infla 4/3 y localStorage cuenta UTF-16 a 2
 * bytes por carácter— así que un solo tipo configurado bastaba para llenarla.
 * Con esto el catálogo guarda un puntero de unos bytes.
 *
 * Mismo patrón que `/api/pipeline/clasificar`: mismo origen (sin CORS), y la
 * dirección real de la API y su llave solo las conoce este handler.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

// Los mismos tres números alineados que el resto de las subidas: el dropzone,
// este guardia, y MAX_SUBIDA_MB en el .env de nexus_back.
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
		// adapter-node aborta el cuerpo ANTES de que este handler lo vea si pesa
		// más que BODY_SIZE_LIMIT, y sin distinguirlo el mensaje culparía al
		// formulario cuando el archivo estaba bien. Ver el comentario gemelo en
		// `/api/pipeline/extraer`, que costó una investigación equivocada.
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
		return fallo('Falta el archivo a guardar.', 400);
	}
	if (archivo.size === 0) {
		return fallo('El archivo llegó vacío.', 400);
	}
	if (archivo.size > MAX_BYTES) {
		return fallo(`El archivo excede el límite de ${MAX_MB} MB.`, 413);
	}

	const tenant = entrada.get('tenant');
	if (typeof tenant !== 'string' || tenant.trim() === '') {
		return fallo('Falta el tenant al que pertenece el archivo.', 400);
	}

	const salida = new FormData();
	salida.append('archivo', archivo, archivo.name);
	salida.append('tenant', tenant.trim());
	// El hash que ya calcula el navegador para detectar duplicados en la Bandeja.
	// Viaja para VERIFICAR la transferencia, no para nombrar el objeto: el back
	// siempre lo recalcula sobre los bytes que de verdad llegaron.
	const sha256 = entrada.get('sha256');
	if (typeof sha256 === 'string' && sha256 !== '') salida.append('sha256', sha256);

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/archivos/'), {
			method: 'POST',
			headers: cabecerasNexus(),
			body: salida,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'La subida tardó demasiado y se canceló del lado del navegador.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	const texto = await respuesta.text().catch(() => '');
	if (!respuesta.ok) {
		// El `detail` de FastAPI se desenvuelve para que el front reciba siempre
		// la misma forma `{mensaje}` que el resto de las rutas de este BFF.
		let mensaje = `nexus_back respondió ${respuesta.status}.`;
		try {
			const cuerpo = JSON.parse(texto);
			if (typeof cuerpo?.detail === 'string') mensaje = cuerpo.detail;
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
