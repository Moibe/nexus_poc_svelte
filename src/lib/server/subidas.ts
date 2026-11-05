/**
 * Lo que las rutas de subida de archivos comprueban sobre el archivo mismo (NEX-563, auditoría de seguridad 2026-10-30).
 *
 * Hasta ahora el BFF solo validaba el TAMAÑO; el tipo lo validaban la pantalla (por la extensión, que escribe quien sube) y nexus_back. Aquí se
 * mira la FIRMA —los primeros bytes—, que es lo único que dice qué es en realidad el archivo: la app procesa PDF, JPEG, PNG y TIFF, y
 * cualquier otra cosa se rechaza con un 415 antes de gastar una llamada a Document AI o de guardarla en el almacén.
 */

import { json } from '@sveltejs/kit';

import { firmaDeArchivo } from '$lib/server/seguridad';

/** `null` si el archivo es un PDF, JPEG, PNG o TIFF por sus primeros bytes; si no, la respuesta 415 que hay que devolver. */
export async function rechazarSiNoEsDocumento(archivo: File): Promise<Response | null> {
	const cabeza = new Uint8Array(await archivo.slice(0, 1100).arrayBuffer());
	if (firmaDeArchivo(cabeza)) return null;
	return json({ mensaje: 'El archivo no es un PDF, JPG, PNG o TIFF válido.', codigo: 'tipo_no_permitido' }, { status: 415 });
}
