/**
 * Subir archivos a un expediente (2026-10-30, pedido de Moibe): lo que se puede subir y lo que se le dice a la persona.
 *
 * Es lógica PURA (sin Svelte ni red) para poder probarla sola. Los límites son los de la bandeja de nexus_back, que son los de todas las
 * subidas del producto: PDF, JPEG, PNG y TIFF, de hasta 20 MB y no vacíos. El servidor los vuelve a comprobar; esto solo evita mandar
 * lo que ya se sabe que va a rechazar y dice por qué sin esperar la ida y vuelta.
 */

/** Las extensiones que acepta la bandeja. `tif` y `tiff` son el mismo formato (el navegador manda `image/tiff` con las dos). */
export const EXTENSIONES_ACEPTADAS = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'] as const;

/** El tope por archivo, en MB: el mismo del dropzone del Pipeline, del puente `/api/expedientes/[id]/documentos` y de `MAX_SUBIDA_MB` en el back. */
export const MAX_MB_SUBIDA = 20;

/** Lo que va en el `accept` del `<input type="file">`: `.pdf,.jpg,…`. */
export const ACEPTAR_ATRIBUTO = EXTENSIONES_ACEPTADAS.map((e) => `.${e}`).join(',');

/** Lo mínimo que hace falta saber de un archivo para validarlo (un `File` lo cumple). */
export type ArchivoParaValidar = { name: string; size: number };

/** Por qué un archivo NO se puede subir, o `null` si sí. El texto sigue a «nombre.ext: …» en la pantalla. */
export function motivoDeRechazo(archivo: ArchivoParaValidar): string | null {
	const punto = archivo.name.lastIndexOf('.');
	const extension = punto >= 0 ? archivo.name.slice(punto + 1).toLowerCase() : '';
	if (!(EXTENSIONES_ACEPTADAS as readonly string[]).includes(extension)) return 'formato no permitido (solo PDF, JPG, PNG y TIFF)';
	if (archivo.size === 0) return 'el archivo está vacío';
	if (archivo.size > MAX_MB_SUBIDA * 1024 * 1024) return `archivo demasiado grande (máximo ${MAX_MB_SUBIDA} MB)`;
	return null;
}

/** «1 archivo», «3 archivos». */
export const cuantosArchivos = (n: number): string => `${n} ${n === 1 ? 'archivo' : 'archivos'}`;

/**
 * El aviso verde de la página cuando se cierra la subida. `null` si no se subió ninguno (no hay nada bueno que avisar: los errores ya
 * se vieron en la ventana). Si algunos fallaron, lo dice sin esconderlo.
 */
export function avisoDeSubida(expediente: string, subidos: number, fallidos: number): { titulo: string; cuerpo: string } | null {
	if (subidos <= 0) return null;
	const hecho = `Se ${subidos === 1 ? 'subió' : 'subieron'} ${cuantosArchivos(subidos)} a «${expediente}».`;
	const resto = fallidos > 0 ? ` ${cuantosArchivos(fallidos)} no se ${fallidos === 1 ? 'pudo' : 'pudieron'} subir.` : '';
	return { titulo: subidos === 1 ? 'Archivo subido' : 'Archivos subidos', cuerpo: hecho + resto };
}
