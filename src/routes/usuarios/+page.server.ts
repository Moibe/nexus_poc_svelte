/**
 * HU06 · Los usuarios de MI organización. La lista la pide el servidor, que es
 * quien tiene el JWT en la cookie.
 *
 * Quién la ve: el administrador de una organización, y el de plataforma, que
 * no pertenece a ninguna y aquí encuentra la explicación con el enlace para
 * crear una. Cualquier otro —Supervisor, Analista, lo que sea— se va al
 * inicio: el servidor le responde 403 igual, y enseñarle una pantalla que no
 * es suya solo confunde.
 */

import { error, redirect } from '@sveltejs/kit';

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
		// Quien NO administra una organización no tiene nada que hacer aquí: se
		// va al inicio, como en `/organizaciones` (pedido de Moibe, 2026-10-09).
		// Se decide con la respuesta del SERVIDOR y no con el rol del JWT, que
		// puede llevar hasta 15 minutos de retraso: a quien acaban de ascender a
		// administrador, la pantalla le funciona desde el primer momento.
		if (!esAdminPlataforma) redirect(303, '/');
		// El administrador de plataforma sí se queda: no pertenece a ninguna
		// organización y la pantalla le explica por qué, con el enlace para
		// crear una.
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
