/**
 * Lo que el clasificador hace con un archivo al SUBIRLO a un expediente, dicho a la persona (2026-11-02, Moibe: «los dos clasifican»; sin
 * confianza mínima: basta con ser de ese tipo).
 *
 * Cada archivo se clasifica en la misma llamada con que se sube y nexus_back guarda el tipo documental que reconoció: es lo que dice de qué tipo
 * es cada documento del expediente, y por eso los procesos del motor de reglas lo encuentran por él. Hasta el 2026-11-05 esa clasificación
 * además metía el documento, solo, a los expedientes virtuales que esperaban su tipo; Moibe los quitó («ahora podremos meter el expediente
 * completo a la ejecución de un proceso»), así que aquí ya no hay a dónde «entrar»: solo queda el tipo que se reconoció.
 *
 * Es lógica PURA (sin Svelte ni red) para poder probarla sola.
 */

/** La confianza como se dice en pantalla: «92.5%», «68%». Sin ceros de relleno y con hasta dos decimales. */
export function porcentaje(valor: number): string {
	return `${Number(valor.toFixed(2))}%`;
}

/** La nota fija de la ventana de subir archivos a un expediente. */
export function notaDeSubida(): string {
	return 'Cada archivo se clasifica al subirlo: el clasificador reconoce de qué tipo documental es, y los procesos del motor de reglas usan ese tipo para encontrarlo dentro del expediente.';
}

/**
 * Lo que nexus_back dice de la clasificación de un archivo recién subido (`clasificacion` en la respuesta de
 * `POST /expedientes/{id}/documentos`). Clasificar nunca tumba la subida: si no se pudo, el archivo quedó subido y sin tipo.
 */
export type ClasificacionDeSubida = {
	/** `clasificado` (reconoció un tipo), `sin_tipo` (dijo que no es ninguno), `sin_clasificador` (la organización no tiene tipos activos) o `no_clasificado` (no se pudo). */
	estado: 'clasificado' | 'sin_tipo' | 'sin_clasificador' | 'no_clasificado';
	tipo: { id: string; nombre: string } | null;
	/** De 0 a 100, o `null` si no hay. */
	confianza: number | null;
};

const ESTADOS_DE_CLASIFICACION: readonly string[] = ['clasificado', 'sin_tipo', 'sin_clasificador', 'no_clasificado'];

/**
 * Lee `clasificacion` de la respuesta del servidor sin fiarse de su forma: un servidor más viejo (sin clasificación) o una respuesta rara dan
 * `null` y la pantalla simplemente no dice nada del clasificador, en vez de romperse.
 */
export function leerClasificacion(valor: unknown): ClasificacionDeSubida | null {
	if (typeof valor !== 'object' || valor === null) return null;
	const v = valor as Record<string, unknown>;
	if (typeof v.estado !== 'string' || !ESTADOS_DE_CLASIFICACION.includes(v.estado)) return null;
	const tipo = typeof v.tipo === 'object' && v.tipo !== null ? (v.tipo as Record<string, unknown>) : null;
	return {
		estado: v.estado as ClasificacionDeSubida['estado'],
		tipo: tipo && typeof tipo.id === 'string' && typeof tipo.nombre === 'string' ? { id: tipo.id, nombre: tipo.nombre } : null,
		confianza: typeof v.confianza === 'number' ? v.confianza : null
	};
}

/** Lo que se le dice a la persona de un archivo recién clasificado (una línea bajo su nombre) y de qué color: `bien` reconoció un tipo, `aviso` pide atención, `neutro` solo informa. */
export type LineaDeClasificacion = { texto: string; tono: 'bien' | 'aviso' | 'neutro' };

export function lineaDeClasificacion(c: ClasificacionDeSubida): LineaDeClasificacion {
	switch (c.estado) {
		case 'clasificado': {
			const tipo = c.tipo?.nombre ?? 'un tipo documental';
			const con = c.confianza === null ? '' : ` (${porcentaje(c.confianza)})`;
			return { tono: 'bien', texto: `Clasificado como «${tipo}»${con}.` };
		}
		case 'sin_tipo':
			return { tono: 'neutro', texto: 'El clasificador no lo reconoció como ninguno de los tipos documentales.' };
		case 'sin_clasificador':
			return { tono: 'neutro', texto: 'No se clasificó: tu organización todavía no tiene tipos documentales activos.' };
		default:
			return { tono: 'aviso', texto: 'No se pudo clasificar; quedó subido sin tipo documental.' };
	}
}
