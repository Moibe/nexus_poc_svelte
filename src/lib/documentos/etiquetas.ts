/**
 * Dónde va la etiqueta (el nombre) de cada recuadro sobre el documento, para que no tape lo marcado (2026-11-12). Antes iba siempre ARRIBA del
 * recuadro, y en renglones seguidos (los apellidos y el nombre de una credencial, las líneas de un domicilio) la etiqueta de cada uno tapaba el
 * renglón de arriba y se encimaba con la etiqueta vecina: no se veía qué estaba marcado. Lógica pura, sin pantalla.
 *
 * Por cada recuadro, de arriba hacia abajo, se prueba la etiqueta arriba, a la derecha, abajo y a la izquierda, y se queda el primer lugar que no
 * pisa ningún recuadro (ni el suyo) ni otra etiqueta ya puesta y que cabe en la página. Si ninguno está libre, el que menos pisa.
 */

/** `[ymin, xmin, ymax, xmax]`, de 0 a 1000 respecto a la página (como las cajas de `ubicaciones.ts`). */
export type Caja = [number, number, number, number];
export type Lado = 'arriba' | 'derecha' | 'abajo' | 'izquierda';

export type EtiquetaPorColocar = {
	clave: string;
	caja: Caja;
	/** El tamaño de la etiqueta en píxeles de pantalla. */
	anchoPx: number;
	altoPx: number;
	/** Cuánto se separa la etiqueta de su recuadro, en píxeles (el que se edita lleva esquinas por fuera: va más lejos). */
	separacionPx: number;
};

const ORDEN: Lado[] = ['arriba', 'derecha', 'abajo', 'izquierda'];

function traslape(a: Caja, b: Caja): number {
	const alto = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
	const ancho = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
	return alto > 0 && ancho > 0 ? alto * ancho : 0;
}

/** El rectángulo que ocuparía la etiqueta de `e` en ese lado, en milésimas de la página. */
export function rectanguloDeEtiqueta(e: EtiquetaPorColocar, lado: Lado, pagina: { anchoPx: number; altoPx: number }): Caja {
	const sx = 1000 / pagina.anchoPx;
	const sy = 1000 / pagina.altoPx;
	const [y0, x0, y1, x1] = e.caja;
	const ancho = e.anchoPx * sx;
	const alto = e.altoPx * sy;
	const centro = (y0 + y1) / 2;
	switch (lado) {
		case 'arriba':
			return [y0 - e.separacionPx * sy - alto, x0, y0 - e.separacionPx * sy, x0 + ancho];
		case 'abajo':
			return [y1 + e.separacionPx * sy, x0, y1 + e.separacionPx * sy + alto, x0 + ancho];
		case 'derecha':
			return [centro - alto / 2, x1 + e.separacionPx * sx, centro + alto / 2, x1 + e.separacionPx * sx + ancho];
		case 'izquierda':
			return [centro - alto / 2, x0 - e.separacionPx * sx - ancho, centro + alto / 2, x0 - e.separacionPx * sx];
	}
}

/**
 * El lado de cada etiqueta, por su `clave`. `otras` son recuadros que no llevan etiqueta aquí pero tampoco se deben tapar (el que se está dibujando).
 * Sin tamaño de página (aún no se pinta) todas van arriba.
 */
export function colocarEtiquetas(etiquetas: EtiquetaPorColocar[], pagina: { anchoPx: number; altoPx: number }, otras: Caja[] = []): Record<string, Lado> {
	const lados: Record<string, Lado> = {};
	if (!(pagina.anchoPx > 0 && pagina.altoPx > 0)) {
		for (const e of etiquetas) lados[e.clave] = 'arriba';
		return lados;
	}
	const recuadros = [...etiquetas.map((e) => e.caja), ...otras];
	const puestas: Caja[] = [];
	const ordenadas = [...etiquetas].sort((a, b) => a.caja[0] - b.caja[0] || a.caja[1] - b.caja[1]);
	for (const e of ordenadas) {
		let mejor: { lado: Lado; rect: Caja; costo: number } | null = null;
		for (const lado of ORDEN) {
			const rect = rectanguloDeEtiqueta(e, lado, pagina);
			const fuera = rect[0] < 0 || rect[1] < 0 || rect[2] > 1000 || rect[3] > 1000;
			const costo =
				(fuera ? 1e9 : 0) + recuadros.reduce((s, c) => s + traslape(rect, c), 0) + puestas.reduce((s, c) => s + traslape(rect, c), 0);
			if (!mejor || costo < mejor.costo) mejor = { lado, rect, costo };
			if (costo === 0) break;
		}
		lados[e.clave] = mejor!.lado;
		puestas.push(mejor!.rect);
	}
	return lados;
}
