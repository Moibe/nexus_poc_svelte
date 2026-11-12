/**
 * BFF: proponer un campo NUEVO a partir de un recuadro dibujado sobre un documento de ejemplo (2026-11-12, Moibe eligió «Dibujar crea el campo»).
 * Reenvía el documento, la `pagina`, la `caja` (JSON `[ymin, xmin, ymax, xmax]` de 0 a 1000), `existentes` (JSON con los nombres que ya están en la
 * lista o en el tipo) y, si vienen, el nombre y la descripción del tipo a `POST /procesadores/proponer-campo` de nexus_back, que devuelve
 * `{ nombre, descripcion, tipoDato, valorEstructura, valor }`. No guarda nada: la persona lo revisa antes de agregarlo.
 */

import type { RequestHandler } from '@sveltejs/kit';

import { reenviarDocumentoAGemini } from '$lib/server/documentoAGemini';

export const POST: RequestHandler = (evento) =>
	reenviarDocumentoAGemini(evento, {
		ruta: '/procesadores/proponer-campo',
		textos: {
			caja: { tope: 200, requerido: true },
			pagina: { tope: 6, porOmision: '1' },
			existentes: { tope: 20000, porOmision: '[]' },
			nombreTipo: { tope: 200 },
			descripcionTipo: { tope: 2000 }
		},
		faltan: 'Falta el recuadro.',
		tardo: 'Leer el recuadro tardó demasiado y se canceló.'
	});
