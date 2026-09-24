/**
 * BFF: sirve al navegador un archivo guardado en el almacén.
 *
 * Es la otra mitad de `POST /api/archivos`: el catálogo guarda una RUTA
 * RELATIVA en vez de los bytes, y esta ruta es la que un `<img src>` puede
 * pedir. Tiene que pasar por aquí y no ir directo a nexus_back porque la
 * API exige `X-API-Key`, y esa llave no puede llegar al navegador.
 *
 * `[...ruta]` es un parámetro de resto a propósito: la ruta del almacén trae
 * diagonales (`csi/3f/a9/3fa9…`), así que un `[ruta]` normal solo capturaría
 * el primer segmento.
 */

import { error, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, cabecerasNexus, urlNexus } from '$lib/server/nexus';

export const GET: RequestHandler = async ({ params, url }) => {
	const ruta = params.ruta ?? '';
	if (ruta === '') error(400, 'Falta la ruta del archivo.');

	// El MIME lo decide quien guardó (el catálogo lo tiene) porque el almacén no
	// lo persiste: en disco los objetos no tienen extensión. nexus_back lo valida
	// contra su lista blanca antes de devolverlo, así que no hace falta repetir
	// esa validación aquí — pero sí pasarlo.
	const mime = url.searchParams.get('mime') ?? 'application/octet-stream';

	let respuesta: Response;
	try {
		respuesta = await fetch(
			urlNexus(`/archivos/${ruta}?mime=${encodeURIComponent(mime)}`),
			{ headers: cabecerasNexus(), signal: AbortSignal.timeout(TIMEOUT_MS) }
		);
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		error(504, esTimeout ? 'La lectura tardó demasiado.' : 'No se pudo contactar a nexus_back.');
	}

	if (!respuesta.ok) {
		// Un 404 aquí es normal y no es una falla: pasa con un ejemplo guardado
		// antes de que existiera el almacén, o con uno que se borró del disco.
		// Quien lo pinta muestra su propio hueco.
		error(respuesta.status, `No se pudo leer el archivo (${respuesta.status}).`);
	}

	const cuerpo = await respuesta.arrayBuffer();
	return new Response(cuerpo, {
		headers: {
			'Content-Type': respuesta.headers.get('content-type') ?? mime,
			// Se respeta el cacheo que manda nexus_back: el nombre del objeto ES el
			// hash de su contenido, así que una ruta nunca cambia de bytes.
			'Cache-Control':
				respuesta.headers.get('cache-control') ?? 'public, max-age=31536000, immutable'
		}
	});
};
