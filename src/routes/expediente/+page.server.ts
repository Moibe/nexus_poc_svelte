/**
 * Expediente · los EXPEDIENTES de MI organización, y los tipos de los que pueden nacer (el alta pide elegir uno). Las dos listas las
 * pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Todos los roles pueden VER los expedientes. Crearlos es de quien organiza (Administrador, Supervisor, Analista y Operador) y crear
 * un tipo, de quien administra: de eso solo decide si se le ofrece el botón; nexus_back responde 403 igual (`roles.PUEDEN_ORGANIZAR` y
 * `roles.PUEDEN_ADMINISTRAR`, espejos de `puedeOrganizar` y `puedeAdministrar`).
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`), igual que
 * con las API Keys y los webhooks.
 */

import type { Expediente } from '$lib/expedientes/expedientes';
import type { TipoDeExpediente } from '$lib/expedientes/tipos';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar, puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const sesion = { cookies, url };
	const [expedientes, tipos] = await Promise.all([
		leerDeNexus(`/expedientes/?tenant=${tenant}`, sesion, 'No se pudieron cargar los expedientes.'),
		leerDeNexus(`/tipos-expediente/?tenant=${tenant}`, sesion, 'No se pudieron cargar los tipos de expediente.')
	]);
	return {
		expedientes: listaDe<Expediente>(expedientes, 'expedientes'),
		tipos: listaDe<TipoDeExpediente>(tipos, 'tipos'),
		puedeOrganizar: puedeOrganizar(locals.usuario),
		puedeCrearTipo: puedeAdministrar(locals.usuario)
	};
};
