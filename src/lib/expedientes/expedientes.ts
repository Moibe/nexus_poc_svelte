/**
 * Un expediente como lo devuelve nexus_back (`/expedientes`): la carpeta de UN caso (un paciente, un choque), instancia de un tipo de
 * expediente, con los documentos de ese caso. Se llama por su `nombre`; no tiene folio. Aquí solo viven los campos que las pantallas
 * usan, más los formateadores de lo que se muestra de ellos (peso, fecha, formato del archivo): sin dependencias, para poder probarlos
 * sueltos (`node --experimental-strip-types`).
 */

/** El tipo del que el expediente es instancia. `nombre` es `null` si el tipo ya no está en el registro. */
export type TipoDelExpediente = { id: string; nombre: string | null };

/** Lo que dice la lista de cada expediente. */
export type Expediente = {
	id: string;
	nombre: string;
	/** `null` solo en un expediente guardado antes de que el tipo fuera obligatorio. */
	tipo: TipoDelExpediente | null;
	creadoPor: string | null;
	creadoEn: string | null;
	/** Cuántos documentos tiene. */
	totalDocumentos: number;
	/** Cuánto pesan en total, en bytes. Puede faltar si el servidor es anterior a este campo. */
	tamanoBytes?: number;
};

/** Un documento tal como lo guarda nexus_back al entrar al sistema. */
export type DocumentoDeExpediente = {
	id: string;
	nombreOriginal: string;
	mime: string;
	tamanoBytes: number;
	/** Por dónde entró: la API o la carga manual. */
	canal: 'API' | 'MANUAL';
	recibidoEn: string | null;
};

/** El expediente abierto: lo mismo que en la lista y sus documentos, en el orden en que se agregaron. */
export type ExpedienteConDocumentos = Expediente & { documentos: DocumentoDeExpediente[] };

/** El tope del nombre: el mismo que impone nexus_back (`servicios/expedientes.py`). */
export const MAX_NOMBRE_EXPEDIENTE = 200;

const UNIDADES = ['B', 'KB', 'MB', 'GB'];

/**
 * El peso como lo escribe el diseño: «4.8 MB», «0.5 MB». Base 1024, un decimal y sin «.0» de relleno. Sin peso (o sin dato) dice
 * «0 MB», que es lo que el diseño muestra en un expediente vacío.
 */
export function formatearTamano(bytes: number | null | undefined): string {
	if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '0 MB';
	let valor = bytes;
	let i = 0;
	// Se compara ya redondeado: 1 048 575 B redondea a «1024 KB» y debe decir «1 MB».
	while (i < UNIDADES.length - 1 && Math.round(valor * 10) / 10 >= 1024) {
		valor /= 1024;
		i++;
	}
	return i === 0 ? `${bytes} B` : `${Math.round(valor * 10) / 10} ${UNIDADES[i]}`;
}

/** «12/05/2026», en la hora de quien mira. Una fecha ausente o ilegible es «—». */
export function fechaCorta(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const FORMATO_POR_MIME: Record<string, string> = {
	'application/pdf': 'PDF',
	'image/jpeg': 'JPG',
	'image/png': 'PNG',
	'image/tiff': 'TIFF'
};

/** El formato del archivo en una palabra («PDF», «JPG»): el tipo MIME si lo conocemos, si no la extensión del nombre. */
export function formatoDe(documento: Pick<DocumentoDeExpediente, 'nombreOriginal' | 'mime'>): string {
	const porMime = FORMATO_POR_MIME[(documento.mime ?? '').toLowerCase()];
	if (porMime) return porMime;
	const extension = /\.([a-z0-9]{1,5})$/i.exec(documento.nombreOriginal ?? '')?.[1];
	if (extension) return extension.toUpperCase();
	const subtipo = (documento.mime ?? '').split('/')[1];
	return subtipo ? subtipo.toUpperCase() : 'Archivo';
}

/** «1 Archivo», «2 Archivos» (con la mayúscula del diseño). */
export function etiquetaDeArchivos(n: number): string {
	return `${n} ${n === 1 ? 'Archivo' : 'Archivos'}`;
}

/** Para buscar sin que importen mayúsculas ni acentos: «medico» encuentra «Expediente médico». */
export function normalizar(texto: string): string {
	return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

// ---------------------------------------------------------------------------------------------------------------- cómo se ve el listado

/**
 * Cómo se muestra el listado de expedientes (2026-10-25, pedido de Moibe): una LISTA, con una fila por expediente y sus columnas, o un
 * MOSAICO, con una carpeta por expediente. La elección se recuerda en una cookie (`COOKIE_VISTA_EXPEDIENTES`) y no en el navegador a
 * secas: la lee el servidor al pintar la página, así que quien eligió el mosaico no ve un destello de lista antes de que cargue.
 */
export type VistaExpedientes = 'lista' | 'mosaico';

export const COOKIE_VISTA_EXPEDIENTES = 'exp_vista';

/** La vista que dice la cookie. Cualquier otra cosa —o ninguna— es la lista, que es la de siempre. */
export function vistaDe(valor: string | null | undefined): VistaExpedientes {
	return valor === 'mosaico' ? 'mosaico' : 'lista';
}

// -------------------------------------------------------------------------------------------------------------------------- el orden

export type OrdenExpedientes =
	| 'recientes'
	| 'antiguos'
	| 'nombre'
	| 'nombre-desc'
	| 'tipo'
	| 'tipo-desc'
	| 'archivos'
	| 'archivos-asc'
	| 'peso'
	| 'peso-asc';
export type OrdenDocumentos = 'recientes' | 'antiguos' | 'nombre' | 'tamano';

/** Lo que ofrece el menú «Ordenar» del mosaico. En la lista se ordena picando el encabezado de cada columna: son los mismos órdenes. */
export const OPCIONES_ORDEN_EXPEDIENTES: { valor: OrdenExpedientes; etiqueta: string }[] = [
	{ valor: 'recientes', etiqueta: 'Más recientes primero' },
	{ valor: 'antiguos', etiqueta: 'Más antiguos primero' },
	{ valor: 'nombre', etiqueta: 'Nombre (A-Z)' },
	{ valor: 'nombre-desc', etiqueta: 'Nombre (Z-A)' },
	{ valor: 'tipo', etiqueta: 'Tipo de expediente (A-Z)' },
	{ valor: 'tipo-desc', etiqueta: 'Tipo de expediente (Z-A)' },
	{ valor: 'archivos', etiqueta: 'Más archivos primero' },
	{ valor: 'archivos-asc', etiqueta: 'Menos archivos primero' },
	{ valor: 'peso', etiqueta: 'Más pesados primero' },
	{ valor: 'peso-asc', etiqueta: 'Menos pesados primero' }
];

export const OPCIONES_ORDEN_DOCUMENTOS: { valor: OrdenDocumentos; etiqueta: string }[] = [
	{ valor: 'recientes', etiqueta: 'Más recientes primero' },
	{ valor: 'antiguos', etiqueta: 'Más antiguos primero' },
	{ valor: 'nombre', etiqueta: 'Nombre (A-Z)' },
	{ valor: 'tamano', etiqueta: 'Tamaño (mayor primero)' }
];

const porNombre = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
const comparar = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

/** Lo mínimo que hace falta de un expediente para ordenarlo (un `Expediente` de verdad lo cumple). */
type Ordenable = {
	nombre: string;
	tipo?: { nombre: string | null } | null;
	totalDocumentos?: number;
	tamanoBytes?: number;
	creadoEn?: string | null;
};

/** Cuándo se creó, en milisegundos; sin fecha (o ilegible) cuenta como el más antiguo de todos. */
function cuando(e: Ordenable): number {
	const t = Date.parse(e.creadoEn ?? '');
	return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Ordena sin tocar la lista recibida. Todo empate se desempata igual en cada orden, para que dos corridas den lo mismo y la lista no
 * «baile» al cambiar de columna:
 *   · por fecha, el que llegó antes a la lista (el servidor las trae en el orden en que se crearon; «recientes» es el mismo orden al
 *     revés, así que a un segundo de resolución, donde las fechas empatan, sigue mandando el orden de llegada);
 *   · por tipo, por archivos y por peso, el nombre de A a Z, de modo que ordenar por tipo AGRUPA los de un mismo tipo y los deja
 *     alfabéticos. Un expediente sin tipo (los guardados antes de que el tipo fuera obligatorio) va siempre al final.
 */
export function ordenarExpedientes<T extends Ordenable>(lista: T[], orden: OrdenExpedientes): T[] {
	const filas = lista.map((e, i) => ({ e, i }));
	type Fila = (typeof filas)[number];
	const nombre = (a: Fila, b: Fila) => porNombre(a.e.nombre, b.e.nombre) || a.i - b.i;
	const tipo = (a: Fila) => a.e.tipo?.nombre ?? null;
	const archivos = (a: Fila) => a.e.totalDocumentos ?? 0;
	const peso = (a: Fila) => a.e.tamanoBytes ?? 0;
	const porTipo = (a: Fila, b: Fila, direccion: 1 | -1) => {
		const ta = tipo(a);
		const tb = tipo(b);
		if (ta === null || tb === null) return ta === tb ? nombre(a, b) : ta === null ? 1 : -1;
		return direccion * porNombre(ta, tb) || nombre(a, b);
	};
	const criterios: Record<OrdenExpedientes, (a: Fila, b: Fila) => number> = {
		recientes: (a, b) => comparar(cuando(b.e), cuando(a.e)) || b.i - a.i,
		antiguos: (a, b) => comparar(cuando(a.e), cuando(b.e)) || a.i - b.i,
		nombre,
		'nombre-desc': (a, b) => porNombre(b.e.nombre, a.e.nombre) || a.i - b.i,
		tipo: (a, b) => porTipo(a, b, 1),
		'tipo-desc': (a, b) => porTipo(a, b, -1),
		archivos: (a, b) => comparar(archivos(b), archivos(a)) || nombre(a, b),
		'archivos-asc': (a, b) => comparar(archivos(a), archivos(b)) || nombre(a, b),
		peso: (a, b) => comparar(peso(b), peso(a)) || nombre(a, b),
		'peso-asc': (a, b) => comparar(peso(a), peso(b)) || nombre(a, b)
	};
	return filas.sort(criterios[orden]).map((f) => f.e);
}

/** Las columnas de la lista, de izquierda a derecha, y el orden de cada una en cada dirección. */
export type ColumnaExpedientes = 'nombre' | 'tipo' | 'archivos' | 'peso' | 'creado';

export const COLUMNAS_EXPEDIENTES: {
	columna: ColumnaExpedientes;
	etiqueta: string;
	asc: OrdenExpedientes;
	desc: OrdenExpedientes;
	/** Hacia dónde ordena el PRIMER clic: los textos de la A a la Z; las cantidades y las fechas, lo más grande y lo más reciente primero. */
	primera: 'asc' | 'desc';
}[] = [
	{ columna: 'nombre', etiqueta: 'Expediente', asc: 'nombre', desc: 'nombre-desc', primera: 'asc' },
	{ columna: 'tipo', etiqueta: 'Tipo de expediente', asc: 'tipo', desc: 'tipo-desc', primera: 'asc' },
	{ columna: 'archivos', etiqueta: 'Archivos', asc: 'archivos-asc', desc: 'archivos', primera: 'desc' },
	{ columna: 'peso', etiqueta: 'Peso', asc: 'peso-asc', desc: 'peso', primera: 'desc' },
	{ columna: 'creado', etiqueta: 'Fecha de creación', asc: 'antiguos', desc: 'recientes', primera: 'desc' }
];

/** Por qué columna y en qué dirección ordena un orden. */
export function columnaDeOrden(orden: OrdenExpedientes): { columna: ColumnaExpedientes; direccion: 'asc' | 'desc' } {
	for (const c of COLUMNAS_EXPEDIENTES) {
		if (c.asc === orden) return { columna: c.columna, direccion: 'asc' };
		if (c.desc === orden) return { columna: c.columna, direccion: 'desc' };
	}
	return { columna: 'creado', direccion: 'desc' };
}

/** El orden que sale al picar el encabezado de una columna: si la lista ya iba por ella, se invierte; si no, arranca por su primera dirección. */
export function ordenAlPicar(actual: OrdenExpedientes, columna: ColumnaExpedientes): OrdenExpedientes {
	const c = COLUMNAS_EXPEDIENTES.find((x) => x.columna === columna)!;
	const ahora = columnaDeOrden(actual);
	if (ahora.columna !== columna) return c[c.primera];
	return ahora.direccion === 'asc' ? c.desc : c.asc;
}

// ------------------------------------------------------------------------------------------------------------------------ los filtros

/** «Con documentos» y «Sin documentos» (vacíos). Elegir los dos es no filtrar. */
export type FiltroDocumentos = 'con' | 'sin';

export const OPCIONES_FILTRO_DOCUMENTOS: { valor: FiltroDocumentos; etiqueta: string }[] = [
	{ valor: 'con', etiqueta: 'Con documentos' },
	{ valor: 'sin', etiqueta: 'Sin documentos' }
];

/**
 * Lo que el listado puede filtrar: el texto (nombre o tipo, sin importar mayúsculas ni acentos), uno o varios TIPOS de expediente (por
 * su id), si tienen o no documentos y el rango de fechas en que se crearon (extremos incluidos, en la hora de quien mira; solo se
 * aplica con los dos extremos, como el calendario del resto de la app).
 */
export type FiltrosExpedientes = {
	texto: string;
	tipos: string[];
	documentos: FiltroDocumentos[];
	desde: Date | null;
	hasta: Date | null;
};

export const SIN_FILTROS: FiltrosExpedientes = { texto: '', tipos: [], documentos: [], desde: null, hasta: null };

type Filtrable = Ordenable & { tipo?: { id: string; nombre: string | null } | null };

const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const finDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

/** ¿Hay algún filtro puesto, además del texto? Los dos «con/sin documentos» juntos o un rango a medias no filtran nada. */
function hayFiltrosAparte(f: FiltrosExpedientes): boolean {
	return f.tipos.length > 0 || filtraDocumentos(f) !== null || (f.desde !== null && f.hasta !== null);
}

/** ¿Hay algo filtrando? Un texto de solo espacios cuenta como ningún texto. */
export function hayFiltros(f: FiltrosExpedientes): boolean {
	return f.texto.trim() !== '' || hayFiltrosAparte(f);
}

/** «con» o «sin» si se eligió SOLO uno de los dos; `null` si no se filtra por documentos. */
function filtraDocumentos(f: FiltrosExpedientes): FiltroDocumentos | null {
	const unico = new Set(f.documentos);
	return unico.size === 1 ? [...unico][0] : null;
}

/** Lo que se le dice a quien filtró y no le quedó ningún expediente: dice qué se buscó, para que no parezca un error. */
export function mensajeSinResultados(f: FiltrosExpedientes): string {
	const texto = f.texto.trim();
	if (!hayFiltrosAparte(f)) return `No encontramos expedientes con «${texto}». Revisa el nombre o el tipo e intenta de nuevo.`;
	const busqueda = texto ? `con «${texto}» que cumplan` : 'que cumplan';
	return `No encontramos expedientes ${busqueda} los filtros elegidos. Quita o cambia alguno e intenta de nuevo.`;
}

/** Los expedientes que cumplen TODOS los filtros puestos. No toca la lista recibida y respeta su orden. */
export function filtrarExpedientes<T extends Filtrable>(lista: T[], f: FiltrosExpedientes): T[] {
	const q = normalizar(f.texto);
	const documentos = filtraDocumentos(f);
	const rango = f.desde && f.hasta ? { de: inicioDelDia(f.desde), a: finDelDia(f.hasta) } : null;
	return lista.filter((e) => {
		if (q && !normalizar(`${e.nombre} ${e.tipo?.nombre ?? ''}`).includes(q)) return false;
		if (f.tipos.length > 0 && !(e.tipo && f.tipos.includes(e.tipo.id))) return false;
		if (documentos === 'con' && !((e.totalDocumentos ?? 0) > 0)) return false;
		if (documentos === 'sin' && (e.totalDocumentos ?? 0) > 0) return false;
		if (rango) {
			const t = cuando(e);
			if (t < rango.de || t > rango.a) return false;
		}
		return true;
	});
}

/** Lo mismo para los documentos, que se llaman `nombreOriginal`; con «tamano», el más grande primero. */
export function ordenarDocumentos<T extends DocumentoDeExpediente>(lista: T[], orden: OrdenDocumentos): T[] {
	if (orden === 'tamano') return [...lista].sort((a, b) => b.tamanoBytes - a.tamanoBytes);
	if (orden === 'nombre') return [...lista].sort((a, b) => porNombre(a.nombreOriginal, b.nombreOriginal));
	return orden === 'recientes' ? [...lista].reverse() : [...lista];
}
