/**
 * BFF: crear (POST) un EXPEDIENTE VIRTUAL dentro de un expediente de la organización de quien pide (2026-10-29).
 *
 * Un expediente virtual es un grupito de documentos DE ESE EXPEDIENTE, instancia de un tipo de expediente virtual (`tipoId`): «la
 * solicitud de crédito de Juan Pérez». Nace con el `nombre` y los `documentos` elegidos (pueden ser ninguno). nexus_back responde 404 si
 * el expediente, el tipo o un documento no son de aquí (un documento que no está en el expediente no entra y no se crea nada), 403 a los
 * roles que no organizan y 503 si no hay base (los virtuales solo viven en SQL); aquí se reenvía tal cual. El tenant lo fija el servidor
 * desde la sesión (HU11).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ cookies, request, locals, params }) => {
	const datos = await request.json().catch(() => null);
	if (typeof datos?.nombre !== 'string' || !datos.nombre.trim()) return json({ mensaje: 'Escribe el nombre del expediente virtual.' }, { status: 400 });
	if (typeof datos?.tipoId !== 'string' || !datos.tipoId) return json({ mensaje: 'Elige el tipo de expediente virtual.' }, { status: 400 });
	const documentos = Array.isArray(datos?.documentos) ? datos.documentos.filter((d: unknown) => typeof d === 'string') : [];
	return reenviarANexus(cookies, 'POST', `/expedientes/${encodeURIComponent(params.id ?? '')}/virtuales`, {
		tenant: tenantDe(locals),
		tipoId: datos.tipoId,
		nombre: datos.nombre,
		documentos
	});
};
