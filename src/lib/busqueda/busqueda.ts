/**
 * Búsqueda · lo puro de la pantalla «Búsqueda» (NEX-607, 2026-11-23): la forma de la respuesta, cómo se pinta cada celda y qué se le dice a la
 * persona en cada caso. Sin DOM: se prueba con Node.
 *
 * nexus_back contesta `{columnas, filas, hayMas, tope, milisegundos, consulta, explicacion, intentos}`; `filas` son listas en el orden de `columnas`,
 * con fechas como texto `AAAA-MM-DD` o ISO, números como números y bits como booleanos (`servicios/busqueda.py`). Esta pantalla enseña la tabla y
 * cuántos renglones son; la consulta y la explicación ya viajan, pero se enseñan desde NEX-608.
 */

export const MAX_PREGUNTA = 500;

/** De dónde salió la consulta (NEX-609): el modelo, un ejemplo aprobado por la organización o una pregunta igual que ya había salido bien. */
export type Origen = 'modelo' | 'ejemplo' | 'anterior';

export type Respuesta = {
	columnas: string[];
	filas: unknown[][];
	hayMas: boolean;
	tope: number;
	milisegundos: number;
	consulta?: string;
	explicacion?: string;
	intentos?: number;
	/** NEX-609: el renglón de la bitácora, para «¿Te sirvió?» (null si no se pudo anotar: entonces no se ofrece). */
	preguntaId?: string | null;
	origen?: Origen;
	reusoDe?: string | null;
	/** NEX-611: la conversación en la que quedó y el número de pregunta; si tomó algo de las anteriores; hasta tres preguntas para seguir. */
	conversacion?: string | null;
	turno?: number | null;
	usaAnteriores?: boolean;
	sugerencias?: string[];
};

/** Lo que sale de preguntar: la tabla, o un caso que se dice con sus palabras. `tope`: se llegó al tope de uso (NEX-609) o se preguntó muy seguido. */
export type Resultado =
	| { tipo: 'tabla'; respuesta: Respuesta }
	| { tipo: 'no_se_puede'; mensaje: string }
	| { tipo: 'tardo'; mensaje: string }
	| { tipo: 'tope'; mensaje: string }
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
	const c = cuerpo as { codigo?: unknown; mensaje?: unknown; reintentarEn?: unknown } | null;
	const mensaje = typeof c?.mensaje === 'string' && c.mensaje.trim() ? c.mensaje : '';
	if (c?.codigo === 'no_se_puede') return { tipo: 'no_se_puede', mensaje: mensaje || NO_SE_PUEDE };
	if (c?.codigo === 'tardo') return { tipo: 'tardo', mensaje: mensaje || TARDO };
	// El tope de uso del back (por persona por hora, por organización por día) y el del servidor de la página (muchas seguidas en un minuto).
	if (c?.codigo === 'tope') return { tipo: 'tope', mensaje: mensajeDeTope(mensaje, c.reintentarEn) };
	if (status === 429 && c?.codigo === 'demasiadas_peticiones') return { tipo: 'tope', mensaje: mensaje || MUY_SEGUIDO };
	return { tipo: 'error', mensaje: mensaje || FALLO };
}

const MUY_SEGUIDO = 'Hiciste muchas preguntas seguidas. Espera un momento e intenta de nuevo.';

function dosDigitos(n: number): string {
	return String(n).padStart(2, '0');
}

/**
 * El mensaje del tope con CUÁNDO se puede volver a preguntar, en la hora de quien lo lee: «… Podrás volver a preguntar a las 15:42.», «… mañana a las
 * 09:15.» o «… el 26 nov a las 09:15.». `reintentarEn` viene del back en UTC (ISO); si no viene o no se entiende, solo el mensaje.
 */
export function mensajeDeTope(mensaje: string, reintentarEn: unknown, ahora: Date = new Date()): string {
	const base = mensaje.trim() || 'Llegaste al tope de preguntas.';
	if (typeof reintentarEn !== 'string') return base;
	const cuando = new Date(reintentarEn);
	if (Number.isNaN(cuando.getTime())) return base;
	const hora = `${dosDigitos(cuando.getHours())}:${dosDigitos(cuando.getMinutes())}`;
	const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
	const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
	const dia = mismoDia(cuando, ahora) ? '' : mismoDia(cuando, manana) ? 'mañana ' : `el ${cuando.getDate()} ${MESES[cuando.getMonth()]} `;
	return `${base} Podrás volver a preguntar ${dia}a las ${hora}.`;
}

/** Lo que se dice bajo una respuesta cuya consulta se reusó (NEX-609), o `null` si la escribió el modelo para esta pregunta. */
export function notaDeOrigen(origen: Origen | undefined): string | null {
	if (origen === 'ejemplo') return 'Usé un ejemplo que aprobó tu organización para esta misma pregunta.';
	if (origen === 'anterior') return 'Usé la misma consulta de la vez anterior que se hizo esta pregunta; los datos son los de hoy.';
	return null;
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
/** Un mes `AAAA-MM`, como lo devuelve la búsqueda al agrupar por mes (FORMAT(fecha, 'yyyy-MM')). */
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearNumero(n: number): string {
	return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(n);
}

/**
 * Una celda como la lee una persona: `null` es «—»; una fecha `AAAA-MM-DD` sale «15 mar 2024»; un mes `AAAA-MM` sale «mar 2024» (NEX-610: igual que
 * en la gráfica); una fecha con hora (UTC, como la guarda el servidor) sale en la hora local «15 mar 2024, 10:30»; un número con separador de miles y
 * sin ceros de más; un booleano «Sí»/«No»; lo demás, tal cual.
 */
export function formatearCelda(valor: unknown): string {
	if (valor === null || valor === undefined) return '—';
	if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
	if (typeof valor === 'number') return Number.isFinite(valor) ? formatearNumero(valor) : String(valor);
	if (typeof valor === 'string') {
		const m = MES.exec(valor);
		if (m) return `${MESES[Number(m[2]) - 1]} ${m[1]}`;
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

// ── NEX-609: lo que se guarda de cada pregunta y los ejemplos de la organización ────────────────────────────────────────────────────────

/** Una de «Tus preguntas recientes» (`GET /busqueda/preguntas`). */
export type Reciente = { id: string; pregunta: string; resultado: string; en: string | null };

export type Persona = { guid: string; nombre: string | null; correo: string | null } | null;

/** Una respuesta marcada «Sí me sirvió» que quien administra todavía no aprueba ni descarta (`GET /busqueda/por-revisar`). */
export type PorRevisar = {
	id: string;
	pregunta: string;
	consulta: string;
	explicacion: string;
	renglones: number | null;
	en: string | null;
	veces: number;
	personasUtil: number;
	autor: Persona;
};

/** Un ejemplo aprobado de la organización (`GET /busqueda/ejemplos`). */
export type EjemploAprobado = {
	id: string;
	pregunta: string;
	consulta: string;
	explicacion: string;
	aprobadoEn: string | null;
	reusos: number;
	aprobadoPor: Persona;
};

/** Cómo se nombra a una persona en las listas: su nombre, si no su correo, si no «alguien de tu organización» (una cuenta retirada). */
export function nombreDe(persona: Persona): string {
	return persona?.nombre?.trim() || persona?.correo?.trim() || 'alguien de tu organización';
}

/** «Se preguntó 3 veces · le sirvió a 2 personas». */
export function resumenDeUso(veces: number, personasUtil: number): string {
	const v = veces === 1 ? 'Se preguntó 1 vez' : `Se preguntó ${formatearNumero(veces)} veces`;
	const p = personasUtil === 1 ? 'le sirvió a 1 persona' : `le sirvió a ${formatearNumero(personasUtil)} personas`;
	return `${v} · ${p}`;
}

/** «Su consulta se reusó 4 veces tal cual», o que todavía no. */
export function resumenDeReusos(reusos: number): string {
	if (reusos <= 0) return 'Todavía nadie ha hecho esta misma pregunta.';
	return reusos === 1 ? 'Su consulta se reusó 1 vez tal cual.' : `Su consulta se reusó ${formatearNumero(reusos)} veces tal cual.`;
}

/** Ids que el navegador manda al BFF: se validan antes de pegarlos a una ruta de nexus_back. */
export function esIdDePregunta(valor: unknown): valor is string {
	return typeof valor === 'string' && /^pregunta-[0-9a-f]{32}$/.test(valor);
}
export function esIdDeEjemplo(valor: unknown): valor is string {
	return typeof valor === 'string' && /^ejemplo-[0-9a-f]{32}$/.test(valor);
}

/** Preguntas que se ofrecen como pista mientras no se ha preguntado nada (son texto, no se mandan solas). */
export const PISTAS = [
	'¿Cuántos documentos hay por tipo documental?',
	'¿Qué documentos tienen campos corregidos?',
	'¿Cuántos documentos llegaron este mes?'
];

// ── NEX-608: entender la respuesta y llevársela ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Las preguntas sugeridas al abrir la página, armadas con los tipos documentales de la organización (solo los suyos: los trae el `load` con el tenant de
 * la sesión). Con tipos, una por cada uno de los primeros tres más dos generales; sin tipos, solo las generales. Al picarlas se preguntan tal cual.
 */
export function preguntasSugeridas(tipos: string[]): string[] {
	const limpios = [...new Set(tipos.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))];
	const porTipo = limpios.slice(0, 3).map((t, i) => {
		const plantillas = [`¿Cuántos documentos de tipo ${t} llegaron este mes?`, `¿Qué documentos de tipo ${t} tienen campos faltantes?`, `Dame la lista de documentos de tipo ${t}`];
		return plantillas[i % plantillas.length];
	});
	return [...porTipo, '¿Cuántos documentos hay por tipo documental?', '¿Qué documentos tienen campos corregidos?'];
}

export type Direccion = 'asc' | 'desc';
export type Orden = { indice: number; direccion: Direccion } | null;

/** Qué orden queda al picar el encabezado de una columna: la primera vez ascendente; la misma otra vez, invierte. */
export function ordenAlPicar(actual: Orden, indice: number): Orden {
	if (actual && actual.indice === indice) return { indice, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' };
	return { indice, direccion: 'asc' };
}

function comparar(a: unknown, b: unknown): number {
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
	// Las fechas vienen como texto ISO: el orden de texto es el orden de fecha. Lo demás, como lo leería una persona (acentos y mayúsculas aparte).
	return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

/** Las filas ordenadas por una columna; lo vacío va siempre al final. Sin orden, tal como llegaron. No toca la lista original. */
export function ordenarFilas(filas: unknown[][], orden: Orden): unknown[][] {
	if (!orden) return filas;
	const { indice, direccion } = orden;
	const signo = direccion === 'asc' ? 1 : -1;
	return [...filas].sort((f, g) => {
		const a = f[indice];
		const b = g[indice];
		const vacioA = a === null || a === undefined || a === '';
		const vacioB = b === null || b === undefined || b === '';
		if (vacioA && vacioB) return 0;
		if (vacioA) return 1;
		if (vacioB) return -1;
		return signo * comparar(a, b);
	});
}

/** Las columnas que la pantalla NO enseña: `documento` (el id) y `pagina`, que sirven para abrir el documento en su página (el back las pide así). */
export function indicesOcultos(columnas: string[]): Set<number> {
	const fuera = new Set<number>();
	columnas.forEach((c, i) => {
		const n = c.trim().toLowerCase();
		if (n === 'documento' || n === 'pagina' || n === 'página') fuera.add(i);
	});
	return fuera;
}

/** Hay un enlace si la fila trae un `documento` con forma de id: `{ documento, pagina }` (`pagina` solo si viene y es un entero positivo). */
export function enlaceDeFila(columnas: string[], fila: unknown[]): { documento: string; pagina: number | null } | null {
	const iDoc = columnas.findIndex((c) => c.trim().toLowerCase() === 'documento');
	if (iDoc < 0) return null;
	const documento = fila[iDoc];
	if (typeof documento !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(documento)) return null;
	const iPag = columnas.findIndex((c) => ['pagina', 'página'].includes(c.trim().toLowerCase()));
	const pagina = iPag >= 0 ? fila[iPag] : null;
	return { documento, pagina: typeof pagina === 'number' && Number.isInteger(pagina) && pagina > 0 ? pagina : null };
}

/** La dirección que abre el documento (en su página, si se sabe): un BFF resuelve dónde está el archivo y manda al visor. */
export function hrefDeDocumento(enlace: { documento: string; pagina: number | null }): string {
	return `/api/documentos/${encodeURIComponent(enlace.documento)}/abrir${enlace.pagina ? `?pagina=${enlace.pagina}` : ''}`;
}

function celdaCsv(valor: unknown): string {
	// Exactamente lo que muestra la tabla, salvo lo que Excel entiende mejor crudo: los números sin separador de miles, las fechas como AAAA-MM-DD y los
	// meses como AAAA-MM.
	let texto: string;
	if (valor === null || valor === undefined) texto = '';
	else if (typeof valor === 'number') texto = String(valor);
	else if (typeof valor === 'string' && (FECHA.test(valor) || FECHA_HORA.test(valor) || MES.test(valor))) texto = valor.replace(/T.*$/, '');
	else texto = formatearCelda(valor);
	return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * La respuesta como CSV: las mismas columnas y filas que la tabla (sin las ocultas y en el orden que se ve), con BOM UTF-8 y renglones CRLF para que Excel la
 * abra con los acentos bien y sin acomodar nada.
 */
export function aCsv(columnas: string[], filas: unknown[][]): string {
	const fuera = indicesOcultos(columnas);
	const visibles = columnas.map((_, i) => i).filter((i) => !fuera.has(i));
	const encabezado = visibles.map((i) => celdaCsv(columnas[i] || `Columna ${i + 1}`)).join(',');
	const cuerpo = filas.map((f) => visibles.map((i) => celdaCsv(f[i])).join(','));
	return '﻿' + [encabezado, ...cuerpo].join('\r\n') + '\r\n';
}

/** El nombre del archivo: la pregunta recortada y la fecha, sin caracteres que un sistema de archivos rechace. */
export function nombreCsv(pregunta: string, hoy = new Date()): string {
	return nombreDeArchivo(pregunta, 'csv', hoy);
}

// ── NEX-611: la conversación ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Una pregunta de la conversación con su respuesta (`resultado` null: se está pensando). `orden` y `medida` son de esa respuesta (cómo se ordenó su tabla
 * y qué columna se grafica); `abierto`, si una respuesta anterior está desplegada; `reinicio`, si el servidor la tomó como el inicio de una conversación
 * nueva aunque se mandó la anterior (no encontró sus preguntas: no se tomaron en cuenta).
 */
export type Turno = {
	id: number;
	pregunta: string;
	resultado: Resultado | null;
	orden: Orden;
	medida: number | null;
	abierto: boolean;
	reinicio: boolean;
};

export function esIdDeConversacion(valor: unknown): valor is string {
	return typeof valor === 'string' && /^conversacion-[0-9a-f]{32}$/.test(valor);
}

/** La conversación en la que quedó una pregunta: viene en la respuesta y también en los errores (la pantalla sigue en ella). */
export function conversacionDe(cuerpo: unknown): string | null {
	const c = (cuerpo as { conversacion?: unknown } | null)?.conversacion;
	return esIdDeConversacion(c) ? c : null;
}

/** Como compara el servidor dos preguntas: minúsculas, sin acentos ni signos. */
function clave(texto: string): string {
	return texto
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^0-9a-zñ]+/g, ' ')
		.trim();
}

/** Las preguntas para seguir de una respuesta: texto, sin repetidas ni la pregunta misma, hasta tres (el servidor ya las limpia; esto por si acaso). */
export function sugerenciasDe(valor: unknown, pregunta: string): string[] {
	if (!Array.isArray(valor)) return [];
	const vistas = new Set([clave(pregunta)]);
	const salida: string[] = [];
	for (const v of valor) {
		if (typeof v !== 'string') continue;
		const texto = v.replace(/\s+/g, ' ').trim();
		const k = clave(texto);
		if (texto.length < 3 || texto.length > 120 || !k || vistas.has(k)) continue;
		vistas.add(k);
		salida.push(texto);
		if (salida.length === 3) break;
	}
	return salida;
}

/** El valor de una respuesta que es UN dato (un renglón con una sola columna a la vista), para enseñarlo en el resumen de una pregunta anterior. */
export function valorUnico(respuesta: Pick<Respuesta, 'columnas' | 'filas'>): { columna: string; valor: string } | null {
	if (respuesta.filas.length !== 1) return null;
	const ocultas = indicesOcultos(respuesta.columnas);
	const visibles = respuesta.columnas.map((_, i) => i).filter((i) => !ocultas.has(i));
	if (visibles.length !== 1) return null;
	const i = visibles[0];
	return { columna: respuesta.columnas[i] || 'Respuesta', valor: formatearCelda(respuesta.filas[0][i]) };
}

/**
 * Lo que se ve de una pregunta anterior plegada: el dato si la respuesta es uno («INE de este año: 3»), si no cuántos renglones, con la frase de cómo
 * se entendió; o qué pasó si no hubo respuesta. `tono` pinta el ícono.
 */
export function resumenDeTurno(resultado: Resultado | null): { destacado: string | null; texto: string; tono: 'normal' | 'aviso' | 'error' } {
	if (resultado === null) return { destacado: null, texto: 'Pensando…', tono: 'normal' };
	if (resultado.tipo === 'tabla') {
		const r = resultado.respuesta;
		const unico = valorUnico(r);
		const explicacion = (r.explicacion ?? '').trim();
		if (unico) return { destacado: `${unico.columna}: ${unico.valor}`, texto: explicacion, tono: 'normal' };
		return { destacado: textoDeRenglones(r), texto: explicacion, tono: 'normal' };
	}
	if (resultado.tipo === 'no_se_puede') return { destacado: 'No se puede responder con los datos extraídos.', texto: resultado.mensaje, tono: 'aviso' };
	if (resultado.tipo === 'tardo') return { destacado: 'Tardó demasiado.', texto: resultado.mensaje, tono: 'aviso' };
	if (resultado.tipo === 'tope') return { destacado: 'No se pudo preguntar.', texto: resultado.mensaje, tono: 'aviso' };
	return { destacado: 'No se pudo responder.', texto: resultado.mensaje, tono: 'error' };
}

/** Lo que se agradece tras «¿Te sirvió?». Una respuesta que tomó algo de su conversación no se propone como ejemplo ni se reusa sola: solo «Gracias.». */
export function textoDeGracias(util: boolean, usaAnteriores: boolean | undefined): string {
	if (usaAnteriores) return 'Gracias.';
	return util
		? 'Gracias. Quien administra tu organización podrá aprobarla como ejemplo.'
		: 'Gracias. La próxima vez que alguien lo pregunte, se buscará otra forma de responder.';
}

/** El mismo nombre que el CSV, con otra extensión (NEX-610: la gráfica se baja como `.png`). */
export function nombreDeArchivo(pregunta: string, extension: string, hoy = new Date()): string {
	const base = pregunta
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^A-Za-z0-9 ]+/g, ' ')
		.trim()
		.replace(/\s+/g, '-')
		.toLowerCase()
		.slice(0, 40)
		.replace(/-+$/, '');
	const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
	return `biblioratum-busqueda-${base || 'respuesta'}-${fecha}.${extension}`;
}
