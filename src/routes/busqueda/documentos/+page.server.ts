/**
 * Buscar en documentos · lo que la página necesita antes de buscar: los tipos documentales activos de la organización (para el filtro, con su id) y
 * cómo va su índice (cuántos documentos están listos para buscar). Nada de esto es motivo para no dejar buscar: si una lectura falla, la página sale
 * sin eso. Solo una sesión cerrada manda al inicio.
 */

import { isRedirect } from '@sveltejs/kit';

import type { EstadoDelIndice } from '$lib/busqueda/documentos';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import type { PageServerLoad } from './$types';

type Tipo = { id: string; datos?: { nombre?: unknown; estado?: unknown } };

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));

	async function leer(ruta: string): Promise<Record<string, unknown> | null> {
		try {
			return await leerDeNexus(ruta, { cookies, url }, 'No se pudo leer.');
		} catch (err) {
			if (isRedirect(err)) throw err;
			return null;
		}
	}

	const [tipos, estado] = await Promise.all([leer(`/tipos-documentales/?tenant=${tenant}`), leer(`/busqueda/documentos/estado?tenant=${tenant}`)]);
	return {
		tipos: listaDe<Tipo>(tipos, 'tipos')
			.filter((t) => t.datos?.estado === 'activo' && typeof t.datos?.nombre === 'string' && t.datos.nombre.trim())
			.map((t) => ({ valor: t.id, etiqueta: (t.datos!.nombre as string).trim() }))
			.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
		estado: estado && typeof estado.indexados === 'number' ? (estado as unknown as EstadoDelIndice) : null,
		organizacion: tenantDe(locals)
	};
};
