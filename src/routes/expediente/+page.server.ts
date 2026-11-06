/**
 * Expediente · los EXPEDIENTES de MI organización. La lista la pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Todos los roles pueden VER los expedientes. Crearlos es de quien organiza (Administrador, Supervisor, Analista y Operador): de eso
 * solo decide si se le ofrece el botón; nexus_back responde 403 igual (`roles.PUEDEN_ORGANIZAR`, espejo de `puedeOrganizar`).
 *
 * Desde el 2026-10-29 un expediente no tiene tipo (es un receptáculo de documentos), así que esta pantalla ya no lee los tipos; y desde el
 * 2026-11-05 tampoco hay expedientes virtuales que los usaran (Moibe los quitó).
 *
 * Desde el 2026-11-03 un expediente vive en un GRUPO (`/grupos`): se pide la lista de grupos para el filtro del listado y para elegir el del
 * expediente al crearlo. Si no se pueden leer, el listado se sigue viendo (`gruposFallo`) y el modal de alta lo dice y no deja crear.
 *
 * La vista del listado (lista o mosaico) la recuerda una cookie que escribe el navegador al elegirla; se lee AQUÍ, en el servidor, para
 * que la página llegue ya pintada como la dejó quien mira y no se vea un destello de la otra antes de que cargue.
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`), igual que
 * con las API Keys y los webhooks.
 */

import { isRedirect } from '@sveltejs/kit';

import { COOKIE_VISTA_EXPEDIENTES, vistaDe, type Expediente } from '$lib/expedientes/expedientes';
import type { Grupo } from '$lib/expedientes/grupos';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar, puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const sesion = { cookies, url };
	const [expedientes, grupos] = await Promise.all([
		leerDeNexus(`/expedientes/?tenant=${tenant}`, sesion, 'No se pudieron cargar los expedientes.'),
		// Los grupos no son lo principal de esta pantalla: si no se pueden leer, el listado se ve igual y el alta lo dice.
		leerDeNexus(`/grupos/?tenant=${tenant}`, sesion, 'No se pudieron cargar los grupos.').catch((e) => {
			if (isRedirect(e)) throw e;
			return null;
		})
	]);
	return {
		expedientes: listaDe<Expediente>(expedientes, 'expedientes'),
		grupos: listaDe<Grupo>(grupos, 'grupos'),
		gruposFallo: grupos === null,
		vista: vistaDe(cookies.get(COOKIE_VISTA_EXPEDIENTES)),
		puedeOrganizar: puedeOrganizar(locals.usuario),
		puedeAdministrar: puedeAdministrar(locals.usuario)
	};
};
