/**
 * Ejecutar un proceso del motor de reglas con DATOS REALES (2026-11-03, Moibe: «adelante, házlo»), sin nada de pantalla ni de red.
 *
 * El lienzo ya sabe correr un proceso con valores de EJEMPLO escritos en cada regla (`evaluar`, en `reglas.ts`); una ejecución es lo mismo pero con
 * lo que dijeron los documentos del EXPEDIENTE. Hasta el 2026-11-05 se ejecutaba sobre un expediente virtual (un subconjunto de sus documentos);
 * Moibe los quitó: ahora el expediente entero entra a la ejecución, y lo que el proceso pone en el lienzo es el delineador de cuáles documentos
 * necesita de él. En vez de escribir otra implementación de qué significa «igual» (texto sin mayúsculas, números
 * con símbolo de moneda, fechas escritas de tres maneras, las tres posibilidades de «Y»…), aquí se reemplazan los valores de ejemplo por los reales y
 * se llama a la MISMA `evaluar`: lo que el lienzo enseña probando y lo que una ejecución decide no pueden discrepar. Es lo que corre el servidor del
 * front (el BFF `/api/ejecuciones`); nexus_back prepara los datos (`GET /ejecuciones/preparar`) y guarda lo que sale (`POST /ejecuciones`).
 *
 * Vive aparte de `reglas.ts` para no engordarlo, y por la misma razón que él NO importa nada que necesite el navegador o SvelteKit: se prueba sola con
 * `verificar-ejecutar.mjs`.
 *
 * ## Qué hace
 *
 *  1. Si el expediente trae DOS O MÁS documentos de un tipo que el proceso usa (`duplicados`), NO corre: no se sabe cuál es «el INE» (Moibe). Quien
 *     calcula `duplicados` es nexus_back y solo cuenta los tipos que el proceso usa: un tipo que el proceso NO usa puede repetirse sin estorbar.
 *  2. Reemplaza el ejemplo de cada entrada que viene de un campo por su valor real: un campo suelto es su valor; uno «1 a N» o la columna de un grupo que
 *     se repite, sus elementos (un renglón cada uno); las filas de un grupo, un renglón por fila; el punto «Documento» de un tipo es «sí» si el
 *     expediente lo trae. Un campo que el documento no trae (o un tipo sin documento) deja el ejemplo vacío: la regla dirá «sin valores».
 *  3. Evalúa. El Resultado dice con qué palabra termina: la de «se cumple», la de «no se cumple» o la de «faltan datos» (la corrida queda INCOMPLETA).
 *  4. Arma lo que se guarda: la palabra, la lista de valores finales (nombre, valor y de dónde salió) y la foto de cómo salió cada regla y de qué
 *     documento y campo se tomó cada dato (la evidencia), con lo que faltó.
 */
import {
	HANDLE_DOCUMENTO,
	NODO_CONSTANTE,
	NODO_OPERADOR,
	NODO_RESULTADO,
	NODO_TIPO,
	NODO_VALOR_FINAL,
	cuantoTiempo,
	evaluar,
	fechaDeHoy,
	hidratarDibujo,
	lineasDeEjemplo,
	llaveDeParecido,
	maximoDeAntiguedad,
	nombreDeValorFinal,
	numeroDeOperador,
	operadorDe,
	salidaDeCampo,
	textoDeAntiguedad,
	textoDeParecido,
	unidadDeAntiguedad,
	type CasoDelResultado,
	type ClaveOperador,
	type DatosNodoOperador,
	type DatosNodoTipo,
	type Estado,
	type Familia,
	type MedidaDeAntiguedad,
	type MedidaDeParecido,
	type Parecidos,
	type Veredicto
} from './reglas';
import type { TipoDocumentalGuardado } from '$lib/state/configuracion.svelte';

// ── Lo que entrega `GET /ejecuciones/preparar` ───────────────────────────────

/** Los valores de un campo de un documento: un valor, una lista (en el orden del documento) o las filas de un grupo que se repite (solo cuántas). */
export type ValoresDeCampo = { forma: 'valor' | 'lista' | 'filas'; valores: string[]; confianza: number | null; pagina: number | null };

/** Un tipo documental del proceso y lo que el expediente trae de él. `valores` solo hay si es UN documento; por el nombre de cada punto del lienzo. */
export type DocumentoDeTipo = {
	tipoId: string;
	tipoNombre: string;
	encontrados: { id: string; nombre: string | null; origenTipo: string | null }[];
	valores: Record<string, ValoresDeCampo> | null;
};

export type Duplicado = { tipoId: string; tipoNombre: string; documentos: { id: string; nombre: string | null }[] };

/** Lo que `GET /ejecuciones/preparar` entrega para un expediente y un proceso. Sin expediente virtual (Moibe, 2026-11-05): los documentos salen del expediente completo. */
export type Preparacion = {
	expediente: { id: string; nombre: string };
	proceso: { id: string; revision: number; nombre: string; datos: { nodos?: unknown; aristas?: unknown } };
	/** Los tipos documentales que el proceso usa, con sus campos como están en la biblioteca. */
	tipos: { id: string; nombre: string; campos: unknown[] }[];
	documentos: DocumentoDeTipo[];
	duplicados: Duplicado[];
};

// ── Lo que sale ──────────────────────────────────────────────────────────────

/** Un valor final de la corrida: lo que `POST /ejecuciones` guarda como renglón. */
export type ValorFinalDeCorrida = {
	nodoId: string;
	nombre: string;
	forma: 'valor' | 'lista' | 'veredicto';
	familia: Familia | null;
	estado: 'listo' | 'sin_valores' | 'sin_conexion';
	valor: string | null;
	lista: string[] | null;
	origen: string | null;
};

/**
 * Lo que le llegó a UNA entrada de una regla al correr (2026-11-10, Moibe: «en los detalles de por qué fue rechazado no incluyes ese valor fijo, y eso
 * sería de utilidad»): de dónde vino y qué valor traía, para ver de un vistazo QUÉ se comparó.
 */
export type EntradaDeCorrida = {
	/** El rótulo de la entrada, como en el nodo: «Entrada A», «Valor», «Desde», «Lista», «Regla A», «Si (condición)», «Documento»… */
	etiqueta: string;
	/** De dónde vino: «Nombre · INE», «Valor fijo #1», «Igual a #2»; `null` si no tenía nada conectado. */
	origen: string | null;
	/**
	 * Lo que traía, como se lee: el valor; los elementos de una lista, separados por comas; «N filas» de un grupo; «Pasa» o «No pasa» de una regla (o
	 * el número que calculó); «Lo trae» o «No lo trae» de un documento. `null` si no traía nada (el documento no tenía ese dato, o no hay cable).
	 */
	valor: string | null;
};

/** Cómo salió una regla. */
export type ReglaDeCorrida = {
	id: string;
	etiqueta: string;
	operador: ClaveOperador;
	estado: Estado;
	valor: string | null;
	texto: string;
	/** Solo de un «Parecido a» ya medido: lo que dijo la IA (porcentaje y razón) y el mínimo con que se decidió. Queda escrito en el historial. */
	parecido?: { porcentaje: number; razon: string; minimo: number; sinIA?: true };
	/** Solo de una «Antigüedad contra hoy» ya decidida (2026-11-10): con qué hoy, máximo y unidad, y cuánto tenía la fecha. Queda escrito en el historial. */
	antiguedad?: MedidaDeAntiguedad;
	/**
	 * Lo que le llegó a cada entrada, en el orden del nodo (2026-11-10). Las ejecuciones de antes no lo traen. A una «Antigüedad contra hoy» se le suman dos
	 * renglones que no son entradas pero también se compararon: su «Máximo» y el «Hoy» de la ejecución.
	 */
	entradas?: EntradaDeCorrida[];
};

/** De qué documento se tomó lo de un tipo documental y qué campos del proceso se leyeron. */
export type EvidenciaDeCorrida = {
	tipoId: string;
	tipoNombre: string;
	documentoId: string | null;
	documentoNombre: string | null;
	/** De dónde se supo el tipo del documento: `extraccion` (ya se extrajo) o `clasificacion` (solo se clasificó, todavía sin datos). */
	origenTipo: string | null;
	campos: { campo: string; forma: ValoresDeCampo['forma']; valores: string[]; confianza: number | null; pagina: number | null }[];
};

export type DetalleDeCorrida = {
	reglas: ReglaDeCorrida[];
	evidencia: EvidenciaDeCorrida[];
	/** El veredicto de la regla conectada al Resultado, del que sale la palabra. */
	condicion: Veredicto;
	/** Lo que faltó, en palabras: un documento que el expediente no trae o un campo que el documento no tiene. */
	faltantes: string[];
};

export type Corrida = {
	resultado: { caso: CasoDelResultado; texto: string };
	valoresFinales: ValorFinalDeCorrida[];
	detalle: DetalleDeCorrida;
};

/** Por qué no se corrió. */
export type NoCorre =
	| { codigo: 'duplicados'; mensaje: string; duplicados: Duplicado[] }
	| { codigo: 'sin_resultado' | 'regla_incompleta'; mensaje: string };

export type Salida = { corre: true; corrida: Corrida } | { corre: false; motivo: NoCorre };

// ── Cómo se escribe lo que se avisa ──────────────────────────────────────────

/** El aviso de tipos documentales repetidos (en el cable, `duplicados`; Moibe, 2026-11-06: «Duplicado» es solo el archivo idéntico): cuáles son y qué hacer. Lo usa quien ejecuta y la pantalla. */
export function avisoDeDuplicados(duplicados: readonly Duplicado[]): string {
	const partes = duplicados.map((d) => `«${d.tipoNombre}» (${d.documentos.map((x) => x.nombre ?? 'sin nombre').join(', ')})`);
	return `El expediente trae tipos documentales repetidos: ${partes.join('; ')}. No se sabe cuál usar, así que el proceso no se ejecutó. Deja uno de cada tipo en el expediente y vuelve a ejecutar.`;
}

// ── Valores reales en lugar de los de ejemplo ────────────────────────────────

/** Una línea por elemento: un salto de línea dentro de un valor lo partiría en dos elementos. */
const comoRenglon = (texto: string) => texto.replace(/\s*[\r\n]+\s*/g, ' ').trim();

/** El «ejemplo» que reemplaza lo real en una entrada: lo que `evaluar` leerá como si lo hubiera escrito una persona. */
export function muestraDeCampo(punto: string, doc: DocumentoDeTipo | undefined): string {
	if (punto === HANDLE_DOCUMENTO) return doc && doc.encontrados.length >= 1 ? 'si' : 'no';
	const v = doc?.valores?.[punto];
	if (!v) return '';
	if (v.forma === 'valor') return comoRenglon(v.valores[0] ?? '');
	return v.valores.map(comoRenglon).filter(Boolean).join('\n');
}

type NodoDeLienzo = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> };
type CableDeLienzo = { id: string; source: string; sourceHandle: string | null; target: string; targetHandle: string | null };

/** El dibujo del proceso con los valores reales puestos donde el lienzo pone los de ejemplo. Devuelve copias: el proceso guardado no se toca. */
export function conValoresReales(nodos: readonly NodoDeLienzo[], cables: readonly CableDeLienzo[], documentos: readonly DocumentoDeTipo[]): NodoDeLienzo[] {
	const copia = nodos.map((n) => ({ ...n, data: { ...n.data } }));
	for (const cable of cables) {
		const origen = copia.find((n) => n.id === cable.source);
		const destino = copia.find((n) => n.id === cable.target);
		if (origen?.type !== NODO_TIPO || !destino || !cable.targetHandle || !cable.sourceHandle) continue;
		const doc = documentos.find((d) => d.tipoId === (origen.data as DatosNodoTipo).tipoId);
		destino.data[cable.targetHandle] = muestraDeCampo(cable.sourceHandle, doc);
	}
	return copia;
}

// ── De dónde sale cada cosa, en palabras ─────────────────────────────────────

/** «rfc · INE», «Igual a #1» o «Valor fijo #2»: de dónde viene lo que le llega a un punto de entrada. */
function origenDe(cable: CableDeLienzo | undefined, nodos: readonly NodoDeLienzo[], tipos: readonly TipoDocumentalGuardado[]): string | null {
	const origen = cable && nodos.find((n) => n.id === cable.source);
	if (!cable || !origen) return null;
	if (origen.type === NODO_TIPO) {
		const salida = salidaDeCampo(tipos, (origen.data as DatosNodoTipo).tipoId, cable.sourceHandle ?? '');
		return salida ? `${salida.campo} · ${salida.tipo}` : null;
	}
	if (origen.type === NODO_CONSTANTE) return `Valor fijo #${numeroDeOperador(origen.id)}`;
	if (origen.type === NODO_OPERADOR) {
		const def = operadorDe(String((origen.data as DatosNodoOperador).operador));
		return def ? `${def.etiqueta} #${numeroDeOperador(origen.id)}` : null;
	}
	return null;
}

const TEXTO_SIN_VALORES = 'Faltan valores para decidirla';
const TEXTO_INCOMPLETA = 'Le falta algo conectado';

/** Lo que dice el historial de una regla que llega a otra: su veredicto en palabras (igual que la insignia del lienzo). */
const ESTADO_EN_PALABRAS: Record<Estado, string> = { pasa: 'Pasa', no_pasa: 'No pasa', listo: 'Listo', sin_valores: 'Sin valores', sin_conexion: 'Incompleta' };
/** Hasta cuánto se guarda de lo que llegó a una entrada: una lista larga no debe engordar el historial (lo completo está en «De dónde salieron los datos»). */
export const TOPE_VALOR_DE_ENTRADA = 300;
const recortar = (t: string) => (t.length > TOPE_VALOR_DE_ENTRADA ? `${t.slice(0, TOPE_VALOR_DE_ENTRADA - 1)}…` : t);

/**
 * Lo que le llegó a cada entrada de la regla `n` (con los valores REALES ya puestos por `conValoresReales`): de un campo, su valor (o los elementos de
 * su lista, o cuántas filas); de un valor fijo, su valor; de otra regla, su veredicto o el número que calculó; del documento entero, si el expediente lo
 * trae. Es lo mismo que leyó `evaluar`, puesto en palabras.
 */
function entradasDe(n: NodoDeLienzo, cables: readonly CableDeLienzo[], nodos: readonly NodoDeLienzo[], tipos: readonly TipoDocumentalGuardado[], ev: ReturnType<typeof evaluar>): EntradaDeCorrida[] {
	const def = operadorDe(String((n.data as DatosNodoOperador).operador));
	if (!def) return [];
	return def.entradas.map((e): EntradaDeCorrida => {
		const cable = cables.find((a) => a.target === n.id && a.targetHandle === e.id);
		const origen = cable && nodos.find((x) => x.id === cable.source);
		if (!cable || !origen) return { etiqueta: e.etiqueta, origen: null, valor: null };
		let valor: string | null = null;
		if (origen.type === NODO_TIPO) {
			const muestra = String(n.data[e.id] ?? '');
			if (cable.sourceHandle === HANDLE_DOCUMENTO) {
				valor = muestra === 'si' ? 'Lo trae' : muestra === 'no' ? 'No lo trae' : null;
			} else {
				const lineas = lineasDeEjemplo(muestra);
				const forma = salidaDeCampo(tipos, (origen.data as DatosNodoTipo).tipoId, cable.sourceHandle ?? '')?.forma;
				valor = lineas.length === 0 ? null : forma === 'filas' ? `${lineas.length} fila${lineas.length === 1 ? '' : 's'}` : lineas.join(', ');
			}
		} else if (origen.type === NODO_CONSTANTE) {
			valor = String(origen.data.valor ?? '').trim() || null;
		} else if (origen.type === NODO_OPERADOR) {
			const otro = operadorDe(String((origen.data as DatosNodoOperador).operador));
			const estado = ev.estados[origen.id] ?? 'sin_conexion';
			valor = otro?.salida === 'valor' && estado === 'listo' ? (ev.valores[origen.id] ?? null) : ESTADO_EN_PALABRAS[estado];
		}
		return { etiqueta: e.etiqueta, origen: origenDe(cable, nodos, tipos), valor: valor === null ? null : recortar(valor) };
	});
}

// ── Correr ───────────────────────────────────────────────────────────────────

/**
 * Los pares de textos REALES que los «Parecido a» del proceso necesitan medir con IA antes de correr (vacío si no hay o no aplica). Quien ejecuta los
 * mide (`POST /procesos/parecido`), arma el mapa con `parecidosMedidos` y llama a `correr` con él. Con duplicados no corre: no hay nada que medir.
 */
export function paresPorMedir(prep: Preparacion): { a: string; b: string }[] {
	if (prep.duplicados.length > 0) return [];
	const dibujo = hidratarDibujo(prep.proceso.datos);
	const nodos = conValoresReales(dibujo.nodes, dibujo.edges, prep.documentos);
	return evaluar(nodos, dibujo.edges, prep.tipos as unknown as TipoDocumentalGuardado[]).pendientes;
}

/** El mapa que recibe `correr`: cada par con lo que dijo la IA, en el mismo orden en que se pidieron. */
export function parecidosMedidos(pares: readonly { a: string; b: string }[], medidas: readonly MedidaDeParecido[]): Parecidos {
	const mapa: Record<string, MedidaDeParecido> = {};
	pares.forEach((p, i) => {
		if (medidas[i]) mapa[llaveDeParecido(p.a, p.b)] = medidas[i];
	});
	return mapa;
}

/**
 * Corre el proceso con los datos de `prep` y arma lo que se guarda. Si no hay con qué decidir (duplicados, sin Resultado, una regla incompleta) NO
 * corre y dice por qué: eso no es una corrida y no se guarda.
 */
export function correr(prep: Preparacion, medidos: Parecidos = {}, hoy: string = fechaDeHoy()): Salida {
	if (prep.duplicados.length > 0) return { corre: false, motivo: { codigo: 'duplicados', mensaje: avisoDeDuplicados(prep.duplicados), duplicados: prep.duplicados } };

	const dibujo = hidratarDibujo(prep.proceso.datos);
	const aristas = dibujo.edges;
	const nodos = conValoresReales(dibujo.nodes, aristas, prep.documentos);
	// Los tipos llegan como `{id, nombre, campos}`: es lo único que `evaluar` lee de ellos.
	const tipos = prep.tipos as unknown as TipoDocumentalGuardado[];
	// «Antigüedad contra hoy» se cuenta hasta el día en que se ejecuta (en México): el dibujo guardado no trae ningún hoy de ejemplo.
	const ev = evaluar(nodos, aristas, tipos, medidos, hoy);

	const nodoResultado = nodos.find((n) => n.type === NODO_RESULTADO);
	if (!nodoResultado || !ev.resultado) {
		return { corre: false, motivo: { codigo: 'sin_resultado', mensaje: 'El proceso no tiene su nodo de Resultado: ábrelo en el motor de reglas y agrégalo.' } };
	}
	if (ev.resultado.caso === null || ev.resultado.texto === null) {
		return {
			corre: false,
			motivo: { codigo: 'regla_incompleta', mensaje: 'Una regla del proceso está incompleta (le falta algo conectado): ábrelo en el motor de reglas y complétala.' }
		};
	}

	const cableDe = (id: string) => aristas.find((a) => a.target === id && a.targetHandle === 'a');

	// Los valores finales, en el orden de los nodos del proceso.
	const valoresFinales: ValorFinalDeCorrida[] = nodos
		.filter((n) => n.type === NODO_VALOR_FINAL)
		.map((n): ValorFinalDeCorrida => {
			const f = ev.finales[n.id] ?? { estado: 'sin_conexion' as const };
			return {
				nodoId: n.id,
				nombre: nombreDeValorFinal(n.id, n.data),
				forma: f.forma ?? 'valor',
				familia: f.familia ?? null,
				estado: f.estado,
				valor: f.estado === 'listo' ? (f.valor ?? '') : null,
				lista: f.estado === 'listo' && f.forma === 'lista' ? (f.elementos ?? []) : null,
				origen: origenDe(cableDe(n.id), nodos, tipos)
			};
		});

	// Cómo salió cada regla, en el orden de los nodos.
	const reglas: ReglaDeCorrida[] = [];
	for (const n of nodos) {
		if (n.type !== NODO_OPERADOR) continue;
		const def = operadorDe(String((n.data as DatosNodoOperador).operador));
		if (!def) continue;
		const estado = ev.estados[n.id] ?? 'sin_conexion';
		const valor = ev.valores[n.id] ?? null;
		const parecido = ev.parecidos[n.id];
		const antiguedad = ev.antiguedades[n.id];
		const entradas = [
			...entradasDe(n, aristas, nodos, tipos, ev),
			// «Antigüedad contra hoy»: su máximo y el hoy de la ejecución no llegan por cable, pero también se compararon.
			...(def.clave === 'antiguedad'
				? [
						{ etiqueta: 'Máximo', origen: 'En la regla', valor: cuantoTiempo(maximoDeAntiguedad(n.data), unidadDeAntiguedad(n.data)) },
						{ etiqueta: 'Hoy', origen: 'Día de la ejecución', valor: hoy }
					]
				: [])
		];
		if (parecido && (estado === 'pasa' || estado === 'no_pasa')) {
			reglas.push({ id: n.id, etiqueta: `${def.etiqueta} #${numeroDeOperador(n.id)}`, operador: def.clave, estado, valor, texto: textoDeParecido(estado, parecido), parecido: { ...parecido }, entradas });
			continue;
		}
		if (antiguedad && (estado === 'pasa' || estado === 'no_pasa')) {
			reglas.push({ id: n.id, etiqueta: `${def.etiqueta} #${numeroDeOperador(n.id)}`, operador: def.clave, estado, valor, texto: textoDeAntiguedad(estado, antiguedad), antiguedad: { ...antiguedad }, entradas });
			continue;
		}
		reglas.push({
			id: n.id,
			etiqueta: `${def.etiqueta} #${numeroDeOperador(n.id)}`,
			operador: def.clave,
			estado,
			valor,
			texto:
				estado === 'pasa' ? def.textoPasa : estado === 'no_pasa' ? def.textoNoPasa : estado === 'listo' ? `Resultado: ${valor ?? ''}` : estado === 'sin_valores' ? TEXTO_SIN_VALORES : TEXTO_INCOMPLETA,
			entradas
		});
	}

	// La evidencia: por cada tipo del proceso, de qué documento se tomó y qué campos se leyeron (los que tienen cable).
	const faltantes: string[] = [];
	const evidencia: EvidenciaDeCorrida[] = [];
	for (const n of nodos) {
		if (n.type !== NODO_TIPO) continue;
		const tipoId = (n.data as DatosNodoTipo).tipoId;
		const tipo = prep.tipos.find((t) => t.id === tipoId);
		const doc = prep.documentos.find((d) => d.tipoId === tipoId);
		if (!tipo || evidencia.some((e) => e.tipoId === tipoId)) continue;
		const encontrado = doc?.encontrados[0] ?? null;
		const usados = [...new Set(aristas.filter((a) => a.source === n.id && a.sourceHandle && a.sourceHandle !== HANDLE_DOCUMENTO).map((a) => a.sourceHandle as string))];
		const usaDocumento = aristas.some((a) => a.source === n.id && a.sourceHandle === HANDLE_DOCUMENTO);
		if (!encontrado && (usados.length > 0 || usaDocumento)) faltantes.push(`${tipo.nombre}: el expediente no trae el documento`);
		const campos = usados.map((punto) => {
			const v = doc?.valores?.[punto];
			if (encontrado && v && v.valores.length === 0) faltantes.push(`${tipo.nombre} · ${punto}: el documento no trae el dato`);
			else if (encontrado && !v) faltantes.push(`${tipo.nombre} · ${punto}: el documento no trae el dato`);
			return { campo: punto, forma: v?.forma ?? 'valor', valores: v?.valores ?? [], confianza: v?.confianza ?? null, pagina: v?.pagina ?? null };
		});
		evidencia.push({ tipoId, tipoNombre: tipo.nombre, documentoId: encontrado?.id ?? null, documentoNombre: encontrado?.nombre ?? null, origenTipo: encontrado?.origenTipo ?? null, campos });
	}

	return {
		corre: true,
		corrida: {
			resultado: { caso: ev.resultado.caso, texto: ev.resultado.texto },
			valoresFinales,
			detalle: { reglas, evidencia, condicion: ev.resultado.condicion, faltantes }
		}
	};
}

