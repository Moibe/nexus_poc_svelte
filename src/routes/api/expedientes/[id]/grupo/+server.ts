/**
 * BFF: asignar un expediente a un grupo, o pasarlo a otro (PUT, 2026-11-03).
 *
 * Los expedientes anteriores a los grupos no tienen y se les asigna aquí; uno que ya tiene grupo se puede pasar a otro, pero nunca queda sin
 * grupo (por eso no hay DELETE). Es idempotente: si ya estaba en ese grupo, nexus_back responde `cambiado: false`. Lo hace quien organiza
 * (Administrador, Supervisor, Analista y Operador): el servidor responde 403 `sin_permiso` a los demás roles y 404 si el expediente o el grupo
 * no son de esta organización, y aquí se reenvía tal cual. El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador (HU11).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const PUT: RequestHandler = async ({ cookies, request, locals, params }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.grupoId !== 'string' || !datos.grupoId) {
		return json({ mensaje: 'Elige el grupo al que pasa el expediente.' }, { status: 400 });
	}
	return reenviarANexus(cookies, 'PUT', `/expedientes/${encodeURIComponent(params.id ?? '')}/grupo`, { tenant: tenantDe(locals), grupoId: datos.grupoId });
};
