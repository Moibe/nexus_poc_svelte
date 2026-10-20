/**
 * La lógica del lienzo del motor de reglas, sin nada de pantalla (2026-10-20): qué operadores hay, qué se puede conectar con qué,
 * cuándo dos valores son «iguales» y cómo se evalúa una cadena de reglas. Vive aparte de los componentes para poder probarla sola
 * (`verificar-reglas.mjs`): por eso aquí solo se importan TIPOS, nunca código.
 *
 * El modelo: un PROCESO es un conjunto de reglas y corre sobre un EXPEDIENTE (un conjunto de documentos). Los tipos documentales
 * son sus entradas; por cada conexión viaja un CAMPO (no el documento entero) y su tipo de dato decide qué se puede comparar.
 * Las reglas de COMPARACIÓN (igual, distinto, contiene, mayor, menor) reciben campos y dan pasa / no pasa. Las LÓGICAS (Y, O, No)
 * reciben ese pasa / no pasa de otras reglas, y así se encadenan.
 */
import type { TipoDocumentalGuardado } from '$lib/state/configuracion.svelte';

// ── Los nodos del lienzo ─────────────────────────────────────────────────────

/** Lo que lleva un nodo de tipo documental: solo cuál es. Sus campos se leen en vivo de la biblioteca. */
export type DatosNodoTipo = { tipoId: string };

/**
 * Lo que lleva un nodo operador: cuál es y, para los de comparación, los valores de EJEMPLO con los que se prueba la regla (uno
 * por entrada: el lienzo aún no corre sobre un expediente de verdad). Los operadores lógicos no usan `a` ni `b`.
 */
export type DatosNodoOperador = { operador: ClaveOperador; a: string; b: string };

/** Los tipos de nodo que registra el lienzo (`nodeTypes`). */
export const NODO_TIPO = 'tipo-documental';
export const NODO_OPERADOR = 'operador';

/** Con qué se arrastra algo desde la paleta hasta el lienzo (`DataTransfer`). */
export const MIME_TIPO_DOCUMENTAL = 'application/x-nexusdoc-tipo-documental';
export const MIME_OPERADOR = 'application/x-nexusdoc-operador';

/** El punto por el que un operador entrega su pasa / no pasa. */
export const SALIDA_RESULTADO = 'resultado';

/** Con qué llave el lienzo le ofrece a sus nodos el veredicto de cada regla (`getContext`). */
export const CLAVE_VEREDICTOS = 'nexusdoc-veredictos';

/**
 * Un proceso corre sobre un expediente, o sea un conjunto de documentos, así que cada tipo documental aparece UNA vez: el nodo
 * «Acta constitutiva» es el acta de ESTE expediente. De ahí que el id del nodo salga del tipo y no se pueda repetir.
 */
export const idNodoDeTipo = (tipoId: string) => `tipo-${tipoId}`;

/** El número con el que se distingue un operador de otro del mismo tipo («Igual a #2»). */
export const numeroDeOperador = (nodoId: string) => nodoId.replace(/^operador-/, '');

// ── Qué es comparable con qué ────────────────────────────────────────────────

/** Dos campos se pueden comparar si son de la misma familia: un número con una moneda sí, un texto con una fecha no. */
export type Familia = 'texto' | 'numero' | 'fecha' | 'booleano';

/** `null` para lo que no es UN valor (el grupo de campos). */
export function familiaDe(tipoDato: string): Familia | null {
	switch (tipoDato) {
		case 'texto':
		case 'lista':
			return 'texto';
		case 'numero':
		case 'moneda':
			return 'numero';
		case 'fecha':
			return 'fecha';
		case 'booleano':
			return 'booleano';
		default:
			return null;
	}
}

const NOMBRE_DE_FAMILIA: Record<Familia, string> = { texto: 'un texto', numero: 'un número', fecha: 'una fecha', booleano: 'un sí/no' };
const PLURAL_DE_FAMILIA: Record<Familia, string> = { texto: 'textos', numero: 'números', fecha: 'fechas', booleano: 'valores sí/no' };

// ── Los operadores ───────────────────────────────────────────────────────────

export type ClaveOperador = 'igual' | 'distinto' | 'contiene' | 'mayor' | 'menor' | 'y' | 'o' | 'no';
export type Entrada = 'a' | 'b';

export type DefOperador = {
	clave: ClaveOperador;
	etiqueta: string;
	descripcion: string;
	/** Lo que se dibuja en el nodo y en la paleta. */
	simbolo: string;
	/** Comparación: recibe CAMPOS. Lógico: recibe el pasa / no pasa de otras reglas. */
	grupo: 'comparacion' | 'logico';
	entradas: readonly { id: Entrada; etiqueta: string }[];
	/** Solo comparación: con qué familias de dato trabaja. */
	familias: readonly Familia[];
	/** Lo que dice el nodo según le salga. */
	textoPasa: string;
	textoNoPasa: string;
};

const TODAS: readonly Familia[] = ['texto', 'numero', 'fecha', 'booleano'];
const LADOS_AB = [
	{ id: 'a', etiqueta: 'Lado A' },
	{ id: 'b', etiqueta: 'Lado B' }
] as const;
const REGLAS_AB = [
	{ id: 'a', etiqueta: 'Regla A' },
	{ id: 'b', etiqueta: 'Regla B' }
] as const;

/** Los operadores que ofrece la paleta, en el orden en que se muestran. */
export const OPERADORES: readonly DefOperador[] = [
	{ clave: 'igual', etiqueta: 'Igual a', simbolo: '=', grupo: 'comparacion', descripcion: 'Pasa si los dos valores son iguales.', entradas: LADOS_AB, familias: TODAS, textoPasa: 'Pasa: los dos valores son iguales', textoNoPasa: 'No pasa: los valores son distintos' },
	{ clave: 'distinto', etiqueta: 'Distinto de', simbolo: '≠', grupo: 'comparacion', descripcion: 'Pasa si los dos valores son distintos.', entradas: LADOS_AB, familias: TODAS, textoPasa: 'Pasa: los valores son distintos', textoNoPasa: 'No pasa: los dos valores son iguales' },
	{
		clave: 'contiene',
		etiqueta: 'Contiene',
		simbolo: '∋',
		grupo: 'comparacion',
		descripcion: 'Pasa si el texto contiene al fragmento.',
		entradas: [
			{ id: 'a', etiqueta: 'Texto' },
			{ id: 'b', etiqueta: 'Debe contener' }
		],
		familias: ['texto'],
		textoPasa: 'Pasa: el texto contiene el fragmento',
		textoNoPasa: 'No pasa: el texto no contiene el fragmento'
	},
	{
		clave: 'mayor',
		etiqueta: 'Mayor que',
		simbolo: '>',
		grupo: 'comparacion',
		descripcion: 'Pasa si el primer valor es mayor que el segundo.',
		entradas: [
			{ id: 'a', etiqueta: 'Valor' },
			{ id: 'b', etiqueta: 'Mayor que' }
		],
		familias: ['numero', 'fecha'],
		textoPasa: 'Pasa: el primer valor es mayor',
		textoNoPasa: 'No pasa: el primer valor no es mayor'
	},
	{
		clave: 'menor',
		etiqueta: 'Menor que',
		simbolo: '<',
		grupo: 'comparacion',
		descripcion: 'Pasa si el primer valor es menor que el segundo.',
		entradas: [
			{ id: 'a', etiqueta: 'Valor' },
			{ id: 'b', etiqueta: 'Menor que' }
		],
		familias: ['numero', 'fecha'],
		textoPasa: 'Pasa: el primer valor es menor',
		textoNoPasa: 'No pasa: el primer valor no es menor'
	},
	{ clave: 'y', etiqueta: 'Y', simbolo: 'Y', grupo: 'logico', descripcion: 'Pasa si las dos reglas conectadas pasan.', entradas: REGLAS_AB, familias: [], textoPasa: 'Pasa: las dos reglas pasan', textoNoPasa: 'No pasa: alguna regla no pasa' },
	{ clave: 'o', etiqueta: 'O', simbolo: 'O', grupo: 'logico', descripcion: 'Pasa si al menos una de las reglas pasa.', entradas: REGLAS_AB, familias: [], textoPasa: 'Pasa: alguna regla pasa', textoNoPasa: 'No pasa: ninguna regla pasa' },
	{
		clave: 'no',
		etiqueta: 'No',
		simbolo: '¬',
		grupo: 'logico',
		descripcion: 'Pasa si la regla conectada NO pasa.',
		entradas: [{ id: 'a', etiqueta: 'Regla' }],
		familias: [],
		textoPasa: 'Pasa: la regla no pasa',
		textoNoPasa: 'No pasa: la regla pasa'
	}
];

export const operadorDe = (clave: string): DefOperador | undefined => OPERADORES.find((o) => o.clave === clave);

// ── De dónde sale un valor: la salida de un campo ────────────────────────────

/** Lo que sale por el punto de un campo: de qué documento, cuál campo y de qué tipo. */
export type Salida = {
	/** El nombre del tipo documental. */
	tipo: string;
	/** El nombre del campo; `grupo.subcampo` si es de dentro de un grupo. */
	campo: string;
	tipoDato: string;
	/** Trae VARIOS valores (cardinalidad 1 a N, o un subcampo de un grupo que se repite). */
	seRepite: boolean;
};

type CampoDeTipo = TipoDocumentalGuardado['campos'][number];

/** La salida del campo `campo`, o del subcampo `sub` de un grupo. */
export function salidaDe(nombreTipo: string, campo: CampoDeTipo, sub?: CampoDeTipo['subcampos'][number]): Salida {
	return {
		tipo: nombreTipo,
		campo: sub ? `${campo.nombre}.${sub.nombre}` : campo.nombre,
		tipoDato: sub ? sub.tipoDato : campo.tipoDato,
		seRepite: campo.cardinalidad === 'multiple'
	};
}

/** La salida a la que apunta el punto `handleId` de un nodo de tipo. Se compara por nombre completo, sin partirlo por el punto: un campo puede llamarse «no. de folio». */
export function salidaDeCampo(tipos: readonly TipoDocumentalGuardado[], tipoId: string, handleId: string): Salida | null {
	const tipo = tipos.find((t) => t.id === tipoId);
	if (!tipo) return null;
	for (const c of tipo.campos) {
		if (c.nombre === handleId) return salidaDe(tipo.nombre, c);
		if (c.tipoDato === 'grupo') {
			for (const s of c.subcampos) if (`${c.nombre}.${s.nombre}` === handleId) return salidaDe(tipo.nombre, c, s);
		}
	}
	return null;
}

/** Por qué esta salida NO se puede conectar todavía; `null` si se puede. */
export function porQueNoSeConecta(s: Salida): string | null {
	if (s.tipoDato === 'grupo') return 'Un grupo de campos trae filas, no un valor: conecta alguno de sus subcampos.';
	if (s.seRepite) return 'Trae varios valores (1 a N): se podrá usar con los operadores de listas.';
	if (familiaDe(s.tipoDato) === null) return 'Este tipo de dato todavía no se puede comparar.';
	return null;
}

// ── Qué conexiones se aceptan ────────────────────────────────────────────────

type NodoMinimo = { id: string; type?: string; data: Record<string, unknown> };
export type Conexion = { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null };

const operadorDelNodo = (n: NodoMinimo | undefined): DefOperador | undefined =>
	n?.type === NODO_OPERADOR ? operadorDe(String((n.data as DatosNodoOperador).operador)) : undefined;

/** ¿Llega `desde` hasta `hasta` siguiendo los cables hacia adelante? Sirve para no cerrar un ciclo. */
function alcanza(desde: string, hasta: string, aristas: readonly Conexion[]): boolean {
	const vistos = new Set<string>();
	const pendientes = [desde];
	while (pendientes.length) {
		const actual = pendientes.pop() as string;
		if (actual === hasta) return true;
		if (vistos.has(actual)) continue;
		vistos.add(actual);
		for (const e of aristas) if (e.source === actual) pendientes.push(e.target);
	}
	return false;
}

/**
 * Por qué NO se acepta esta conexión; `null` si se acepta. La razón se le dice a la persona: soltar un cable y que no pase nada,
 * sin decir por qué, es lo peor de un lienzo.
 */
export function motivoDeRechazo(
	c: Conexion,
	nodos: readonly NodoMinimo[],
	aristas: readonly Conexion[],
	tipos: readonly TipoDocumentalGuardado[]
): string | null {
	const origen = nodos.find((n) => n.id === c.source);
	const destino = nodos.find((n) => n.id === c.target);
	if (!origen || !destino) return 'No se puede conectar eso.';
	const def = operadorDelNodo(destino);
	const entrada = def?.entradas.find((e) => e.id === c.targetHandle);
	if (!def || !entrada) return 'Un campo o un resultado se conecta a una de las entradas de un operador.';

	// El otro lado del operador, si ya tiene algo: manda sobre lo que se puede poner en éste.
	const otroLado = def.entradas.find((e) => e.id !== c.targetHandle);
	const aristaOtra = otroLado && aristas.find((e) => e.target === c.target && e.targetHandle === otroLado.id);
	const mismaOrigen = aristaOtra && aristaOtra.source === c.source && (aristaOtra.sourceHandle ?? '') === (c.sourceHandle ?? '');

	// ── Un resultado hacia un operador lógico ──
	if (origen.type === NODO_OPERADOR) {
		if (c.sourceHandle !== SALIDA_RESULTADO) return 'De un operador solo sale su resultado.';
		if (def.grupo !== 'logico') return `«${def.etiqueta}» compara campos: un resultado se conecta a un operador Y, O o No.`;
		if (origen.id === destino.id) return 'Una regla no puede depender de sí misma.';
		if (alcanza(destino.id, origen.id, aristas)) return 'Eso cerraría un ciclo: una regla acabaría dependiendo de sí misma.';
		if (mismaOrigen) return 'Las dos entradas serían la misma regla: no habría nada que combinar.';
		return null;
	}

	// ── Un campo hacia un operador de comparación ──
	if (origen.type !== NODO_TIPO) return 'No se puede conectar eso.';
	if (def.grupo !== 'comparacion') return `«${def.etiqueta}» combina resultados de otras reglas, no campos: conecta antes el campo a una comparación.`;

	const salida = salidaDeCampo(tipos, (origen.data as DatosNodoTipo).tipoId, c.sourceHandle ?? '');
	if (!salida) return 'Ese campo ya no existe en el tipo documental.';
	const noSePuede = porQueNoSeConecta(salida);
	if (noSePuede) return noSePuede;
	const mia = familiaDe(salida.tipoDato) as Familia;
	if (!def.familias.includes(mia)) {
		return `«${def.etiqueta}» solo trabaja con ${def.familias.map((f) => PLURAL_DE_FAMILIA[f]).join(' y ')}.`;
	}

	const nodoOtro = aristaOtra && nodos.find((n) => n.id === aristaOtra.source);
	const salidaOtra = aristaOtra && nodoOtro && salidaDeCampo(tipos, (nodoOtro.data as DatosNodoTipo).tipoId, aristaOtra.sourceHandle ?? '');
	if (aristaOtra && salidaOtra) {
		if (mismaOrigen) return 'Los dos lados serían el mismo campo: no habría nada que comparar.';
		const suya = familiaDe(salidaOtra.tipoDato);
		if (suya && mia !== suya) return `No se puede comparar ${NOMBRE_DE_FAMILIA[mia]} con ${NOMBRE_DE_FAMILIA[suya]}.`;
	}
	return null;
}

// ── Cuándo dos valores son iguales, y cuál es mayor ──────────────────────────

const textoLimpio = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

/** «$1,250.50», «1.250,50» y «1250.5» son el mismo número. `null` si no hay un número ahí. */
function aNumero(s: string): number | null {
	let t = s.replace(/[^\d.,-]/g, '');
	if (!/\d/.test(t)) return null;
	if (t.includes('.') && t.includes(',')) {
		// Con los dos separadores, el decimal es el que va al final: «1,250.50» y «1.250,50» son lo mismo.
		const decimal = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
		t = t.split(decimal === ',' ? '.' : ',').join('').replace(decimal, '.');
	} else if (/^-?\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, '');
	else t = t.replace(',', '.');
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dosCifras = (n: number | string) => String(n).padStart(2, '0');

/** `2020-03-15`, `15/03/2020` y «15 de marzo de 2020» son la misma fecha. `null` si no se reconoce. */
function aFecha(s: string): string | null {
	const t = textoLimpio(s);
	let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
	if (m) return `${m[1]}-${dosCifras(m[2])}-${dosCifras(m[3])}`;
	m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
	if (m) return `${m[3]}-${dosCifras(m[2])}-${dosCifras(m[1])}`;
	m = /^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/.exec(t);
	const mes = m ? MESES.indexOf(m[2]) : -1;
	if (m && mes >= 0) return `${m[3]}-${dosCifras(mes + 1)}-${dosCifras(m[1])}`;
	return null;
}

function aBooleano(s: string): boolean | null {
	const t = textoLimpio(s);
	if (['si', 'sí', 'true', 'verdadero', '1'].includes(t)) return true;
	if (['no', 'false', 'falso', '0'].includes(t)) return false;
	return null;
}

/**
 * ¿Son iguales los dos valores? Se comparan por lo que SIGNIFICAN, no por cómo se escribieron:
 *   · texto: sin importar mayúsculas ni espacios de más;
 *   · número: por su valor (el símbolo de moneda y los separadores de miles no cuentan);
 *   · fecha: por el día, venga como venga escrita;
 *   · sí/no: «sí» y «true» son lo mismo.
 * Un valor que no se entiende (un número que no es número) no es igual a nada.
 */
export function sonIguales(familia: Familia, a: string, b: string): boolean {
	switch (familia) {
		case 'numero': {
			const x = aNumero(a);
			const y = aNumero(b);
			return x !== null && y !== null && Math.abs(x - y) < 1e-9;
		}
		case 'fecha': {
			const x = aFecha(a);
			const y = aFecha(b);
			return x !== null && y !== null ? x === y : textoLimpio(a) === textoLimpio(b);
		}
		case 'booleano': {
			const x = aBooleano(a);
			const y = aBooleano(b);
			return x !== null && y !== null && x === y;
		}
		default:
			return textoLimpio(a) === textoLimpio(b);
	}
}

/** Negativo si `a` va antes que `b`, 0 si son el mismo, positivo si va después; `null` si alguno no se entiende. Solo números y fechas. */
export function ordenar(familia: Familia, a: string, b: string): number | null {
	if (familia === 'numero') {
		const x = aNumero(a);
		const y = aNumero(b);
		return x === null || y === null ? null : x - y;
	}
	if (familia === 'fecha') {
		const x = aFecha(a);
		const y = aFecha(b);
		return x === null || y === null ? null : x < y ? -1 : x > y ? 1 : 0;
	}
	return null;
}

// ── El veredicto de cada regla ───────────────────────────────────────────────

/**
 * Qué dice una regla: `sin_conexion` (le falta algo conectado), `sin_valores` (está conectada pero faltan valores de ejemplo, o
 * una regla de la que depende todavía no tiene veredicto), `pasa` o `no_pasa`.
 */
export type Veredicto = 'pasa' | 'no_pasa' | 'sin_valores' | 'sin_conexion';

/** El veredicto de una COMPARACIÓN con los valores de ejemplo. Un valor que no se entiende no cumple ninguna comparación. */
export function evaluarComparacion(clave: ClaveOperador, familia: Familia, a: string, b: string): Veredicto {
	if (!a.trim() || !b.trim()) return 'sin_valores';
	const si = (ok: boolean): Veredicto => (ok ? 'pasa' : 'no_pasa');
	switch (clave) {
		case 'igual':
			return si(sonIguales(familia, a, b));
		case 'distinto':
			return si(!sonIguales(familia, a, b));
		case 'contiene':
			return si(textoLimpio(a).includes(textoLimpio(b)));
		case 'mayor': {
			const o = ordenar(familia, a, b);
			return si(o !== null && o > 0);
		}
		case 'menor': {
			const o = ordenar(familia, a, b);
			return si(o !== null && o < 0);
		}
		default:
			return 'sin_conexion';
	}
}

/**
 * El veredicto de un operador LÓGICO a partir del de las reglas que le llegan (ya todas conectadas). Si alguna no tiene veredicto,
 * Y y O solo se atreven a decidir cuando lo que ya se sabe basta: un «no pasa» hunde a Y, un «pasa» salva a O.
 */
export function evaluarLogico(clave: ClaveOperador, entradas: readonly Veredicto[]): Veredicto {
	const sabe = (v: Veredicto) => v === 'pasa' || v === 'no_pasa';
	switch (clave) {
		case 'y':
			if (entradas.includes('no_pasa')) return 'no_pasa';
			return entradas.every((v) => v === 'pasa') ? 'pasa' : 'sin_valores';
		case 'o':
			if (entradas.includes('pasa')) return 'pasa';
			return entradas.every((v) => v === 'no_pasa') ? 'no_pasa' : 'sin_valores';
		case 'no': {
			const v = entradas[0];
			return !sabe(v) ? 'sin_valores' : v === 'pasa' ? 'no_pasa' : 'pasa';
		}
		default:
			return 'sin_conexion';
	}
}

/** El veredicto de CADA operador del lienzo, siguiendo los cables: las comparaciones leen sus campos y sus valores de ejemplo, las lógicas leen a las que les llegan. */
export function evaluar(
	nodos: readonly NodoMinimo[],
	aristas: readonly Conexion[],
	tipos: readonly TipoDocumentalGuardado[]
): Record<string, Veredicto> {
	const hechos: Record<string, Veredicto> = {};

	const de = (id: string, enCurso: ReadonlySet<string>): Veredicto => {
		if (id in hechos) return hechos[id];
		const nodo = nodos.find((n) => n.id === id);
		const def = operadorDelNodo(nodo);
		if (!nodo || !def) return 'sin_conexion';
		// Un ciclo no debería existir (la conexión se rechaza), pero un lienzo guardado a mano no debe colgar la pantalla.
		if (enCurso.has(id)) return 'sin_valores';
		const dentro = new Set(enCurso).add(id);

		let resultado: Veredicto;
		const cables = def.entradas.map((e) => aristas.find((a) => a.target === id && a.targetHandle === e.id));
		if (cables.some((c) => !c)) {
			resultado = 'sin_conexion';
		} else if (def.grupo === 'comparacion') {
			const salidas = (cables as Conexion[]).map((c) => {
				const origen = nodos.find((n) => n.id === c.source);
				return origen?.type === NODO_TIPO ? salidaDeCampo(tipos, (origen.data as DatosNodoTipo).tipoId, c.sourceHandle ?? '') : null;
			});
			const familia = salidas[0] ? familiaDe(salidas[0].tipoDato) : null;
			const datos = nodo.data as DatosNodoOperador;
			resultado = salidas.some((s) => !s) || !familia ? 'sin_conexion' : evaluarComparacion(def.clave, familia, datos.a ?? '', datos.b ?? '');
		} else {
			const llegan = (cables as Conexion[]).map((c) => (operadorDelNodo(nodos.find((n) => n.id === c.source)) ? de(c.source, dentro) : 'sin_conexion'));
			resultado = llegan.includes('sin_conexion') ? 'sin_conexion' : evaluarLogico(def.clave, llegan);
		}
		hechos[id] = resultado;
		return resultado;
	};

	for (const n of nodos) if (operadorDelNodo(n)) de(n.id, new Set());
	return hechos;
}

// ── Guardar el dibujo y volver a abrirlo ─────────────────────────────────────

/** Un nodo tal como se guarda: solo lo que el lienzo necesita (la librería le suma medidas y banderas de selección que no van). */
export type NodoGuardado = {
	id: string;
	type: typeof NODO_TIPO | typeof NODO_OPERADOR;
	position: { x: number; y: number };
	data: DatosNodoTipo | DatosNodoOperador;
};
/** Un cable tal como se guarda. */
export type AristaGuardada = { id: string; source: string; sourceHandle: string | null; target: string; targetHandle: string | null };
export type DibujoGuardado = { nodos: NodoGuardado[]; aristas: AristaGuardada[] };

type NodoDeLienzo = NodoMinimo & { position: { x: number; y: number } };

/** Las posiciones se guardan sin decimales: medio píxel de arrastre no es un cambio que valga un «cambios sin guardar». */
const entero = (n: number) => Math.round(n);

/**
 * El dibujo del lienzo como se guarda. Es DETERMINISTA —mismo lienzo, mismo resultado— porque de ahí sale la huella con la que se
 * sabe si hay cambios sin guardar: los cables se renumeran (`cable-1`, `cable-2`…) en vez de guardar los ids que inventa la librería,
 * que llevan los nombres de los campos y pueden salir larguísimos.
 */
export function serializarDibujo(nodes: readonly NodoDeLienzo[], edges: readonly Conexion[]): DibujoGuardado {
	const nodos: NodoGuardado[] = [];
	for (const n of nodes) {
		const position = { x: entero(n.position.x), y: entero(n.position.y) };
		if (n.type === NODO_TIPO) {
			nodos.push({ id: n.id, type: NODO_TIPO, position, data: { tipoId: String((n.data as DatosNodoTipo).tipoId) } });
		} else if (n.type === NODO_OPERADOR) {
			const d = n.data as DatosNodoOperador;
			nodos.push({ id: n.id, type: NODO_OPERADOR, position, data: { operador: d.operador, a: d.a ?? '', b: d.b ?? '' } });
		}
	}
	const existentes = new Set(nodos.map((n) => n.id));
	const aristas = edges
		.filter((e) => existentes.has(e.source) && existentes.has(e.target))
		.map((e, i): AristaGuardada => ({
			id: `cable-${i + 1}`,
			source: e.source,
			sourceHandle: e.sourceHandle ?? null,
			target: e.target,
			targetHandle: e.targetHandle ?? null
		}));
	return { nodos, aristas };
}

/** Lo que identifica a un dibujo: dos lienzos con la misma huella son el mismo. */
export const huellaDelDibujo = (d: DibujoGuardado): string => JSON.stringify(d);

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Lo guardado, de vuelta a nodos y cables del lienzo. Lo que no se entiende se deja fuera en vez de reventar la pantalla (un nodo
 * de un tipo que ya no existe, un cable a un nodo que no está, un operador que el catálogo ya no tiene): el servidor valida lo que
 * recibe, pero el catálogo de operadores puede cambiar entre versiones. `operadoresPuestos` es por dónde sigue la numeración, para
 * que un operador nuevo no se llame igual que uno ya guardado.
 */
export function hidratarDibujo(guardado: { nodos?: unknown; aristas?: unknown }): {
	nodes: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }[];
	edges: { id: string; source: string; sourceHandle: string | null; target: string; targetHandle: string | null }[];
	operadoresPuestos: number;
} {
	const nodes: ReturnType<typeof hidratarDibujo>['nodes'] = [];
	for (const n of Array.isArray(guardado.nodos) ? guardado.nodos : []) {
		if (!esObjeto(n) || typeof n.id !== 'string' || !esObjeto(n.position) || !esObjeto(n.data)) continue;
		if (!esNumero(n.position.x) || !esNumero(n.position.y)) continue;
		const position = { x: n.position.x, y: n.position.y };
		if (n.type === NODO_TIPO && typeof n.data.tipoId === 'string') {
			nodes.push({ id: n.id, type: NODO_TIPO, position, data: { tipoId: n.data.tipoId } });
		} else if (n.type === NODO_OPERADOR && typeof n.data.operador === 'string' && operadorDe(n.data.operador)) {
			nodes.push({
				id: n.id,
				type: NODO_OPERADOR,
				position,
				data: { operador: n.data.operador, a: typeof n.data.a === 'string' ? n.data.a : '', b: typeof n.data.b === 'string' ? n.data.b : '' }
			});
		}
	}
	const existentes = new Set(nodes.map((n) => n.id));
	const edges: ReturnType<typeof hidratarDibujo>['edges'] = [];
	for (const a of Array.isArray(guardado.aristas) ? guardado.aristas : []) {
		if (!esObjeto(a) || typeof a.id !== 'string' || typeof a.source !== 'string' || typeof a.target !== 'string') continue;
		if (!existentes.has(a.source) || !existentes.has(a.target)) continue;
		edges.push({
			id: a.id,
			source: a.source,
			sourceHandle: typeof a.sourceHandle === 'string' ? a.sourceHandle : null,
			target: a.target,
			targetHandle: typeof a.targetHandle === 'string' ? a.targetHandle : null
		});
	}
	let operadoresPuestos = 0;
	for (const n of nodes) {
		const m = n.type === NODO_OPERADOR ? /^operador-(\d+)$/.exec(n.id) : null;
		if (m) operadoresPuestos = Math.max(operadoresPuestos, Number(m[1]));
	}
	return { nodes, edges, operadoresPuestos };
}
