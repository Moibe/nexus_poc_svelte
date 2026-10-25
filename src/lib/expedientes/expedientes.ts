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

export type OrdenExpedientes = 'recientes' | 'antiguos' | 'nombre';
export type OrdenDocumentos = 'recientes' | 'antiguos' | 'nombre' | 'tamano';

export const OPCIONES_ORDEN_EXPEDIENTES: { valor: OrdenExpedientes; etiqueta: string }[] = [
	{ valor: 'recientes', etiqueta: 'Más recientes primero' },
	{ valor: 'antiguos', etiqueta: 'Más antiguos primero' },
	{ valor: 'nombre', etiqueta: 'Nombre (A-Z)' }
];

export const OPCIONES_ORDEN_DOCUMENTOS: { valor: OrdenDocumentos; etiqueta: string }[] = [
	...OPCIONES_ORDEN_EXPEDIENTES,
	{ valor: 'tamano', etiqueta: 'Tamaño (mayor primero)' }
];

const porNombre = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });

/**
 * Ordena sin tocar la lista recibida. El servidor las trae en el orden de llegada (el más viejo primero), así que «recientes» es darle
 * la vuelta —y no comparar fechas, que a un segundo de resolución empatan— y «antiguos» es dejarla como viene.
 */
export function ordenar<T extends { nombre: string }>(lista: T[], orden: 'recientes' | 'antiguos' | 'nombre'): T[] {
	if (orden === 'recientes') return [...lista].reverse();
	if (orden === 'nombre') return [...lista].sort((a, b) => porNombre(a.nombre, b.nombre));
	return [...lista];
}

/** Lo mismo para los documentos, que se llaman `nombreOriginal`; con «tamano», el más grande primero. */
export function ordenarDocumentos(lista: DocumentoDeExpediente[], orden: OrdenDocumentos): DocumentoDeExpediente[] {
	if (orden === 'tamano') return [...lista].sort((a, b) => b.tamanoBytes - a.tamanoBytes);
	if (orden === 'nombre') return [...lista].sort((a, b) => porNombre(a.nombreOriginal, b.nombreOriginal));
	return orden === 'recientes' ? [...lista].reverse() : [...lista];
}
