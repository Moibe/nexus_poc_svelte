/**
 * Búsqueda · la respuesta como gráfica (NEX-610, 2026-11-26). Lo puro: cuándo una respuesta se presta para gráfica, qué se grafica y dónde va
 * cada cosa. Sin DOM: el ancho de un texto llega como función (`Medir`), así que se prueba con Node.
 *
 * La gráfica la arma Biblioratum con las MISMAS filas de la tabla: el modelo no la dibuja ni escribe código para dibujarla, y cambiar entre
 * tabla y gráfica no vuelve a preguntar nada. Se ofrece solo cuando la respuesta es un RESUMEN:
 *   · una columna de categorías (barras) o de fechas (línea), con un renglón por cada una (si se repite, no es un resumen por esa columna);
 *   · y al menos una columna de números (si hay varias, se elige cuál graficar).
 * No se ofrece con un solo renglón (un número suelto), sin números (una lista de nombres) ni con la columna `documento` (una lista de documentos
 * o de datos: nexus_back la pide justo ahí, y nunca en conteos ni totales).
 *
 * Fechas que se entienden, como las devuelve nexus_back: `AAAA-MM` (por mes; el ejemplo del back usa FORMAT(fecha, 'yyyy-MM')), `AAAA-MM-DD`
 * (por día), `AAAA` o un entero en una columna «Año» (por año) y fecha con hora ISO.
 *
 * Las barras siguen el orden de la tabla cuando trae uno con sentido (por la categoría, como Q1…Q4, o por el número); si no, van de mayor a menor.
 * Con más de 12 categorías se enseñan las 12 mayores y el resto se junta en «Otras», SOLO si la columna se puede sumar (conteos, totales):
 * sumar promedios, porcentajes o confianzas daría un número que no está en ningún lado, así que con esas se enseñan las 12 y se dice que las
 * demás están en la tabla. Los números de las barras y de la línea son los de la tabla, con el mismo formato.
 */

import { MESES, esColumnaNumerica, formatearCelda, formatearNumero, indicesOcultos } from './busqueda';

/** El ancho en píxeles de un texto con la letra de la gráfica (12 px) y el peso dado. En el navegador lo mide un canvas; en las pruebas, una regla. */
export type Medir = (texto: string, peso?: 400 | 500 | 600) => number;

export type Escala = 'anio' | 'mes' | 'dia' | 'momento';

/** Qué se grafica: la columna de categorías o de fechas (`dimension`), cómo se lee el tiempo (`escala`, solo en línea) y qué columnas de números. */
export type Plan =
	| { forma: 'barras'; dimension: number; escala: null; medidas: number[] }
	| { forma: 'linea'; dimension: number; escala: Escala; medidas: number[] };

/** Cuántas barras se enseñan; con más categorías, el resto se junta en «Otras». */
export const TOPE_BARRAS = 12;

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DIA = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MOMENTO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?$/;
const ANIO = /^(19|20|21)\d{2}$/;
const DIA_MS = 86_400_000;

function normal(texto: string): string {
	return texto
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim();
}

function vacio(v: unknown): boolean {
	return v === null || v === undefined || v === '';
}

/** ¿Una columna «Año» con enteros de 1900 a 2100? (`YEAR(fecha) AS [Año]`). */
function esColumnaDeAnio(nombre: string, filas: unknown[][], i: number): boolean {
	if (!/^(ano|anio|year|ejercicio)\b/.test(normal(nombre))) return false;
	let vistos = 0;
	for (const f of filas) {
		const v = f[i];
		if (vacio(v)) continue;
		if (typeof v !== 'number' || !Number.isInteger(v) || v < 1900 || v > 2100) return false;
		vistos++;
	}
	return vistos > 0;
}

/** Cómo se lee el tiempo de una columna de texto, o `null` si no es de fechas (o mezcla formas). */
function escalaDe(filas: unknown[][], i: number): Escala | null {
	const vistas = new Set<Escala>();
	for (const f of filas) {
		const v = f[i];
		if (vacio(v)) continue;
		if (typeof v !== 'string') return null;
		if (MES.test(v)) vistas.add('mes');
		else if (DIA.test(v)) vistas.add('dia');
		else if (MOMENTO.test(v) && !Number.isNaN(Date.parse(v.endsWith('Z') ? v : v + 'Z'))) vistas.add('momento');
		else if (ANIO.test(v)) vistas.add('anio');
		else return null;
	}
	return vistas.size === 1 ? [...vistas][0] : null;
}

/** El momento de una fecha en su escala: meses y días como enteros seguidos (para ver dónde falta un periodo), años tal cual, fecha con hora en ms. */
function tiempoDe(valor: unknown, escala: Escala): number | null {
	if (escala === 'anio') {
		if (typeof valor === 'number' && Number.isInteger(valor)) return valor;
		return typeof valor === 'string' && ANIO.test(valor) ? Number(valor) : null;
	}
	if (typeof valor !== 'string') return null;
	if (escala === 'mes') {
		const m = MES.exec(valor);
		return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
	}
	if (escala === 'dia') {
		const m = DIA.exec(valor);
		return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DIA_MS : null;
	}
	const ms = Date.parse(valor.endsWith('Z') ? valor : valor + 'Z');
	return Number.isNaN(ms) ? null : ms;
}

function cuantosConValor(filas: unknown[][], medida: number, dimension: number | null): number {
	return filas.filter((f) => typeof f[medida] === 'number' && Number.isFinite(f[medida]) && (dimension === null || !vacio(f[dimension]))).length;
}

/**
 * ¿Se presta para gráfica? Devuelve qué graficar o `null`. Ver el encabezado: un resumen por categorías o por fechas con al menos dos renglones
 * graficables, sin `documento`, con una sola columna que no es número (o una columna «Año») y un renglón por cada valor de esa columna.
 */
export function planDeGrafica(columnas: string[], filas: unknown[][]): Plan | null {
	if (filas.length < 2) return null;
	if (columnas.some((c) => normal(c) === 'documento')) return null;
	const ocultas = indicesOcultos(columnas);
	const visibles = columnas.map((_, i) => i).filter((i) => !ocultas.has(i));
	const numericas = visibles.filter((i) => esColumnaNumerica(filas, i));
	// Una columna sin ningún valor no es categoría de nada: no estorba.
	const resto = visibles.filter((i) => !numericas.includes(i) && filas.some((f) => !vacio(f[i])));

	let dimension: number;
	let escala: Escala | null;
	if (resto.length === 1) {
		dimension = resto[0];
		escala = escalaDe(filas, dimension);
	} else if (resto.length === 0) {
		const anio = numericas.find((i) => esColumnaDeAnio(columnas[i], filas, i));
		if (anio === undefined) return null;
		dimension = anio;
		escala = 'anio';
	} else {
		return null;
	}

	// Un renglón por categoría o por periodo.
	const vistos = new Set<string>();
	for (const f of filas) {
		const clave = JSON.stringify(f[dimension] ?? null);
		if (vistos.has(clave)) return null;
		vistos.add(clave);
	}

	// Columnas de números con al menos dos renglones que se pueden dibujar (en línea, con fecha).
	const medidas = numericas.filter((i) => i !== dimension && cuantosConValor(filas, i, escala ? dimension : null) >= 2);
	if (medidas.length === 0) return null;
	return escala ? { forma: 'linea', dimension, escala, medidas } : { forma: 'barras', dimension, escala: null, medidas };
}

/** «Documentos por tipo documental»: la medida por la dimensión, con los nombres de las columnas (los alias en español del back). */
export function tituloDeGrafica(columnas: string[], plan: Plan, medida: number): string {
	const nombre = (i: number) => columnas[i]?.trim() || `Columna ${i + 1}`;
	const dimension = nombre(plan.dimension);
	// «Tipo documental» → «tipo documental», pero «CURP» se queda como está.
	const enMedio = /^\p{Lu}\p{Ll}/u.test(dimension) ? dimension[0].toLocaleLowerCase('es') + dimension.slice(1) : dimension;
	return `${nombre(medida)} por ${enMedio}`;
}

/** ¿Tiene sentido sumar esta columna? Conteos y totales sí; promedios, mínimos, máximos, porcentajes, confianzas o tasas no. */
export function esSumable(nombre: string): boolean {
	return !/promedio|media|mediana|minim|maxim|porcentaje|%|tasa|confianza|proporcion|indice|ratio|calificacion|puntaje|edad/.test(normal(nombre));
}

function redondear(n: number): number {
	return Number.parseFloat(n.toPrecision(15));
}

function plural(n: number, uno: string, varios: string): string {
	return `${formatearNumero(n)} ${n === 1 ? uno : varios}`;
}

// ── Barras ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Una barra: su categoría como se lee en la tabla, su valor, y cuántas categorías junta (solo «Otras»). `fila`: el renglón de la tabla. */
export type Barra = { etiqueta: string; valor: number; juntas: number; fila: number | null };

export type DatosBarras = {
	barras: Barra[];
	/** Cuántas categorías hay con valor (antes de juntar). */
	total: number;
	/** Cuántas quedaron fuera sin juntarse (columnas que no se suman). */
	fuera: number;
	/** Renglones sin número en la columna graficada. */
	sinValor: number;
	sumable: boolean;
};

/** La categoría como se lee en la tabla; lo vacío, «(sin dato)». */
export function etiquetaDeCategoria(valor: unknown): string {
	return vacio(valor) ? '(sin dato)' : formatearCelda(valor);
}

function compararCategorias(a: unknown, b: unknown): number {
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
	return String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true, sensitivity: 'base' });
}

function enOrden<T>(lista: T[], comparar: (a: T, b: T) => number): boolean {
	return lista.every((x, i) => i === 0 || comparar(lista[i - 1], x) <= 0) || lista.every((x, i) => i === 0 || comparar(lista[i - 1], x) >= 0);
}

/**
 * ¿La tabla ya trae un orden con sentido? Por la categoría (Q1…Q4, rangos, Sí/No, o el alfabeto si así se pidió) o por el número (de más a menos, o al
 * revés si se preguntó por los que tienen menos). Entonces las barras lo respetan; si no, van de mayor a menor.
 */
function conOrden(barras: Barra[], filas: unknown[][], dimension: number): boolean {
	return enOrden(barras.map((b) => b.valor), (a, b) => a - b) || enOrden(barras.map((b) => filas[b.fila ?? 0]?.[dimension]), compararCategorias);
}

/**
 * Las barras en el orden de la tabla si trae uno con sentido (`conOrden`); si no, de mayor a menor (empates, en el orden de la tabla). Con más de `tope`,
 * las `tope` mayores, de mayor a menor, y «Otras» con la suma del resto.
 */
export function barrasDe(columnas: string[], filas: unknown[][], plan: Plan, medida: number, tope = TOPE_BARRAS): DatosBarras {
	const todas: Barra[] = [];
	filas.forEach((f, i) => {
		const v = f[medida];
		if (typeof v === 'number' && Number.isFinite(v)) todas.push({ etiqueta: etiquetaDeCategoria(f[plan.dimension]), valor: v, juntas: 0, fila: i });
	});
	const sinValor = filas.length - todas.length;
	const sumable = esSumable(columnas[medida] ?? '');
	const base = { total: todas.length, sinValor, sumable };
	const deMayorAMenor = [...todas].sort((a, b) => b.valor - a.valor || (a.fila ?? 0) - (b.fila ?? 0));
	if (todas.length <= tope) return { ...base, barras: conOrden(todas, filas, plan.dimension) ? todas : deMayorAMenor, fuera: 0 };
	const primeras = deMayorAMenor.slice(0, tope);
	const resto = deMayorAMenor.slice(tope);
	if (!sumable) return { ...base, barras: primeras, fuera: resto.length };
	const otras: Barra = { etiqueta: 'Otras', valor: redondear(resto.reduce((s, b) => s + b.valor, 0)), juntas: resto.length, fila: null };
	return { ...base, barras: [...primeras, otras], fuera: 0 };
}

// ── Línea ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Un punto: su momento en la escala (`t`), cómo se lee la fecha, el valor y el renglón de la tabla. */
export type Punto = { t: number; etiqueta: string; valor: number; fila: number };

export type DatosLinea = {
	puntos: Punto[];
	/** Puntos seguidos: la línea se corta donde falta un periodo (un mes sin renglón NO es cero: no está en la tabla). */
	tramos: Punto[][];
	sinFecha: number;
	sinValor: number;
};

function anioDeT(t: number, escala: Escala): number {
	if (escala === 'anio') return t;
	if (escala === 'mes') return Math.floor(t / 12);
	if (escala === 'dia') return new Date(t * DIA_MS).getUTCFullYear();
	return new Date(t).getFullYear();
}

/** Cómo se lee una fecha en la gráfica. `conAnio = false` la acorta para el eje («ene», «15 mar») cuando el año ya se dijo. */
export function etiquetaDeTiempo(t: number, escala: Escala, conAnio = true): string {
	if (escala === 'anio') return String(t);
	if (escala === 'mes') {
		const mes = MESES[((t % 12) + 12) % 12];
		return conAnio ? `${mes} ${Math.floor(t / 12)}` : mes;
	}
	if (escala === 'dia') {
		const d = new Date(t * DIA_MS);
		const corta = `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
		return conAnio ? `${corta} ${d.getUTCFullYear()}` : corta;
	}
	const d = new Date(t);
	const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	return `${d.getDate()} ${MESES[d.getMonth()]}${conAnio ? ` ${d.getFullYear()}` : ''}, ${hora}`;
}

/** Los puntos en orden de fecha, partidos en tramos seguidos. Lo que no tiene fecha o valor no se dibuja (y se cuenta, para decirlo). */
export function lineaDe(filas: unknown[][], plan: Plan, medida: number): DatosLinea {
	const escala = plan.escala ?? 'dia';
	const puntos: Punto[] = [];
	let sinFecha = 0;
	let sinValor = 0;
	filas.forEach((f, i) => {
		const t = vacio(f[plan.dimension]) ? null : tiempoDe(f[plan.dimension], escala);
		if (t === null) {
			sinFecha++;
			return;
		}
		const v = f[medida];
		if (typeof v !== 'number' || !Number.isFinite(v)) {
			sinValor++;
			return;
		}
		puntos.push({ t, etiqueta: escala === 'momento' ? formatearCelda(f[plan.dimension]) : etiquetaDeTiempo(t, escala), valor: v, fila: i });
	});
	puntos.sort((a, b) => a.t - b.t);
	const tramos: Punto[][] = [];
	for (const p of puntos) {
		const actual = tramos.at(-1);
		const previo = actual?.at(-1);
		if (actual && previo && (escala === 'momento' || p.t - previo.t <= 1)) actual.push(p);
		else tramos.push([p]);
	}
	return { puntos, tramos, sinFecha, sinValor };
}

// ── Escalas y texto ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Las marcas del eje con números redondos (pasos de 1, 2 o 5 por potencia de 10). Con `conCero`, el cero siempre entra (conteos y totales);
 * sin él, se ajusta a los datos (promedios, porcentajes). Con `enteros`, el paso nunca es menor que 1.
 */
export function escalaLinda(minimo: number, maximo: number, { enteros = false, conCero = true, marcas = 5 } = {}): { desde: number; hasta: number; paso: number; marcas: number[] } {
	let bajo = conCero ? Math.min(0, minimo) : minimo;
	let alto = conCero ? Math.max(0, maximo) : maximo;
	if (bajo === alto) {
		const holgura = Math.abs(bajo) * 0.1 || 1;
		if (conCero && bajo === 0) alto = 1;
		else {
			bajo -= holgura;
			alto += holgura;
		}
	}
	const crudo = (alto - bajo) / marcas;
	const potencia = 10 ** Math.floor(Math.log10(crudo));
	const fraccion = crudo / potencia;
	let paso = (fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10) * potencia;
	if (enteros) paso = Math.max(1, Math.round(paso));
	const decimales = Math.max(0, -Math.floor(Math.log10(paso)));
	const fijar = (n: number) => Number(n.toFixed(decimales));
	const desde = fijar(Math.floor(bajo / paso) * paso);
	const hasta = fijar(Math.ceil(alto / paso) * paso);
	const lista: number[] = [];
	for (let k = 0; desde + k * paso <= hasta + paso / 2; k++) lista.push(fijar(desde + k * paso));
	return { desde, hasta, paso, marcas: lista };
}

const COMPACTO = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

/** Un número del eje: completo por debajo de 10,000; compacto («12.5 k», «1.5 M») cuando el eje llega a 10,000. */
export function formatoEje(valor: number, mayorDelEje: number): string {
	return Math.abs(mayorDelEje) >= 10_000 ? COMPACTO.format(valor) : formatearNumero(valor);
}

/** El texto que cabe en `ancho`, con «…» si hubo que cortarlo (el completo va en el aviso flotante y en la tabla). */
export function recortar(texto: string, ancho: number, medir: Medir): string {
	if (medir(texto) <= ancho) return texto;
	let bajo = 0;
	let alto = texto.length;
	while (bajo < alto) {
		const medio = Math.ceil((bajo + alto) / 2);
		if (medir(texto.slice(0, medio).trimEnd() + '…') <= ancho) bajo = medio;
		else alto = medio - 1;
	}
	return texto.slice(0, bajo).trimEnd() + '…';
}

// ── Acomodo: barras ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Medidas fijas de las barras: renglón de 30 px, barra de 18 (nunca más de 24), punta redondeada de 4 y base recta. */
export const BARRAS = { fila: 30, grosor: 18, radio: 4, separacionEtiqueta: 10, separacionValor: 6, margen: 2 } as const;

export type BarraDispuesta = Barra & {
	/** Arriba del renglón y su centro. */
	arriba: number;
	centro: number;
	/** El contorno de la barra (vacío si vale cero). */
	d: string;
	xFin: number;
	etiquetaVisible: string;
	valorTexto: string;
	xValor: number;
	anclaValor: 'start' | 'end';
};

export type BarrasDispuestas = { ancho: number; alto: number; xEtiquetas: number; xCero: number; filas: BarraDispuesta[] };

/** Una barra con la base recta y la punta redondeada, crezca a la derecha o a la izquierda. */
export function caminoDeBarra(xBase: number, xFin: number, arriba: number, grosor: number, radio: number): string {
	const largo = Math.abs(xFin - xBase);
	if (largo < 0.5) return '';
	const r = Math.min(radio, largo, grosor / 2);
	const s = xFin >= xBase ? 1 : -1;
	const giro = s > 0 ? 1 : 0;
	const n = (v: number) => Math.round(v * 100) / 100;
	return (
		`M${n(xBase)},${n(arriba)}H${n(xFin - s * r)}A${n(r)},${n(r)} 0 0 ${giro} ${n(xFin)},${n(arriba + r)}` +
		`V${n(arriba + grosor - r)}A${n(r)},${n(r)} 0 0 ${giro} ${n(xFin - s * r)},${n(arriba + grosor)}H${n(xBase)}Z`
	);
}

/**
 * Dónde va cada barra en un ancho dado: las categorías a la izquierda (alineadas a la barra, cortadas con «…» si no caben en ~30 % del ancho, 40 % en
 * pantallas angostas), las barras desde el cero y el valor en la punta. Todas las barras llevan su valor, así que no hace falta eje de valores.
 */
export function disponerBarras(barras: Barra[], ancho: number, medir: Medir): BarrasDispuestas {
	const { fila, grosor, radio, separacionEtiqueta, separacionValor, margen } = BARRAS;
	const textos = barras.map((b) => formatearNumero(b.valor));
	const anchoValor = Math.ceil(Math.max(0, ...textos.map((t) => medir(t, 500)))) + separacionValor;
	const largoEtiquetas = Math.ceil(Math.max(0, ...barras.map((b) => medir(b.etiqueta))));
	const xEtiquetas = Math.min(largoEtiquetas, Math.max(64, Math.floor(ancho * (ancho < 480 ? 0.4 : 0.3))));
	const valores = barras.map((b) => b.valor);
	const hayNegativos = valores.some((v) => v < 0);
	const x0 = xEtiquetas + separacionEtiqueta + (hayNegativos ? anchoValor : 0);
	const x1 = Math.max(x0 + 40, ancho - anchoValor - margen);
	const minimo = Math.min(0, ...valores);
	const maximo = Math.max(0, ...valores);
	const rango = maximo - minimo || 1;
	const xDe = (v: number) => x0 + ((v - minimo) / rango) * (x1 - x0);
	const xCero = xDe(0);
	const filas = barras.map((b, i): BarraDispuesta => {
		const arriba = i * fila + (fila - grosor) / 2;
		const xFin = xDe(b.valor);
		const negativa = b.valor < 0;
		return {
			...b,
			arriba,
			centro: i * fila + fila / 2,
			d: caminoDeBarra(xCero, xFin, arriba, grosor, radio),
			xFin,
			etiquetaVisible: recortar(b.etiqueta, xEtiquetas, medir),
			valorTexto: textos[i],
			xValor: negativa ? xFin - separacionValor : xFin + separacionValor,
			anclaValor: negativa ? 'end' : 'start'
		};
	});
	return { ancho, alto: barras.length * fila, xEtiquetas, xCero, filas };
}

// ── Acomodo: línea ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Medidas fijas de la línea: 300 px de alto con el eje de fechas incluido, línea de 2 px, puntos de 8 px (radio 4) con anillo del color de la tarjeta. */
export const LINEA = { alto: 300, arriba: 26, abajo: 30, derecha: 12, separacionEje: 8, margenInterno: 10, radio: 4, maxPuntosVisibles: 60 } as const;

export type PuntoDispuesto = Punto & { x: number; y: number; visible: boolean };
export type MarcaX = { x: number; texto: string; izquierda: number };

export type LineaDispuesta = {
	ancho: number;
	alto: number;
	plot: { x0: number; x1: number; y0: number; y1: number };
	marcasY: { y: number; texto: string; base: boolean }[];
	/** Donde se apoya el área: el cero si está en el eje; si no, el piso. */
	yBase: number;
	marcasX: MarcaX[];
	tramos: { linea: string; area: string }[];
	puntos: PuntoDispuesto[];
	final: { x: number; y: number; texto: string; ancla: 'start' | 'middle' | 'end' } | null;
};

/**
 * Dónde va cada cosa de la línea: el eje de valores a la izquierda (números redondos, rejilla fina), las fechas abajo (las que caben sin encimarse,
 * siempre la última, el año solo en la primera y cuando cambia), la línea por tramos seguidos con su área tenue y el valor del último punto.
 */
export function disponerLinea(datos: DatosLinea, escala: Escala, conCero: boolean, ancho: number, medir: Medir): LineaDispuesta {
	const { alto, arriba, abajo, derecha, separacionEje, margenInterno, maxPuntosVisibles } = LINEA;
	const valores = datos.puntos.map((p) => p.valor);
	const minimo = Math.min(...valores);
	const maximo = Math.max(...valores);
	const y = escalaLinda(minimo, maximo, { enteros: valores.every(Number.isInteger), conCero: conCero || minimo < 0 });
	const mayor = Math.max(Math.abs(y.desde), Math.abs(y.hasta));
	const textosY = y.marcas.map((v) => formatoEje(v, mayor));
	const x0 = Math.ceil(Math.max(0, ...textosY.map((t) => medir(t)))) + separacionEje;
	const plot = { x0, x1: ancho - derecha, y0: arriba, y1: alto - abajo };
	const tMin = datos.puntos[0]?.t ?? 0;
	const tMax = datos.puntos.at(-1)?.t ?? 0;
	const xDe = (t: number) =>
		tMax === tMin ? (plot.x0 + plot.x1) / 2 : plot.x0 + margenInterno + ((t - tMin) / (tMax - tMin)) * (plot.x1 - plot.x0 - 2 * margenInterno);
	const yDe = (v: number) => plot.y1 - ((v - y.desde) / (y.hasta - y.desde || 1)) * (plot.y1 - plot.y0);
	const yBase = y.desde <= 0 && y.hasta >= 0 ? yDe(0) : plot.y1;
	const n = (v: number) => Math.round(v * 100) / 100;

	const aislados = new Set(datos.tramos.filter((t) => t.length === 1).map((t) => t[0]));
	const ultimo = datos.puntos.at(-1);
	const dispuestos = new Map<Punto, PuntoDispuesto>();
	for (const p of datos.puntos) {
		dispuestos.set(p, { ...p, x: xDe(p.t), y: yDe(p.valor), visible: datos.puntos.length <= maxPuntosVisibles || aislados.has(p) || p === ultimo });
	}
	const puntos = [...dispuestos.values()];

	const tramos = datos.tramos
		.filter((t) => t.length > 1)
		.map((t) => {
			const ps = t.map((p) => dispuestos.get(p)!);
			const linea = 'M' + ps.map((p) => `${n(p.x)},${n(p.y)}`).join('L');
			const area = `M${n(ps[0].x)},${n(yBase)}L` + ps.map((p) => `${n(p.x)},${n(p.y)}`).join('L') + `L${n(ps.at(-1)!.x)},${n(yBase)}Z`;
			return { linea, area };
		});

	const marcasY = y.marcas.map((v, i) => ({ y: yDe(v), texto: textosY[i], base: v === 0 || (i === 0 && y.desde > 0) }));

	// Las fechas del eje: se miden con año (lo más ancho que pueden ser) para no encimarlas al ponerle el año a alguna.
	const SEPARACION = 14;
	const caja = (x: number, w: number) => {
		const izquierda = Math.min(Math.max(x - w / 2, 0), Math.max(0, ancho - w));
		return { izquierda, derecha: izquierda + w };
	};
	const candidatas = puntos.map((p) => ({ p, w: medir(etiquetaDeTiempo(p.t, escala, true)) }));
	const puestas: typeof candidatas = [];
	for (const c of candidatas) {
		const previa = puestas.at(-1);
		if (!previa || caja(c.p.x, c.w).izquierda >= caja(previa.p.x, previa.w).derecha + SEPARACION) puestas.push(c);
	}
	const ultima = candidatas.at(-1);
	if (ultima && puestas.at(-1) !== ultima) {
		while (puestas.length && caja(ultima.p.x, ultima.w).izquierda < caja(puestas.at(-1)!.p.x, puestas.at(-1)!.w).derecha + SEPARACION) puestas.pop();
		puestas.push(ultima);
	}
	let anioPrevio: number | null = null;
	const marcasX = puestas.map(({ p }) => {
		const anio = anioDeT(p.t, escala);
		const texto = etiquetaDeTiempo(p.t, escala, anio !== anioPrevio);
		anioPrevio = anio;
		return { x: p.x, texto, izquierda: caja(p.x, medir(texto)).izquierda };
	});

	const fin = ultimo ? dispuestos.get(ultimo)! : null;
	const final = fin
		? {
				x: fin.x,
				y: fin.y - 10,
				texto: formatearNumero(fin.valor),
				ancla: (fin.x > plot.x1 - 40 ? 'end' : fin.x < plot.x0 + 40 ? 'start' : 'middle') as 'start' | 'middle' | 'end'
			}
		: null;

	return { ancho, alto, plot, marcasY, yBase, marcasX, tramos, puntos, final };
}

// ── Lo que se dice debajo ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Las notas bajo la gráfica: qué se juntó o quedó fuera y qué renglones no se dibujan, para que los números se puedan cuadrar con la tabla. */
export function notasDeBarras(datos: DatosBarras, tope = TOPE_BARRAS): string[] {
	const notas: string[] = [];
	const otras = datos.barras.find((b) => b.juntas > 0);
	if (otras) notas.push(`Se muestran las ${tope} mayores de ${formatearNumero(datos.total)}; «Otras» suma las ${formatearNumero(otras.juntas)} restantes.`);
	if (datos.fuera > 0)
		notas.push(`Se muestran las ${tope} mayores de ${formatearNumero(datos.total)}; las otras ${formatearNumero(datos.fuera)} están en la tabla (esta columna no se suma).`);
	if (datos.sinValor > 0) notas.push(`${plural(datos.sinValor, 'renglón sin valor no aparece', 'renglones sin valor no aparecen')} en la gráfica.`);
	return notas;
}

export function notasDeLinea(datos: DatosLinea, escala: Escala): string[] {
	const notas: string[] = [];
	if (escala !== 'momento' && datos.tramos.length > 1) notas.push('La línea se corta donde un periodo no tiene renglón en la tabla.');
	if (datos.sinFecha > 0) notas.push(`${plural(datos.sinFecha, 'renglón sin fecha no aparece', 'renglones sin fecha no aparecen')} en la gráfica.`);
	if (datos.sinValor > 0) notas.push(`${plural(datos.sinValor, 'renglón sin valor no aparece', 'renglones sin valor no aparecen')} en la gráfica.`);
	return notas;
}

/** Lo que oye quien usa lector de pantalla al llegar a la gráfica. */
export function descripcionDeGrafica(titulo: string, forma: Plan['forma'], cuantos: number, desde?: string, hasta?: string): string {
	if (forma === 'barras') return `Gráfica de barras: ${titulo}, ${plural(cuantos, 'barra', 'barras')}.`;
	return `Gráfica de línea: ${titulo}, ${plural(cuantos, 'punto', 'puntos')}${desde && hasta ? `, de ${desde} a ${hasta}` : ''}.`;
}
