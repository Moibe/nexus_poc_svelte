/**
 * Búsqueda · lo que la página necesita antes de preguntar:
 *   · NEX-608: los NOMBRES de los tipos documentales activos de la organización, para armar las preguntas sugeridas («¿Cuántos contratos llegaron este
 *     mes?»). Solo los de la propia organización: la lista la pide el servidor con el tenant de la sesión, como todo. Leer la biblioteca está abierto a
 *     cualquier rol.
 *   · NEX-609: «Tus preguntas recientes» (las de quien mira, `GET /busqueda/preguntas`) y, para quien administra la organización, cuántas respuestas
 *     esperan en «Por revisar» para aprobarlas como ejemplo (el enlace a `/busqueda/ejemplos` lo dice).
 *
 * Nada de esto es motivo para no dejar preguntar: si una lectura falla, la página sale sin eso. Solo una sesión cerrada manda al inicio. Después de cada
 * pregunta, la página vuelve a pedir esto con `invalidate('busqueda:recientes')`.
 */

import { isRedirect } from '@sveltejs/kit';

import type { Reciente } from '$lib/busqueda/busqueda';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

type Tipo = { id: string; datos?: { nombre?: unknown; estado?: unknown } };

export const load: PageServerLoad = async ({ cookies, locals, url, depends }) => {
	depends('busqueda:recientes');
	const tenant = encodeURIComponent(tenantDe(locals));
	// Los ejemplos son de una ORGANIZACIÓN: el administrador de plataforma, en su espacio, no tiene qué aprobar.
	const administra = puedeAdministrar(locals.usuario) && Boolean(locals.usuario?.tenantGuid);

	async function lista<T>(ruta: string, clave: string): Promise<T[]> {
		try {
			return listaDe<T>(await leerDeNexus(ruta, { cookies, url }, 'No se pudo leer.'), clave);
		} catch (err) {
			if (isRedirect(err)) throw err;
			return [];
		}
	}

	const [tipos, recientes, porRevisar] = await Promise.all([
		lista<Tipo>(`/tipos-documentales/?tenant=${tenant}`, 'tipos'),
		lista<Reciente>(`/busqueda/preguntas?tenant=${tenant}&limite=8`, 'preguntas'),
		administra ? lista<unknown>(`/busqueda/por-revisar?tenant=${tenant}`, 'preguntas') : Promise.resolve([])
	]);
	return {
		tipos: tipos
			.filter((t) => t.datos?.estado === 'activo' && typeof t.datos?.nombre === 'string' && t.datos.nombre.trim())
			.map((t) => (t.datos!.nombre as string).trim()),
		recientes,
		administra,
		porRevisar: porRevisar.length
	};
};
