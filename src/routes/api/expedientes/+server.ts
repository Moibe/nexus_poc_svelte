/**
 * BFF: crear (POST) un expediente en la organización de quien pide.
 *
 * Un expediente es la carpeta de un cliente o de un caso, un receptáculo de documentos; desde el 2026-10-29 no tiene tipo (lo tienen
 * sus expedientes virtuales), así que solo viaja el `nombre`. Vive por organización en nexus_back (`/expedientes`). Quien crea es quien
 * organiza (Administrador, Supervisor, Analista y Operador): el servidor responde 403 `sin_permiso` a los demás roles, y aquí se
 * reenvía tal cual. El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador, y se reenvía el JWT de la persona
 * para que nexus_back lo compruebe (HU11).
 *
 * Los listados no pasan por aquí: los piden los `load` de `/expediente`, que ya corren en el servidor con las cookies de la persona.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.nombre !== 'string' || !datos.nombre.trim()) {
		return json({ mensaje: 'Escribe el nombre del expediente.' }, { status: 400 });
	}
	return reenviarANexus(cookies, 'POST', '/expedientes/', { tenant: tenantDe(locals), nombre: datos.nombre });
};
