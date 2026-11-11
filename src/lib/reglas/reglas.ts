/**
 * La lógica del lienzo del motor de reglas, sin nada de pantalla (2026-10-20): qué operadores hay, qué se puede conectar con qué,
 * cuándo dos valores son «iguales» y cómo se evalúa una cadena de reglas. Vive aparte de los componentes para poder probarla sola
 * (`verificar-reglas.mjs`): por eso aquí solo se importan TIPOS, nunca código.
 *
 * El modelo: un PROCESO es un conjunto de reglas y corre sobre un EXPEDIENTE (un conjunto de documentos): cualquiera de la organización, sin
 * limitarse a nada (Moibe, 2026-11-05: se quitaron los expedientes virtuales, y con ellos el «tipo sobre el que corre» el proceso). Los tipos
 * documentales son sus entradas —lo que se pone en el lienzo es el delineador de qué documentos necesita el proceso del expediente—; por cada
 * conexión viaja un CAMPO (no el documento entero) y su tipo de dato decide qué se puede comparar.
 *
 * Por un cable puede viajar:
 *   · un VALOR: un campo suelto, un valor fijo escrito en el lienzo, o el número que entrega una regla (`Cantidad`, `Suma`);
 *   · una LISTA de valores: un campo «1 a N» o una columna de un grupo que se repite;
 *   · las FILAS de un grupo que se repite (solo para contarlas);
 *   · un VEREDICTO (pasa / no pasa): lo que entrega una comparación, una pregunta por un documento o un operador lógico;
 *   · el DOCUMENTO entero (el punto «Documento» de un tipo documental): no es ningún dato, solo sirve para preguntar si el
 *     expediente lo trae (`Existe documento`).
 *
 * Los operadores de COMPARACIÓN (igual, distinto, contiene, parecido, mayor, mayor o igual, menor, menor o igual) reciben dos valores y dan un
 * veredicto; «Entre» (2026-11-10) recibe TRES —el valor y sus dos límites— y es el único con una tercera entrada (`c`). El de FECHAS,
 * «Antigüedad contra hoy» (2026-11-10), recibe UNA fecha y la mide contra el día de hoy con el máximo de su nodo («3 meses»). Los de LISTAS
 * (cantidad, suma, alguno, todos, unicos) reciben una lista: `cantidad` y `suma` entregan un valor (que se puede comparar) y los demás,
 * un veredicto. `Existe documento` recibe un documento entero y dice si el expediente lo trae. Los LÓGICOS (Y, O, No, Implica) reciben
 * veredictos de otras reglas, y así se encadenan: `Implica` es el «si… entonces…» (si la primera regla pasa, la segunda también debe
 * pasar; si la primera no pasa no hay nada que exigir).
 *
 * Los nodos FINALES (2026-11-03) dicen qué entrega el proceso al terminar. Un VALOR FINAL es un dato que ya no se compara más y que entra,
 * con su nombre, a la lista de valores finales de la corrida; el RESULTADO es la palabra con la que termina el proceso («Aprobado»,
 * «Certificado»…): recibe una regla y guarda un texto para cuando pasa, otro para cuando no y otro para cuando no se puede saber por falta de
 * datos. No entregan nada a otro nodo: solo reciben cable.
 */
import type { TipoDocumentalGuardado } from '$lib/state/configuracion.svelte';

// ── Los nodos del lienzo ─────────────────────────────────────────────────────

/**
 * Lo que lleva un nodo de tipo documental: cuál es y, SOLO mientras está en pantalla, qué campos se ven (`campos`: los puntos de salida
 * `campo` o `grupo.subcampo`, 2026-11-03). Los campos se leen en vivo de la biblioteca. `campos` NO se guarda: `serializarDibujo` solo
 * escribe `tipoId`, y `hidratarDibujo` lo reconstruye con los campos que tienen cable.
 *
 * `version` (2026-11-04, NEX-542) es la versión del tipo con la que se armó el proceso, o con la que se confirmó por última vez: sí se guarda. El nodo
 * enseña ESA versión y, si el tipo ya va en otra, avisa y ofrece usar la nueva (lo cual cuenta como un cambio por guardar). Los procesos de antes no la
 * traen (`undefined`): se enseña la del tipo y no hay aviso, porque no se sabe con cuál se armaron.
 */
export type DatosNodoTipo = { tipoId: string; campos?: string[]; version?: number };

/**
 * En qué estado está, para el lienzo, el tipo documental de un nodo: `activo` es el único que se puede USAR en un proceso (2026-11-05, Moibe:
 * «no deberíamos poder usar en el canvas los tipos documentales que no estén activos»). Un `borrador` todavía no se puede procesar (incluye
 * el activo que está en «Crear nueva versión»: vuelve a `borrador` hasta que se publica), uno `archivado` ya no está en la biblioteca y uno
 * `ausente` ya no existe (lo borraron).
 */
export type EstadoDeTipoEnLienzo = 'activo' | 'borrador' | 'archivado' | 'ausente';
export function estadoDeTipoEnLienzo(tipos: readonly Pick<TipoDocumentalGuardado, 'id' | 'estado'>[], tipoId: string): EstadoDeTipoEnLienzo {
	return tipos.find((t) => t.id === tipoId)?.estado ?? 'ausente';
}

/**
 * Lo que lleva un nodo operador: cuál es y, para los que reciben datos de un documento, los valores de EJEMPLO con los que se
 * prueba la regla (uno por entrada: el lienzo aún no corre sobre un expediente de verdad). Si lo que entra es una LISTA, el ejemplo
 * son varios renglones, uno por elemento. Los operadores lógicos no usan `a` ni `b`. `c` es el ejemplo de la tercera entrada y solo lo lleva un
 * operador que la tiene («Entre»: Valor, Desde y Hasta; ver `usaTerceraEntrada`).
 *
 * «Antigüedad contra hoy» (2026-11-10) lleva además su `maximo` y su `unidad` («3 meses»), que son parte de la regla y se guardan, y `hoy`: la fecha de
 * hoy de EJEMPLO que se escribe en el lienzo para probarla. `hoy` NO se guarda (ni `serializarDibujo` lo escribe ni `hidratarDibujo` lo lee): sin
 * él, la regla se decide con la fecha del día, que es lo que hace una ejecución.
 */
export type DatosNodoOperador = {
	operador: ClaveOperador;
	a: string;
	b: string;
	c?: string;
	minimo?: number;
	maximo?: number;
	unidad?: UnidadDeTiempo;
	hoy?: string;
};

/** «Parecido a» (2026-11-10): el porcentaje mínimo de parecido para que pase, cuando el nodo no trae otro. El back usa el mismo (`MINIMO_PARECIDO`). */
export const MINIMO_PARECIDO = 90;

/** Lo que dice un «Parecido a» ya medido: «Pasa: se parecen 96 %» o «No pasa: se parecen 40 % (mínimo 90 %)». Lo usan el nodo y el historial de ejecuciones. */
export function textoDeParecido(estado: 'pasa' | 'no_pasa', medida: { porcentaje: number; minimo: number }): string {
	return estado === 'pasa' ? `Pasa: se parecen ${medida.porcentaje} %` : `No pasa: se parecen ${medida.porcentaje} % (mínimo ${medida.minimo} %)`;
}

/** El mínimo de un nodo «Parecido a»: un entero de 1 a 100; cualquier otra cosa es el de siempre. */
export function minimoDeParecido(datos: { minimo?: unknown } | null | undefined): number {
	const m = datos?.minimo;
	return typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 100 ? m : MINIMO_PARECIDO;
}

/** En qué se cuenta el máximo de «Antigüedad contra hoy». La llave va sin ñ (`anios`) porque es lo que se guarda; la persona lee `plural`. */
export type UnidadDeTiempo = 'dias' | 'meses' | 'anios';
export const UNIDADES_DE_TIEMPO: readonly { valor: UnidadDeTiempo; singular: string; plural: string }[] = [
	{ valor: 'dias', singular: 'día', plural: 'días' },
	{ valor: 'meses', singular: 'mes', plural: 'meses' },
	{ valor: 'anios', singular: 'año', plural: 'años' }
];
/** Lo que trae un nodo nuevo de «Antigüedad contra hoy»: 3 meses, como el comprobante «no mayor a tres meses» del diseño. El back usa los mismos. */
export const MAXIMO_ANTIGUEDAD = 3;
export const UNIDAD_ANTIGUEDAD: UnidadDeTiempo = 'meses';
/** El tope del máximo (el back pone el mismo): 9999 de cualquier unidad ya es más de lo que pide una regla. */
export const TOPE_MAXIMO_ANTIGUEDAD = 9999;

/** El máximo de un nodo «Antigüedad contra hoy»: un entero de 1 a 9999; cualquier otra cosa es el de siempre. */
export function maximoDeAntiguedad(datos: { maximo?: unknown } | null | undefined): number {
	const m = datos?.maximo;
	return typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= TOPE_MAXIMO_ANTIGUEDAD ? m : MAXIMO_ANTIGUEDAD;
}

/** La unidad de un nodo «Antigüedad contra hoy»: días, meses o años; cualquier otra cosa es la de siempre. */
export function unidadDeAntiguedad(datos: { unidad?: unknown } | null | undefined): UnidadDeTiempo {
	const u = datos?.unidad;
	return UNIDADES_DE_TIEMPO.some((x) => x.valor === u) ? (u as UnidadDeTiempo) : UNIDAD_ANTIGUEDAD;
}

/** «1 mes», «3 meses», «1 año», «12 días». */
export function cuantoTiempo(n: number, unidad: UnidadDeTiempo): string {
	const u = UNIDADES_DE_TIEMPO.find((x) => x.valor === unidad) ?? UNIDADES_DE_TIEMPO[1];
	return `${n} ${n === 1 ? u.singular : u.plural}`;
}

/** La zona en la que se cuenta «hoy»: las organizaciones de Biblioratum están en México, y el servidor no necesariamente lo está. */
export const ZONA_DE_HOY = 'America/Mexico_City';

/** La fecha de hoy (aaaa-mm-dd) en `ZONA_DE_HOY`: a las 7 de la noche en México ya es mañana en UTC, y eso no debe cambiar una antigüedad. */
export function fechaDeHoy(ahora: Date = new Date(), zona: string = ZONA_DE_HOY): string {
	const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora);
	const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
	return `${de('year')}-${de('month')}-${de('day')}`;
}

/**
 * Lo que salió de una «Antigüedad contra hoy» ya decidida: con qué hoy, máximo y unidad se decidió y cuánto tiene la fecha (`edad`: «tiene 1 mes»,
 * «tiene 3 meses y 4 días», «es de hoy»). Si no hubo edad que medir, `motivo` dice por qué no pasó: la fecha (o el hoy de ejemplo) no se entiende, o la
 * fecha es posterior a hoy.
 */
export type MedidaDeAntiguedad = {
	hoy: string;
	maximo: number;
	unidad: UnidadDeTiempo;
	edad?: string;
	motivo?: 'fecha_ilegible' | 'hoy_ilegible' | 'futura';
};

/** Lo que dice una «Antigüedad contra hoy» ya decidida: «Pasa: tiene 1 mes» o «No pasa: tiene 4 meses y 2 días (máximo 3 meses)». Lo usan el nodo y el historial. */
export function textoDeAntiguedad(estado: 'pasa' | 'no_pasa', m: MedidaDeAntiguedad): string {
	if (m.motivo === 'futura') return 'No pasa: la fecha es posterior a hoy';
	if (m.motivo === 'fecha_ilegible') return 'No pasa: la fecha no se entiende';
	if (m.motivo === 'hoy_ilegible') return 'No pasa: la fecha de hoy no se entiende';
	return estado === 'pasa' ? `Pasa: ${m.edad ?? ''}` : `No pasa: ${m.edad ?? ''} (máximo ${cuantoTiempo(m.maximo, m.unidad)})`;
}

/**
 * Lo que dijo la IA de un par de textos (`POST /procesos/parecido` de nexus_back): `porcentaje` de 0 a 100 y la `razon` en una frase. Se guardan por
 * `llaveDeParecido`, la misma llave que usa el back. `sinIA` marca la medida que no vino de la IA (`MISMO_TEXTO`): ahí la pantalla no dice «IA:».
 */
export type MedidaDeParecido = { porcentaje: number; razon: string; sinIA?: true };
export type Parecidos = Readonly<Record<string, MedidaDeParecido>>;

/**
 * Cómo se comparan los textos de un «Parecido a»: en mayúsculas, sin acentos (ni la tilde de la ñ) y sin espacios de más. «Pérez  lópez» → «PEREZ LOPEZ».
 * Existe porque la forma de escribir le cambiaba la respuesta a la IA (2026-11-10, Moibe: «KEYSI» contra «KEISY» no pasaba y «Keysi» contra «KEISY»
 * sí): el back le pregunta SIEMPRE con los textos así (`parecido.comparable`, la misma regla), y aquí sirve para que las variantes compartan la medida.
 */
export function textoComparable(texto: string): string {
	return texto.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().split(/\s+/).filter(Boolean).join(' ');
}

/** El par visto como se compara: simétrico («A ~ B» es «B ~ A») y sin importar mayúsculas, acentos ni espacios. */
export function llaveDeParecido(a: string, b: string): string {
	const x = textoComparable(a);
	const y = textoComparable(b);
	return JSON.stringify(x <= y ? [x, y] : [y, x]);
}

/** Dos textos que solo se escriben distinto (mayúsculas, acentos, espacios) son el mismo texto: 100 sin preguntarle a la IA. El back contesta igual. */
export const MISMO_TEXTO: MedidaDeParecido = { porcentaje: 100, razon: 'Es el mismo texto: solo cambian mayúsculas, acentos o espacios.', sinIA: true };

/** Lo que lleva un nodo de valor fijo: de qué clase es y el valor. A diferencia de un ejemplo, éste es parte de la regla. */
export type DatosNodoConstante = { familia: Familia; valor: string };

/**
 * Lo que lleva un nodo «Valor final»: el nombre con el que entra a la lista de valores finales de la corrida (vacío = el que el lienzo le da por
 * su número, ver `nombreDeValorFinal`) y, como un operador, el valor de EJEMPLO con que se prueba (`a`; solo se escribe cuando lo que le llega es
 * un campo: un valor fijo o una regla ya traen el suyo).
 */
export type DatosNodoValorFinal = { nombre: string; a: string };

/** Los tres casos con que puede terminar un proceso: la regla que decide pasa (`si`), no pasa (`no`) o no se puede saber por falta de datos (`sin`). */
export type CasoDelResultado = 'si' | 'no' | 'sin';

/** Lo que lleva el nodo «Resultado»: la palabra de cada caso, escrita por la organización («Aprobado», «Certificado»…). */
export type DatosNodoResultado = Record<CasoDelResultado, string>;

/** Los tipos de nodo que registra el lienzo (`nodeTypes`). */
export const NODO_TIPO = 'tipo-documental';
export const NODO_OPERADOR = 'operador';
export const NODO_CONSTANTE = 'constante';
export const NODO_VALOR_FINAL = 'valor-final';
export const NODO_RESULTADO = 'resultado-final';

/** Con qué se arrastra algo desde la paleta hasta el lienzo (`DataTransfer`). */
export const MIME_TIPO_DOCUMENTAL = 'application/x-nexusdoc-tipo-documental';
export const MIME_OPERADOR = 'application/x-nexusdoc-operador';
export const MIME_CONSTANTE = 'application/x-nexusdoc-constante';
export const MIME_VALOR_FINAL = 'application/x-nexusdoc-valor-final';
export const MIME_RESULTADO = 'application/x-nexusdoc-resultado-final';

/** Los dos nodos finales reciben UN cable, por este punto, y no entregan nada. */
export const ENTRADA_FINAL = 'a';
/** Un proceso termina con UNA palabra, así que el nodo del resultado es único y su id es fijo (como el de un tipo documental, que sale del tipo). */
export const ID_NODO_RESULTADO = 'resultado-final';

/** Lo que dice cada caso del resultado mientras la organización no escriba otra cosa. */
export const TEXTOS_DEL_RESULTADO: Readonly<DatosNodoResultado> = { si: 'Aprobado', no: 'Rechazado', sin: 'Sin datos' };
/** Los casos del resultado, en el orden en que se muestran, con cómo se le llama a cada uno. */
export const CASOS_DEL_RESULTADO: readonly { caso: CasoDelResultado; etiqueta: string }[] = [
	{ caso: 'si', etiqueta: 'Si se cumple' },
	{ caso: 'no', etiqueta: 'Si no se cumple' },
	{ caso: 'sin', etiqueta: 'Si faltan datos' }
];
/** Lo que cabe en el nombre de un valor final y en cada palabra del resultado (el back pone los mismos topes). */
export const MAX_NOMBRE_FINAL = 80;
export const MAX_TEXTO_RESULTADO = 60;

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

/** El número con el que se distingue un operador, un valor fijo o un valor final de otro del mismo tipo («Igual a #2», «Valor fijo #1», «Valor final #3»). */
export const numeroDeOperador = (nodoId: string) => nodoId.replace(/^(operador|constante|valor-final)-/, '');

/**
 * Las palabras de un resultado tal como se guardan: sin espacios de más y, si una quedó vacía o no es texto, la de siempre (`TEXTOS_DEL_RESULTADO`).
 * Un resultado sin palabra para algún caso no diría nada cuando le tocara.
 */
export function textosDelResultado(datos: Partial<Record<CasoDelResultado, unknown>> | null | undefined): DatosNodoResultado {
	const de = (caso: CasoDelResultado) => {
		const texto = datos?.[caso];
		return typeof texto === 'string' && texto.trim() ? texto.trim().slice(0, MAX_TEXTO_RESULTADO) : TEXTOS_DEL_RESULTADO[caso];
	};
	return { si: de('si'), no: de('no'), sin: de('sin') };
}

/** El nombre con el que un valor final entra a la lista de la corrida: el que se escribió o, sin nombre, «Valor final #N» (su número). */
export const nombreDeValorFinal = (nodoId: string, datos: { nombre?: unknown } | null | undefined): string =>
	(typeof datos?.nombre === 'string' ? datos.nombre.trim() : '') || `Valor final #${numeroDeOperador(nodoId)}`;

// ── Dónde cabe un nodo nuevo ─────────────────────────────────────────────────

/** Un rectángulo del lienzo, en sus coordenadas: esquina de arriba a la izquierda y tamaño. */
export type Caja = { x: number; y: number; ancho: number; alto: number };

/** El aire que se deja entre dos tarjetas, en píxeles del lienzo. */
export const MARGEN_ENTRE_NODOS = 24;

const seTocan = (a: Caja, b: Caja, margen: number) =>
	a.x < b.x + b.ancho + margen && b.x < a.x + a.ancho + margen && a.y < b.y + b.alto + margen && b.y < a.y + a.alto + margen;

/**
 * Dónde poner un nodo nuevo para que no tape a otro (2026-11-04, NEX-540). Se parte de donde se soltó (o del centro, si se pulsó en la paleta): si ahí
 * no estorba a nadie, se queda; si no, se corre a la derecha de lo que tapaba, y así hasta que quepa. Solo avanza hacia la derecha, así que siempre
 * termina. Mover una tarjeta que ya está puesta no pasa por aquí: se puede dejar donde se quiera.
 */
export function posicionLibre(deseada: { x: number; y: number }, tamano: { ancho: number; alto: number }, ocupadas: readonly Caja[], margen = MARGEN_ENTRE_NODOS): { x: number; y: number } {
	let x = deseada.x;
	for (let vuelta = 0; vuelta <= ocupadas.length; vuelta++) {
		const mia: Caja = { x, y: deseada.y, ...tamano };
		const estorba = ocupadas.filter((o) => seTocan(mia, o, margen));
		if (estorba.length === 0) return { x, y: deseada.y };
		x = Math.max(...estorba.map((o) => o.x + o.ancho)) + margen;
	}
	return { x, y: deseada.y };
}

/** A qué se conecta un nodo: cada cable que sale de él, con el nombre del nodo de destino y de su entrada («Igual a #1», «Entrada A»). */
export type UsoDeNodo = { destino: string; entrada: string | null };

/**
 * Los usos de un nodo: lo que se desconecta si se quita (2026-11-04, NEX-543). Sirve para avisar antes de quitar un tipo documental que ya está
 * en uso, diciendo qué reglas se quedan sin esa entrada.
 */
export function usosDeNodo(nodoId: string, nodes: readonly NodoMinimo[], edges: readonly Conexion[]): UsoDeNodo[] {
	const nombreDe = (n: NodoMinimo): string => {
		if (n.type === NODO_OPERADOR) {
			const def = operadorDelNodo(n);
			return `${def?.etiqueta ?? 'Regla'} #${numeroDeOperador(n.id)}`;
		}
		if (n.type === NODO_CONSTANTE) return `Valor fijo #${numeroDeOperador(n.id)}`;
		if (n.type === NODO_VALOR_FINAL) return `Valor final «${nombreDeValorFinal(n.id, n.data)}»`;
		if (n.type === NODO_RESULTADO) return 'Resultado';
		return n.id;
	};
	const usos: UsoDeNodo[] = [];
	for (const e of edges) {
		if (e.source !== nodoId) continue;
		const destino = nodes.find((n) => n.id === e.target);
		if (!destino) continue;
		const entrada = operadorDelNodo(destino)?.entradas.find((x) => x.id === e.targetHandle)?.etiqueta ?? null;
		usos.push({ destino: nombreDe(destino), entrada });
	}
	return usos;
}

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
	| 'parecido'
	| 'mayor'
	| 'mayor_igual'
	| 'menor'
	| 'menor_igual'
	| 'entre'
	| 'antiguedad'
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
export type Entrada = 'a' | 'b' | 'c';

/** Lo que una entrada acepta que le llegue: un valor suelto, una lista de valores, el veredicto de otra regla o un documento entero. */
export type Acepta = 'valor' | 'lista' | 'veredicto' | 'documento';

export type DefOperador = {
	clave: ClaveOperador;
	etiqueta: string;
	/** Lo que dice la paleta y, si no trae `descripcionEnNodo`, también el nodo. */
	descripcion: string;
	/** Una descripción más corta para el nodo, cuando el nodo ya enseña lo que la de la paleta explica (la unidad de «Antigüedad contra hoy»). */
	descripcionEnNodo?: string;
	/** Lo que se dibuja en el nodo y en la paleta (si el operador no tiene ícono propio, ver `SimboloDeOperador.svelte`). */
	simbolo: string;
	grupo: 'comparacion' | 'fecha' | 'lista' | 'documento' | 'logico';
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
const ENTRADAS_AB = [
	{ id: 'a', etiqueta: 'Entrada A', acepta: 'valor' },
	{ id: 'b', etiqueta: 'Entrada B', acepta: 'valor' }
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
	{ clave: 'igual', etiqueta: 'Igual a', simbolo: '=', grupo: 'comparacion', salida: 'veredicto', descripcion: 'Pasa si los dos valores son iguales.', entradas: ENTRADAS_AB, familias: TODAS, textoPasa: 'Pasa: los dos valores son iguales', textoNoPasa: 'No pasa: los valores son distintos' },
	{ clave: 'distinto', etiqueta: 'Distinto de', simbolo: '≠', grupo: 'comparacion', salida: 'veredicto', descripcion: 'Pasa si los dos valores son distintos.', entradas: ENTRADAS_AB, familias: TODAS, textoPasa: 'Pasa: los valores son distintos', textoNoPasa: 'No pasa: los dos valores son iguales' },
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
		// «Parecido a» (2026-11-10, Moibe: «vamos directo con la 3», la IA): pasa si los dos textos se parecen al menos el mínimo del nodo. Quien mide
		// el parecido es Gemini (vía nexus_back), porque una distancia entre letras no sabe que «S.A. de C.V.» es «Sociedad Anónima de Capital Variable».
		// `evaluar` NO pregunta: recibe los parecidos ya medidos (`Parecidos`) y dice cuáles le faltan (`pendientes`); quien llama los pide y vuelve a evaluar.
		clave: 'parecido',
		etiqueta: 'Parecido a',
		simbolo: '≈',
		grupo: 'comparacion',
		salida: 'veredicto',
		descripcion: 'Pasa si los dos textos se parecen al menos el porcentaje indicado.',
		entradas: ENTRADAS_AB,
		familias: ['texto'],
		textoPasa: 'Pasa: los textos se parecen',
		textoNoPasa: 'No pasa: los textos no se parecen lo suficiente'
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
		// Las inclusivas (2026-11-10, Moibe: «también necesito los inclusivos, que son Mayor o igual y Menor o igual»).
		clave: 'mayor_igual',
		etiqueta: 'Mayor o igual',
		simbolo: '≥',
		grupo: 'comparacion',
		salida: 'veredicto',
		descripcion: 'Pasa si el primer valor es mayor o igual que el segundo.',
		entradas: [
			{ id: 'a', etiqueta: 'Valor', acepta: 'valor' },
			{ id: 'b', etiqueta: 'Mayor o igual que', acepta: 'valor' }
		],
		familias: ['numero', 'fecha'],
		textoPasa: 'Pasa: el primer valor es mayor o igual',
		textoNoPasa: 'No pasa: el primer valor es menor'
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
		clave: 'menor_igual',
		etiqueta: 'Menor o igual',
		simbolo: '≤',
		grupo: 'comparacion',
		salida: 'veredicto',
		descripcion: 'Pasa si el primer valor es menor o igual que el segundo.',
		entradas: [
			{ id: 'a', etiqueta: 'Valor', acepta: 'valor' },
			{ id: 'b', etiqueta: 'Menor o igual que', acepta: 'valor' }
		],
		familias: ['numero', 'fecha'],
		textoPasa: 'Pasa: el primer valor es menor o igual',
		textoNoPasa: 'No pasa: el primer valor es mayor'
	},
	{
		// «Entre» (2026-11-10, Moibe): el valor y sus dos límites, los dos incluidos. Es la única regla con TRES entradas: la tercera es `c`, y su
		// ejemplo se guarda en `c` (ver `usaTerceraEntrada`). Se decide en `evaluarEntre`.
		clave: 'entre',
		etiqueta: 'Entre',
		simbolo: '↔',
		grupo: 'comparacion',
		salida: 'veredicto',
		descripcion: 'Pasa si un valor o fecha está entre dos límites, incluyéndolos.',
		entradas: [
			{ id: 'a', etiqueta: 'Valor', acepta: 'valor' },
			{ id: 'b', etiqueta: 'Desde', acepta: 'valor' },
			{ id: 'c', etiqueta: 'Hasta', acepta: 'valor' }
		],
		familias: ['numero', 'fecha'],
		textoPasa: 'Pasa: está dentro del rango',
		textoNoPasa: 'No pasa: está fuera del rango'
	},
	{
		// «Antigüedad contra hoy» (2026-11-10, Moibe, con su diseño): ¿la fecha tiene como máximo N días, meses o años, contados hasta hoy? El caso
		// de siempre es el comprobante «no mayor a tres meses». Recibe UNA fecha; el máximo y la unidad viven en el nodo (como el mínimo de «Parecido
		// a») y «hoy» es el día en que se ejecuta. Se decide en `evaluarAntiguedad`.
		clave: 'antiguedad',
		etiqueta: 'Antigüedad contra hoy',
		simbolo: '◷',
		grupo: 'fecha',
		salida: 'veredicto',
		descripcion: 'Pasa si la fecha tiene como máximo los días, meses o años indicados, contados hasta hoy.',
		descripcionEnNodo: 'Pasa si la fecha tiene como máximo el tiempo indicado, contado hasta hoy.',
		entradas: [{ id: 'a', etiqueta: 'Fecha', acepta: 'valor' }],
		familias: ['fecha'],
		textoPasa: 'Pasa: la fecha no rebasa la antigüedad máxima',
		textoNoPasa: 'No pasa: la fecha rebasa la antigüedad máxima'
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
	{ clave: 'fecha', titulo: 'Fechas' },
	{ clave: 'lista', titulo: 'Operan listas' },
	{ clave: 'documento', titulo: 'Revisan el expediente' },
	{ clave: 'logico', titulo: 'Combinan reglas' }
] as const;

export const operadorDe = (clave: string): DefOperador | undefined => OPERADORES.find((o) => o.clave === clave);

/** ¿El operador tiene una TERCERA entrada (`c`)? Hoy solo «Entre». Solo esos guardan el ejemplo `c`: los demás siguen guardándose como siempre. */
export const usaTerceraEntrada = (clave: string): boolean => operadorDe(clave)?.entradas.some((e) => e.id === 'c') ?? false;

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
 * Por qué un nodo FINAL no acepta este cable; `null` si lo acepta. Los dos reciben por un solo punto y no entregan nada, así que no hay ciclos ni
 * «el otro lado» que comparar: solo importa QUÉ llega.
 *   · «Valor final» entrega un dato a la lista de la corrida: sirve un valor, una lista de valores o el pasa / no pasa de una regla. No sirve
 *     el documento entero (no es un dato) ni las filas de un grupo (hay que contarlas o elegir una columna).
 *   · «Resultado» se decide por una regla: solo sirve su pasa / no pasa.
 */
function motivoDeRechazoFinal(c: Conexion, destino: NodoMinimo, nodos: readonly NodoMinimo[], tipos: readonly TipoDocumentalGuardado[]): string | null {
	if (c.targetHandle !== ENTRADA_FINAL) return 'Un campo, un valor o un resultado se conecta al punto de entrada del nodo.';
	const fuente = fuenteDeConexion(c, nodos, tipos);
	if (typeof fuente === 'string') return fuente;
	if (destino.type === NODO_RESULTADO) {
		return fuente.forma === 'veredicto'
			? null
			: '«Resultado» se decide por una regla que pasa o no pasa: conecta el resultado de una regla (una comparación, Y, O…), no un campo ni un valor.';
	}
	switch (fuente.forma) {
		case 'documento':
			return '«Valor final» entrega un dato, no un documento entero: conecta uno de sus campos, o el documento a «Existe documento» para entregar si está.';
		case 'filas':
			return '«Valor final» entrega un dato y un grupo trae filas: cuéntalas con «Cantidad» o conecta una de sus columnas.';
		default:
			return null;
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
	if (destino.type === NODO_VALOR_FINAL || destino.type === NODO_RESULTADO) return motivoDeRechazoFinal(c, destino, nodos, tipos);
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

	// 2 · lo que ya llega a las OTRAS entradas del operador manda sobre lo que se puede poner en ésta (todas: «Entre» tiene tres).
	for (const otroLado of def.entradas) {
		if (otroLado.id === c.targetHandle) continue;
		const aristaOtra = aristas.find((e) => e.target === c.target && e.targetHandle === otroLado.id);
		if (!aristaOtra) continue;
		const suya = fuenteDeConexion(aristaOtra, nodos, tipos);
		if (typeof suya === 'string') continue;
		if (aristaOtra.source === c.source && (aristaOtra.sourceHandle ?? '') === (c.sourceHandle ?? '')) {
			if (origen.type === NODO_TIPO) return 'Las dos entradas serían el mismo campo: no habría nada que comparar.';
			if (origen.type === NODO_CONSTANTE) return 'Las dos entradas serían el mismo valor fijo: no habría nada que comparar.';
			return 'Las dos entradas serían la misma regla: no habría nada que combinar.';
		}
		if (fuente.familia && suya.familia && fuente.familia !== suya.familia) {
			return `No se puede comparar ${NOMBRE_DE_FAMILIA[fuente.familia]} con ${NOMBRE_DE_FAMILIA[suya.familia]}.`;
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
		case 'mayor_igual': {
			const o = ordenar(familia, a, b);
			return si(o !== null && o >= 0);
		}
		case 'menor_igual': {
			const o = ordenar(familia, a, b);
			return si(o !== null && o <= 0);
		}
		default:
			return 'sin_conexion';
	}
}

/**
 * El veredicto de «Entre»: pasa si `valor` queda entre `desde` y `hasta`, los dos incluidos. Los límites van en su orden: si «Desde» queda después
 * de «Hasta» no hay nada entre ellos y no pasa (no se voltean solos: un rango al revés en los datos es un error que conviene que se vea). Como en
 * las demás comparaciones, un valor que no se entiende no está dentro de nada.
 */
export function evaluarEntre(familia: Familia, valor: string, desde: string, hasta: string): Veredicto {
	if (!valor.trim() || !desde.trim() || !hasta.trim()) return 'sin_valores';
	const conDesde = ordenar(familia, valor, desde);
	const conHasta = ordenar(familia, valor, hasta);
	return conDesde !== null && conHasta !== null && conDesde >= 0 && conHasta <= 0 ? 'pasa' : 'no_pasa';
}

/** Un día del calendario: año, mes (1 a 12) y día. */
type Dia = { a: number; m: number; d: number };

/** El día que dice un texto (como `aFecha`: ISO, dd/mm/aaaa o «15 de marzo de 2020»), si existe en el calendario: el 31 de abril no. */
function diaDe(s: string): Dia | null {
	const iso = aFecha(s);
	if (!iso) return null;
	const [a, m, d] = iso.split('-').map(Number);
	const t = new Date(Date.UTC(a, m - 1, d));
	return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { a, m, d } : null;
}

const MS_POR_DIA = 86_400_000;
const numeroDeDia = (x: Dia) => Date.UTC(x.a, x.m - 1, x.d) / MS_POR_DIA;
const diasDelMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();

/** `x` más `n` meses. Si ese día no existe en el mes al que se llega, el último de ese mes: 31 de enero + 1 mes = 28 (o 29) de febrero. */
function sumarMeses(x: Dia, n: number): Dia {
	const total = x.a * 12 + (x.m - 1) + n;
	const a = Math.floor(total / 12);
	const m = total - a * 12 + 1;
	return { a, m, d: Math.min(x.d, diasDelMes(a, m)) };
}

/** Cuántos meses COMPLETOS hay de `desde` a `hasta` (que no va antes): los que se le pueden sumar a `desde` sin pasarse de `hasta`. */
function mesesCompletos(desde: Dia, hasta: Dia): number {
	let n = (hasta.a - desde.a) * 12 + (hasta.m - desde.m);
	while (n > 0 && numeroDeDia(sumarMeses(desde, n)) > numeroDeDia(hasta)) n--;
	return n;
}

/**
 * Cuánto tiene una fecha a la fecha `hoy`, en palabras y en la unidad de la regla: «tiene 1 mes», «tiene 2 años», «tiene 12 días» (menos de una
 * unidad se dice en días; menos de un año, en meses), «es de hoy». Se cuentan unidades COMPLETAS: del 10 de septiembre al 4 de noviembre «tiene 1 mes».
 * Con `preciso` (cuando no pasa) se dice también lo que sobra, porque «tiene 3 meses (máximo 3 meses)» no explicaría por qué no pasó: «tiene 3 meses y 4 días».
 */
function edadEnPalabras(fecha: Dia, hoy: Dia, unidad: UnidadDeTiempo, preciso: boolean): string {
	const dias = numeroDeDia(hoy) - numeroDeDia(fecha);
	if (dias === 0) return 'es de hoy';
	if (unidad === 'dias') return `tiene ${cuantoTiempo(dias, 'dias')}`;
	const meses = mesesCompletos(fecha, hoy);
	const diasDeMas = numeroDeDia(hoy) - numeroDeDia(sumarMeses(fecha, meses));
	const conResto = (base: string, resto: string | null) => `tiene ${base}${preciso && resto ? ` y ${resto}` : ''}`;
	if (unidad === 'anios' && meses >= 12) {
		const anios = Math.floor(meses / 12);
		const mesesDeMas = meses - anios * 12;
		return conResto(cuantoTiempo(anios, 'anios'), mesesDeMas > 0 ? cuantoTiempo(mesesDeMas, 'meses') : diasDeMas > 0 ? cuantoTiempo(diasDeMas, 'dias') : null);
	}
	if (meses >= 1) return conResto(cuantoTiempo(meses, 'meses'), diasDeMas > 0 ? cuantoTiempo(diasDeMas, 'dias') : null);
	return `tiene ${cuantoTiempo(dias, 'dias')}`;
}

/**
 * El veredicto de «Antigüedad contra hoy»: pasa si de `fecha` a `hoy` no han pasado más de `maximo` días, meses o años. El límite se incluye (una
 * fecha de hace exactamente 3 meses pasa con «máximo 3 meses») y los meses y años son de calendario, no de 30 o 365 días: se le suma el máximo a la
 * fecha y pasa si `hoy` no va después.
 *
 * Una fecha POSTERIOR a hoy no pasa: no tiene antigüedad, y un documento fechado en el futuro es un dato que conviene que se vea (como los límites al
 * revés de «Entre»). Como en las demás comparaciones, una fecha que no se entiende no cumple. Sin fecha (o sin hoy), `sin_valores`.
 */
export function evaluarAntiguedad(fecha: string, maximo: number, unidad: UnidadDeTiempo, hoy: string): { estado: Veredicto; medida?: MedidaDeAntiguedad } {
	if (!fecha.trim() || !hoy.trim()) return { estado: 'sin_valores' };
	const base = { hoy: hoy.trim(), maximo, unidad };
	const f = diaDe(fecha);
	const h = diaDe(hoy);
	if (!f) return { estado: 'no_pasa', medida: { ...base, motivo: 'fecha_ilegible' } };
	if (!h) return { estado: 'no_pasa', medida: { ...base, motivo: 'hoy_ilegible' } };
	if (numeroDeDia(f) > numeroDeDia(h)) return { estado: 'no_pasa', medida: { ...base, motivo: 'futura' } };
	const limite = unidad === 'dias' ? numeroDeDia(f) + maximo : numeroDeDia(sumarMeses(f, unidad === 'anios' ? maximo * 12 : maximo));
	const estado: Veredicto = numeroDeDia(h) <= limite ? 'pasa' : 'no_pasa';
	return { estado, medida: { ...base, edad: edadEnPalabras(f, h, unidad, estado === 'no_pasa') } };
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

/**
 * Lo que entrega un nodo «Valor final» con los valores de ejemplo: `listo` (ya tiene su valor), `sin_valores` (está conectado pero falta el
 * ejemplo de un campo, o la regla de la que viene no lo tiene) o `sin_conexion` (no tiene nada conectado, o lo conectado ya no sirve).
 */
export type EvaluacionDeValorFinal = {
	estado: 'listo' | 'sin_valores' | 'sin_conexion';
	valor?: string;
	/**
	 * Qué entrega (2026-11-03, para guardarlo en el historial de Ejecuciones): `valor` (un dato), `lista` (varios, en `elementos`) o `veredicto` (el pasa /
	 * no pasa de una regla, que se entrega como «Pasa» o «No pasa»). Con `sin_conexion` no se sabe: no está.
	 */
	forma?: 'valor' | 'lista' | 'veredicto';
	/** De qué clase es el dato (`null` para un veredicto); ausente con `sin_conexion`. */
	familia?: Familia | null;
	/** Los elementos de una lista que ya tiene valor. */
	elementos?: string[];
};

/**
 * Con qué palabra terminaría el proceso con los valores de ejemplo. `condicion` es el veredicto de la regla conectada (`sin_conexion` si no hay
 * ninguna, o está incompleta) y `caso` y `texto` salen de él: pasa → `si`, no pasa → `no`, sin valores → `sin`; sin conexión no dice nada (`null`).
 */
export type EvaluacionDelResultado = { condicion: Veredicto; caso: CasoDelResultado | null; texto: string | null };

/** Lo que evaluó el lienzo: el estado de CADA regla y el valor de las que entregan uno, lo que entrega cada valor final y cómo termina el proceso. */
export type Evaluacion = {
	estados: Record<string, Estado>;
	valores: Record<string, string>;
	finales: Record<string, EvaluacionDeValorFinal>;
	/** `null` si el lienzo no tiene nodo de resultado. */
	resultado: EvaluacionDelResultado | null;
	/** Por cada «Parecido a» que ya tiene su medida: el porcentaje, la razón de la IA y el mínimo con que se decidió. */
	parecidos: Record<string, MedidaDeParecido & { minimo: number }>;
	/** Los pares de textos que algún «Parecido a» necesita medir y todavía no tiene (sin repetir): quien llama los pide y vuelve a evaluar. */
	pendientes: { a: string; b: string }[];
	/** Qué par (su `llaveDeParecido`) le toca a cada «Parecido a» que ya tiene sus dos textos: así el nodo sabe si el suyo se está midiendo o falló. */
	llavesDeParecido: Record<string, string>;
	/** Por cada «Antigüedad contra hoy» ya decidida: con qué hoy, máximo y unidad, y cuánto tiene la fecha (o por qué no se pudo medir). */
	antiguedades: Record<string, MedidaDeAntiguedad>;
};

/** Lo que el lienzo les ofrece a sus nodos por contexto (`CLAVE_VEREDICTOS`): lo evaluado para todo el grafo. */
export type EvaluadoDelLienzo = {
	readonly todos: Record<string, Estado>;
	readonly valores: Record<string, string>;
	readonly finales: Record<string, EvaluacionDeValorFinal>;
	readonly resultado: EvaluacionDelResultado | null;
	readonly parecidos: Record<string, MedidaDeParecido & { minimo: number }>;
	/** Los «Parecido a» cuyo par se está midiendo AHORA (el lienzo lo pidió y no ha vuelto), y los que no se pudieron medir, con el porqué. */
	readonly llavesDeParecido: Record<string, string>;
	readonly midiendo: ReadonlySet<string>;
	readonly erroresDeParecido: Readonly<Record<string, string>>;
	/** Olvida el fallo de un par (su llave) para que el lienzo lo vuelva a pedir. */
	reintentarParecido(llave: string): void;
	readonly antiguedades: Record<string, MedidaDeAntiguedad>;
	/** La fecha de hoy con la que el lienzo prueba «Antigüedad contra hoy» mientras el nodo no traiga otra escrita. */
	readonly hoy: string;
};

/** Lo que llega a una entrada de un nodo: un campo, un valor fijo o la regla de la que viene. */
export type OrigenDeEntrada =
	| { clase: 'campo'; salida: Salida }
	| { clase: 'fijo'; numero: string; valor: string }
	| { clase: 'regla'; nombre: string; estado: Estado; valor: string | undefined; entrega: 'veredicto' | 'valor' };

/** Los ids de los valores finales cuyo nombre (el escrito o el que les da su número) lo lleva también otro: en la lista de la corrida se confundirían. */
export function valoresFinalesRepetidos(nodos: readonly NodoMinimo[]): Set<string> {
	const porNombre = new Map<string, string[]>();
	for (const n of nodos) {
		if (n.type !== NODO_VALOR_FINAL) continue;
		const nombre = nombreDeValorFinal(n.id, n.data).toLocaleLowerCase('es');
		porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), n.id]);
	}
	return new Set([...porNombre.values()].flatMap((ids) => (ids.length > 1 ? ids : [])));
}

/**
 * El estado de CADA operador del lienzo, siguiendo los cables: las comparaciones y las listas leen sus campos con sus valores de
 * ejemplo, los valores fijos y lo que entregan `Cantidad` y `Suma`; las lógicas leen a las reglas que les llegan.
 *
 * `hoy` es la fecha contra la que se cuenta «Antigüedad contra hoy» cuando el nodo no trae una de ejemplo (`datos.hoy`): la del día en México, si no
 * se dice otra. Una ejecución no la pasa y así usa la del día en que corre (el dibujo guardado nunca trae `datos.hoy`).
 */
export function evaluar(
	nodos: readonly NodoMinimo[],
	aristas: readonly Conexion[],
	tipos: readonly TipoDocumentalGuardado[],
	medidos: Parecidos = {},
	hoy: string = fechaDeHoy()
): Evaluacion {
	const estados: Record<string, Estado> = {};
	const valores: Record<string, string> = {};
	const parecidos: Record<string, MedidaDeParecido & { minimo: number }> = {};
	const pendientes = new Map<string, { a: string; b: string }>();
	const llavesDeParecido: Record<string, string> = {};
	const antiguedades: Record<string, MedidaDeAntiguedad> = {};

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
			} else if (def.clave === 'parecido') {
				const [a, b] = [llegan[0].muestra.trim(), llegan[1].muestra.trim()];
				// Escritos igual salvo mayúsculas, acentos o espacios: el mismo texto, sin preguntar (y sin esperar a la red, también al ejecutar).
				const medida = a && b ? (textoComparable(a) === textoComparable(b) ? MISMO_TEXTO : medidos[llaveDeParecido(a, b)]) : undefined;
				if (a && b) llavesDeParecido[id] = llaveDeParecido(a, b);
				if (!a || !b) estado = 'sin_valores';
				else if (!medida) {
					// Falta medirlo: no se sabe todavía. Quien llama lo pide a la IA y vuelve a evaluar.
					pendientes.set(llaveDeParecido(a, b), { a, b });
					estado = 'sin_valores';
				} else {
					const minimo = minimoDeParecido(datos);
					parecidos[id] = { ...medida, minimo };
					estado = medida.porcentaje >= minimo ? 'pasa' : 'no_pasa';
				}
			} else if (def.clave === 'entre') {
				const familia = (llegan[0].fuente as Fuente).familia;
				estado = familia ? evaluarEntre(familia, llegan[0].muestra, llegan[1].muestra, llegan[2].muestra) : 'sin_conexion';
			} else if (def.clave === 'antiguedad') {
				const r = evaluarAntiguedad(llegan[0].muestra, maximoDeAntiguedad(datos), unidadDeAntiguedad(datos), typeof datos.hoy === 'string' ? datos.hoy : hoy);
				estado = r.estado;
				if (r.medida) antiguedades[id] = r.medida;
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

	// Los nodos finales leen lo que ya se evaluó: no entregan nada a nadie, así que no hay dependencias entre ellos.
	const cableDe = (id: string) => aristas.find((a) => a.target === id && a.targetHandle === ENTRADA_FINAL);

	/** Lo que entrega un valor final: el valor del campo (el ejemplo del propio nodo), del valor fijo o de la regla; el pasa / no pasa de una regla se entrega como «Pasa» o «No pasa». */
	const valorFinal = (n: NodoMinimo): EvaluacionDeValorFinal => {
		const cable = cableDe(n.id);
		const fuente = cable ? fuenteDeConexion(cable, nodos, tipos) : null;
		if (!cable || fuente === null || typeof fuente === 'string' || fuente.forma === 'filas' || fuente.forma === 'documento') return { estado: 'sin_conexion' };
		const origen = nodos.find((o) => o.id === cable.source);
		if (origen?.type === NODO_OPERADOR) {
			const estado = estados[origen.id] ?? 'sin_conexion';
			if (estado === 'sin_conexion') return { estado };
			// Lo que una regla entrega es un veredicto (pasa / no pasa) o, Cantidad y Suma, un número.
			const forma = fuente.forma === 'veredicto' ? 'veredicto' : 'valor';
			const familia = forma === 'veredicto' ? null : fuente.familia;
			if (estado === 'sin_valores') return { estado, forma, familia };
			return { estado: 'listo', valor: estado === 'listo' ? (valores[origen.id] ?? '') : estado === 'pasa' ? 'Pasa' : 'No pasa', forma, familia };
		}
		const muestra = origen?.type === NODO_CONSTANTE ? String((origen.data as DatosNodoConstante).valor ?? '') : String((n.data as DatosNodoValorFinal).a ?? '');
		const forma = fuente.forma === 'lista' ? 'lista' : 'valor';
		const elementos = forma === 'lista' ? lineasDeEjemplo(muestra) : [];
		const texto = forma === 'lista' ? elementos.join(', ') : muestra.trim();
		return texto
			? { estado: 'listo', valor: texto, forma, familia: fuente.familia, ...(forma === 'lista' ? { elementos } : {}) }
			: { estado: 'sin_valores', forma, familia: fuente.familia };
	};
	const finales: Record<string, EvaluacionDeValorFinal> = {};
	for (const n of nodos) if (n.type === NODO_VALOR_FINAL) finales[n.id] = valorFinal(n);

	/** Con qué palabra termina el proceso: la de su nodo de resultado según el veredicto de la regla conectada. Con dos nodos (no debería haberlos), manda el primero. */
	let resultado: EvaluacionDelResultado | null = null;
	const nodoResultado = nodos.find((n) => n.type === NODO_RESULTADO);
	if (nodoResultado) {
		const cable = cableDe(nodoResultado.id);
		const fuente = cable ? fuenteDeConexion(cable, nodos, tipos) : null;
		const origen = cable && nodos.find((o) => o.id === cable.source);
		const estado = origen && operadorDelNodo(origen) && fuente && typeof fuente !== 'string' && fuente.forma === 'veredicto' ? estados[origen.id] : undefined;
		const condicion: Veredicto = estado === 'pasa' || estado === 'no_pasa' || estado === 'sin_valores' ? estado : 'sin_conexion';
		const caso: CasoDelResultado | null = condicion === 'pasa' ? 'si' : condicion === 'no_pasa' ? 'no' : condicion === 'sin_valores' ? 'sin' : null;
		resultado = { condicion, caso, texto: caso ? textosDelResultado(nodoResultado.data)[caso] : null };
	}
	return { estados, valores, finales, resultado, parecidos, pendientes: [...pendientes.values()], llavesDeParecido, antiguedades };
}

// ── Guardar el dibujo y volver a abrirlo ─────────────────────────────────────

/** Un nodo tal como se guarda: solo lo que el lienzo necesita (la librería le suma medidas y banderas de selección que no van). */
export type NodoGuardado = {
	id: string;
	type: typeof NODO_TIPO | typeof NODO_OPERADOR | typeof NODO_CONSTANTE | typeof NODO_VALOR_FINAL | typeof NODO_RESULTADO;
	position: { x: number; y: number };
	data: DatosNodoTipo | DatosNodoOperador | DatosNodoConstante | DatosNodoValorFinal | DatosNodoResultado;
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
			const version = (n.data as DatosNodoTipo).version;
			nodos.push({
				id: n.id,
				type: NODO_TIPO,
				position,
				data: { tipoId: String((n.data as DatosNodoTipo).tipoId), ...(Number.isInteger(version) && (version as number) >= 0 ? { version } : {}) }
			});
		} else if (n.type === NODO_OPERADOR) {
			const d = n.data as DatosNodoOperador;
			nodos.push({
				id: n.id,
				type: NODO_OPERADOR,
				position,
				data: {
					operador: d.operador,
					a: d.a ?? '',
					b: d.b ?? '',
					...(usaTerceraEntrada(d.operador) ? { c: d.c ?? '' } : {}),
					...(d.operador === 'parecido' ? { minimo: minimoDeParecido(d) } : {}),
					// «Antigüedad contra hoy»: el máximo y su unidad son parte de la regla. Su `hoy` de ejemplo NO se guarda.
					...(d.operador === 'antiguedad' ? { maximo: maximoDeAntiguedad(d), unidad: unidadDeAntiguedad(d) } : {})
				}
			});
		} else if (n.type === NODO_CONSTANTE) {
			const d = n.data as DatosNodoConstante;
			nodos.push({ id: n.id, type: NODO_CONSTANTE, position, data: { familia: esFamilia(d.familia) ? d.familia : 'texto', valor: d.valor ?? '' } });
		} else if (n.type === NODO_VALOR_FINAL) {
			const d = n.data as DatosNodoValorFinal;
			// El nombre se guarda sin espacios de más: «RFC » y «RFC» son el mismo nombre y escribirle un espacio no es un cambio por guardar.
			nodos.push({ id: n.id, type: NODO_VALOR_FINAL, position, data: { nombre: (d.nombre ?? '').trim(), a: d.a ?? '' } });
		} else if (n.type === NODO_RESULTADO) {
			nodos.push({ id: n.id, type: NODO_RESULTADO, position, data: textosDelResultado(n.data as Partial<DatosNodoResultado>) });
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
 * recibe, pero el catálogo de operadores puede cambiar entre versiones. `operadoresPuestos`, `constantesPuestas` y `valoresFinalesPuestos` son
 * por dónde sigue la numeración, para que un nodo nuevo no se llame igual que uno ya guardado.
 */
export function hidratarDibujo(guardado: { nodos?: unknown; aristas?: unknown }): {
	nodes: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }[];
	edges: { id: string; source: string; sourceHandle: string | null; target: string; targetHandle: string | null }[];
	operadoresPuestos: number;
	constantesPuestas: number;
	valoresFinalesPuestos: number;
} {
	const nodes: ReturnType<typeof hidratarDibujo>['nodes'] = [];
	for (const n of Array.isArray(guardado.nodos) ? guardado.nodos : []) {
		if (!esObjeto(n) || typeof n.id !== 'string' || !esObjeto(n.position) || !esObjeto(n.data)) continue;
		if (!esNumeroFinito(n.position.x) || !esNumeroFinito(n.position.y)) continue;
		const position = { x: n.position.x, y: n.position.y };
		if (n.type === NODO_TIPO && typeof n.data.tipoId === 'string') {
			const version = n.data.version;
			nodes.push({
				id: n.id,
				type: NODO_TIPO,
				position,
				data: { tipoId: n.data.tipoId, ...(Number.isInteger(version) && (version as number) >= 0 ? { version } : {}) }
			});
		} else if (n.type === NODO_OPERADOR && typeof n.data.operador === 'string' && operadorDe(n.data.operador)) {
			nodes.push({
				id: n.id,
				type: NODO_OPERADOR,
				position,
				data: {
					operador: n.data.operador,
					a: typeof n.data.a === 'string' ? n.data.a : '',
					b: typeof n.data.b === 'string' ? n.data.b : '',
					...(usaTerceraEntrada(n.data.operador) ? { c: typeof n.data.c === 'string' ? n.data.c : '' } : {}),
					...(n.data.operador === 'parecido' ? { minimo: minimoDeParecido(n.data) } : {}),
					...(n.data.operador === 'antiguedad' ? { maximo: maximoDeAntiguedad(n.data), unidad: unidadDeAntiguedad(n.data) } : {})
				}
			});
		} else if (n.type === NODO_CONSTANTE && esFamilia(n.data.familia)) {
			nodes.push({ id: n.id, type: NODO_CONSTANTE, position, data: { familia: n.data.familia, valor: typeof n.data.valor === 'string' ? n.data.valor : '' } });
		} else if (n.type === NODO_VALOR_FINAL) {
			nodes.push({ id: n.id, type: NODO_VALOR_FINAL, position, data: { nombre: typeof n.data.nombre === 'string' ? n.data.nombre : '', a: typeof n.data.a === 'string' ? n.data.a : '' } });
		} else if (n.type === NODO_RESULTADO && !nodes.some((o) => o.type === NODO_RESULTADO)) {
			// Un proceso termina con UNA palabra: si lo guardado trae más de un nodo de resultado (a mano), solo se abre el primero.
			nodes.push({ id: n.id, type: NODO_RESULTADO, position, data: textosDelResultado(n.data) });
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
	// Un nodo de tipo muestra los campos que tienen cable (lo único que un proceso guardado usa); los demás se eligen del menú del nodo.
	for (const n of nodes) {
		if (n.type !== NODO_TIPO) continue;
		const usados = edges.flatMap((e) => (e.source === n.id && e.sourceHandle && e.sourceHandle !== HANDLE_DOCUMENTO ? [e.sourceHandle] : []));
		n.data = { ...n.data, campos: [...new Set(usados)] };
	}
	let operadoresPuestos = 0;
	let constantesPuestas = 0;
	let valoresFinalesPuestos = 0;
	for (const n of nodes) {
		const op = n.type === NODO_OPERADOR ? /^operador-(\d+)$/.exec(n.id) : null;
		if (op) operadoresPuestos = Math.max(operadoresPuestos, Number(op[1]));
		const k = n.type === NODO_CONSTANTE ? /^constante-(\d+)$/.exec(n.id) : null;
		if (k) constantesPuestas = Math.max(constantesPuestas, Number(k[1]));
		const vf = n.type === NODO_VALOR_FINAL ? /^valor-final-(\d+)$/.exec(n.id) : null;
		if (vf) valoresFinalesPuestos = Math.max(valoresFinalesPuestos, Number(vf[1]));
	}
	return { nodes, edges, operadoresPuestos, constantesPuestas, valoresFinalesPuestos };
}

// ── Abrir, guardar y saber si hay cambios por guardar ────────────────────────

/**
 * Lo que se recuerda de un proceso al abrirlo o guardarlo para saber si hay cambios sin guardar: la huella de su dibujo y su nombre sin espacios
 * de más. NADA MÁS. Un proceso guardado antes del 2026-11-05 trae además `tipoExpedienteVirtualId` en sus `datos` (el tipo de expediente virtual
 * sobre el que corría); desde que se quitaron los expedientes virtuales (Moibe) ese campo se IGNORA: no entra aquí, así que abrir uno de esos
 * procesos no lo deja con «cambios sin guardar», y tampoco se reenvía al guardar (`guardarProceso`).
 */
export type FotoDeProceso = { huella: string; nombre: string };

/**
 * Lo que sale de abrir un proceso del servidor: su dibujo, para el lienzo (`hidratarDibujo`), y la foto con la que se sabrá si después hay cambios.
 * La foto se saca de lo que QUEDÓ en el lienzo y no de lo que mandó el servidor: si algo no se pudo abrir (un operador que ya no existe), el proceso
 * no debe aparecer con cambios sin que nadie los haya hecho.
 */
export function abrirProceso(datos: { nombre?: unknown; nodos?: unknown; aristas?: unknown }): { dibujo: ReturnType<typeof hidratarDibujo>; foto: FotoDeProceso } {
	const dibujo = hidratarDibujo(datos);
	const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
	return { dibujo, foto: { huella: huellaDelDibujo(serializarDibujo(dibujo.nodes, dibujo.edges)), nombre } };
}

/**
 * ¿Hay algo que guardar? De un proceso que ya existe en el servidor, si su dibujo o su nombre difieren de la foto (mover un nodo y devolverlo, o
 * escribir un valor y borrarlo, deja el proceso como estaba); de uno que todavía no existe, si la persona ya puso algo: un nodo, un cable o un nombre.
 */
export function hayCambiosSinGuardar(existe: boolean, ahora: { huella: string; nombre: string; hayDibujo: boolean }, foto: FotoDeProceso): boolean {
	return existe ? ahora.huella !== foto.huella || ahora.nombre.trim() !== foto.nombre : ahora.hayDibujo || ahora.nombre.trim() !== '';
}

/**
 * Qué le falta a un proceso para poder guardarse, en el orden en que se le dice a la persona; `null` si no le falta nada (sin contar si hay cambios).
 * «Guardar» exige:
 *   · un NOMBRE;
 *   · al menos un TIPO DOCUMENTAL en el lienzo (NEX-529): son las entradas, la declaración de qué documentos necesita el proceso del expediente;
 *   · que NINGUNO de los tipos del lienzo haya dejado de estar activo (2026-11-05, Moibe: «no deberíamos poder usar en el canvas los tipos documentales
 *     que no estén activos»);
 *   · el nodo del RESULTADO (2026-11-03, Moibe): sin la palabra con la que termina no hay con qué contestar cuando se ejecute.
 * Desde el 2026-11-05 YA NO exige un tipo de expediente virtual (Moibe: «voy a quitar los expedientes virtuales»): un proceso corre sobre cualquier
 * expediente de la organización. Es una regla de la pantalla: el back no exige nada de esto (activar o desactivar desde la lista guarda el proceso
 * entero y no debe fallar con los procesos de antes).
 */
export type FaltaParaGuardar = 'nombre' | 'documento' | 'inactivos' | 'resultado';
export function faltaParaGuardar(proceso: { nombre: string; hayTipoDocumental: boolean; tiposNoActivos: number; hayResultado: boolean }): FaltaParaGuardar | null {
	if (proceso.nombre.trim() === '') return 'nombre';
	if (!proceso.hayTipoDocumental) return 'documento';
	if (proceso.tiposNoActivos > 0) return 'inactivos';
	if (!proceso.hayResultado) return 'resultado';
	return null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────── el alta de un proceso (2026-11-06)

/**
 * ¿Su Resultado tiene una regla conectada? Es lo que hace EJECUTABLE a un proceso (espejo de `procesos.resultado_conectado` de nexus_back): un nodo de
 * Resultado cuya entrada «a» viene de un operador. Guardar solo exige que el nodo exista; con el alta nueva (que deja el Resultado suelto hasta que se
 * conecta) es fácil guardar uno que todavía no se puede ejecutar, y la pantalla lo dice (2026-11-06).
 */
export function resultadoConectado(dibujo: { nodos: readonly unknown[]; aristas: readonly unknown[] }): boolean {
	const tipos = new Map<unknown, unknown>();
	for (const n of dibujo.nodos) if (n && typeof n === 'object') tipos.set((n as { id?: unknown }).id, (n as { type?: unknown }).type);
	return dibujo.aristas.some((a) => {
		if (!a || typeof a !== 'object') return false;
		const { source, target, targetHandle } = a as { source?: unknown; target?: unknown; targetHandle?: unknown };
		return tipos.get(target) === NODO_RESULTADO && targetHandle === 'a' && tipos.get(source) === NODO_OPERADOR;
	});
}

/** El tope del nombre de un proceso: el del campo del lienzo y el que impone nexus_back. */
export const MAX_NOMBRE_PROCESO = 200;
/** Cuántos tipos documentales se aceptan de la dirección del alta (la biblioteca de una organización no llega ni cerca; es solo un tope contra direcciones absurdas). */
const MAX_TIPOS_DEL_ALTA = 50;

/**
 * La dirección del lienzo de un proceso NUEVO con lo que se eligió en el alta (Moibe, 2026-11-06, Figma HUN5 «Crear proceso»: antes de llegar al lienzo se
 * pone el nombre y se eligen los TIPOS DOCUMENTALES del proceso; los campos de cada uno se eligen ya en el lienzo). Va en la dirección y no en un estado
 * guardado aparte para que recargar la página no pierda el borrador. Sin nombre ni tipos es la de siempre: un lienzo en blanco.
 */
export function direccionDeProcesoNuevo(nombre: string, tipos: readonly string[]): string {
	const p = new URLSearchParams();
	const limpio = nombre.trim().slice(0, MAX_NOMBRE_PROCESO);
	if (limpio) p.set('nombre', limpio);
	for (const t of new Set(tipos)) if (t) p.append('tipo', t);
	const consulta = p.toString();
	return consulta ? `/motor-de-reglas/nuevo?${consulta}` : '/motor-de-reglas/nuevo';
}

/**
 * Lo que el lienzo de un proceso nuevo lee de su dirección (lo contrario de `direccionDeProcesoNuevo`): el nombre sin espacios de más y los ids de los
 * tipos documentales, sin repetir y en el orden en que vienen. Es lo que viene de la barra de direcciones, así que se desconfía: lo que no es un id
 * razonable se descarta (el lienzo igual los comprueba contra la biblioteca antes de ponerlos).
 */
export function entradasDeProcesoNuevo(params: URLSearchParams): { nombre: string; tipos: string[] } {
	const nombre = (params.get('nombre') ?? '').trim().slice(0, MAX_NOMBRE_PROCESO);
	const tipos: string[] = [];
	for (const crudo of params.getAll('tipo')) {
		const id = crudo.trim();
		if (id && id.length <= 100 && !tipos.includes(id)) tipos.push(id);
	}
	return { nombre, tipos: tipos.slice(0, MAX_TIPOS_DEL_ALTA) };
}
