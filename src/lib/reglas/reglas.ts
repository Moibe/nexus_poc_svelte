/**
 * La lógica del lienzo del motor de reglas, sin nada de pantalla (2026-10-20): qué operadores hay, qué se puede conectar con qué,
 * cuándo dos valores son «iguales» y cómo se evalúa una cadena de reglas. Vive aparte de los componentes para poder probarla sola
 * (`verificar-reglas.mjs`): por eso aquí solo se importan TIPOS, nunca código.
 *
 * El modelo: un PROCESO es un conjunto de reglas y corre sobre un EXPEDIENTE (un conjunto de documentos). Los tipos documentales
 * son sus entradas; por cada conexión viaja un CAMPO (no el documento entero) y su tipo de dato decide qué se puede comparar.
 *
 * Por un cable puede viajar:
 *   · un VALOR: un campo suelto, un valor fijo escrito en el lienzo, o el número que entrega una regla (`Cantidad`, `Suma`);
 *   · una LISTA de valores: un campo «1 a N» o una columna de un grupo que se repite;
 *   · las FILAS de un grupo que se repite (solo para contarlas);
 *   · un VEREDICTO (pasa / no pasa): lo que entrega una comparación, una pregunta por un documento o un operador lógico;
 *   · el DOCUMENTO entero (el punto «Documento» de un tipo documental): no es ningún dato, solo sirve para preguntar si el
 *     expediente lo trae (`Existe documento`).
 *
 * Los operadores de COMPARACIÓN (igual, distinto, contiene, mayor, menor) reciben dos valores y dan un veredicto. Los de LISTAS
 * (cantidad, suma, alguno, todos, unicos) reciben una lista: `cantidad` y `suma` entregan un valor (que se puede comparar) y los demás,
 * un veredicto. `Existe documento` recibe un documento entero y dice si el expediente lo trae. Los LÓGICOS (Y, O, No, Implica) reciben
 * veredictos de otras reglas, y así se encadenan: `Implica` es el «si… entonces…» (si la primera regla pasa, la segunda también debe
 * pasar; si la primera no pasa no hay nada que exigir).
 */
import type { TipoDocumentalGuardado } from '$lib/state/configuracion.svelte';

// ── Los nodos del lienzo ─────────────────────────────────────────────────────

/** Lo que lleva un nodo de tipo documental: solo cuál es. Sus campos se leen en vivo de la biblioteca. */
export type DatosNodoTipo = { tipoId: string };

/**
 * Lo que lleva un nodo operador: cuál es y, para los que reciben datos de un documento, los valores de EJEMPLO con los que se
 * prueba la regla (uno por entrada: el lienzo aún no corre sobre un expediente de verdad). Si lo que entra es una LISTA, el ejemplo
 * son varios renglones, uno por elemento. Los operadores lógicos no usan `a` ni `b`.
 */
export type DatosNodoOperador = { operador: ClaveOperador; a: string; b: string };

/** Lo que lleva un nodo de valor fijo: de qué clase es y el valor. A diferencia de un ejemplo, éste es parte de la regla. */
export type DatosNodoConstante = { familia: Familia; valor: string };

/** Los tipos de nodo que registra el lienzo (`nodeTypes`). */
export const NODO_TIPO = 'tipo-documental';
export const NODO_OPERADOR = 'operador';
export const NODO_CONSTANTE = 'constante';

/** Con qué se arrastra algo desde la paleta hasta el lienzo (`DataTransfer`). */
export const MIME_TIPO_DOCUMENTAL = 'application/x-nexusdoc-tipo-documental';
export const MIME_OPERADOR = 'application/x-nexusdoc-operador';
export const MIME_CONSTANTE = 'application/x-nexusdoc-constante';

/** El punto por el que un operador entrega su resultado (un veredicto o un valor, según el operador). */
export const SALIDA_RESULTADO = 'resultado';
/** El punto por el que un valor fijo entrega su valor. */
export const SALIDA_VALOR = 'valor';
/**
 * El punto por el que un tipo documental entrega el DOCUMENTO entero (no un campo). Comparte nodo con los puntos de los campos, que
 * se llaman como el campo, así que su id tiene que ser uno que ningún campo se ponga: lleva una arroba. (Como con «grupo.subcampo»,
 * un campo que se llamara exactamente así chocaría; el nombre de un campo no se restringe, pero nadie escribe eso.)
 */
export const HANDLE_DOCUMENTO = '@documento';

/** Con qué llave el lienzo le ofrece a sus nodos lo que evaluó (`getContext`). */
export const CLAVE_VEREDICTOS = 'nexusdoc-veredictos';

/**
 * Un proceso corre sobre un expediente, o sea un conjunto de documentos, así que cada tipo documental aparece UNA vez: el nodo
 * «Acta constitutiva» es el acta de ESTE expediente. De ahí que el id del nodo salga del tipo y no se pueda repetir.
 */
export const idNodoDeTipo = (tipoId: string) => `tipo-${tipoId}`;

/** El número con el que se distingue un operador o un valor fijo de otro del mismo tipo («Igual a #2», «Valor fijo #1»). */
export const numeroDeOperador = (nodoId: string) => nodoId.replace(/^(operador|constante)-/, '');

// ── Qué es comparable con qué ────────────────────────────────────────────────

/** Dos campos se pueden comparar si son de la misma familia: un número con una moneda sí, un texto con una fecha no. */
export type Familia = 'texto' | 'numero' | 'fecha' | 'booleano';

/** Las clases que se le pueden dar a un valor fijo, para el desplegable. */
export const FAMILIAS_DE_VALOR_FIJO: readonly { valor: Familia; etiqueta: string }[] = [
	{ valor: 'texto', etiqueta: 'Texto' },
	{ valor: 'numero', etiqueta: 'Número' },
	{ valor: 'fecha', etiqueta: 'Fecha' },
	{ valor: 'booleano', etiqueta: 'Sí / no' }
];

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

const esFamilia = (v: unknown): v is Familia => v === 'texto' || v === 'numero' || v === 'fecha' || v === 'booleano';

const NOMBRE_DE_FAMILIA: Record<Familia, string> = { texto: 'un texto', numero: 'un número', fecha: 'una fecha', booleano: 'un sí/no' };
const PLURAL_DE_FAMILIA: Record<Familia, string> = { texto: 'textos', numero: 'números', fecha: 'fechas', booleano: 'valores sí/no' };

// ── Los operadores ───────────────────────────────────────────────────────────

export type ClaveOperador =
	| 'igual'
	| 'distinto'
	| 'contiene'
	| 'mayor'
	| 'menor'
	| 'cantidad'
	| 'suma'
	| 'alguno'
	| 'todos'
	| 'unicos'
	| 'existe'
	| 'y'
	| 'o'
	| 'no'
	| 'implica';
export type Entrada = 'a' | 'b';

/** Lo que una entrada acepta que le llegue: un valor suelto, una lista de valores, el veredicto de otra regla o un documento entero. */
export type Acepta = 'valor' | 'lista' | 'veredicto' | 'documento';

export type DefOperador = {
	clave: ClaveOperador;
	etiqueta: string;
	descripcion: string;
	/** Lo que se dibuja en el nodo y en la paleta. */
	simbolo: string;
	grupo: 'comparacion' | 'lista' | 'documento' | 'logico';
	/** Lo que entrega: un pasa / no pasa, o un VALOR (un número) que otra regla puede comparar. */
	salida: 'veredicto' | 'valor';
	entradas: readonly { id: Entrada; etiqueta: string; acepta: Acepta }[];
	/** Con qué familias de dato trabaja (en las entradas de valores y de listas). */
	familias: readonly Familia[];
	/** Solo «Cantidad»: además de una lista, cuenta las FILAS de un grupo que se repite. */
	aceptaFilas?: boolean;
	/** Lo que dice el nodo según le salga (solo los que entregan un veredicto). */
	textoPasa: string;
	textoNoPasa: string;
	/**
	 * Solo «Implica»: lo que dice cuando pasa PORQUE la condición no se cumple (la primera regla no pasa y entonces no hay nada que
	 * exigir). Sin esto, una regla que «pasa» cuando la regla de entrada no pasa parece un error.
	 */
	textoPasaSinCondicion?: string;
};

const TODAS: readonly Familia[] = ['texto', 'numero', 'fecha', 'booleano'];
const LADOS_AB = [
	{ id: 'a', etiqueta: 'Lado A', acepta: 'valor' },
	{ id: 'b', etiqueta: 'Lado B', acepta: 'valor' }
] as const;
const REGLAS_AB = [
	{ id: 'a', etiqueta: 'Regla A', acepta: 'veredicto' },
	{ id: 'b', etiqueta: 'Regla B', acepta: 'veredicto' }
] as const;
const UNA_LISTA = [{ id: 'a', etiqueta: 'Lista', acepta: 'lista' }] as const;
const UN_DOCUMENTO = [{ id: 'a', etiqueta: 'Documento', acepta: 'documento' }] as const;
const SI_ENTONCES = [
	{ id: 'a', etiqueta: 'Si (condición)', acepta: 'veredicto' },
	{ id: 'b', etiqueta: 'Entonces (debe pasar)', acepta: 'veredicto' }
] as const;

/** Los operadores que ofrece la paleta, en el orden en que se muestran. */
export const OPERADORES: readonly DefOperador[] = [
	{ clave: 'igual', etiqueta: 'Igual a', simbolo: '=', grupo: 'comparacion', salida: 'veredicto', descripcion: 'Pasa si los dos valores son iguales.', entradas: LADOS_AB, familias: TODAS, textoPasa: 'Pasa: los dos valores son iguales', textoNoPasa: 'No pasa: los valores son distintos' },
	{ clave: 'distinto', etiqueta: 'Distinto de', simbolo: '≠', grupo: 'comparacion', salida: 'veredicto', descripcion: 'Pasa si los dos valores son distintos.', entradas: LADOS_AB, familias: TODAS, textoPasa: 'Pasa: los valores son distintos', textoNoPasa: 'No pasa: los dos valores son iguales' },
	{
		clave: 'contiene',
		etiqueta: 'Contiene',
		simbolo: '∋',
		grupo: 'comparacion',
		salida: 'veredicto',
		descripcion: 'Pasa si el texto contiene al fragmento.',
		entradas: [
			{ id: 'a', etiqueta: 'Texto', acepta: 'valor' },
			{ id: 'b', etiqueta: 'Debe contener', acepta: 'valor' }
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
		salida: 'veredicto',
		descripcion: 'Pasa si el primer valor es mayor que el segundo.',
		entradas: [
			{ id: 'a', etiqueta: 'Valor', acepta: 'valor' },
			{ id: 'b', etiqueta: 'Mayor que', acepta: 'valor' }
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
		salida: 'veredicto',
		descripcion: 'Pasa si el primer valor es menor que el segundo.',
		entradas: [
			{ id: 'a', etiqueta: 'Valor', acepta: 'valor' },
			{ id: 'b', etiqueta: 'Menor que', acepta: 'valor' }
		],
		familias: ['numero', 'fecha'],
		textoPasa: 'Pasa: el primer valor es menor',
		textoNoPasa: 'No pasa: el primer valor no es menor'
	},
	{
		clave: 'cantidad',
		etiqueta: 'Cantidad',
		simbolo: '#',
		grupo: 'lista',
		salida: 'valor',
		descripcion: 'Cuántos elementos o filas trae la lista.',
		entradas: UNA_LISTA,
		familias: TODAS,
		aceptaFilas: true,
		textoPasa: '',
		textoNoPasa: ''
	},
	{
		clave: 'suma',
		etiqueta: 'Suma',
		simbolo: 'Σ',
		grupo: 'lista',
		salida: 'valor',
		descripcion: 'Suma los números de la lista.',
		entradas: [{ id: 'a', etiqueta: 'Lista de números', acepta: 'lista' }],
		familias: ['numero'],
		textoPasa: '',
		textoNoPasa: ''
	},
	{
		clave: 'alguno',
		etiqueta: 'Alguno es igual a',
		simbolo: '∃',
		grupo: 'lista',
		salida: 'veredicto',
		descripcion: 'Pasa si algún elemento de la lista es igual al valor.',
		entradas: [
			{ id: 'a', etiqueta: 'Lista', acepta: 'lista' },
			{ id: 'b', etiqueta: 'Valor', acepta: 'valor' }
		],
		familias: TODAS,
		textoPasa: 'Pasa: algún elemento es igual',
		textoNoPasa: 'No pasa: ningún elemento es igual'
	},
	{
		clave: 'todos',
		etiqueta: 'Todos son iguales a',
		simbolo: '∀',
		grupo: 'lista',
		salida: 'veredicto',
		descripcion: 'Pasa si todos los elementos de la lista son iguales al valor.',
		entradas: [
			{ id: 'a', etiqueta: 'Lista', acepta: 'lista' },
			{ id: 'b', etiqueta: 'Valor', acepta: 'valor' }
		],
		familias: TODAS,
		textoPasa: 'Pasa: todos son iguales',
		textoNoPasa: 'No pasa: alguno es distinto'
	},
	{
		clave: 'unicos',
		etiqueta: 'Sin repetidos',
		simbolo: '⊘',
		grupo: 'lista',
		salida: 'veredicto',
		descripcion: 'Pasa si la lista no repite ningún valor.',
		entradas: UNA_LISTA,
		familias: TODAS,
		textoPasa: 'Pasa: no hay repetidos',
		textoNoPasa: 'No pasa: hay valores repetidos'
	},
	{
		clave: 'existe',
		etiqueta: 'Existe documento',
		simbolo: '◇',
		grupo: 'documento',
		salida: 'veredicto',
		descripcion: 'Pasa si el expediente trae un documento de este tipo.',
		entradas: UN_DOCUMENTO,
		familias: [],
		textoPasa: 'Pasa: el expediente trae el documento',
		textoNoPasa: 'No pasa: el expediente no trae el documento'
	},
	{ clave: 'y', etiqueta: 'Y', simbolo: 'Y', grupo: 'logico', salida: 'veredicto', descripcion: 'Pasa si las dos reglas conectadas pasan.', entradas: REGLAS_AB, familias: [], textoPasa: 'Pasa: las dos reglas pasan', textoNoPasa: 'No pasa: alguna regla no pasa' },
	{ clave: 'o', etiqueta: 'O', simbolo: 'O', grupo: 'logico', salida: 'veredicto', descripcion: 'Pasa si al menos una de las reglas pasa.', entradas: REGLAS_AB, familias: [], textoPasa: 'Pasa: alguna regla pasa', textoNoPasa: 'No pasa: ninguna regla pasa' },
	{
		clave: 'no',
		etiqueta: 'No',
		simbolo: '¬',
		grupo: 'logico',
		salida: 'veredicto',
		descripcion: 'Pasa si la regla conectada NO pasa.',
		entradas: [{ id: 'a', etiqueta: 'Regla', acepta: 'veredicto' }],
		familias: [],
		textoPasa: 'Pasa: la regla no pasa',
		textoNoPasa: 'No pasa: la regla pasa'
	},
	{
		clave: 'implica',
		etiqueta: 'Implica',
		simbolo: '→',
		grupo: 'logico',
		salida: 'veredicto',
		descripcion: 'Si la primera regla pasa, la segunda también debe pasar.',
		entradas: SI_ENTONCES,
		familias: [],
		textoPasa: 'Pasa: se cumple lo que se exigía',
		textoNoPasa: 'No pasa: se cumple la condición y lo que se exigía no',
		textoPasaSinCondicion: 'Pasa: la condición no se cumple, no hay nada que exigir'
	}
];

/** Los grupos de la paleta, en orden. */
export const GRUPOS_DE_OPERADORES = [
	{ clave: 'comparacion', titulo: 'Comparan valores' },
	{ clave: 'lista', titulo: 'Operan listas' },
	{ clave: 'documento', titulo: 'Revisan el expediente' },
	{ clave: 'logico', titulo: 'Combinan reglas' }
] as const;

export const operadorDe = (clave: string): DefOperador | undefined => OPERADORES.find((o) => o.clave === clave);

// ── De dónde sale un dato: la salida de un campo ─────────────────────────────

/**
 * Qué clase de cosa sale por el punto de un campo:
 *   · `valor`: un dato suelto (un campo, o una columna de un grupo que NO se repite);
 *   · `lista`: varios datos (un campo «1 a N», o una columna de un grupo que se repite);
 *   · `filas`: las filas de un grupo que se repite, que solo se pueden contar;
 *   · `nada`: un grupo que no se repite no entrega ningún dato por sí mismo (sus columnas, sí);
 *   · `documento`: el documento entero (el punto `HANDLE_DOCUMENTO`), que no es un dato: solo se le puede preguntar si existe.
 */
export type FormaDeSalida = 'valor' | 'lista' | 'filas' | 'nada' | 'documento';

/** Lo que sale por el punto de un campo: de qué documento, cuál campo y de qué tipo. */
export type Salida = {
	/** El nombre del tipo documental. */
	tipo: string;
	/** El nombre del campo; `grupo.subcampo` si es de dentro de un grupo. */
	campo: string;
	tipoDato: string;
	/** Trae VARIOS valores (cardinalidad 1 a N, o un subcampo de un grupo que se repite). */
	seRepite: boolean;
	forma: FormaDeSalida;
	/** `null` para las filas de un grupo y para lo que el lienzo todavía no sabe comparar. */
	familia: Familia | null;
};

type CampoDeTipo = TipoDocumentalGuardado['campos'][number];

/** La salida del campo `campo`, o del subcampo `sub` de un grupo. */
export function salidaDe(nombreTipo: string, campo: CampoDeTipo, sub?: CampoDeTipo['subcampos'][number]): Salida {
	const seRepite = campo.cardinalidad === 'multiple';
	const tipoDato = sub ? sub.tipoDato : campo.tipoDato;
	const esGrupoEntero = !sub && campo.tipoDato === 'grupo';
	const forma: FormaDeSalida = esGrupoEntero ? (seRepite ? 'filas' : 'nada') : seRepite ? 'lista' : 'valor';
	return {
		tipo: nombreTipo,
		campo: sub ? `${campo.nombre}.${sub.nombre}` : campo.nombre,
		tipoDato,
		seRepite,
		forma,
		familia: esGrupoEntero ? null : familiaDe(tipoDato)
	};
}

/** La salida a la que apunta el punto `handleId` de un nodo de tipo. Se compara por nombre completo, sin partirlo por el punto: un campo puede llamarse «no. de folio». */
export function salidaDeCampo(tipos: readonly TipoDocumentalGuardado[], tipoId: string, handleId: string): Salida | null {
	const tipo = tipos.find((t) => t.id === tipoId);
	if (!tipo) return null;
	if (handleId === HANDLE_DOCUMENTO) {
		return { tipo: tipo.nombre, campo: 'Documento', tipoDato: 'documento', seRepite: false, forma: 'documento', familia: null };
	}
	for (const c of tipo.campos) {
		if (c.nombre === handleId) return salidaDe(tipo.nombre, c);
		if (c.tipoDato === 'grupo') {
			for (const s of c.subcampos) if (`${c.nombre}.${s.nombre}` === handleId) return salidaDe(tipo.nombre, c, s);
		}
	}
	return null;
}

/** Por qué esta salida NO se puede conectar a NINGÚN operador; `null` si se puede (aunque solo sirva a algunos). */
export function porQueNoSeConecta(s: Salida): string | null {
	if (s.forma === 'nada') return 'Un grupo de campos que no se repite no trae ningún dato por sí mismo: conecta alguno de sus subcampos.';
	if (s.forma !== 'filas' && s.forma !== 'documento' && s.familia === null) return 'Este tipo de dato todavía no se puede usar en una regla.';
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

/** Lo que entrega el origen de un cable, para saber si le sirve a la entrada a la que llega. */
export type Fuente = { forma: 'valor' | 'lista' | 'filas' | 'veredicto' | 'documento'; familia: Familia | null };

/** Lo que entrega el origen de un cable; o, si no es algo que se pueda conectar, por qué. */
function fuenteDeConexion(c: Conexion, nodos: readonly NodoMinimo[], tipos: readonly TipoDocumentalGuardado[]): Fuente | string {
	const origen = nodos.find((n) => n.id === c.source);
	if (!origen) return 'No se puede conectar eso.';
	if (origen.type === NODO_TIPO) {
		const salida = salidaDeCampo(tipos, (origen.data as DatosNodoTipo).tipoId, c.sourceHandle ?? '');
		if (!salida) return 'Ese campo ya no existe en el tipo documental.';
		const noSePuede = porQueNoSeConecta(salida);
		if (noSePuede) return noSePuede;
		return { forma: salida.forma as Exclude<FormaDeSalida, 'nada'>, familia: salida.familia };
	}
	if (origen.type === NODO_CONSTANTE) {
		if (c.sourceHandle !== SALIDA_VALOR) return 'De un valor fijo solo sale su valor.';
		const familia = (origen.data as DatosNodoConstante).familia;
		return { forma: 'valor', familia: esFamilia(familia) ? familia : 'texto' };
	}
	const def = operadorDelNodo(origen);
	if (def) {
		if (c.sourceHandle !== SALIDA_RESULTADO) return 'De un operador solo sale su resultado.';
		return def.salida === 'veredicto' ? { forma: 'veredicto', familia: null } : { forma: 'valor', familia: 'numero' };
	}
	return 'No se puede conectar eso.';
}

/** Por qué lo que entrega `fuente` no le sirve a la `entrada` de `def`; `null` si le sirve. */
function noLeSirve(fuente: Fuente, acepta: Acepta, def: DefOperador): string | null {
	// El documento entero no es un dato: solo le sirve a quien pregunta por un documento, y a éste solo le sirve un documento.
	if (acepta === 'documento') {
		return fuente.forma === 'documento'
			? null
			: `«${def.etiqueta}» revisa un documento entero, no un campo ni una regla: conecta el punto «Documento» de un tipo documental.`;
	}
	if (fuente.forma === 'documento') {
		return acepta === 'veredicto'
			? `«${def.etiqueta}» combina resultados de otras reglas, no documentos: conecta antes el documento a «Existe documento».`
			: acepta === 'lista'
				? `«${def.etiqueta}» trabaja con listas de valores, no con un documento entero: conecta uno de sus campos que se repite.`
				: `«${def.etiqueta}» compara campos y valores, no un documento entero: conecta uno de sus campos.`;
	}
	if (acepta === 'veredicto') {
		return fuente.forma === 'veredicto'
			? null
			: `«${def.etiqueta}» combina resultados de otras reglas, no campos ni valores: conecta antes ese dato a una regla.`;
	}
	if (acepta === 'valor') {
		switch (fuente.forma) {
			case 'valor':
				return null;
			case 'veredicto':
				return `«${def.etiqueta}» compara campos y valores: un resultado se conecta a un operador lógico (Y, O, No o Implica).`;
			case 'lista':
				return `Es una lista de valores y «${def.etiqueta}» necesita uno solo: pásala por un operador de listas (Cantidad, Suma, Alguno es igual a…).`;
			default:
				return `Es un grupo de filas y «${def.etiqueta}» necesita un solo valor: cuéntalas con «Cantidad» o conecta una de sus columnas a un operador de listas.`;
		}
	}
	// acepta === 'lista'
	switch (fuente.forma) {
		case 'lista':
			return null;
		case 'filas':
			return def.aceptaFilas ? null : `«${def.etiqueta}» trabaja con los valores de una lista y un grupo trae filas: conecta una de sus columnas (o cuéntalas con «Cantidad»).`;
		case 'veredicto':
			return `«${def.etiqueta}» trabaja con listas de valores, no con el resultado de una regla.`;
		default:
			return `«${def.etiqueta}» trabaja con listas y esto trae un solo valor.`;
	}
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
	if (!def || !entrada) return 'Un campo, un valor o un resultado se conecta a una de las entradas de un operador.';

	// 1 · qué es lo que sale, y si le sirve a ESTA entrada.
	const fuente = fuenteDeConexion(c, nodos, tipos);
	if (typeof fuente === 'string') return fuente;
	const noServe = noLeSirve(fuente, entrada.acepta, def);
	if (noServe) return noServe;
	if (fuente.forma !== 'veredicto' && fuente.forma !== 'filas' && fuente.familia && !def.familias.includes(fuente.familia)) {
		return `«${def.etiqueta}» solo trabaja con ${def.familias.map((f) => PLURAL_DE_FAMILIA[f]).join(' y ')}.`;
	}

	// 2 · el otro lado del operador, si ya tiene algo: manda sobre lo que se puede poner en éste.
	const otroLado = def.entradas.find((e) => e.id !== c.targetHandle);
	const aristaOtra = otroLado && aristas.find((e) => e.target === c.target && e.targetHandle === otroLado.id);
	if (aristaOtra) {
		const suya = fuenteDeConexion(aristaOtra, nodos, tipos);
		if (typeof suya !== 'string') {
			if (aristaOtra.source === c.source && (aristaOtra.sourceHandle ?? '') === (c.sourceHandle ?? '')) {
				if (origen.type === NODO_TIPO) return 'Los dos lados serían el mismo campo: no habría nada que comparar.';
				if (origen.type === NODO_CONSTANTE) return 'Los dos lados serían el mismo valor fijo: no habría nada que comparar.';
				return 'Las dos entradas serían la misma regla: no habría nada que combinar.';
			}
			if (fuente.familia && suya.familia && fuente.familia !== suya.familia) {
				return `No se puede comparar ${NOMBRE_DE_FAMILIA[fuente.familia]} con ${NOMBRE_DE_FAMILIA[suya.familia]}.`;
			}
		}
	}

	// 3 · un resultado no puede acabar dependiendo de sí mismo.
	if (origen.type === NODO_OPERADOR) {
		if (origen.id === destino.id) return 'Una regla no puede depender de sí misma.';
		if (alcanza(destino.id, origen.id, aristas)) return 'Eso cerraría un ciclo: una regla acabaría dependiendo de sí misma.';
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

/** ¿Hay un número en este texto? Para avisar de la línea de una lista que no lo es. */
export const esNumero = (s: string): boolean => aNumero(s) !== null;

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

/** Lo que identifica a un valor para saber si dos son «el mismo»: lo mismo que `sonIguales`, pero como una llave para agrupar. */
function llaveDeComparacion(familia: Familia, s: string): string {
	switch (familia) {
		case 'numero': {
			const n = aNumero(s);
			return n === null ? `?${textoLimpio(s)}` : String(n);
		}
		case 'fecha':
			return aFecha(s) ?? `?${textoLimpio(s)}`;
		case 'booleano': {
			const b = aBooleano(s);
			return b === null ? `?${textoLimpio(s)}` : String(b);
		}
		default:
			return textoLimpio(s);
	}
}

// ── El veredicto de cada regla ───────────────────────────────────────────────

/**
 * Qué dice una regla: `sin_conexion` (le falta algo conectado), `sin_valores` (está conectada pero faltan valores de ejemplo, o
 * una regla de la que depende todavía no tiene veredicto), `pasa` o `no_pasa`.
 */
export type Veredicto = 'pasa' | 'no_pasa' | 'sin_valores' | 'sin_conexion';

/** Lo mismo, más `listo`: una regla que entrega un VALOR (Cantidad, Suma) no «pasa», ya calculó su número. */
export type Estado = Veredicto | 'listo';

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
 *
 * «Implica» (`entradas` = [condición, consecuencia]) es «no condición, o consecuencia», con la misma prudencia que O: si la
 * condición NO se cumple pasa, sea cual sea la consecuencia (no hay nada que exigir), y si la consecuencia pasa también; solo
 * falla cuando la condición pasa y la consecuencia no. Si la condición no se sabe, no se atreve a decir que falla.
 */
export function evaluarLogico(clave: ClaveOperador, entradas: readonly Veredicto[]): Veredicto {
	const sabe = (v: Veredicto) => v === 'pasa' || v === 'no_pasa';
	switch (clave) {
		case 'implica': {
			const [condicion, consecuencia] = entradas;
			if (condicion === 'no_pasa' || consecuencia === 'pasa') return 'pasa';
			return condicion === 'pasa' && consecuencia === 'no_pasa' ? 'no_pasa' : 'sin_valores';
		}
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

/**
 * El veredicto de «Existe documento» con el ejemplo que se eligió en el nodo: «sí» (el expediente de ejemplo trae el documento)
 * pasa y «no» no pasa. Sin elegir nada —o con algo que no se entiende— no se sabe: `sin_valores`.
 */
export function evaluarExistencia(ejemplo: string): Veredicto {
	const hay = aBooleano(ejemplo);
	return hay === null ? 'sin_valores' : hay ? 'pasa' : 'no_pasa';
}

/** Los elementos de una lista de ejemplo: uno por renglón, sin renglones vacíos. */
export const lineasDeEjemplo = (texto: string): string[] =>
	texto
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

/**
 * Lo que da un operador de LISTAS con los elementos de ejemplo. `b` es el valor con el que se compara (Alguno, Todos). Sin
 * elementos no hay de qué sacar nada: `sin_valores` (el lienzo no distingue «lista vacía» de «todavía no escribí nada»).
 */
export function evaluarLista(clave: ClaveOperador, familia: Familia, elementos: readonly string[], b = ''): { estado: Estado; valor?: string } {
	if (elementos.length === 0) return { estado: 'sin_valores' };
	const si = (ok: boolean): { estado: Estado } => ({ estado: ok ? 'pasa' : 'no_pasa' });
	switch (clave) {
		case 'cantidad':
			return { estado: 'listo', valor: String(elementos.length) };
		case 'suma': {
			const numeros = elementos.map(aNumero);
			if (numeros.some((n) => n === null)) return { estado: 'sin_valores' };
			const total = (numeros as number[]).reduce((s, n) => s + n, 0);
			return { estado: 'listo', valor: String(Math.round(total * 100) / 100) };
		}
		case 'alguno':
			return b.trim() ? si(elementos.some((e) => sonIguales(familia, e, b))) : { estado: 'sin_valores' };
		case 'todos':
			return b.trim() ? si(elementos.every((e) => sonIguales(familia, e, b))) : { estado: 'sin_valores' };
		case 'unicos':
			return si(new Set(elementos.map((e) => llaveDeComparacion(familia, e))).size === elementos.length);
		default:
			return { estado: 'sin_conexion' };
	}
}

/** Lo que evaluó el lienzo: el estado de CADA regla y el valor de las que entregan uno. */
export type Evaluacion = { estados: Record<string, Estado>; valores: Record<string, string> };

/**
 * El estado de CADA operador del lienzo, siguiendo los cables: las comparaciones y las listas leen sus campos con sus valores de
 * ejemplo, los valores fijos y lo que entregan `Cantidad` y `Suma`; las lógicas leen a las reglas que les llegan.
 */
export function evaluar(nodos: readonly NodoMinimo[], aristas: readonly Conexion[], tipos: readonly TipoDocumentalGuardado[]): Evaluacion {
	const estados: Record<string, Estado> = {};
	const valores: Record<string, string> = {};

	/** Lo que llega por una entrada: qué es, el texto de ejemplo y —si viene de otra regla— el estado de ésa. */
	type Llega = { fuente: Fuente | null; muestra: string; estadoOrigen?: Estado };

	const de = (id: string, enCurso: ReadonlySet<string>): Estado => {
		if (id in estados) return estados[id];
		const nodo = nodos.find((n) => n.id === id);
		const def = operadorDelNodo(nodo);
		if (!nodo || !def) return 'sin_conexion';
		// Un ciclo no debería existir (la conexión se rechaza), pero un lienzo guardado a mano no debe colgar la pantalla.
		if (enCurso.has(id)) return 'sin_valores';
		const dentro = new Set(enCurso).add(id);
		const datos = nodo.data as DatosNodoOperador;

		const cables = def.entradas.map((e) => aristas.find((a) => a.target === id && a.targetHandle === e.id));
		let estado: Estado;
		if (cables.some((c) => !c)) {
			estado = 'sin_conexion';
		} else {
			const llegan = def.entradas.map((e, i): Llega => {
				const cable = cables[i] as Conexion;
				const origen = nodos.find((n) => n.id === cable.source);
				const fuente = fuenteDeConexion(cable, nodos, tipos);
				if (typeof fuente === 'string') return { fuente: null, muestra: '' };
				if (origen?.type === NODO_CONSTANTE) return { fuente, muestra: String((origen.data as DatosNodoConstante).valor ?? '') };
				if (origen?.type === NODO_OPERADOR) {
					const estadoOrigen = de(origen.id, dentro);
					return { fuente, muestra: valores[origen.id] ?? '', estadoOrigen };
				}
				return { fuente, muestra: String(datos[e.id] ?? '') };
			});

			if (llegan.some((l) => !l.fuente)) estado = 'sin_conexion';
			else if (llegan.some((l) => l.estadoOrigen === 'sin_conexion')) estado = 'sin_conexion';
			else if (def.grupo === 'logico') {
				estado = evaluarLogico(def.clave, llegan.map((l) => l.estadoOrigen as Veredicto));
			} else if (llegan.some((l) => l.estadoOrigen !== undefined && l.estadoOrigen !== 'listo')) {
				// Un valor que viene de otra regla que todavía no lo tiene.
				estado = 'sin_valores';
			} else if (def.grupo === 'comparacion') {
				const familia = (llegan[0].fuente as Fuente).familia;
				estado = familia ? evaluarComparacion(def.clave, familia, llegan[0].muestra, llegan[1].muestra) : 'sin_conexion';
			} else if (def.grupo === 'documento') {
				estado = evaluarExistencia(llegan[0].muestra);
			} else {
				const familia = (llegan[0].fuente as Fuente).familia ?? 'texto';
				const r = evaluarLista(def.clave, familia, lineasDeEjemplo(llegan[0].muestra), llegan[1]?.muestra ?? '');
				estado = r.estado;
				if (r.valor !== undefined) valores[id] = r.valor;
			}
		}
		estados[id] = estado;
		return estado;
	};

	for (const n of nodos) if (operadorDelNodo(n)) de(n.id, new Set());
	return { estados, valores };
}

// ── Guardar el dibujo y volver a abrirlo ─────────────────────────────────────

/** Un nodo tal como se guarda: solo lo que el lienzo necesita (la librería le suma medidas y banderas de selección que no van). */
export type NodoGuardado = {
	id: string;
	type: typeof NODO_TIPO | typeof NODO_OPERADOR | typeof NODO_CONSTANTE;
	position: { x: number; y: number };
	data: DatosNodoTipo | DatosNodoOperador | DatosNodoConstante;
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
		} else if (n.type === NODO_CONSTANTE) {
			const d = n.data as DatosNodoConstante;
			nodos.push({ id: n.id, type: NODO_CONSTANTE, position, data: { familia: esFamilia(d.familia) ? d.familia : 'texto', valor: d.valor ?? '' } });
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
const esNumeroFinito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Lo guardado, de vuelta a nodos y cables del lienzo. Lo que no se entiende se deja fuera en vez de reventar la pantalla (un nodo
 * de un tipo que ya no existe, un cable a un nodo que no está, un operador que el catálogo ya no tiene): el servidor valida lo que
 * recibe, pero el catálogo de operadores puede cambiar entre versiones. `operadoresPuestos` y `constantesPuestas` son por dónde sigue
 * la numeración, para que un nodo nuevo no se llame igual que uno ya guardado.
 */
export function hidratarDibujo(guardado: { nodos?: unknown; aristas?: unknown }): {
	nodes: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }[];
	edges: { id: string; source: string; sourceHandle: string | null; target: string; targetHandle: string | null }[];
	operadoresPuestos: number;
	constantesPuestas: number;
} {
	const nodes: ReturnType<typeof hidratarDibujo>['nodes'] = [];
	for (const n of Array.isArray(guardado.nodos) ? guardado.nodos : []) {
		if (!esObjeto(n) || typeof n.id !== 'string' || !esObjeto(n.position) || !esObjeto(n.data)) continue;
		if (!esNumeroFinito(n.position.x) || !esNumeroFinito(n.position.y)) continue;
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
		} else if (n.type === NODO_CONSTANTE && esFamilia(n.data.familia)) {
			nodes.push({ id: n.id, type: NODO_CONSTANTE, position, data: { familia: n.data.familia, valor: typeof n.data.valor === 'string' ? n.data.valor : '' } });
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
	let constantesPuestas = 0;
	for (const n of nodes) {
		const op = n.type === NODO_OPERADOR ? /^operador-(\d+)$/.exec(n.id) : null;
		if (op) operadoresPuestos = Math.max(operadoresPuestos, Number(op[1]));
		const k = n.type === NODO_CONSTANTE ? /^constante-(\d+)$/.exec(n.id) : null;
		if (k) constantesPuestas = Math.max(constantesPuestas, Number(k[1]));
	}
	return { nodes, edges, operadoresPuestos, constantesPuestas };
}
