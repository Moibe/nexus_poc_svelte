/**
 * Expediente · UN expediente de MI organización, con sus documentos y sus expedientes virtuales. Lo pide el servidor, que es quien tiene
 * el JWT en la cookie.
 *
 * Un expediente de otra organización contesta 404 igual que uno que no existe (HU11): el navegador no puede distinguir «no es tuyo»
 * de «no hay tal». Todos los roles pueden VERLO. Quien organiza puede además armar expedientes virtuales (2026-10-29): para eso se leen
 * los tipos de expediente virtual de la organización, solo si quien mira puede usarlos.
 *
 * Desde el 2026-11-03 el expediente vive en un GRUPO. Quien organiza puede asignárselo (a los de antes de los grupos) o pasarlo a otro: para eso se
 * leen los grupos de la organización. Si no se pueden leer, el expediente se sigue viendo y el modal dirá que no hay grupos que elegir (`gruposFallo`).
 */

import { error, isRedirect } from '@sveltejs/kit';

import type { ExpedienteConDocumentos } from '$lib/expedientes/expedientes';
import type { Grupo } from '$lib/expedientes/grupos';
import type { TipoDeExpediente } from '$lib/expedientes/tipos';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar, puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const sesion = { cookies, url };
	const organiza = puedeOrganizar(locals.usuario);
	const [cuerpo, tipos, grupos] = await Promise.all([
		leerDeNexus(`/expedientes/${encodeURIComponent(params.id)}?tenant=${tenant}`, sesion, 'No se pudo cargar el expediente.', 'Ese expediente no existe.'),
		// Los tipos solo hacen falta para crear un virtual. Si no se pueden leer, el expediente se sigue viendo: el modal dirá que no hay tipos.
		organiza
			? leerDeNexus(`/tipos-expediente/?tenant=${tenant}`, sesion, 'No se pudieron cargar los tipos.').catch((e) => {
					if (isRedirect(e)) throw e;
					return null;
				})
			: Promise.resolve(null),
		// Los grupos solo hacen falta para asignar o cambiar el del expediente.
		organiza
			? leerDeNexus(`/grupos/?tenant=${tenant}`, sesion, 'No se pudieron cargar los grupos.').catch((e) => {
					if (isRedirect(e)) throw e;
					return null;
				})
			: Promise.resolve(null)
	]);
	if (typeof cuerpo?.id !== 'string') error(502, 'La respuesta del servidor no es válida.');
	return {
		expediente: {
			...cuerpo,
			documentos: listaDe(cuerpo, 'documentos'),
			expedientesVirtuales: listaDe(cuerpo, 'expedientesVirtuales')
		} as unknown as ExpedienteConDocumentos,
		tiposVirtuales: listaDe<TipoDeExpediente>(tipos, 'tipos'),
		grupos: listaDe<Grupo>(grupos, 'grupos'),
		gruposFallo: organiza && grupos === null,
		puedeOrganizar: organiza,
		puedeAdministrar: puedeAdministrar(locals.usuario)
	};
};
