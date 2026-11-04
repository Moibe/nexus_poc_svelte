// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			/** El código con que el servidor anotó el detalle de un error inesperado (`handleError` de `hooks.server.ts`, NEX-567). */
			referencia?: string;
		}
		interface Locals {
			/** El usuario de la sesión, o `null`. Lo pone `hooks.server.ts`. */
			usuario: import('$lib/server/sesion').Usuario | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
