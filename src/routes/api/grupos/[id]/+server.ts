/**
 * BFF: renombrar (PATCH) y borrar (DELETE) un grupo de la organización de quien pide (2026-11-03).
 *
 * Renombrar deja el `id`: los expedientes del grupo ven el nombre nuevo sin tocarlos. Borrar solo se puede si el grupo NO tiene expedientes:
 * un expediente con grupo no puede quedarse sin él (409 `con_expedientes`, con cuántos). Quien lo hace es quien administra (Administrador y
 * Supervisor): el servidor responde 403 `sin_permiso` a los demás roles y 404 si el grupo no es de esta organización (igual que uno que no
 * existe), y aquí se reenvía tal cual, con el `codigo` cuando lo trae (`ya_existe`, `con_expedientes`) para que la pantalla lo diga con sus
 * palabras. El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador, y se reenvía el JWT de la persona (HU11).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

const rutaDelGrupo = (id: string | undefined) => `/grupos/${encodeURIComponent(id ?? '')}`;

export const PATCH: RequestHandler = async ({ cookies, request, locals, params }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.nombre !== 'string' || !datos.nombre.trim()) {
		return json({ mensaje: 'Escribe el nombre del grupo.' }, { status: 400 });
	}
	return reenviarANexus(cookies, 'PATCH', rutaDelGrupo(params.id), { tenant: tenantDe(locals), nombre: datos.nombre });
};

export const DELETE: RequestHandler = async ({ cookies, locals, params }) => {
	return reenviarANexus(cookies, 'DELETE', `${rutaDelGrupo(params.id)}?tenant=${encodeURIComponent(tenantDe(locals))}`);
};
