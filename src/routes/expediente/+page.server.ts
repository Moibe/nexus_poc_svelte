/**
 * Expediente · los EXPEDIENTES de MI organización. La lista la pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Todos los roles pueden VER los expedientes. Crearlos es de quien organiza (Administrador, Supervisor, Analista y Operador): de eso
 * solo decide si se le ofrece el botón; nexus_back responde 403 igual (`roles.PUEDEN_ORGANIZAR`, espejo de `puedeOrganizar`).
 *
 * Desde el 2026-10-29 un expediente no tiene tipo (es un receptáculo de documentos), así que esta pantalla ya no lee los tipos; y desde el
 * 2026-11-05 tampoco hay expedientes virtuales que los usaran (Moibe los quitó). Del 2026-11-03 al 2026-11-06 leía además los GRUPOS
 * (`/grupos`), para el filtro del listado y para elegir el del expediente al crearlo; los grupos se quitaron («en aras de la
 * simplicidad») y la pantalla vuelve a leer solo los expedientes.
 *
 * La vista del listado (lista o mosaico) la recuerda una cookie que escribe el navegador al elegirla; se lee AQUÍ, en el servidor, para
 * que la página llegue ya pintada como la dejó quien mira y no se vea un destello de la otra antes de que cargue.
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`), igual que
 * con las API Keys y los webhooks.
 */

import { COOKIE_VISTA_EXPEDIENTES, vistaDe, type Expediente } from '$lib/expedientes/expedientes';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const expedientes = await leerDeNexus(`/expedientes/?tenant=${tenant}`, { cookies, url }, 'No se pudieron cargar los expedientes.');
	return {
		expedientes: listaDe<Expediente>(expedientes, 'expedientes'),
		vista: vistaDe(cookies.get(COOKIE_VISTA_EXPEDIENTES)),
		puedeOrganizar: puedeOrganizar(locals.usuario)
	};
};
