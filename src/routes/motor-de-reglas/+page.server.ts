/**
 * El motor de reglas es administración (NEX-472): lo guarda `/procesos`, que el servidor solo abre a Administrador y Supervisor.
 * A los demás roles no se les ofrece (el engrane no sale), y si llegan por la dirección, se les regresa al inicio en vez de
 * enseñarles un lienzo que no puede cargar nada.
 */
import { redirect } from '@sveltejs/kit';

import { puedeAdministrar } from '$lib/usuarios/permisos';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!puedeAdministrar(locals.usuario)) redirect(303, '/');
};
