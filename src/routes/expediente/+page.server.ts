/**
 * Expediente · los EXPEDIENTES de MI organización, y los tipos de los que pueden nacer (el alta pide elegir uno). Las dos listas las
 * pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Todos los roles pueden VER los expedientes. Crearlos es de quien organiza (Administrador, Supervisor, Analista y Operador) y crear
 * un tipo, de quien administra: de eso solo decide si se le ofrece el botón; nexus_back responde 403 igual (`roles.PUEDEN_ORGANIZAR` y
 * `roles.PUEDEN_ADMINISTRAR`, espejos de `puedeOrganizar` y `puedeAdministrar`).
 *
 * Si no hay tipos y quien mira administra, el estado vacío le deja crear el primero aquí mismo, y ese alta pide elegir los tipos
 * DOCUMENTALES de su esquema: solo en ese caso se leen (en las demás, esta pantalla no los necesita).
 *
 * La vista del listado (lista o mosaico) la recuerda una cookie que escribe el navegador al elegirla; se lee AQUÍ, en el servidor, para
 * que la página llegue ya pintada como la dejó quien mira y no se vea un destello de la otra antes de que cargue.
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`), igual que
 * con las API Keys y los webhooks.
 */

import { COOKIE_VISTA_EXPEDIENTES, vistaDe, type Expediente } from '$lib/expedientes/expedientes';
import type { TipoDeExpediente } from '$lib/expedientes/tipos';
import { leerDeNexus, listaDe, tiposDocumentalesParaEsquema } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar, puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = tenantDe(locals);
	const codificado = encodeURIComponent(tenant);
	const sesion = { cookies, url };
	const [expedientes, cuerpoTipos] = await Promise.all([
		leerDeNexus(`/expedientes/?tenant=${codificado}`, sesion, 'No se pudieron cargar los expedientes.'),
		leerDeNexus(`/tipos-expediente/?tenant=${codificado}`, sesion, 'No se pudieron cargar los tipos de expediente.')
	]);
	const tipos = listaDe<TipoDeExpediente>(cuerpoTipos, 'tipos');
	const puedeCrearTipo = puedeAdministrar(locals.usuario);
	const esquema = puedeCrearTipo && tipos.length === 0 ? await tiposDocumentalesParaEsquema(sesion, tenant) : { opciones: [], fallo: false };
	return {
		expedientes: listaDe<Expediente>(expedientes, 'expedientes'),
		tipos,
		vista: vistaDe(cookies.get(COOKIE_VISTA_EXPEDIENTES)),
		puedeOrganizar: puedeOrganizar(locals.usuario),
		puedeCrearTipo,
		tiposDocumentales: esquema.opciones,
		tiposDocumentalesFallo: esquema.fallo
	};
};
