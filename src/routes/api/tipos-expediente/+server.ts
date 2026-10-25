/**
 * BFF: dar de alta (POST) un tipo de expediente en la organización de quien pide.
 *
 * Un tipo de expediente es la clase de la que salen los expedientes («expediente médico», «expediente de un choque»); vive por
 * organización en nexus_back (`/tipos-expediente`). Quien crea tipos es quien administra (Administrador y Supervisor): el servidor
 * responde 403 `sin_permiso` a los demás roles, y aquí se reenvía tal cual. El tenant lo fija el servidor desde la sesión
 * (`tenantDe`), nunca el navegador, y se reenvía el JWT de la persona para que nexus_back lo compruebe (HU11).
 *
 * El listado no pasa por aquí: lo pide el `load` de `/expediente`, que ya corre en el servidor con las cookies de la persona.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const ESPERA_MS = 30_000;

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.nombre !== 'string' || !datos.nombre.trim()) {
		return json({ mensaje: 'Escribe el nombre del tipo de expediente.' }, { status: 400 });
	}
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/tipos-expediente/'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, nombre: datos.nombre }),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		// `ya_existe` (409) es el nombre repetido: la pantalla lo dice con sus palabras, así que viaja el código además del texto.
		const detalle = (cuerpo as { detail?: { codigo?: unknown } } | null)?.detail;
		return json(
			{ mensaje: mensajeDeError(cuerpo, respuesta.status), codigo: typeof detalle?.codigo === 'string' ? detalle.codigo : undefined },
			{ status: respuesta.status }
		);
	}
	return json(cuerpo, { status: 201, headers: { 'Cache-Control': 'no-store' } });
};
