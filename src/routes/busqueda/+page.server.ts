/**
 * Búsqueda · lo que la página necesita antes de preguntar (NEX-608, 2026-11-23): los NOMBRES de los tipos documentales activos de la organización, para
 * armar las preguntas sugeridas («¿Cuántos contratos llegaron este mes?»). Solo los de la propia organización: la lista la pide el servidor con el tenant de
 * la sesión, como todo. Leer la biblioteca está abierto a cualquier rol. Si no se pudo leer, la página sale sin sugeridas (no es motivo para no dejar preguntar).
 */

import { isRedirect } from '@sveltejs/kit';

import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import type { PageServerLoad } from './$types';

type Tipo = { id: string; datos?: { nombre?: unknown; estado?: unknown } };

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	let tipos: string[] = [];
	try {
		const cuerpo = await leerDeNexus(`/tipos-documentales/?tenant=${tenant}`, { cookies, url }, 'No se pudieron leer los tipos documentales.');
		tipos = listaDe<Tipo>(cuerpo, 'tipos')
			.filter((t) => t.datos?.estado === 'activo' && typeof t.datos?.nombre === 'string' && t.datos.nombre.trim())
			.map((t) => (t.datos!.nombre as string).trim());
	} catch (err) {
		// Una sesión cerrada sí manda al inicio (lo levanta `leerDeNexus` como redirección); cualquier otra cosa deja la página sin sugeridas.
		if (isRedirect(err)) throw err;
		tipos = [];
	}
	return { tipos };
};
