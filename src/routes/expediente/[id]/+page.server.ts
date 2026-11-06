/**
 * Expediente · UN expediente de MI organización, con sus documentos. Lo pide el servidor, que es quien tiene el JWT en la cookie.
 *
 * Un expediente de otra organización contesta 404 igual que uno que no existe (HU11): el navegador no puede distinguir «no es tuyo»
 * de «no hay tal». Todos los roles pueden VERLO.
 *
 * Moibe, 2026-11-05: se quitaron los expedientes virtuales, así que la respuesta ya no trae `expedientesVirtuales` y aquí tampoco se leen los
 * tipos de expediente virtual. En su lugar el back marca los DUPLICADOS del expediente entero: cada documento trae `duplicado` y el detalle
 * trae `duplicados`, los tipos documentales de los que hay DOS O MÁS documentos (un proceso que use uno de esos tipos no se ejecuta sobre el
 * expediente mientras haya más de uno). Un servidor anterior no manda `duplicados` y se toma como ninguno.
 *
 * Moibe, 2026-11-06: se quitaron los grupos de expedientes («en aras de la simplicidad»), así que aquí tampoco se leen los grupos de la
 * organización ni el expediente trae el suyo.
 *
 * Moibe, 2026-11-06: «Ejecuciones ahora existirá dentro del Expediente»: desde el expediente se ejecuta un proceso, así que además se leen los procesos
 * activos de la organización (`procesos`, y `procesosFallo` si no se pudieron leer). Solo ejecuta quien organiza: a los demás roles ni se les leen.
 */

import { error } from '@sveltejs/kit';

import type { ProcesoOfrecido } from '$lib/ejecuciones/ejecuciones';
import type { DuplicadoDeTipo, ExpedienteConDocumentos } from '$lib/expedientes/expedientes';
import { leerProcesosOfrecidos } from '$lib/server/ejecuciones';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const organiza = puedeOrganizar(locals.usuario);
	// Las dos lecturas van juntas (no dependen una de la otra) y con `Promise.all`: si el expediente no existe y esa lectura falla, la otra no queda colgada
	// con un rechazo que nadie atiende.
	const [cuerpo, ofrecidos] = await Promise.all([
		leerDeNexus(
			`/expedientes/${encodeURIComponent(params.id)}?tenant=${tenant}`,
			{ cookies, url },
			'No se pudo cargar el expediente.',
			'Ese expediente no existe.'
		),
		organiza ? leerProcesosOfrecidos(tenant, { cookies, url }) : Promise.resolve({ procesos: [] as ProcesoOfrecido[], fallo: false })
	]);
	if (typeof cuerpo?.id !== 'string') error(502, 'La respuesta del servidor no es válida.');
	return {
		expediente: {
			...cuerpo,
			documentos: listaDe(cuerpo, 'documentos'),
			duplicados: listaDe<DuplicadoDeTipo>(cuerpo, 'duplicados')
		} as unknown as ExpedienteConDocumentos,
		puedeOrganizar: organiza,
		procesos: ofrecidos.procesos,
		procesosFallo: ofrecidos.fallo
	};
};
