import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: 7000,
		// Sin esto, si el 7000 está ocupado Vite se brinca al 7001 sin avisar y
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

			// adapter-node: el deploy va a pm2 en el server de CSI, que necesita un
			// servidor Node real (build/index.js) y no un target de plataforma.
			// Además la app va a proxear a nexus_back desde su capa server, así que
			// un build estático no serviría.
			//
			// OJO en producción: adapter-node NO autocarga el .env — build/env.js
			// solo lee process.env tal cual. Hay que arrancar con
			// `--node-args="--env-file=.env"`, si no Node usa sus defaults
			// (PORT=3000) en silencio y la app queda "online" en pm2 pero en el
			// puerto equivocado. Mismo tropiezo ya documentado en shape_up.
			adapter: adapter(),

			// El 403 "Cross-site POST form submissions are forbidden" al entrar por
			// dominio (2026-09-10). SvelteKit rechaza todo POST con FormData cuyo
			// header `Origin` no coincida con el origen que el server cree tener, y
			// ese origen está clavado por la variable ORIGIN del proceso pm2 en
			// `http://172.10.30.15:3400`. Entrando por IP coincide; entrando por
			// `nexus-doc.buzzword.com.mx` no, y el pipeline moría en el primer paso
			// con un mensaje que no explicaba nada (la respuesta es texto plano, así
			// que el front ni siquiera podía leer el detalle).
			//
			// La regla exacta está en node_modules/@sveltejs/kit/src/runtime/server/
			// respond.js:82-92: prohíbe si el content-type es de formulario, el
			// método muta, `origin !== url.origin` Y el origen no está en esta lista.
			//
			// Se agrega el dominio a la lista EN VEZ de mover ORIGIN, para que las
			// dos entradas sigan funcionando: mover ORIGIN al dominio habría dejado
			// fuera a la IP, que es por donde se sigue entrando a diario.
			//
			// Van las dos variantes de esquema a propósito: la comparación es por
			// cadena exacta, así que `https://` no cubre a `http://`. Y NO se usa
			// `trustedOrigins: ['*']`, que existe y apaga la comprobación entera.
			csrf: {
				trustedOrigins: [
					'https://nexus-doc.buzzword.com.mx',
					'http://nexus-doc.buzzword.com.mx'
				]
			}
		})
	]
});
