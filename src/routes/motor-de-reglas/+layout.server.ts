/**
 * El motor de reglas es administración (NEX-472): lo guarda `/procesos`, que el servidor solo abre a Administrador y Supervisor.
 * A los demás roles no se les ofrece (el engrane no sale), y si llegan por la dirección, se les regresa al inicio en vez de
 * enseñarles una pantalla que no puede cargar nada.
 *
 * Vive en el LAYOUT (hasta el 2026-10-29 estaba en la página) porque desde ese día el motor tiene dos pantallas —la lista de
 * procesos en `/motor-de-reglas` y el lienzo de uno en `/motor-de-reglas/[id]`— y las dos piden lo mismo.
 *
 * Aquí ya no se lee nada de nexus_back (Moibe, 2026-11-05: quitar los expedientes virtuales). Del 2026-10-29 al 2026-11-05 este `load` traía los
 * TIPOS DE EXPEDIENTE VIRTUAL de la organización —con los ids de su esquema— para el «Corre sobre» del proceso y para filtrar la paleta del lienzo,
 * y leía `url.pathname` para volver a correr en cada navegación dentro del motor (si no, los tipos que se creaban o borraban desde Configuración no
 * se veían hasta recargar). Sin ese selector no hay nada que refrescar. La biblioteca de tipos DOCUMENTALES, que es lo que ofrece la paleta, no
 * viene de aquí: la lee el navegador (`cargarBiblioteca`, de `configuracion.svelte.ts`) al abrir la sesión.
 */
import { redirect } from '@sveltejs/kit';

import { puedeAdministrar } from '$lib/usuarios/permisos';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!puedeAdministrar(locals.usuario)) redirect(303, '/');
};
