/**
 * Un tipo de expediente como lo devuelve nexus_back (`/tipos-expediente`): la CLASE de la que salen los expedientes, por ejemplo
 * «Expediente médico» o «Expediente de un choque». Cada expediente es una instancia de un tipo (la carpeta de UN paciente, de UN
 * choque, con sus documentos). Aquí solo viven los campos que la pantalla usa; el esquema del tipo (los tipos documentales que lo
 * describen) llega en la respuesta pero todavía no se muestra.
 */
export type TipoDeExpediente = {
	id: string;
	nombre: string;
	creadoPor: string | null;
	creadoEn: string | null;
	/** Cuántos expedientes son instancia de este tipo. */
	totalExpedientes: number;
};

/** El tope del nombre: el mismo que impone nexus_back (`servicios/tipos_expediente.py`). */
export const MAX_NOMBRE_TIPO = 200;
