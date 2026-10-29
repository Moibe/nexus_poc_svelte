/**
 * Configuración · los TIPOS de expediente de MI organización. La lista la pide el servidor, que es quien tiene el JWT en la cookie.
 * (Vivía en la pestaña de tipos de `/expediente`; el 2026-10-25 se mudó al módulo de configuración.)
 *
 * Todos los roles pueden VER los tipos (quien organiza expedientes necesita elegir uno); crearlos, renombrarlos y borrarlos es de quien
 * administra, y de eso solo decide si se le ofrecen los botones: nexus_back responde 403 igual (`roles.PUEDEN_ADMINISTRAR`, espejo de
 * `puedeAdministrar`).
 *
 * A quien administra también se le piden los tipos DOCUMENTALES de la organización: al crear un tipo de expediente hay que elegir cuáles
 * forman su esquema. Si no se pueden leer, la pantalla sigue y el modal lo dice (`tiposDocumentalesFallo`).
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`), igual que
 * con las API Keys y los webhooks.
 */

import type { TipoDeExpediente } from '$lib/expedientes/tipos';
import { leerDeNexus, listaDe, tiposDocumentalesParaEsquema } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = tenantDe(locals);
	const sesion = { cookies, url };
	const puede = puedeAdministrar(locals.usuario);
	const [cuerpo, esquema] = await Promise.all([
		leerDeNexus(`/tipos-expediente/?tenant=${encodeURIComponent(tenant)}`, sesion, 'No se pudieron cargar los tipos de expediente.'),
		puede ? tiposDocumentalesParaEsquema(sesion, tenant) : { opciones: [], fallo: false }
	]);
	return {
		tipos: listaDe<TipoDeExpediente>(cuerpo, 'tipos'),
		puedeAdministrar: puede,
		tiposDocumentales: esquema.opciones,
		tiposDocumentalesFallo: esquema.fallo
	};
};
