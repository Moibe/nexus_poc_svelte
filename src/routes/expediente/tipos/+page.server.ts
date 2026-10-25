/**
 * Expediente · los TIPOS de expediente de MI organización. La lista la pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Todos los roles pueden VER los tipos (quien organiza expedientes necesita elegir uno); crearlos es de quien administra, y de eso
 * solo decide si se le ofrece el botón: nexus_back responde 403 igual (`roles.PUEDEN_ADMINISTRAR`, espejo de `puedeAdministrar`).
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`), igual que
 * con las API Keys y los webhooks.
 */

import type { TipoDeExpediente } from '$lib/expedientes/tipos';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = tenantDe(locals);
	const cuerpo = await leerDeNexus(`/tipos-expediente/?tenant=${encodeURIComponent(tenant)}`, { cookies, url }, 'No se pudieron cargar los tipos de expediente.');
	return {
		tipos: listaDe<TipoDeExpediente>(cuerpo, 'tipos'),
		puedeCrear: puedeAdministrar(locals.usuario)
	};
};
