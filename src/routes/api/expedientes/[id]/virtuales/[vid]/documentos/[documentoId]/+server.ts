/**
 * BFF: meter (PUT) o sacar (DELETE) un documento de un expediente virtual (2026-10-29).
 *
 * Solo entran documentos DEL EXPEDIENTE del virtual (nexus_back responde 404 si no, y lo cuida también la base). Meter es idempotente
 * (`agregado: false` si ya estaba). Sacar deja el documento en el expediente: solo deja de ser parte del grupito. Los roles que no
 * organizan reciben 403. Aquí se reenvía tal cual; el tenant lo fija el servidor desde la sesión (HU11).
 */

import type { RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

function ruta(params: Partial<Record<string, string>>, tenant: string): string {
	const [id, vid, doc] = [params.id, params.vid, params.documentoId].map((x) => encodeURIComponent(x ?? ''));
	return `/expedientes/${id}/virtuales/${vid}/documentos/${doc}?tenant=${encodeURIComponent(tenant)}`;
}

export const PUT: RequestHandler = async ({ cookies, locals, params }) => reenviarANexus(cookies, 'PUT', ruta(params, tenantDe(locals)));

export const DELETE: RequestHandler = async ({ cookies, locals, params }) => reenviarANexus(cookies, 'DELETE', ruta(params, tenantDe(locals)));
