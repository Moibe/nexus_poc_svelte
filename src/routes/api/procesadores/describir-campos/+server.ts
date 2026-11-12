/**
 * BFF: completar VARIOS campos a partir de sus recuadros sobre un documento de ejemplo (2026-11-12, Moibe: «quiero que ese etiquetado sí sirva para
 * definir el schema»; eligió «El recuadro completa el campo»). Reenvía el documento, `campos` (JSON `[{nombre, tipoDato, descripcion, pagina, caja}]`)
 * y, si vienen, el nombre y la descripción del tipo a `POST /procesadores/describir-campos` de nexus_back, que devuelve
 * `{ campos: [{nombre, descripcion, tipoDato, valorEstructura, valor}] }`: por campo, lo que se escribió mirando su recuadro. No guarda nada.
 */

import type { RequestHandler } from '@sveltejs/kit';

import { reenviarDocumentoAGemini } from '$lib/server/documentoAGemini';

export const POST: RequestHandler = (evento) =>
	reenviarDocumentoAGemini(evento, {
		ruta: '/procesadores/describir-campos',
		textos: {
			campos: { tope: 60000, requerido: true },
			nombreTipo: { tope: 200 },
			descripcionTipo: { tope: 2000 }
		},
		faltan: 'Faltan los campos con sus recuadros.',
		tardo: 'Leer los recuadros tardó demasiado y se canceló.'
	});
