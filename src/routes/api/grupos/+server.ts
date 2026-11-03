/**
 * BFF: crear (POST) un grupo en la organización de quien pide (2026-11-03).
 *
 * Un grupo es el nivel de arriba de los expedientes: áreas, departamentos, trimestres… como los llame cada organización (`/grupos` en
 * nexus_back). Se crea ANTES de los expedientes y al crear uno se elige a cuál pertenece. Quien crea grupos es quien administra
 * (Administrador y Supervisor): el servidor responde 403 `sin_permiso` a los demás roles, y aquí se reenvía tal cual. El nombre repetido
 * (409 `ya_existe`) viaja con su `codigo` para que la pantalla lo diga bajo el campo. El tenant lo fija el servidor desde la sesión
 * (`tenantDe`), nunca el navegador, y se reenvía el JWT de la persona (HU11).
 *
 * El listado no pasa por aquí: lo pide el `load` de `/configuracion/grupos`. Renombrar y borrar van en `./[id]/+server.ts`.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.nombre !== 'string' || !datos.nombre.trim()) {
		return json({ mensaje: 'Escribe el nombre del grupo.' }, { status: 400 });
	}
	return reenviarANexus(cookies, 'POST', '/grupos/', { tenant: tenantDe(locals), nombre: datos.nombre });
};
