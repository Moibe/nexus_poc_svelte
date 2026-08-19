/**
 * Detección de documentos que no se van a poder procesar: protegidos con
 * contraseña, o corruptos/ilegibles.
 *
 * Se hace inspeccionando los bytes del archivo (firmas y estructura), sin
 * librerías de parseo pesadas y sin tocar `crypto.subtle` ni ninguna otra API
 * restringida a contexto seguro — el server de CSI sirve por HTTP plano.
 *
 * ALCANCE, para tenerlo claro: esto detecta los casos evidentes, no valida el
 * documento a fondo.
 *   - SÍ detecta: archivo vacío, archivo cuyo contenido no corresponde a su
 *     extensión (ej. un .exe renombrado a .pdf), archivo truncado a medias,
 *     PDF cifrado, y Office (docx/xlsx) cifrado.
 *   - NO detecta: un PDF con encabezado válido pero con la tabla de referencias
 *     rota adentro, o un documento que abre pero cuyo contenido es basura. Para
 *     eso haría falta parsear el formato completo (pdf.js y similares), que es
 *     mucho más peso y no aporta para una PoC.
 *
 * Cuando el pipeline real corra del lado del servidor, esa validación profunda
 * le toca a él; esto es el filtro rápido de la UI para no mandar a procesar algo
 * que de entrada se sabe que va a fallar.
 */

export type ProblemaDocumento = 'protegido' | 'corrupto';

// Firmas de formato ("magic numbers"): los primeros bytes que todo archivo
// válido de ese tipo tiene por especificación.
const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const FIRMA_ZIP = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" — docx/xlsx son ZIP por dentro
const FIRMA_CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // contenedor OLE
const FIRMA_JPEG = [0xff, 0xd8, 0xff];
const FIRMA_TIFF_LE = [0x49, 0x49, 0x2a, 0x00]; // "II*\0" little-endian
const FIRMA_TIFF_BE = [0x4d, 0x4d, 0x00, 0x2a]; // "MM\0*" big-endian

function empiezaCon(bytes: Uint8Array, firma: number[]): boolean {
	if (bytes.length < firma.length) return false;
	return firma.every((byte, i) => bytes[i] === byte);
}

/** Bytes de un texto ASCII, para buscarlo dentro del binario. */
function comoAscii(texto: string): number[] {
	return Array.from(texto, (caracter) => caracter.charCodeAt(0));
}

/** Bytes de un texto en UTF-16LE (cada carácter ASCII seguido de 0x00), que es
 * como guarda sus nombres de stream el contenedor OLE de Office. */
function comoUtf16le(texto: string): number[] {
	return Array.from(texto, (caracter) => [caracter.charCodeAt(0), 0x00]).flat();
}

function contiene(bytes: Uint8Array, secuencia: number[], desde = 0): boolean {
	const limite = bytes.length - secuencia.length;
	for (let i = Math.max(0, desde); i <= limite; i++) {
		let coincide = true;
		for (let j = 0; j < secuencia.length; j++) {
			if (bytes[i + j] !== secuencia[j]) {
				coincide = false;
				break;
			}
		}
		if (coincide) return true;
	}
	return false;
}

function revisarPdf(bytes: Uint8Array): ProblemaDocumento | null {
	// Sin el encabezado no es un PDF, sin importar cómo se llame el archivo.
	if (!empiezaCon(bytes, FIRMA_PDF)) return 'corrupto';

	// Un PDF cifrado declara un diccionario /Encrypt. Se busca en todo el
	// archivo y no solo al final porque con cross-reference streams el trailer
	// no siempre queda en los últimos bytes.
	//
	// Falso positivo teóricamente posible: que el texto "/Encrypt" aparezca
	// literal dentro de un stream de contenido. En la práctica los streams van
	// comprimidos (FlateDecode), así que es muy improbable — y el costo de
	// equivocarse aquí es una etiqueta roja de más, no perder datos.
	if (contiene(bytes, comoAscii('/Encrypt'))) return 'protegido';

	// Todo PDF completo cierra con el marcador %%EOF. Si no está en la cola,
	// el archivo se truncó (descarga a medias, copia interrumpida).
	// Se revisan los últimos 2 KB y no solo los últimos bytes porque es común
	// que haya relleno o metadatos después del marcador.
	const colaDesde = Math.max(0, bytes.length - 2048);
	if (!contiene(bytes, comoAscii('%%EOF'), colaDesde)) return 'corrupto';

	return null;
}

function revisarOoxml(bytes: Uint8Array): ProblemaDocumento | null {
	// Un docx/xlsx normal es un ZIP.
	if (empiezaCon(bytes, FIRMA_ZIP)) return null;

	// Si en cambio es un contenedor OLE, hay dos posibilidades: un Office
	// cifrado (el ZIP real va dentro de un stream llamado "EncryptedPackage"),
	// o un .doc/.xls viejo renombrado. Solo el primero es "protegido".
	if (empiezaCon(bytes, FIRMA_CFB)) {
		if (contiene(bytes, comoUtf16le('EncryptedPackage'))) return 'protegido';
		// Formato legado, no es problema de contraseña — se deja pasar y que el
		// pipeline decida si lo soporta.
		return null;
	}

	return 'corrupto';
}

function revisarJpeg(bytes: Uint8Array): ProblemaDocumento | null {
	if (!empiezaCon(bytes, FIRMA_JPEG)) return 'corrupto';

	// Un JPEG completo termina con el marcador EOI (FF D9). Se busca en los
	// últimos 64 bytes porque algunos traen metadatos después del marcador.
	const colaDesde = Math.max(0, bytes.length - 64);
	if (!contiene(bytes, [0xff, 0xd9], colaDesde)) return 'corrupto';

	return null;
}

function revisarTiff(bytes: Uint8Array): ProblemaDocumento | null {
	if (!empiezaCon(bytes, FIRMA_TIFF_LE) && !empiezaCon(bytes, FIRMA_TIFF_BE)) {
		return 'corrupto';
	}
	return null;
}

/**
 * Revisa los bytes de un archivo y devuelve el problema encontrado, o null si
 * no se detectó ninguno. `extension` va en minúsculas y sin punto ('pdf').
 */
export function detectarProblema(bytes: Uint8Array, extension: string): ProblemaDocumento | null {
	if (bytes.length === 0) return 'corrupto';

	switch (extension.toLowerCase()) {
		case 'pdf':
			return revisarPdf(bytes);
		case 'docx':
		case 'xlsx':
			return revisarOoxml(bytes);
		case 'jpg':
		case 'jpeg':
			return revisarJpeg(bytes);
		case 'tiff':
			return revisarTiff(bytes);
		default:
			return null;
	}
}
