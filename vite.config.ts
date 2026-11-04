import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { ORIGENES_DE_CONFIANZA } from './src/lib/seguridad/origenes.ts';

export default defineConfig({
	server: {
		// El mismo puerto en local y en el servidor, para que un número sea
		// siempre el mismo proyecto (el inventario de puertos está en la
		// documentación operativa interna).
		port: 3400,
		// Sin esto, si el 3400 está ocupado Vite se brinca al 3401 sin avisar y
		// terminas hablándole a un server viejo sin darte cuenta. Mejor que truene.
		strictPort: true
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node: el deploy va a pm2 en el servidor, que necesita un
			// servidor Node real (build/index.js) y no un target de plataforma.
			// Además la app va a proxear a nexus_back desde su capa server, así que
			// un build estático no serviría.
			//
			// OJO en producción: adapter-node NO autocarga el .env — build/env.js
			// solo lee process.env tal cual. Hay que arrancar con
			// `--node-args="--env-file=.env"`, si no Node usa sus defaults
			// (PORT=3000) en silencio y la app queda "online" en pm2 pero en el
			// puerto equivocado.
			adapter: adapter(),

			// Comprobación de origen de los formularios (el 403 «Cross-site POST form submissions are forbidden»). SvelteKit rechaza todo
			// POST con FormData cuyo header `Origin` no coincida con el origen que el server cree tener (la variable ORIGIN del proceso) y
			// que tampoco esté en esta lista. La comparación es por cadena exacta, y NO se usa `trustedOrigins: ['*']`, que apaga la
			// comprobación entera.
			//
			// Cómo se agrega otro dominio: NO moviendo ORIGIN (arreglaría el dominio y rompería la otra entrada), sino agregándolo a
			// `src/lib/seguridad/origenes.ts`, que comparten esta comprobación y la de `hooks.server.ts` para las peticiones JSON (NEX-562). Se
			// hornea en el BUILD: reiniciar no aplica nada; hay que reconstruir. El detalle de cada ambiente vive en la documentación
			// operativa interna, no en el repositorio (NEX-565).
			csrf: {
				trustedOrigins: [...ORIGENES_DE_CONFIANZA]
			},

			// Content-Security-Policy EN FIRME (NEX-557, auditoría de seguridad 2026-10-30). La arma SvelteKit para que su único script en línea
			// (el que arranca la hidratación) lleve un NONCE y `script-src` NO necesite `'unsafe-inline'`: sin eso, un XSS inyectaría scripts en
			// línea sin que nada los frenara. Hasta aquí era `Content-Security-Policy-Report-Only` y no bloqueaba nada.
			//
			// Lo que la app necesita, y por qué está en la lista:
			//   · `worker-src blob:` y `script-src 'wasm-unsafe-eval'`: pdf.js (miniaturas y páginas de los PDF) arranca su worker y puede decodificar
			//     imágenes con WebAssembly. `'wasm-unsafe-eval'` NO permite `eval` de JavaScript.
			//   · `img-src data: blob:`: las vistas previas de documentos se pintan desde `blob:` y `data:`.
			//   · `style-src 'unsafe-inline'`: Svelte y las transiciones ponen estilos en línea. Es el único `unsafe-inline` que queda y no ejecuta código.
			//   · `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`: cierran lo que la app no usa.
			// Si algo se rompe en un ambiente, `CSP_SOLO_REPORTE=1` en el `.env` del servidor la vuelve a modo reporte sin reconstruir (ver `hooks.server.ts`).
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self', 'wasm-unsafe-eval'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:'],
					'font-src': ['self', 'data:'],
					'connect-src': ['self'],
					'worker-src': ['self', 'blob:'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	]
});
