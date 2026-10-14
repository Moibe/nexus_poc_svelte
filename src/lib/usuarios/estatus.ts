/** El estatus que se le pinta a cada usuario en los listados de Usuarios y de
 *  Organizaciones. Vive aquí para que las dos pantallas digan lo mismo.
 *
 *  Además de Activo e Inactivo, el diseño no dibuja nada para quien todavía no
 *  hizo su primer acceso, y sin eso el administrador no tiene cómo saber a quién
 *  reenviarle la invitación (HU06, CA-6): "Pendiente" es la cuenta que sigue
 *  esperando su primer acceso y "Caducada" la que dejó pasar las horas de su
 *  contraseña temporal (HU06, CA-5) y ya no puede entrar con ella. */

import type { UsuarioDeOrganizacion } from './tipos';

export type Estatus = { texto: 'Activo' | 'Inactivo' | 'Pendiente' | 'Caducada'; clases: string };

export function estatusDe(u: Pick<UsuarioDeOrganizacion, 'activo' | 'debeCambiarContrasena' | 'accesoVencido'>): Estatus {
	if (!u.activo) return { texto: 'Inactivo', clases: 'bg-muted text-muted-foreground' };
	if (u.debeCambiarContrasena && u.accesoVencido) return { texto: 'Caducada', clases: 'bg-red-50 text-red-700' };
	if (u.debeCambiarContrasena) return { texto: 'Pendiente', clases: 'bg-amber-50 text-amber-700' };
	return { texto: 'Activo', clases: 'bg-green-50 text-green-700' };
}

/** Solo a quien sigue sin hacer su primer acceso se le puede reenviar la
 *  invitación; a una cuenta desactivada primero se le reactiva. El servidor
 *  lo vuelve a exigir. */
export function puedeReenviarInvitacion(u: Pick<UsuarioDeOrganizacion, 'activo' | 'debeCambiarContrasena'>): boolean {
	return u.activo && u.debeCambiarContrasena;
}
