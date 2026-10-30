/**
 * Archivos procesados · lo que lee la pantalla «Gestión de documentos y expedientes» (Figma Sprint 5, HUN1): los DOCUMENTOS de mi
 * organización, cada uno con los expedientes en que está, y los EXPEDIENTES. Lo piden juntos el servidor, que es quien tiene el JWT en
 * la cookie. Todos los roles pueden verlos; agregarlos a un expediente, solo quien organiza. El administrador de plataforma opera en su
 * espacio (`tenantDe`).
 */

import type { DocumentoDeExpediente, Expediente } from '$lib/expedientes/expedientes';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const sesion = { cookies, url };
	const [documentos, expedientes] = await Promise.all([
		leerDeNexus(`/expedientes/documentos?tenant=${tenant}`, sesion, 'No se pudieron cargar los documentos.'),
		leerDeNexus(`/expedientes/?tenant=${tenant}`, sesion, 'No se pudieron cargar los expedientes.')
	]);
	return {
		documentos: listaDe<DocumentoDeExpediente & { expedientes: { id: string; nombre: string }[] }>(documentos, 'documentos'),
		expedientes: listaDe<Expediente>(expedientes, 'expedientes'),
		// Solo decide si se ofrecen las casillas y «Agregar a expediente»; nexus_back responde 403 igual (`roles.PUEDEN_ORGANIZAR`).
		puedeOrganizar: puedeOrganizar(locals.usuario)
	};
};
