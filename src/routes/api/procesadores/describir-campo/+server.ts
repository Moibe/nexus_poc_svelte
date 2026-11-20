/**
 * BFF: completar UN campo a partir de su recuadro sobre un documento de ejemplo (2026-11-11, Moibe: «sí, excelente, por favor la 1»; desde el
 * 2026-11-12 también su tipo y su estructura). El recuadro no viaja a Google; lo que hay dentro sirve para escribir lo que el extractor sí lee.
 * Reenvía el documento, el campo (`campo`, JSON `{nombre, tipoDato, descripcion}`), la `pagina`, la `caja` (JSON `[ymin, xmin, ymax, xmax]` de 0
 * a 1000) y, si vienen, el nombre y la descripción del tipo a `POST /procesadores/describir-campo` de nexus_back, que devuelve
 * `{ descripcion, tipoDato, valorEstructura, valor }`. No guarda nada. Lo común con los otros BFF de recuadros está en `reenviarDocumentoAGemini`.
 */

import type { RequestHandler } from '@sveltejs/kit';

import { reenviarDocumentoAGemini } from '$lib/server/documentoAGemini';

export const POST: RequestHandler = (evento) =>
	reenviarDocumentoAGemini(evento, {
		ruta: '/procesadores/describir-campo',
		textos: {
			campo: { tope: 2000, requerido: true },
			caja: { tope: 200, requerido: true },
			pagina: { tope: 6, porOmision: '1' },
			nombreTipo: { tope: 200 },
			descripcionTipo: { tope: 2000 }
		},
		faltan: 'Faltan el campo o su recuadro.',
		tardo: 'Leer el recuadro tardó demasiado y se canceló.'
	});
