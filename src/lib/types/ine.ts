/**
 * Forma de la respuesta de `POST /ia/ine` en nexus_back.
 *
 * Está escrita a mano contra `servicios/ia.py` y `servicios/ocr.py` de ese
 * proyecto, no generada. Si el back cambia la forma, esto NO truena solo —
 * revísalo cuando toques `_campo()` o `extraer_capa_ocr()` allá.
 *
 * Los nombres en snake_case se conservan tal cual llegan a propósito: son los
 * del diccionario de datos v0.4 (`entity_fact`, `ocr_block`), y renombrarlos a
 * camelCase aquí obligaría a traducir de ida y vuelta el día que estos mismos
 * objetos se manden a guardar a SQL Server.
 */

/** Caja normalizada 0-1 sobre el ancho/alto de la página: se puede pasar a CSS
 *  multiplicando por 100 y poniendo `%`. */
export type Caja = {
	x: number;
	y: number;
	ancho: number;
	alto: number;
};

/** Un campo hoja extraído. Corresponde a una fila futura de `entity_fact`. */
export type CampoExtraido = {
	/** El texto tal como lo leyó el OCR, sin limpiar. */
	value_raw: string | null;
	/** El valor después de aplicar la regla del campo (fechas a ISO, etc.). */
	value_normalized: string | null;
	/** Escala 0-100 (el diccionario la define como `numeric(5,2)`). */
	confianza: number | null;
	/** La misma confianza en la escala 0-1 en que la reporta Google. */
	confianza_cruda: number | null;
	metodo_confianza: string;
	page_number: number | null;
	/** Índice dentro de `ocr.bloques` del que salió el valor. */
	bloque_indice: number | null;
	posicion: Caja | null;
};

export type BloqueOcr = {
	indice: number;
	page_number: number;
	block_type: string;
	texto: string;
	bbox: Caja;
	confianza: number | null;
	orientacion: string | null;
	orientacion_grados: number | null;
};

export type CapaOcr = {
	engine: string;
	engine_version: string | null;
	paginas: Array<{
		page_number: number;
		ancho: number | null;
		alto: number | null;
		unidad: string | null;
		idioma: string | null;
	}>;
	bloques: BloqueOcr[];
};

export type MetadataExtraccion = {
	/** ISO-8601 en UTC: cuándo terminó la llamada a Document AI. */
	procesado_en: string;
	/** `true` cuando la imagen no se reconoció como INE. Ahí no vienen campos. */
	quality_alert: boolean;
	engine: string;
	/** `null` cuando la versión del modelo no se fijó en el .env del back. */
	engine_version: string | null;
	/** Solo presente cuando `quality_alert` es `true`. */
	motivo?: string;
};

/**
 * La respuesta completa. Los campos del documento llegan como llaves sueltas en
 * la raíz (`nombre`, `curp`, `clave_elector`…), por eso el index signature: el
 * procesador puede agregar campos sin que haya que tocar este archivo.
 *
 * `domicilio` es el único anidado hoy — Document AI lo devuelve como entidad
 * compuesta, y el back conserva esa jerarquía a propósito porque `estado` y
 * `localidad` existen a la vez en la raíz y dentro de domicilio con
 * significados distintos.
 */
export type ResultadoIne = {
	confianza_minima: number | null;
	_metadata: MetadataExtraccion;
	ocr?: CapaOcr;
	domicilio?: Record<string, CampoExtraido>;
	[campo: string]: CampoExtraido | Record<string, CampoExtraido> | CapaOcr | MetadataExtraccion | number | null | undefined;
};

/** Discrimina un campo hoja de los objetos especiales (`ocr`, `_metadata`…). */
export function esCampoExtraido(valor: unknown): valor is CampoExtraido {
	return (
		typeof valor === 'object' &&
		valor !== null &&
		'value_normalized' in valor &&
		'metodo_confianza' in valor
	);
}

/**
 * Los campos del documento, en orden, ya separados del ruido de la respuesta.
 * Aplana `domicilio` a `domicilio.estado`, etc., que es la misma notación
 * punteada que usa `extractor_field_map.source_path` en el diccionario.
 */
export function camposDe(resultado: ResultadoIne): Array<[string, CampoExtraido]> {
	const salida: Array<[string, CampoExtraido]> = [];
	for (const [llave, valor] of Object.entries(resultado)) {
		if (llave.startsWith('_') || llave === 'ocr' || llave === 'confianza_minima') continue;
		if (esCampoExtraido(valor)) {
			salida.push([llave, valor]);
		} else if (typeof valor === 'object' && valor !== null) {
			for (const [sub, campo] of Object.entries(valor)) {
				if (esCampoExtraido(campo)) salida.push([`${llave}.${sub}`, campo]);
			}
		}
	}
	return salida;
}

/**
 * Etiqueta cualitativa de la confianza, que es lo que Figma muestra en el
 * modal de detalle ("Buena") junto al porcentaje.
 *
 * Los cortes son NUESTROS, no del diccionario: ahí los umbrales viven en
 * `field_definition` por campo y todavía no existen. Cuando existan, esto se
 * reemplaza por lo que diga la configuración activa.
 *
 * Ojo con leer demasiado en la frontera: está medido que dos corridas del mismo
 * documento con la MISMA versión de modelo dan confianzas ligeramente distintas
 * (98.74 vs 97.18 en campos idénticos). Un documento pegado a un corte puede
 * cambiar de etiqueta entre corridas sin que nada haya cambiado de verdad.
 */
export function calidadDe(confianza: number | null): 'Buena' | 'Media' | 'Baja' | null {
	if (confianza === null) return null;
	if (confianza >= 85) return 'Buena';
	if (confianza >= 60) return 'Media';
	return 'Baja';
}
