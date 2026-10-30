/**
 * El motor de reglas es administración (NEX-472): lo guarda `/procesos`, que el servidor solo abre a Administrador y Supervisor.
 * A los demás roles no se les ofrece (el engrane no sale), y si llegan por la dirección, se les regresa al inicio en vez de
 * enseñarles una pantalla que no puede cargar nada.
 *
 * Vive en el LAYOUT (hasta el 2026-10-29 estaba en la página) porque desde ese día el motor tiene dos pantallas —la lista de
 * procesos en `/motor-de-reglas` y el lienzo de uno en `/motor-de-reglas/[id]`— y las dos piden lo mismo.
 */
import { redirect } from '@sveltejs/kit';

import { puedeAdministrar } from '$lib/usuarios/permisos';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!puedeAdministrar(locals.usuario)) redirect(303, '/');
};
