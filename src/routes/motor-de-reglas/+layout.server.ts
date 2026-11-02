/**
 * El motor de reglas es administración (NEX-472): lo guarda `/procesos`, que el servidor solo abre a Administrador y Supervisor.
 * A los demás roles no se les ofrece (el engrane no sale), y si llegan por la dirección, se les regresa al inicio en vez de
 * enseñarles una pantalla que no puede cargar nada.
 *
 * Vive en el LAYOUT (hasta el 2026-10-29 estaba en la página) porque desde ese día el motor tiene dos pantallas —la lista de
 * procesos en `/motor-de-reglas` y el lienzo de uno en `/motor-de-reglas/[id]`— y las dos piden lo mismo.
 *
 * También desde el 2026-10-29 lee los TIPOS DE EXPEDIENTE VIRTUAL de la organización: un proceso se liga a uno (el grupito de
 * documentos sobre el que correrá), la lista dice a cuál y el lienzo deja elegirlo. Si no se pueden leer, el motor se sigue usando:
 * la lista dice el id que no pudo nombrar y el selector no ofrece nada que elegir.
 *
 * Desde el 2026-11-03 cada tipo trae también los ids de su ESQUEMA (sus tipos documentales): el tipo es OBLIGATORIO para guardar un proceso
 * y el lienzo ofrece como entradas solo los tipos documentales de ese esquema.
 */
import { isRedirect, redirect } from '@sveltejs/kit';

import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeAdministrar } from '$lib/usuarios/permisos';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
	if (!puedeAdministrar(locals.usuario)) redirect(303, '/');
	const cuerpo = await leerDeNexus(`/tipos-expediente/?tenant=${encodeURIComponent(tenantDe(locals))}`, { cookies, url }, 'No se pudieron cargar los tipos.').catch((e) => {
		if (isRedirect(e)) throw e;
		return null;
	});
	return {
		// `tiposDocumentales` son los ids del ESQUEMA de cada tipo: el lienzo ofrece solo esos como entradas del proceso (2026-11-03).
		tiposVirtuales: listaDe<{ id: string; nombre: string; tiposDocumentales?: { id: string }[] }>(cuerpo, 'tipos').map((t) => ({
			id: t.id,
			nombre: t.nombre,
			tiposDocumentales: (t.tiposDocumentales ?? []).map((d) => d.id)
		})),
		tiposVirtualesFallo: cuerpo === null
	};
};
