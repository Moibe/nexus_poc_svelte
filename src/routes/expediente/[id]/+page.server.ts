/**
 * Expediente · UN expediente de MI organización, con sus documentos. Lo pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Un expediente de otra organización contesta 404 igual que uno que no existe (HU11): el navegador no puede distinguir «no es tuyo»
 * de «no hay tal». Todos los roles pueden VERLO; organizarlo (meter y sacar documentos) todavía no tiene pantalla.
 */

import { error } from '@sveltejs/kit';

import type { ExpedienteConDocumentos } from '$lib/expedientes/expedientes';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
	const tenant = tenantDe(locals);
	const cuerpo = await leerDeNexus(
		`/expedientes/${encodeURIComponent(params.id)}?tenant=${encodeURIComponent(tenant)}`,
		{ cookies, url },
		'No se pudo cargar el expediente.',
		'Ese expediente no existe.'
	);
	if (typeof cuerpo?.id !== 'string') error(502, 'La respuesta del servidor no es válida.');
	return {
		expediente: { ...cuerpo, documentos: listaDe(cuerpo, 'documentos') } as unknown as ExpedienteConDocumentos
	};
};
