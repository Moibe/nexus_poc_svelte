/**
 * Dónde está cada campo en un documento de ejemplo (2026-11-11, Moibe: «que a un lado mostremos el documento y marcados etiquetados los campos
 * seleccionados»). Lo contesta `/api/procesadores/ubicar-campos` (Gemini): por campo, la página y una caja `[ymin, xmin, ymax, xmax]` de 0 a 1000
 * respecto a la página. Aquí, lo puro: qué documentos se pueden marcar y cómo pasar una caja a porcentajes para pintarla encima de la página a
 * cualquier tamaño.
 */

export type Ubicacion = {
	campo: string;
	pagina: number;
	/** `[ymin, xmin, ymax, xmax]`, de 0 a 1000. */
	caja: [number, number, number, number];
	valor: string;
};

/** Lo que Gemini lee (PDF, JPG y PNG) es también lo que el navegador sabe pintar; el TIFF no se puede ni marcar ni enseñar. */
export function sePuedeMarcar(archivo: Pick<File, 'name' | 'type'>): boolean {
	const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
	return ['pdf', 'jpg', 'jpeg', 'png'].includes(extension) || ['application/pdf', 'image/jpeg', 'image/png'].includes(archivo.type);
}

export const esPdf = (archivo: Pick<File, 'name' | 'type'>) => archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf');

/** El lado más largo, en píxeles, de la imagen que se manda a ubicar (y se enseña). Más no mejora la ubicación y pesa más. */
export const LADO_MAXIMO_PX = 2400;

/**
 * La foto ENDEREZADA, para ubicar y para enseñar (2026-11-11). Una foto de celular suele guardarse de lado con una etiqueta EXIF que dice cómo
 * girarla: el navegador la enseña derecha, pero Gemini la recibía sin girar y sus cajas caían en otro marco (en la prueba con un pasaporte
 * guardado así: los valores bien leídos y las cajas en cualquier lado; la MRZ salía como una franja vertical). Aquí se pinta en un canvas ya
 * girada (`imageOrientation: 'from-image'`) y se exporta sin EXIF, reducida a `LADO_MAXIMO_PX`: lo que ve Gemini y lo que se pinta debajo de
 * las marcas son los MISMOS píxeles. Un PDF se devuelve tal cual. Si el navegador no puede, se devuelve el original.
 */
export async function imagenDerecha(archivo: File): Promise<File> {
	if (esPdf(archivo) || !sePuedeMarcar(archivo)) return archivo;
	try {
		const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
		const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * escala);
		canvas.height = Math.round(bitmap.height * escala);
		const ctx = canvas.getContext('2d');
		if (!ctx) return archivo;
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();
		const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
		if (!blob) return archivo;
		// Mismo nombre (es el que se enseña en las pestañas); el tipo dice la verdad: ahora es JPEG.
		return new File([blob], archivo.name, { type: 'image/jpeg' });
	} catch {
		return archivo;
	}
}

/** La caja como `top/left/width/height` en porcentaje de la página. */
export function cajaEnPorcentaje([ymin, xmin, ymax, xmax]: Ubicacion['caja']) {
	return { top: ymin / 10, left: xmin / 10, width: (xmax - xmin) / 10, height: (ymax - ymin) / 10 };
}

/** Solo las ubicaciones bien formadas (lo que llega del servidor se revisa otra vez: es lo que se pinta). */
export function leerUbicaciones(datos: unknown): Ubicacion[] {
	const lista = (datos as { ubicaciones?: unknown } | null)?.ubicaciones;
	if (!Array.isArray(lista)) return [];
	return lista.flatMap((u) => {
		const caja = u?.caja;
		if (typeof u?.campo !== 'string' || !Array.isArray(caja) || caja.length !== 4 || !caja.every((n: unknown) => typeof n === 'number' && n >= 0 && n <= 1000)) return [];
		if (caja[2] <= caja[0] || caja[3] <= caja[1]) return [];
		const pagina = Number.isInteger(u.pagina) && u.pagina >= 1 ? u.pagina : 1;
		return [{ campo: u.campo, pagina, caja: caja as Ubicacion['caja'], valor: typeof u.valor === 'string' ? u.valor : '' }];
	});
}
