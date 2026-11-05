/**
 * Configuración · los GRUPOS de MI organización (2026-11-03). La lista la pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Un grupo es el nivel de arriba de los expedientes (áreas, departamentos, trimestres… como los llame cada organización). Todos los roles
 * pueden VER los grupos (quien organiza expedientes necesita elegir uno); crearlos, renombrarlos y borrarlos es de quien administra, y de eso
 * solo decide si se le ofrecen los botones: nexus_back responde 403 igual (`roles.PUEDEN_ADMINISTRAR`, espejo de `puedeAdministrar`).
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`), igual que con las
 * API Keys y los webhooks.
 */

import type { Grupo } from '$lib/expedientes/grupos';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const cuerpo = await leerDeNexus(`/grupos/?tenant=${encodeURIComponent(tenantDe(locals))}`, { cookies, url }, 'No se pudieron cargar los grupos.');
	return {
		grupos: listaDe<Grupo>(cuerpo, 'grupos'),
		puedeAdministrar: puedeAdministrar(locals.usuario)
	};
};
