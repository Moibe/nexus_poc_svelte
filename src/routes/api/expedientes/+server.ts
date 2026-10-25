/**
 * BFF: crear (POST) un expediente en la organización de quien pide.
 *
 * Un expediente es la carpeta de UN caso (un paciente, un choque) y es instancia de un tipo de expediente de su misma organización
 * (`tipoId`). Vive por organización en nexus_back (`/expedientes`). Quien crea es quien organiza (Administrador, Supervisor,
 * Analista y Operador): el servidor responde 403 `sin_permiso` a los demás roles y 404 si el tipo no es de esta organización, y aquí
 * se reenvía tal cual. El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador, y se reenvía el JWT de la
 * persona para que nexus_back lo compruebe (HU11).
 *
 * Los listados no pasan por aquí: los piden los `load` de `/expediente`, que ya corren en el servidor con las cookies de la persona.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

const ESPERA_MS = 30_000;

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.nombre !== 'string' || !datos.nombre.trim()) {
		return json({ mensaje: 'Escribe el nombre del expediente.' }, { status: 400 });
	}
	if (typeof datos?.tipoId !== 'string' || !datos.tipoId) {
		return json({ mensaje: 'Elige el tipo de expediente.' }, { status: 400 });
	}
	const tenant = tenantDe(locals);
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/expedientes/'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({ tenant, nombre: datos.nombre, tipoId: datos.tipoId }),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	}
	return json(cuerpo, { status: 201, headers: { 'Cache-Control': 'no-store' } });
};
