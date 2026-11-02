/**
 * La huella (SHA-256) de un archivo elegido en el navegador, para avisar de duplicados antes de subirlo (2026-11-02).
 *
 * Se calcula con `js-sha256`, JavaScript puro, y no con `crypto.subtle`: esa API solo existe en contexto seguro (HTTPS o localhost) y el
 * servidor de CSI también se abre por HTTP plano en su IP, donde ni siquiera está definida (el mismo tropiezo y la misma salida que ya tiene
 * la bandeja, ver `bandeja.svelte.ts`). Es el mismo hash que guarda nexus_back al recibir los bytes, así que las dos huellas se pueden comparar.
 *
 * Se lee por TROZOS: un archivo de 20 MB hasheado de un jalón congela la página, y leyéndolo a pedazos —cada lectura es asíncrona— la página
 * respira entre uno y otro.
 */
import { sha256 } from 'js-sha256';

/** Cuánto se lee de golpe (4 MB). */
const TROZO = 4 * 1024 * 1024;

/** La huella en hexadecimal (minúsculas), o `null` si el archivo no se pudo leer (se movió, el navegador negó el permiso…): sin huella no se compara. */
export async function huellaDe(archivo: Blob): Promise<string | null> {
	try {
		const hash = sha256.create();
		for (let inicio = 0; inicio < archivo.size; inicio += TROZO) {
			hash.update(new Uint8Array(await archivo.slice(inicio, inicio + TROZO).arrayBuffer()));
		}
		return hash.hex();
	} catch {
		return null;
	}
}
