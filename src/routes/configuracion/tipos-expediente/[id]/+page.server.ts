/**
 * Configuración · los EXPEDIENTES VIRTUALES de UN tipo (2026-10-30, pedido de Moibe): a donde lleva la cuenta de la columna «Expedientes
 * virtuales» de `/configuracion/tipos-expediente`. Lo pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * La lista cruza todos los expedientes de la organización (cada virtual vive dentro de uno) y llega con el expediente de cada uno.
 * Todos los roles pueden VERLA, igual que la lista de tipos: nexus_back la da a cualquiera que opere en la organización. Un tipo que no es
 * de esta organización contesta 404 igual que uno que no existe (HU11).
 *
 * El administrador de plataforma, que no pertenece a ninguna organización, opera en su espacio de plataforma (`tenantDe`).
 */

import { error } from '@sveltejs/kit';

import type { ExpedienteVirtualDeTipo } from '$lib/expedientes/expedientes';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
	const cuerpo = await leerDeNexus(
		`/tipos-expediente/${encodeURIComponent(params.id)}/virtuales?tenant=${encodeURIComponent(tenantDe(locals))}`,
		{ cookies, url },
		'No se pudieron cargar los expedientes virtuales.',
		'Ese tipo de expediente virtual no existe.'
	);
	const tipo = cuerpo?.tipo as { id?: unknown; nombre?: unknown } | undefined;
	if (typeof tipo?.id !== 'string' || typeof tipo?.nombre !== 'string') error(502, 'La respuesta del servidor no es válida.');
	return { tipo: { id: tipo.id, nombre: tipo.nombre }, virtuales: listaDe<ExpedienteVirtualDeTipo>(cuerpo, 'expedientesVirtuales') };
};
