/**
 * BFF: reenvía la sincronización del Classifier a
 * `POST /procesadores/clasificador/sincronizar` de nexus_back, que crea (la
 * primera vez) o actualiza el ÚNICO Custom Document Classifier del sistema
 * con un EntityType por cada tipo documental ACTIVO.
 *
 * Desde el 2026-10-15 NO lleva cuerpo: nexus_back arma las categorías con los
 * tipos activos de TODAS las organizaciones, leídos de su propio registro
 * (antes los mandaba cada navegador desde su localStorage, y el último que
 * sincronizaba pisaba a los demás). Por eso lo que cambió de estado tiene que
 * estar guardado ANTES de llamar aquí.
 *
 * Mismo patrón que /api/procesadores/activar: el navegador pega aquí (mismo
 * origen) y esta capa agrega la llave. La respuesta se devuelve tal cual.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

export const POST: RequestHandler = async () => {
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/procesadores/clasificador/sincronizar'), {
			method: 'POST',
			headers: cabecerasNexus(),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'La sincronización tardó demasiado y se canceló. El clasificador puede haberse actualizado igual: reintentar es seguro.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	let texto: string;
	try {
		texto = await respuesta.text();
	} catch {
		return fallo('La conexión con la API se cortó a media respuesta.', 502);
	}

	let datos: Record<string, unknown>;
	try {
		datos = JSON.parse(texto);
	} catch {
		return fallo(`La API devolvió algo que no es JSON (HTTP ${respuesta.status}).`, 502);
	}

	if (!respuesta.ok) {
		const detalle = typeof datos.detail === 'string' ? datos.detail : `HTTP ${respuesta.status}`;
		return fallo(detalle, respuesta.status);
	}

	return json(datos);
};
