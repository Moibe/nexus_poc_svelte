/**
 * Búsqueda · bajar la gráfica como imagen PNG (NEX-610, 2026-11-26). Solo navegador.
 *
 * Se baja LO QUE SE VE: la misma `<svg>` de la pantalla, copiada, con el título de la gráfica y la pregunta arriba, las notas y la fecha abajo,
 * en el tema que se está viendo (claro u oscuro) y al doble de resolución. Para que la copia salga igual fuera de la página:
 *   · los colores son variables de CSS (`--grafica-*`, `--card`, `--foreground`, `--muted-foreground`): se leen ya resueltas y se escriben en la copia;
 *   · la letra (Plus Jakarta Sans) va DENTRO de la copia, como datos: una imagen SVG no puede pedir archivos de fuera, y sin ella saldría otra letra
 *     con otros anchos (las categorías se cortaron midiendo esta). Si no se pudiera bajar, sale con la letra del sistema, pero sale;
 *   · lo que solo sirve en pantalla (el renglón resaltado, la línea que sigue al puntero) lleva `data-solo-pantalla` y no se copia.
 * Nada de esto pide HTTPS (el servidor de CSI sirve por HTTP plano): canvas, Blob y el `<a download>` de `descargarBlob` funcionan igual.
 */

import fuente400 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?url';
import fuente500 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2?url';
import fuente600 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2?url';

const SVG = 'http://www.w3.org/2000/svg';
const VARIABLES = ['--card', '--foreground', '--muted-foreground', '--grafica-serie', '--grafica-serie-area', '--grafica-otras', '--grafica-rejilla', '--grafica-eje'];
const MARGEN = 24;

export type Encabezado = { titulo: string; subtitulo: string; notas: string[]; pie: string };

let fuentes: Promise<string> | null = null;

function comoDatos(url: string): Promise<string> {
	return fetch(url)
		.then((r) => {
			if (!r.ok) throw new Error(`fuente ${r.status}`);
			return r.blob();
		})
		.then(
			(blob) =>
				new Promise<string>((listo, falla) => {
					const lector = new FileReader();
					lector.onload = () => listo(String(lector.result));
					lector.onerror = () => falla(lector.error);
					lector.readAsDataURL(blob);
				})
		);
}

/** Las `@font-face` con la letra embebida (se bajan una vez por página). Si fallan, cadena vacía y se vuelve a intentar la próxima vez. */
function fuentesEmbebidas(): Promise<string> {
	fuentes ??= Promise.all(
		(
			[
				[400, fuente400],
				[500, fuente500],
				[600, fuente600]
			] as const
		).map(async ([peso, url]) => {
			const datos = await comoDatos(url);
			return `@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:${peso};src:url("${datos}") format('woff2');}`;
		})
	).then(
		(reglas) => reglas.join(''),
		() => {
			fuentes = null;
			return '';
		}
	);
	return fuentes;
}

/** Un texto partido en renglones que caben en `ancho` (a lo más `maximo`; el último se corta con «…»). */
function renglones(texto: string, ancho: number, contexto: CanvasRenderingContext2D, maximo: number): string[] {
	const salida: string[] = [];
	let actual = '';
	for (const palabra of texto.split(/\s+/).filter(Boolean)) {
		const prueba = actual ? `${actual} ${palabra}` : palabra;
		if (!actual || contexto.measureText(prueba).width <= ancho) actual = prueba;
		else {
			salida.push(actual);
			actual = palabra;
		}
	}
	if (actual) salida.push(actual);
	const cortados = salida.slice(0, maximo);
	if (salida.length > maximo || (cortados.length && contexto.measureText(cortados.at(-1)!).width > ancho)) {
		let ultimo = cortados.at(-1)!;
		while (ultimo.length > 1 && contexto.measureText(ultimo + '…').width > ancho) ultimo = ultimo.slice(0, -1).trimEnd();
		cortados[cortados.length - 1] = ultimo + '…';
	}
	return cortados;
}

function texto(contenido: string, x: number, y: number, tam: number, peso: number, color: string): SVGTextElement {
	const t = document.createElementNS(SVG, 'text');
	t.setAttribute('x', String(x));
	t.setAttribute('y', String(y));
	t.setAttribute('font-size', String(tam));
	t.setAttribute('font-weight', String(peso));
	t.setAttribute('style', `fill: var(${color})`);
	t.textContent = contenido;
	return t;
}

/**
 * La gráfica de la pantalla como PNG: `svg` es la de la tarjeta (ya dibujada, con su ancho real). Devuelve el archivo listo para `descargarBlob`.
 * `escala` 2 = el doble de píxeles, para que se lea bien en un documento o una presentación.
 */
export async function graficaComoPng(svg: SVGSVGElement, encabezado: Encabezado, escala = 2): Promise<Blob> {
	const estilo = getComputedStyle(svg);
	const familia = estilo.fontFamily;
	const variables = VARIABLES.map((v) => `${v}:${estilo.getPropertyValue(v).trim()};`).join('');
	const ancho = Math.round(svg.width.baseVal.value);
	const alto = Math.round(svg.height.baseVal.value);
	const anchoTotal = ancho + 2 * MARGEN;

	const contexto = document.createElement('canvas').getContext('2d');
	if (!contexto) throw new Error('Sin canvas.');
	contexto.font = `600 15px ${familia}`;
	const titulo = renglones(encabezado.titulo, ancho, contexto, 2);
	contexto.font = `400 12px ${familia}`;
	const subtitulo = renglones(encabezado.subtitulo, ancho, contexto, 3);
	const notas = encabezado.notas.flatMap((n) => renglones(n, ancho, contexto, 3));

	const raiz = document.createElementNS(SVG, 'svg');
	const estiloSvg = document.createElementNS(SVG, 'style');
	estiloSvg.textContent = `${await fuentesEmbebidas()}svg{${variables}font-family:${familia};}`;
	raiz.appendChild(estiloSvg);
	const fondo = document.createElementNS(SVG, 'rect');
	fondo.setAttribute('width', '100%');
	fondo.setAttribute('height', '100%');
	fondo.setAttribute('style', 'fill: var(--card)');
	raiz.appendChild(fondo);

	let y = MARGEN;
	for (const r of titulo) {
		raiz.appendChild(texto(r, MARGEN, y + 15, 15, 600, '--foreground'));
		y += 21;
	}
	y += 2;
	for (const r of subtitulo) {
		raiz.appendChild(texto(r, MARGEN, y + 12, 12, 400, '--muted-foreground'));
		y += 18;
	}
	y += 14;

	const copia = svg.cloneNode(true) as SVGSVGElement;
	copia.querySelectorAll('[data-solo-pantalla]').forEach((e) => e.remove());
	copia.removeAttribute('class');
	copia.setAttribute('x', String(MARGEN));
	copia.setAttribute('y', String(y));
	copia.setAttribute('width', String(ancho));
	copia.setAttribute('height', String(alto));
	copia.setAttribute('overflow', 'visible');
	raiz.appendChild(copia);
	y += alto + 14;

	for (const r of notas) {
		raiz.appendChild(texto(r, MARGEN, y + 12, 12, 400, '--muted-foreground'));
		y += 18;
	}
	if (notas.length) y += 6;
	raiz.appendChild(texto(encabezado.pie, MARGEN, y + 11, 11, 400, '--muted-foreground'));
	y += 16 + MARGEN;

	const altoTotal = Math.ceil(y);
	raiz.setAttribute('xmlns', SVG);
	raiz.setAttribute('width', String(anchoTotal));
	raiz.setAttribute('height', String(altoTotal));
	raiz.setAttribute('viewBox', `0 0 ${anchoTotal} ${altoTotal}`);

	const xml = new XMLSerializer().serializeToString(raiz);
	const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
	try {
		const imagen = new Image();
		await new Promise<void>((listo, falla) => {
			imagen.onload = () => listo();
			imagen.onerror = () => falla(new Error('No se pudo armar la imagen.'));
			imagen.src = url;
		});
		await imagen.decode().catch(() => undefined);
		const lienzo = document.createElement('canvas');
		lienzo.width = Math.round(anchoTotal * escala);
		lienzo.height = Math.round(altoTotal * escala);
		const dibujo = lienzo.getContext('2d');
		if (!dibujo) throw new Error('Sin canvas.');
		dibujo.scale(escala, escala);
		dibujo.drawImage(imagen, 0, 0, anchoTotal, altoTotal);
		return await new Promise<Blob>((listo, falla) => lienzo.toBlob((b) => (b ? listo(b) : falla(new Error('No se pudo armar la imagen.'))), 'image/png'));
	} finally {
		URL.revokeObjectURL(url);
	}
}
