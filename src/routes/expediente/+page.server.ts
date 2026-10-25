/**
 * Expediente · los TIPOS de expediente de MI organización. La lista la pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Todos los roles pueden VER los tipos (quien organiza expedientes necesita elegir uno); crearlos es de quien administra, y de eso
 * solo decide si se le ofrece el botón: nexus_back responde 403 igual (`roles.PUEDEN_ADMINISTRAR`, espejo de `puedeAdministrar`).
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`), igual que
 * con las API Keys y los webhooks.
 */

import { error } from '@sveltejs/kit';

import { TIMEOUT_MS, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion, irAlLogin, sesionCerrada } from '$lib/server/sesion';
import type { TipoDeExpediente } from '$lib/expedientes/tipos';
import { puedeAdministrar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = tenantDe(locals);
	let lista: Response;
	try {
		lista = await fetch(urlNexus(`/tipos-expediente/?tenant=${encodeURIComponent(tenant)}`), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		error(504, 'No se pudo contactar al servidor.');
	}
	const cuerpo = await lista.json().catch(() => null);

	// La sesión de este JWT se cerró (HU05): al login, no a una página de error.
	if (lista.status === 401 && sesionCerrada(cuerpo)) irAlLogin(cookies, url);
	if (!lista.ok) error(lista.status, 'No se pudieron cargar los tipos de expediente.');

	return {
		tipos: (Array.isArray(cuerpo?.tipos) ? cuerpo.tipos : []) as TipoDeExpediente[],
		puedeCrear: puedeAdministrar(locals.usuario)
	};
};
