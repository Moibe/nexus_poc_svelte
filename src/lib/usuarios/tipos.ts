/** Los tipos de la pantalla de usuarios (HU06, HU07). Viven aquí y no en
 *  `+page.server.ts` para que los componentes del cliente puedan importarlos
 *  sin arrastrar nada del servidor. */

export type UsuarioDeOrganizacion = {
	guid: string;
	/** El consecutivo que el diseño muestra como ID: 001, 002… */
	numero: string;
	nombre: string;
	email: string;
	telefono: string | null;
	rol: string | null;
	/** El nombre visible del rol, ya resuelto por el servidor. */
	rolNombre: string;
	activo: boolean;
	creadoEn: string | null;
	debeCambiarContrasena: boolean;
};

export type Rol = { codigo: string; nombre: string; descripcion: string };
