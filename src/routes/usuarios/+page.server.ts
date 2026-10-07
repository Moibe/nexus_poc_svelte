/**
 * HU06 · Los usuarios de MI organización. La lista la pide el servidor, que es
 * quien tiene el JWT en la cookie.
 *
 * Quién la ve: el administrador de una organización. Si el back dice que quien
 * entra no administra ninguna (`sin_organizacion` — le pasa al administrador de
 * plataforma, que no pertenece a ninguna), la página lo explica en vez de
 * tronar: es un caso normal, no un error.
 */

import { error } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';
import type { Rol, UsuarioDeOrganizacion } from '$lib/usuarios/tipos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const esAdminPlataforma = Boolean(locals.usuario?.esAdminPlataforma);
	const pedir = (ruta: string) =>
		fetch(urlNexus(ruta), { headers: cabecerasConSesion(cookies), signal: AbortSignal.timeout(TIMEOUT_MS) });

	let lista: Response;
	try {
		lista = await pedir('/usuarios/');
	} catch {
		error(504, 'No se pudo contactar al servidor.');
	}
	const cuerpo = await lista.json().catch(() => null);

	if (lista.status === 403 && cuerpo?.detail?.codigo === 'sin_organizacion') {
		return { sinOrganizacion: true as const, esAdminPlataforma, organizacion: null, usuarios: [], roles: [] };
	}
	if (!lista.ok) error(lista.status, 'No se pudieron cargar los usuarios.');

	const catalogo = await pedir('/usuarios/roles').catch(() => null);
	const roles = catalogo?.ok ? ((await catalogo.json().catch(() => null))?.roles ?? []) : [];

	return {
		sinOrganizacion: false as const,
		esAdminPlataforma,
		organizacion: cuerpo?.organizacion ?? null,
		usuarios: (cuerpo?.usuarios ?? []) as UsuarioDeOrganizacion[],
		roles: roles as Rol[]
	};
};
