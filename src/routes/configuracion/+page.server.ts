/**
 * Módulo de configuración · el mosaico de secciones (2026-10-25).
 *
 * Solo dice si quien entra ADMINISTRA, para enseñar las secciones o explicar por qué no hay nada que tocar. No pide datos: cada
 * sección los pide cuando se entra en ella, así que el mosaico abre al instante aunque el servidor esté lento.
 *
 * El engrane solo se le muestra a quien administra (`puedeConfigurar` en `TopBar.svelte`, NEX-472), pero la dirección se puede
 * escribir a mano: aquí se decide otra vez, y las pantallas de cada sección vuelven a decidir por su cuenta.
 */

import { puedeAdministrar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	puedeAdministrar: puedeAdministrar(locals.usuario)
});
