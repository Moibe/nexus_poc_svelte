/**
 * La lógica del lienzo del motor de reglas, sin nada de pantalla (pilotos 1 y 2, 2026-10-20): qué se puede conectar con qué y
 * cuándo dos valores son «iguales». Vive aparte de los componentes para poder probarla sola (`verificar-reglas.mjs`): por eso
 * aquí solo se importan TIPOS, nunca código.
 *
 * El modelo: un PROCESO es un conjunto de reglas y corre sobre un EXPEDIENTE (un conjunto de documentos). Los tipos documentales
 * son sus entradas; por cada conexión viaja un CAMPO (no el documento entero) y su tipo de dato decide qué se puede comparar.
 */
import type { TipoDocumentalGuardado } from '$lib/state/configuracion.svelte';

// ── Los nodos del lienzo ─────────────────────────────────────────────────────

/** Lo que lleva un nodo de tipo documental: solo cuál es. Sus campos se leen en vivo de la biblioteca. */
export type DatosNodoTipo = { tipoId: string };

/** Lo que lleva un nodo «Igual a»: los valores de EJEMPLO con los que se prueba la regla, uno por lado. */
export type DatosNodoIgual = { a: string; b: string };

/** Los tipos de nodo que registra el lienzo (`nodeTypes`). */
export const NODO_TIPO = 'tipo-documental';
export const NODO_IGUAL = 'operador-igual';

/** Con qué se arrastra algo desde la paleta hasta el lienzo (`DataTransfer`). */
export const MIME_TIPO_DOCUMENTAL = 'application/x-nexusdoc-tipo-documental';
export const MIME_OPERADOR = 'application/x-nexusdoc-operador';

/** Los operadores que ofrece la paleta. Cada uno apunta al tipo de nodo que lo dibuja. */
export const OPERADORES = [
	{ clave: 'igual', etiqueta: 'Igual a', descripcion: 'Pasa si los dos valores son iguales.', nodo: NODO_IGUAL }
] as const;

/**
 * Un proceso corre sobre un expediente, o sea un conjunto de documentos, así que cada tipo documental aparece UNA vez: el nodo
 * «Acta constitutiva» es el acta de ESTE expediente. De ahí que el id del nodo salga del tipo y no se pueda repetir.
 */
export const idNodoDeTipo = (tipoId: string) => `tipo-${tipoId}`;

/** Las dos entradas de «Igual a». */
export const LADOS = ['a', 'b'] as const;
export type Lado = (typeof LADOS)[number];

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
	if (origen.type !== NODO_TIPO) return 'Por ahora solo los campos de un documento se pueden conectar a un operador.';
	if (destino.type !== NODO_IGUAL || (c.targetHandle !== 'a' && c.targetHandle !== 'b')) {
		return 'Un campo se conecta a una de las dos entradas de un operador.';
	}

	const salida = salidaDeCampo(tipos, (origen.data as DatosNodoTipo).tipoId, c.sourceHandle ?? '');
	if (!salida) return 'Ese campo ya no existe en el tipo documental.';
	const noSePuede = porQueNoSeConecta(salida);
	if (noSePuede) return noSePuede;

	// El otro lado del operador manda: lo que se compara tiene que ser de la misma familia, y no puede ser el mismo campo.
	const otro = c.targetHandle === 'a' ? 'b' : 'a';
	const arista = aristas.find((e) => e.target === c.target && e.targetHandle === otro);
	const nodoOtro = arista && nodos.find((n) => n.id === arista.source);
	const salidaOtra = arista && nodoOtro && salidaDeCampo(tipos, (nodoOtro.data as DatosNodoTipo).tipoId, arista.sourceHandle ?? '');
	if (arista && salidaOtra) {
		if (arista.source === c.source && (arista.sourceHandle ?? '') === (c.sourceHandle ?? '')) {
			return 'Los dos lados serían el mismo campo: no habría nada que comparar.';
		}
		const mia = familiaDe(salida.tipoDato);
		const suya = familiaDe(salidaOtra.tipoDato);
		if (mia !== suya && mia && suya) return `No se puede comparar ${NOMBRE_DE_FAMILIA[mia]} con ${NOMBRE_DE_FAMILIA[suya]}.`;
	}
	return null;
}

// ── Cuándo dos valores son iguales ───────────────────────────────────────────

export type Resultado = 'pasa' | 'no_pasa' | 'sin_valores';

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

/** El resultado de «Igual a» con los valores de ejemplo; `sin_valores` mientras falte alguno. */
export function comparar(familia: Familia, a: string, b: string): Resultado {
	if (!a.trim() || !b.trim()) return 'sin_valores';
	return sonIguales(familia, a, b) ? 'pasa' : 'no_pasa';
}
