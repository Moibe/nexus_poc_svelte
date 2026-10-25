/**
 * Un tipo de expediente como lo devuelve nexus_back (`/tipos-expediente`): la CLASE de la que salen los expedientes, por ejemplo
 * «Expediente médico» o «Expediente de un choque». Cada expediente es una instancia de un tipo (la carpeta de UN paciente, de UN
 * choque, con sus documentos). Aquí solo viven los campos que la pantalla usa.
 *
 * El esquema del tipo son los tipos documentales que lo describen (varios; ese conjunto ES el esquema). Se define al crear el tipo y
 * describe, no restringe: los expedientes del tipo reciben cualquier archivo.
 */
export type TipoDeExpediente = {
	id: string;
	nombre: string;
	/** El esquema: los tipos documentales del tipo. `nombre` es `null` si ese tipo documental ya se borró de la biblioteca. Vacío en los tipos
	 *  que se crearon antes de que el esquema se pidiera al crear. */
	tiposDocumentales: { id: string; nombre: string | null }[];
	creadoPor: string | null;
	creadoEn: string | null;
	/** Cuántos expedientes son instancia de este tipo. */
	totalExpedientes: number;
};

/** Un tipo documental de la biblioteca de la organización, como se ofrece para armar el esquema de un tipo de expediente. */
export type TipoDocumentalOpcion = {
	id: string;
	nombre: string;
	/** Un `archivado` no se ofrece (la biblioteca tampoco lo muestra); un `borrador` sí, con su etiqueta. */
	estado: 'borrador' | 'activo';
};

/** El tope del nombre: el mismo que impone nexus_back (`servicios/tipos_expediente.py`). */
export const MAX_NOMBRE_TIPO = 200;

/**
 * De la lista cruda de nexus_back (`/tipos-documentales`: cada uno con su `id` y sus `datos`, donde viven `nombre` y `estado`) a lo que el
 * modal ofrece: sin los archivados, sin los que no traen nombre y en el orden de la biblioteca. Un estado que no se conoce se trata como
 * borrador, igual que la biblioteca.
 */
export function opcionesDeTiposDocumentales(crudos: unknown[]): TipoDocumentalOpcion[] {
	const opciones: TipoDocumentalOpcion[] = [];
	for (const crudo of crudos) {
		const e = crudo as { id?: unknown; datos?: { nombre?: unknown; estado?: unknown } } | null;
		const nombre = typeof e?.datos?.nombre === 'string' ? e.datos.nombre.trim() : '';
		if (typeof e?.id !== 'string' || !nombre || e.datos?.estado === 'archivado') continue;
		opciones.push({ id: e.id, nombre, estado: e.datos?.estado === 'activo' ? 'activo' : 'borrador' });
	}
	return opciones;
}
