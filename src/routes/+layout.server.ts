/** El usuario de la sesión, para la barra superior y las pantallas del primer
 *  acceso. Lo pone `hooks.server.ts`; aquí solo se publica a las páginas. */

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, depends }) => {
	// Para que `invalidateAll()` (tras entrar o cambiar la contraseña) vuelva a
	// correr esto y no se quede el usuario de antes.
	depends('app:sesion');
	return { usuario: locals.usuario };
};
