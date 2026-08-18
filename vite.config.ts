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
			adapter: adapter()
		})
	]
});
