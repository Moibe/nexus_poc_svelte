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
