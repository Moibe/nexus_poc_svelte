/**
 * Ejemplos etiquetados y medición de precisión de un tipo documental — lo PURO (2026-11-23, Moibe: «el propósito sí es que nos sirva de
 * entrenamiento» → «arranca con el punto 1, la medición»).
 *
 * En «Ejemplo documental», Biblioratum lee cada documento de ejemplo con la definición actual del tipo y la persona CONFIRMA, CORRIGE o marca
 * como «no aparece» cada campo: esa es la «respuesta buena» del documento (su etiqueta). Con los documentos etiquetados se MIDE: nexus_back los
 * vuelve a leer y compara campo por campo (`servicios/ejemplos_etiquetados.py`). Aquí, sin Svelte ni red (se prueba con
 * `node --experimental-strip-types`): las formas que devuelve el back, el borrador de la revisión que la persona edita y lo que se guarda.
 */

/** `[ymin, xmin, ymax, xmax]`, de 0 a 1000 respecto a la página. */
export type Caja = [number, number, number, number];

/** Un campo de lo que se leyó de un documento (`POST …/leer`). `ruta`: `curp`, `domicilio.calle`, `socios[2].nombre`, `telefonos[1]`. */
export type Renglon = {
	ruta: string;
	/** La ruta sin índices: el CAMPO que se mide. */
	campo: string;
	/** Cómo se le dice a la persona: «CURP», «Socios 2 · Nombre». */
	etiqueta: string;
	/** El campo de arriba (la ruta hasta antes del primer índice o punto). */
	grupo: string;
	fila: number | null;
	tipoDato: string;
	valor: string | null;
	confianza: number | null;
	pagina: number | null;
	caja: Caja | null;
	/** Algo que se repite y no se leyó ninguna fila: el renglón es la ruta pelona. */
	sinFilas?: boolean;
};

export type Lectura = { ejemplo: string; revision: number; procesador: 'tipo' | 'compartido'; base: string | null; campos: Renglon[] };

export type Origen = 'confirmado' | 'corregido' | 'ausente' | 'agregado';

/** Una etiqueta guardada, como la devuelve el back (con su rótulo y si sigue siendo un campo del tipo). */
export type EtiquetaGuardada = {
	ruta: string;
	valor: string | null;
	pagina: number | null;
	caja: Caja | null;
	origen: Origen;
	campo?: string;
	etiqueta?: string;
	grupo?: string;
	tipoDato?: string;
	vigente?: boolean;
	/** La ruta pelona de algo que se repite: «no trae ninguna fila». */
	sinFilas?: boolean;
};

export type EtiquetasDeDocumento = {
	ejemplo: string;
	revision: number;
	campos: EtiquetaGuardada[];
	/** Campos que el tipo tiene HOY y este documento no tiene etiquetados (se agregaron después): hay que volver a leerlo. */
	camposSinEtiqueta?: string[];
	conBase: boolean;
	guardadoEn: string | null;
	guardadoPor: string | null;
};

export type Resultado = 'acierto' | 'error' | 'falto' | 'sobro';

export type Comparacion = {
	ruta: string;
	campo: string;
	etiqueta: string;
	esperado: string | null;
	leido: string | null;
	resultado: Resultado;
	confianza: number | null;
};

export type ResumenDeCampo = { campo: string; etiqueta: string; aciertos: number; errores: number; faltaron: number; sobraron: number; total: number };

export type DocumentoMedido = {
	ejemplo: string;
	nombre: string;
	estado: 'ok' | 'error';
	mensaje?: string;
	comparaciones: Comparacion[];
	aciertos?: number;
	total?: number;
};

export type Medicion = {
	id: string;
	revision: number;
	procesador: 'tipo' | 'compartido';
	version: string | null;
	estado: 'completa' | 'parcial' | 'fallida';
	documentos: number;
	documentosMedidos: number;
	comparaciones: number;
	aciertos: number;
	iniciadaEn: string | null;
	terminadaEn: string | null;
	medidaPor: string | null;
	detalle?: { documentos: DocumentoMedido[]; campos: ResumenDeCampo[] };
};

// ── El borrador que la persona edita ─────────────────────────────────────────

/** Un renglón de la revisión: lo que se leyó (si se leyó en esta sesión) y lo que la persona dice que es. */
export type FilaDeRevision = {
	ruta: string;
	campo: string;
	etiqueta: string;
	grupo: string;
	fila: number | null;
	tipoDato: string;
	/** Lo que leyó Biblioratum en esta lectura; `undefined` si el borrador salió de etiquetas guardadas sin volver a leer. */
	leido: string | null | undefined;
	confianza: number | null;
	/** Lo que la persona dice que dice el documento (lo que se escribe en la caja de texto). */
	valor: string;
	/** «No aparece en el documento». */
	ausente: boolean;
	pagina: number | null;
	caja: Caja | null;
	/** El origen que tenía guardado (cuando el borrador sale de etiquetas guardadas). */
	origenGuardado?: Origen;
	/** El valor que tenía guardado: para saber si la persona lo cambió. */
	valorGuardado?: string | null;
	/** La ruta pelona de algo que se repite sin ninguna fila: no se edita. */
	sinFilas?: boolean;
	/** Ya no es un campo del tipo (se quitó después de etiquetar): se enseña, pero no se guarda. */
	vigente: boolean;
};

const limpio = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();

/** El borrador de un documento recién leído. Lo no leído arranca como «no aparece» (si sí está, basta con escribirlo). Si el documento ya tenía
 *  etiquetas, se conserva lo que la persona había dicho de cada ruta: volver a leer no borra su trabajo. */
export function borradorDesdeLectura(lectura: Lectura, guardadas?: EtiquetasDeDocumento | null): FilaDeRevision[] {
	const previas = new Map((guardadas?.campos ?? []).map((e) => [e.ruta, e]));
	return lectura.campos.map((r) => {
		const previa = previas.get(r.ruta);
		const valor = previa ? (previa.valor ?? '') : (r.valor ?? '');
		const ausente = r.sinFilas ? true : previa ? previa.valor === null : r.valor === null;
		return {
			ruta: r.ruta,
			campo: r.campo,
			etiqueta: r.etiqueta,
			grupo: r.grupo,
			fila: r.fila,
			tipoDato: r.tipoDato,
			leido: r.valor,
			confianza: r.confianza,
			valor,
			ausente,
			pagina: previa?.caja ? previa.pagina : r.pagina,
			caja: previa?.caja ?? r.caja,
			sinFilas: r.sinFilas,
			vigente: true
		};
	});
}

/** El borrador de un documento ya etiquetado, sin volver a leerlo (solo con lo guardado). */
export function borradorDesdeEtiquetas(guardadas: EtiquetasDeDocumento): FilaDeRevision[] {
	return guardadas.campos.map((e) => ({
		ruta: e.ruta,
		campo: e.campo ?? e.ruta.replace(/\[\d+\]/g, ''),
		etiqueta: e.etiqueta ?? e.ruta,
		grupo: e.grupo ?? e.ruta.split(/[[.]/)[0],
		fila: Number(/^[^[.]+\[(\d+)\]/.exec(e.ruta)?.[1]) || null,
		tipoDato: e.tipoDato ?? 'texto',
		leido: undefined,
		confianza: null,
		valor: e.valor ?? '',
		ausente: e.valor === null,
		pagina: e.pagina,
		caja: e.caja,
		origenGuardado: e.origen,
		valorGuardado: e.valor,
		sinFilas: e.sinFilas === true,
		vigente: e.vigente !== false
	}));
}

/** Lo que la persona dice de un renglón: de dónde sale el valor que se va a guardar. */
export function origenDe(f: FilaDeRevision): Origen {
	if (f.ausente || !limpio(f.valor)) return 'ausente';
	if (f.leido === undefined) {
		// Sin lectura en esta sesión: si no cambió lo guardado, se queda su origen; si lo cambió, es una corrección.
		if (f.origenGuardado && limpio(f.valorGuardado) === limpio(f.valor) && f.valorGuardado !== null) return f.origenGuardado;
		return 'corregido';
	}
	if (f.leido === null) return 'agregado';
	return limpio(f.leido) === limpio(f.valor) ? 'confirmado' : 'corregido';
}

/** Las etiquetas que se mandan a guardar (`PUT …/etiquetas`): solo las de campos que el tipo todavía tiene. */
export function etiquetasParaGuardar(filas: FilaDeRevision[]): { ruta: string; valor: string | null; pagina: number | null; caja: Caja | null; origen: Origen }[] {
	return filas
		.filter((f) => f.vigente)
		.map((f) => {
			const origen = origenDe(f);
			const valor = origen === 'ausente' ? null : limpio(f.valor);
			return { ruta: f.ruta, valor, pagina: valor === null ? null : f.pagina, caja: valor === null ? null : f.caja, origen };
		});
}

/** ¿La revisión cambió respecto de lo guardado? (Para avisar antes de salir sin guardar.) */
export function hayCambios(filas: FilaDeRevision[], guardadas: EtiquetasDeDocumento | null | undefined): boolean {
	if (!guardadas) return filas.length > 0;
	const antes = new Map(guardadas.campos.map((e) => [e.ruta, e]));
	const ahora = etiquetasParaGuardar(filas);
	if (ahora.length !== guardadas.campos.filter((e) => e.vigente !== false).length) return true;
	return ahora.some((e) => {
		const a = antes.get(e.ruta);
		return !a || limpio(a.valor) !== limpio(e.valor) || (a.valor === null) !== (e.valor === null) || JSON.stringify(a.caja) !== JSON.stringify(e.caja);
	});
}

/** Cuántos renglones van confirmados, corregidos, agregados y como «no aparece». */
export function cuentasDeRevision(filas: FilaDeRevision[]): Record<Origen, number> {
	const cuentas: Record<Origen, number> = { confirmado: 0, corregido: 0, ausente: 0, agregado: 0 };
	for (const f of filas) if (f.vigente && !f.sinFilas) cuentas[origenDe(f)] += 1;
	return cuentas;
}

/** Los renglones agrupados para pintarlos: un campo suelto va solo; lo de un grupo o lo que se repite, bajo su encabezado. */
export function agrupar(filas: FilaDeRevision[]): { grupo: string; titulo: string | null; filas: FilaDeRevision[] }[] {
	const grupos: { grupo: string; titulo: string | null; filas: FilaDeRevision[] }[] = [];
	for (const f of filas) {
		const compuesto = f.ruta !== f.grupo || f.sinFilas;
		const ultimo = grupos.at(-1);
		if (compuesto && ultimo && ultimo.grupo === f.grupo && ultimo.titulo !== null) {
			ultimo.filas.push(f);
			continue;
		}
		grupos.push({ grupo: f.grupo, titulo: compuesto ? f.etiqueta.split(/ \d+| · /)[0] : null, filas: [f] });
	}
	return grupos;
}

// ── La medición ──────────────────────────────────────────────────────────────

/** «92 %» (redondeado hacia abajo: 99.6 % no es 100 %). Sin comparaciones, «—». */
export function porcentaje(aciertos: number, total: number): string {
	if (!total) return '—';
	return `${Math.floor((aciertos / total) * 100)} %`;
}

/** Lo que cuesta medir, para decirlo antes: una lectura por página de cada documento etiquetado. */
export function costoDeMedir(paginasPorDocumento: number[]): { paginas: number; texto: string } {
	const paginas = paginasPorDocumento.reduce((s, p) => s + Math.max(1, p || 1), 0);
	return { paginas, texto: `≈ US$${(paginas * 0.03).toFixed(2)}` };
}

/** Lo que no salió bien en una medición, documento por documento, para enseñar las diferencias. */
export function diferencias(m: Medicion): { documento: string; etiqueta: string; esperado: string | null; leido: string | null; resultado: Resultado }[] {
	return (m.detalle?.documentos ?? []).flatMap((d) =>
		d.comparaciones
			.filter((c) => c.resultado !== 'acierto')
			.map((c) => ({ documento: d.nombre || d.ejemplo, etiqueta: c.etiqueta, esperado: c.esperado, leido: c.leido, resultado: c.resultado }))
	);
}

/** El texto de un resultado que no fue acierto. */
export const TEXTO_RESULTADO: Record<Resultado, string> = {
	acierto: 'Acierto',
	error: 'Leyó otra cosa',
	falto: 'No lo leyó',
	sobro: 'Leyó algo que no está'
};

export const TEXTO_ORIGEN: Record<Origen, string> = {
	confirmado: 'Confirmado',
	corregido: 'Corregido',
	ausente: 'No aparece',
	agregado: 'Agregado'
};
