/**
 * El texto de un fallo de los puentes del pipeline (`/api/pipeline/*`), para mostrarlo en la fila del documento.
 *
 * Los puentes contestan sus errores como `{ mensaje }`, pero no todo error llega con esa forma, y hasta el 2026-10-29 lo que no la
 * traía se contaba como «La API respondió 403 al clasificar.», que no le dice nada a nadie:
 *
 *   · SvelteKit responde SUS errores (`error(403, …)`, p. ej. «Tu cuenta no pertenece a ninguna organización») como `{ message }`:
 *     ese texto sí se puede mostrar.
 *   · La comprobación de origen de SvelteKit (CSRF) responde un 403 en TEXTO PLANO («Cross-site POST form submissions are
 *     forbidden») cuando la página se abrió por una dirección que el servidor no reconoce (ver `csrf.trustedOrigins` en
 *     `vite.config.ts`). No hay nada que leer del cuerpo, y es lo único que da un 403 sin cuerpo legible, así que se explica.
 *
 * Lo del clasificador que falta NO pasa por aquí: lo dice el back con su propia frase (un 409 con `mensaje`).
 */
export function mensajeDeFallo(datos: unknown, status: number, durante = ''): string {
	const d = datos as { mensaje?: unknown; message?: unknown } | null;
	if (typeof d?.mensaje === 'string' && d.mensaje.trim()) return d.mensaje;
	if (typeof d?.message === 'string' && d.message.trim()) return d.message;
	if (status === 403) {
		return 'El servidor rechazó la petición. Abre la aplicación desde su dirección oficial; si ya lo hiciste, avisa a quien la administra.';
	}
	return `La API respondió ${status}${durante ? ` ${durante}` : ''}.`;
}
