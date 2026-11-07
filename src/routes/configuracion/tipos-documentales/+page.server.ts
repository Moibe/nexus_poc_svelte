/**
 * Configuración · la biblioteca de TIPOS DOCUMENTALES: administración (NEX-568, auditoría de seguridad 2026-10-30, hallazgo NX-19).
 *
 * Crear, cambiar, ordenar y borrar tipos documentales es de quien administra (`roles.PUEDEN_ADMINISTRAR` en nexus_back, espejo de
 * `puedeAdministrar`). Al resto de los roles no se les ofrece (el engrane no trae «Módulo de configuración»), pero la pantalla no tenía guardia en
 * el servidor: quien abría la dirección a mano (un Viewer o un Auditor, por ejemplo) recibía la pantalla completa. Ahora el servidor los regresa al
 * inicio, igual que con el motor de reglas, antes de enseñarles nada.
 *
 * No carga datos: la biblioteca la lee el propio componente por `/api/tipos-documentales`.
 */

import { redirect } from '@sveltejs/kit';

import { puedeAdministrar } from '$lib/usuarios/permisos';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!puedeAdministrar(locals.usuario)) redirect(303, '/');
	return {};
};
