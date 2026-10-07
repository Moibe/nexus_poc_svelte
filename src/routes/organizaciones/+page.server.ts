/**
 * HU02 · El listado de organizaciones. Carga del lado del servidor, que es
 * quien tiene la cookie con el JWT; el navegador nunca ve un token.
 *
 * Solo para el administrador de plataforma: `hooks.server.ts` ya garantiza que
 * hay sesión, pero no el rol. Un usuario de organización que escriba la URL a
 * mano se va al inicio.
 */

import { error, redirect } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';
import type { PageServerLoad } from './$types';

export type Organizacion = {
	guid: string;
	nombre: string;
	slug: string;
	codigo: string;
	estado: string;
	creadaEn: string | null;
	recuperacion: { telefono?: string | null; email?: string | null };
	admin: { guid: string; nombre: string; email: string; telefono: string | null } | null;
};

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.usuario?.esAdminPlataforma) redirect(303, '/');

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/organizaciones/'), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		error(504, 'No se pudo contactar al servidor.');
	}
	if (!respuesta.ok) error(respuesta.status, 'No se pudieron cargar las organizaciones.');
	const cuerpo = await respuesta.json().catch(() => null);
	return { organizaciones: (cuerpo?.organizaciones ?? []) as Organizacion[] };
};
