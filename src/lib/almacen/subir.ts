/**
 * Subir bytes al almacén desde el navegador, vía el BFF `POST /api/archivos`.
 *
 * Vive aparte porque lo usan dos caminos que no se conocen entre sí: el modal
 * de "Cargar ejemplo documental" (un archivo que el usuario acaba de elegir) y
 * la migración de los ejemplos viejos que todavía guardan sus bytes en
 * base64 dentro de `localStorage` (ver `migrarEjemplos.ts`). Si cada uno
 * armara su propio `fetch`, el día que cambie el contrato del BFF uno de los
 * dos se quedaría atrás sin que nadie lo note.
 *
 * No lanza: devuelve el puntero o el motivo, porque los dos llamadores deciden
 * cosas distintas con un fallo — el modal lo muestra, la migración lo registra
 * y lo reintenta otro día.
 */

export type PunteroAlmacen = { rutaRelativa: string; sha256: string; mime: string };

export type ResultadoSubida =
	| { ok: true; puntero: PunteroAlmacen }
	/** `status` es 0 cuando ni siquiera hubo respuesta (red caída). */
	| { ok: false; status: number; mensaje: string };

export async function subirAlAlmacen(
	archivo: Blob,
	nombre: string,
	tenant: string
): Promise<ResultadoSubida> {
	const cuerpo = new FormData();
	cuerpo.append('archivo', archivo, nombre);
	cuerpo.append('tenant', tenant);
	let r: Response;
	try {
		r = await fetch('/api/archivos', { method: 'POST', body: cuerpo });
	} catch {
		return { ok: false, status: 0, mensaje: 'No se pudo contactar al servidor para guardar el archivo.' };
	}
	const datos = await r.json().catch(() => null);
	if (!r.ok) {
		return {
			ok: false,
			status: r.status,
			mensaje: datos?.mensaje ?? `No se pudo guardar el archivo (${r.status}).`
		};
	}
	if (
		typeof datos?.rutaRelativa !== 'string' ||
		datos.rutaRelativa === '' ||
		typeof datos?.sha256 !== 'string' ||
		typeof datos?.mime !== 'string'
	) {
		// Un 200 sin puntero no es un éxito: guardarlo dejaría un ejemplo que
		// apunta a ninguna parte y que ya no tiene sus bytes.
		return { ok: false, status: r.status, mensaje: 'El servidor respondió sin decir dónde quedó el archivo.' };
	}
	return {
		ok: true,
		puntero: { rutaRelativa: datos.rutaRelativa, sha256: datos.sha256, mime: datos.mime }
	};
}
