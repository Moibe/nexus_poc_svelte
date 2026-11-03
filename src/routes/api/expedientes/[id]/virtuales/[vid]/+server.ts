/**
 * BFF: borrar (DELETE) un expediente virtual (2026-10-29). Borra el grupito, NO sus documentos: siguen en el expediente. nexus_back
 * responde 404 si no es de aquí y 403 a los roles que no organizan; aquí se reenvía tal cual. El tenant lo fija el servidor (HU11).
 */

import type { RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const DELETE: RequestHandler = async ({ cookies, locals, params }) => {
	const ruta = `/expedientes/${encodeURIComponent(params.id ?? '')}/virtuales/${encodeURIComponent(params.vid ?? '')}?tenant=${encodeURIComponent(tenantDe(locals))}`;
	return reenviarANexus(cookies, 'DELETE', ruta);
};
