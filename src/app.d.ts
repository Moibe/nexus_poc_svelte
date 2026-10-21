// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
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
