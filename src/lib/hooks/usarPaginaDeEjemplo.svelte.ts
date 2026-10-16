/**
 * La IMAGEN de una página de un documento de ejemplo, lista para ponerle un `<img>` (2026-10-16).
 *
 * Es lo que hace que la interfaz de etiquetado sirva para PDF de varias páginas. Cada pantalla que muestra un documento de
 * ejemplo —el recortador, «ver el documento completo», la miniatura de un recorte guardado— le pide AQUÍ la página que toca y
 * recibe una URL, sin saber si salió del almacén o de pintar el PDF.
 *
 * De dónde sale la imagen:
 *
 *   · Una imagen (JPG/PNG), o la página 1 de un PDF: la de siempre, `fuenteDeDocumento(doc)`. Es la ruta rápida y no abre pdf.js:
 *     al subir un PDF ya se guardó su página 1 como PNG, y así una INE o un pasaporte se comportan exactamente como antes.
 *   · La página 2 en adelante de un PDF: se pinta desde el ORIGINAL (`pdfDeEjemplo`), que se baja del almacén una vez. Cada
 *     imagen es un object URL que se revoca solo al cambiar de página o de pantalla (misma razón que `usarVistaPrevia`: el
 *     navegador no libera esa memoria por su cuenta).
 *   · Un PDF viejo del que solo quedó la página 1 como imagen (`esPdfSinOriginal`): no hay de dónde pintar las demás. Tiene
 *     UNA página, y pedir otra es un fallo, no una imagen equivocada.
 *
 * `numPaginas` es `null` mientras no se sabe. Se sabe de inmediato si el documento lo guardó (los subidos desde el 2026-10-16),
 * y si no, solo cuando quien lo pide dice `contar: true` y el PDF se abrió: abrir el original solo para decir «20 páginas» en
 * una tarjeta sería bajar hasta 20 MB por un número.
 */
import { untrack } from 'svelte';

import { pdfDeEjemplo } from '$lib/documentos/paginasPdf';
import {
	esPdfSinOriginal,
	fuenteDeDocumento,
	type DocumentoEjemploInstancia
} from '$lib/state/configuracion.svelte';

export type EntradaPagina = {
	doc: DocumentoEjemploInstancia | null;
	/** De 1 en adelante. */
	pagina: number;
	/** Abrir el PDF aunque la página pedida sea la 1, solo para saber cuántas páginas tiene. */
	contar?: boolean;
};

export type EstadoPagina = 'cargando' | 'listo' | 'fallo';

export function usarPaginaDeEjemplo(obtener: () => EntradaPagina): {
	readonly url: string;
	readonly estado: EstadoPagina;
	readonly numPaginas: number | null;
} {
	let url = $state('');
	let estado = $state<EstadoPagina>('cargando');
	let numPaginas = $state<number | null>(null);

	// Lo que de verdad cambia la imagen, como valores simples: el objeto del documento lo reemplaza cada recarga de la biblioteca
	// (misma ruta, mismos bytes) y eso NO debe volver a pintar la página debajo de quien está dibujando encima.
	const llave = $derived.by(() => {
		const { doc } = obtener();
		return doc ? `${doc.id}|${doc.rutaRelativa ?? ''}|${doc.rutaVista ?? ''}|${doc.tipo}|${doc.paginas ?? ''}` : '';
	});
	const pagina = $derived(obtener().pagina);
	const contar = $derived(obtener().contar === true);

	$effect(() => {
		void llave;
		const n = pagina;
		const quiereContar = contar;
		const doc = untrack(() => obtener().doc);

		if (!doc) {
			url = '';
			estado = 'cargando';
			numPaginas = null;
			return;
		}

		const esPdf = doc.tipo === 'PDF';
		const sinOriginal = esPdf && (esPdfSinOriginal(doc) || !doc.rutaRelativa);

		if (!esPdf || sinOriginal) {
			// Una sola página: la imagen que ya existe. Pedir otra no tiene de dónde salir.
			numPaginas = 1;
			if (n > 1) {
				url = '';
				estado = 'fallo';
			} else {
				url = fuenteDeDocumento(doc);
				estado = 'listo';
			}
			return;
		}

		numPaginas = doc.paginas ?? null;

		// Ruta rápida: la página 1 ya está pintada en el almacén, y si no hay que contar no se abre el PDF.
		if (n <= 1 && (!quiereContar || doc.paginas)) {
			url = fuenteDeDocumento(doc);
			estado = 'listo';
			return;
		}

		let vigente = true;
		let creada: string | null = null;
		url = '';
		estado = 'cargando';
		pdfDeEjemplo(doc)
			.then(async (pdf) => {
				if (!vigente) return;
				numPaginas = pdf.numPaginas;
				if (n < 1 || n > pdf.numPaginas) {
					estado = 'fallo';
					return;
				}
				// La 1 sigue saliendo del almacén (ya pintada); solo se pinta lo que no existe.
				if (n === 1) {
					url = fuenteDeDocumento(doc);
					estado = 'listo';
					return;
				}
				const blob = await pdf.renderizar(n);
				if (!vigente) return;
				creada = URL.createObjectURL(blob);
				url = creada;
				estado = 'listo';
			})
			.catch(() => {
				if (vigente) estado = 'fallo';
			});
		return () => {
			vigente = false;
			if (creada) URL.revokeObjectURL(creada);
			creada = null;
		};
	});

	return {
		get url() {
			return url;
		},
		get estado() {
			return estado;
		},
		get numPaginas() {
			return numPaginas;
		}
	};
}
