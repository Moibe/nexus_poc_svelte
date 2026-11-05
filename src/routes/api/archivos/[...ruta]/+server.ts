/**
 * BFF: sirve al navegador un archivo guardado en el almacén.
 *
 * Es la otra mitad de `POST /api/archivos`: el catálogo guarda una RUTA
 * RELATIVA en vez de los bytes, y esta ruta es la que un `<img src>` puede
 * pedir. Tiene que pasar por aquí y no ir directo a nexus_back porque la
 * API exige `X-API-Key`, y esa llave no puede llegar al navegador.
 *
 * Reenvía también el JWT de la persona: nexus_back solo entrega un archivo a
 * quien pertenece a la organización dueña de la ruta (su primer segmento), y a
 * cualquier otra le contesta lo mismo que si no existiera (HU11).
 *
 * `[...ruta]` es un parámetro de resto a propósito: la ruta del almacén trae
 * diagonales (`csi/3f/a9/3fa9…`), así que un `[ruta]` normal solo capturaría
 * el primer segmento.
 */

import { error, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { TIPOS_PERMITIDOS, tipoDeContenidoSeguro } from '$lib/server/seguridad';
import { cabecerasConSesion } from '$lib/server/sesion';

/** La única forma de ruta que tiene un objeto del almacén:
 *  `{cliente}/{aa}/{bb}/{sha256}`. Todo lo demás se rechaza AQUÍ, antes de
 *  reenviar con la llave del servidor. Sin esto, este BFF —que entonces no
 *  pedía sesión— servía a cualquier navegador los registros internos del
 *  almacén (`.registro/llaves.jsonl`, con los hashes de las llaves de todos
 *  los clientes). nexus_back ya lo valida también; esto es el segundo
 *  cinturón. */
const FORMA_OBJETO = /^[A-Za-z0-9_-]{1,64}\/([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{64})$/;

export const GET: RequestHandler = async ({ cookies, params, url }) => {
	const ruta = params.ruta ?? '';
	if (ruta === '') error(400, 'Falta la ruta del archivo.');
	const forma = FORMA_OBJETO.exec(ruta);
	if (!forma || forma[1] + forma[2] !== forma[3].slice(0, 4)) error(404, 'No existe ese archivo.');

	// El MIME lo decide quien guardó (el catálogo lo tiene) porque el almacén no
	// lo persiste: en disco los objetos no tienen extensión. nexus_back lo valida
	// contra su lista blanca antes de devolverlo, pero NO se confía en eso solo
	// (NEX-558, auditoría de seguridad 2026-10-30): lo que pide el navegador
	// únicamente se reenvía si es PDF, JPEG, PNG o TIFF; cualquier otra cosa
	// (`text/html`, `image/svg+xml`…) se cambia por el genérico, y la respuesta
	// se arma más abajo con la misma lista blanca.
	const pedido = (url.searchParams.get('mime') ?? '').split(';')[0].trim().toLowerCase();
	const mime = TIPOS_PERMITIDOS.has(pedido) ? pedido : 'application/octet-stream';

	let respuesta: Response;
	try {
		respuesta = await fetch(
			urlNexus(`/archivos/${ruta}?mime=${encodeURIComponent(mime)}`),
			{ headers: cabecerasConSesion(cookies), signal: AbortSignal.timeout(TIMEOUT_MS) }
		);
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		error(504, esTimeout ? 'La lectura tardó demasiado.' : 'No se pudo contactar a nexus_back.');
	}

	if (!respuesta.ok) {
		// Un 404 aquí es normal y no es una falla: pasa con un ejemplo guardado
		// antes de que existiera el almacén, o con uno que se borró del disco.
		// Quien lo pinta muestra su propio hueco.
		//
		// El `detail` de nexus_back sí se pasa: lo redacta el back, no trae rutas
		// del servidor, y es lo único que distingue "falta configurar el almacén"
		// de "el NAS no contesta" cuando alguien diagnostica con curl.
		let motivo = `No se pudo leer el archivo (${respuesta.status}).`;
		try {
			const detalle = (await respuesta.json())?.detail;
			if (typeof detalle === 'string') motivo = detalle;
			else if (typeof detalle?.mensaje === 'string') motivo = detalle.mensaje;
		} catch {
			/* respuesta no-JSON: se queda el genérico */
		}
		// Un 5xx no enseña lo que dijo el back (NEX-567): se anota en el servidor y a la persona se le da un texto genérico.
		if (respuesta.status >= 500) {
			console.error(`[archivos] nexus_back respondió ${respuesta.status}: ${motivo}`);
			error(respuesta.status, 'No se pudo leer el archivo en este momento. Intenta de nuevo en unos minutos.');
		}
		error(respuesta.status, motivo);
	}

	const cuerpo = await respuesta.arrayBuffer();
	// El tipo de contenido sale de una lista blanca, no de lo que pidió el navegador (NEX-558): un archivo subido NO puede servirse como `text/html`
	// desde el mismo origen de la app. `nosniff` impide que el navegador lo adivine, y `Content-Disposition` hace que lo desconocido se DESCARGUE
	// en vez de abrirse.
	const tipo = tipoDeContenidoSeguro(respuesta.headers.get('content-type'), mime);
	return new Response(cuerpo, {
		headers: {
			'Content-Type': tipo,
			'X-Content-Type-Options': 'nosniff',
			'Content-Disposition': `${tipo === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="archivo"`,
			// Se respeta el cacheo que manda nexus_back: el nombre del objeto ES el
			// hash de su contenido, así que una ruta nunca cambia de bytes. Es
			// `private`: el archivo es de una organización, y una caché compartida
			// (un proxy, una CDN) se lo serviría a quien lo pidiera sin pasar por
			// la comprobación de arriba (HU11).
			'Cache-Control':
				respuesta.headers.get('cache-control') ?? 'private, max-age=31536000, immutable'
		}
	});
};
