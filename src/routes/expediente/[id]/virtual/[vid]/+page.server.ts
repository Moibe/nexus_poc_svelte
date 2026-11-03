/**
 * Expediente · UN expediente virtual (2026-10-29): el grupito de documentos, con su tipo y el esquema del tipo, y —para quien organiza— los
 * documentos del expediente que se le pueden agregar. Lo pide el servidor, que tiene el JWT en la cookie.
 *
 * Uno de otra organización, de otro expediente o que no existe contesta 404, sin distinguir (HU11). Todos los roles lo ven.
 */

import { error } from '@sveltejs/kit';

import type { ExpedienteConDocumentos, ExpedienteVirtual } from '$lib/expedientes/expedientes';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar, puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const sesion = { cookies, url };
	const id = encodeURIComponent(params.id);
	const organiza = puedeOrganizar(locals.usuario);
	const [virtual, expediente] = await Promise.all([
		leerDeNexus(`/expedientes/${id}/virtuales/${encodeURIComponent(params.vid)}?tenant=${tenant}`, sesion, 'No se pudo cargar el expediente virtual.', 'Ese expediente virtual no existe.'),
		// Los documentos del expediente solo hacen falta para agregarle al virtual: los pide quien puede hacerlo.
		organiza ? leerDeNexus(`/expedientes/${id}?tenant=${tenant}`, sesion, 'No se pudo cargar el expediente.', 'Ese expediente no existe.') : Promise.resolve(null)
	]);
	if (typeof virtual?.id !== 'string') error(502, 'La respuesta del servidor no es válida.');
	return {
		virtual: { ...virtual, documentos: listaDe(virtual, 'documentos') } as unknown as ExpedienteVirtual,
		documentosDelExpediente: listaDe<ExpedienteConDocumentos['documentos'][number]>(expediente, 'documentos'),
		puedeOrganizar: organiza,
		// Para ofrecer abrir en el motor de reglas los procesos que le aplican (el motor es de quien administra).
		puedeAdministrar: puedeAdministrar(locals.usuario)
	};
};
