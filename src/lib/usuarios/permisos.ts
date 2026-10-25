/**
 * Lo que cada rol puede ADMINISTRAR (NEX-472, 2026-10-22).
 *
 * Administrar es configurar lo que un tercero usa de NexusDoc y lo que define cómo se procesa: API Keys, webhooks, el motor de
 * reglas y la biblioteca de tipos documentales. Es el espejo de `roles.PUEDEN_ADMINISTRAR` de nexus_back, que es quien MANDA: el
 * servidor responde 403 `sin_permiso` a cualquier otro rol aunque este archivo diga otra cosa. Aquí solo se decide qué se
 * le OFRECE a la persona, para no enseñarle una puerta cerrada (mismo criterio que la pestaña «Usuarios»).
 *
 * Propuesta de producto, pendiente de confirmar con César: Administrador y Supervisor, y el administrador de plataforma.
 * Si cambia, cambia en los dos lados.
 *
 * El rol sale del JWT, que dura 15 minutos: a quien acaban de ascender, el menú le aparece al renovarse la sesión.
 */
import type { Usuario } from '$lib/server/sesion';

const ROLES_QUE_ADMINISTRAN = new Set(['ADMIN', 'SUPERVISOR']);

export function puedeAdministrar(usuario: Pick<Usuario, 'esAdminPlataforma' | 'rol'> | null | undefined): boolean {
	if (!usuario) return false;
	return usuario.esAdminPlataforma || (usuario.rol !== null && ROLES_QUE_ADMINISTRAN.has(usuario.rol));
}
