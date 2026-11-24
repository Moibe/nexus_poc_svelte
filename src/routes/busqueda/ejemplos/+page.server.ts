/**
 * Búsqueda · Ejemplos de la organización (NEX-609, 2026-11-23): lo que está «Por revisar» (respuestas que alguien marcó «Sí me sirvió») y los ejemplos
 * ya aprobados. Solo para quien administra la organización: a los demás la página les explica que esto es de quien administra, sin pedir nada (el
 * enlace solo se le enseña a quien administra, pero la dirección se puede escribir a mano). nexus_back vuelve a decidir (`exigir_administrar`).
 *
 * Si la lectura falla, la página lo dice en vez de caerse; una sesión cerrada manda al inicio.
 */

import { isRedirect } from '@sveltejs/kit';

import type { EjemploAprobado, PorRevisar } from '$lib/busqueda/busqueda';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const administra = puedeAdministrar(locals.usuario) && Boolean(locals.usuario?.tenantGuid);
	if (!administra) return { administra: false, porRevisar: [] as PorRevisar[], ejemplos: [] as EjemploAprobado[], error: null as string | null };
	const tenant = encodeURIComponent(tenantDe(locals));
	try {
		const [revisar, aprobados] = await Promise.all([
			leerDeNexus(`/busqueda/por-revisar?tenant=${tenant}`, { cookies, url }, 'No se pudo leer lo que está por revisar.'),
			leerDeNexus(`/busqueda/ejemplos?tenant=${tenant}`, { cookies, url }, 'No se pudieron leer los ejemplos.')
		]);
		return {
			administra: true,
			porRevisar: listaDe<PorRevisar>(revisar, 'preguntas'),
			ejemplos: listaDe<EjemploAprobado>(aprobados, 'ejemplos'),
			error: null as string | null
		};
	} catch (err) {
		if (isRedirect(err)) throw err;
		return {
			administra: true,
			porRevisar: [] as PorRevisar[],
			ejemplos: [] as EjemploAprobado[],
			error: 'No se pudieron leer los ejemplos de tu organización. Intenta de nuevo en un momento.' as string | null
		};
	}
};
