/**
 * Búsqueda · lo puro de la pantalla «Búsqueda» (NEX-607, 2026-11-23): la forma de la respuesta, cómo se pinta cada celda y qué se le dice a la
 * persona en cada caso. Sin DOM: se prueba con Node.
 *
 * nexus_back contesta `{columnas, filas, hayMas, tope, milisegundos, consulta, explicacion, intentos}`; `filas` son listas en el orden de `columnas`,
 * con fechas como texto `AAAA-MM-DD` o ISO, números como números y bits como booleanos (`servicios/busqueda.py`). Esta pantalla enseña la tabla y
 * cuántos renglones son; la consulta y la explicación ya viajan, pero se enseñan desde NEX-608.
 */

export const MAX_PREGUNTA = 500;

export type Respuesta = {
	columnas: string[];
	filas: unknown[][];
	hayMas: boolean;
	tope: number;
	milisegundos: number;
	consulta?: string;
	explicacion?: string;
	intentos?: number;
};

/** Lo que sale de preguntar: la tabla, o un caso que se dice con sus palabras. */
export type Resultado =
	| { tipo: 'tabla'; respuesta: Respuesta }
	| { tipo: 'no_se_puede'; mensaje: string }
	| { tipo: 'tardo'; mensaje: string }
	| { tipo: 'error'; mensaje: string };

const NO_SE_PUEDE = 'Eso no se puede responder con los datos extraídos de tus documentos.';
const TARDO = 'La consulta tardó demasiado y se canceló. Intenta una pregunta más acotada (un tipo documental, un periodo).';
const FALLO = 'No se pudo responder. Intenta de nuevo o pregunta de otra forma.';

/** ¿Lo que llegó tiene la forma de una respuesta? (un servidor viejo o un cuerpo roto no deben tronar la pantalla). */
export function esRespuesta(cuerpo: unknown): cuerpo is Respuesta {
	const c = cuerpo as Respuesta | null;
	return (
		!!c &&
		Array.isArray(c.columnas) &&
		c.columnas.every((x) => typeof x === 'string') &&
		Array.isArray(c.filas) &&
		c.filas.every((f) => Array.isArray(f)) &&
		typeof c.hayMas === 'boolean'
	);
}

/**
 * De lo que contestó el BFF (`status` y cuerpo) al resultado que pinta la pantalla. Los 422 del back traen `codigo`: `no_se_puede` y `tardo`
 * tienen su propio estado; `consulta_invalida` y lo demás son un error con el mensaje que vino (o el genérico).
 */
export function resultadoDe(status: number, cuerpo: unknown): Resultado {
	if (status === 200) {
		if (esRespuesta(cuerpo)) return { tipo: 'tabla', respuesta: cuerpo };
		return { tipo: 'error', mensaje: FALLO };
	}
	const c = cuerpo as { codigo?: unknown; mensaje?: unknown } | null;
	const mensaje = typeof c?.mensaje === 'string' && c.mensaje.trim() ? c.mensaje : '';
	if (c?.codigo === 'no_se_puede') return { tipo: 'no_se_puede', mensaje: mensaje || NO_SE_PUEDE };
	if (c?.codigo === 'tardo') return { tipo: 'tardo', mensaje: mensaje || TARDO };
	return { tipo: 'error', mensaje: mensaje || FALLO };
}

/** «1 renglón», «14 renglones», o el aviso de que hay más de los que se muestran. */
export function textoDeRenglones(respuesta: Pick<Respuesta, 'filas' | 'hayMas' | 'tope'>): string {
	const n = respuesta.filas.length;
	if (respuesta.hayMas) return `Hay más de ${formatearNumero(respuesta.tope)} renglones: se muestran los primeros ${formatearNumero(respuesta.tope)}.`;
	if (n === 0) return 'No hay información que responda a eso.';
	return n === 1 ? '1 renglón' : `${formatearNumero(n)} renglones`;
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z?$/;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearNumero(n: number): string {
	return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(n);
}

/**
 * Una celda como la lee una persona: `null` es «—»; una fecha `AAAA-MM-DD` sale «15 mar 2024»; una fecha con hora (UTC, como la guarda el servidor)
 * sale en la hora local «15 mar 2024, 10:30»; un número con separador de miles y sin ceros de más; un booleano «Sí»/«No»; lo demás, tal cual.
 */
export function formatearCelda(valor: unknown): string {
	if (valor === null || valor === undefined) return '—';
	if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
	if (typeof valor === 'number') return Number.isFinite(valor) ? formatearNumero(valor) : String(valor);
	if (typeof valor === 'string') {
		const f = FECHA.exec(valor);
		if (f) {
			const mes = Number(f[2]);
			const dia = Number(f[3]);
			if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) return `${dia} ${MESES[mes - 1]} ${f[1]}`;
			return valor;
		}
		const fh = FECHA_HORA.exec(valor);
		if (fh) {
			const d = new Date(valor.endsWith('Z') ? valor : valor + 'Z');
			if (!Number.isNaN(d.getTime())) {
				const hh = String(d.getHours()).padStart(2, '0');
				const mm = String(d.getMinutes()).padStart(2, '0');
				return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
			}
		}
		return valor;
	}
	return String(valor);
}

/** ¿La columna es numérica (para alinearla a la derecha)? Lo es si todo lo que trae con valor es número. */
export function esColumnaNumerica(filas: unknown[][], indice: number): boolean {
	let vistos = 0;
	for (const f of filas) {
		const v = f[indice];
		if (v === null || v === undefined) continue;
		if (typeof v !== 'number') return false;
		vistos++;
	}
	return vistos > 0;
}

/** La pregunta lista para mandar: sin espacios de más; vacía si no hay nada que preguntar. */
export function limpiarPregunta(texto: string): string {
	return texto.replace(/\s+/g, ' ').trim().slice(0, MAX_PREGUNTA);
}

/** Preguntas que se ofrecen como pista mientras no se ha preguntado nada (son texto, no se mandan solas). */
export const PISTAS = [
	'¿Cuántos documentos hay por tipo documental?',
	'¿Qué documentos tienen campos corregidos?',
	'¿Cuántos documentos llegaron este mes?'
];
