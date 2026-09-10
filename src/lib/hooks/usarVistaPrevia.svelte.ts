/**
 * Vista previa de un documento subido, como object URL.
 *
 * Nació dentro de `DetalleDocumentoSheet.svelte` (líneas 50-71 hasta el
 * 2026-09-10) y se sacó aquí cuando "Registro de OT" necesitó exactamente lo
 * mismo. Se extrajo en vez de copiarse porque son doce líneas cuyo valor está
 * en DOS decisiones sutiles —abajo— que en una copia se pierden en cuanto
 * alguien toque una de las dos pantallas y no la otra.
 */

/** Formatos que el navegador sabe pintar en un `<img>`.
 *
 *  TIFF NO está, aunque sea una imagen perfectamente válida y el dropzone la
 *  acepte: ningún motor de los grandes lo soporta nativamente. Sin este filtro
 *  el usuario ve el ícono de imagen rota en vez del ícono de archivo. */
const PREVISUALIZABLES = ['JPG', 'JPEG', 'PNG'];

export function sePuedePrevisualizar(extension: string): boolean {
	return PREVISUALIZABLES.includes(extension);
}

/**
 * Devuelve un objeto con `.url`: el object URL vivo del documento, o `null`.
 *
 * Se llama durante la inicialización del componente, como cualquier runa.
 * `obtener` es una función y no el valor para que el `$effect` pueda volver a
 * leerlo cuando cambie el documento.
 *
 * DECISIÓN 1 — se revoca a mano. Un object URL reserva memoria hasta que se
 * revoca; el navegador NO la libera solo al cerrar el modal. Sin el retorno de
 * limpieza del `$effect`, abrir el detalle de veinte documentos deja veinte
 * archivos retenidos.
 *
 * DECISIÓN 2 — depende del DOCUMENTO, no de si el panel está abierto. Si
 * dependiera de `open`, la vista previa se borraría al empezar la animación de
 * cierre y se vería el panel vaciarse mientras se desliza. Como el documento
 * solo cambia cuando se abre otro, la URL vive exactamente lo que debe.
 */
export function usarVistaPrevia(
	obtener: () => { archivo: File; extension: string } | null
): { readonly url: string | null } {
	let url = $state<string | null>(null);

	$effect(() => {
		const documento = obtener();
		if (!documento || !sePuedePrevisualizar(documento.extension)) {
			url = null;
			return;
		}
		const creada = URL.createObjectURL(documento.archivo);
		url = creada;
		return () => {
			URL.revokeObjectURL(creada);
			url = null;
		};
	});

	return {
		get url() {
			return url;
		}
	};
}
