/**
 * BFF: borrar (DELETE) un expediente completo de la organización de quien pide (2026-11-10, Moibe: «que pueda borrar un expediente completo con un
 * iconito de bote de basura»).
 *
 * Borrar el expediente NO borra sus documentos: igual que «Quitar» uno por uno, siguen siendo de la organización (en Archivos procesados) y en los
 * demás expedientes donde estén. El historial de sus ejecuciones se conserva en nexus_back. Quien organiza (Administrador, Supervisor, Analista y
 * Operador) puede; a los demás roles nexus_back les responde 403 `sin_permiso`, y 404 si el expediente no existe en esta organización; aquí se
 * reenvía tal cual. El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador (HU11).
 */

import type { RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const DELETE: RequestHandler = ({ cookies, locals, params }) =>
	reenviarANexus(cookies, 'DELETE', `/expedientes/${encodeURIComponent(params.id ?? '')}?tenant=${encodeURIComponent(tenantDe(locals))}`);
