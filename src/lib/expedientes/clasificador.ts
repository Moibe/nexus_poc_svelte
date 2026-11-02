/**
 * Lo que el clasificador hace SOLO con los expedientes virtuales, dicho a la persona (2026-11-02, Moibe: «los dos clasifican»; primero pidió un
 * mínimo de 75% de confianza y después lo quitó: «pasa simplemente por ser de ese tipo»).
 *
 * La regla vive en nexus_back (`servicios/expedientes_virtuales.py`): un documento que el clasificador reconoce como de un tipo documental entra
 * solo a los expedientes virtuales de su expediente que esperan ese tipo; si hay dos del mismo tipo, a los dos. No hay confianza mínima.
 *
 * Es lógica PURA (sin Svelte ni red) para poder probarla sola.
 */

/** La confianza como se dice en pantalla: «92.5%», «68%». Sin ceros de relleno y con hasta dos decimales. */
export function porcentaje(valor: number): string {
	return `${Number(valor.toFixed(2))}%`;
}

/** La nota fija de la ventana de subir archivos a un expediente. */
export function notaDeSubida(): string {
	return 'Cada archivo se clasifica al subirlo. Si el clasificador lo reconoce como de un tipo documental, entra solo a los expedientes virtuales de este expediente que esperan ese tipo.';
}

/**
 * «El clasificador metió 2 documentos en expedientes virtuales.» `colocados` es cuántos documentos entraron solos a algún expediente virtual
 * (no a cuántos virtuales). Con cero, nada que decir.
 */
export function avisoDeColocados(colocados: number, cosa: 'archivo' | 'documento' = 'documento'): string {
	if (colocados <= 0) return '';
	return `El clasificador metió ${colocados} ${cosa}${colocados === 1 ? '' : 's'} en expedientes virtuales.`;
}

/** La nota de un expediente virtual abierto: qué mete solo el clasificador y que se puede quitar. */
export function notaDeVirtual(): string {
	return 'Los documentos del expediente que el clasificador reconoce como de alguno de estos tipos entran solos. Los que agregó dicen «Agregado por el clasificador» y se quitan como cualquier otro.';
}

/** La nota de la ventana «Nuevo expediente virtual»: lo ya clasificado entra solo al crearlo. */
export function notaAlCrearVirtual(): string {
	return 'Los documentos del expediente que el clasificador ya reconoció como de alguno de los tipos del esquema entran solos al crearlo. Los demás los marcas tú.';
}

// ── El clasificador al subir ──────────────────────────────────────────────────────────────────────────────────────────────────

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

/** A cuál expediente virtual entró solo el archivo. */
export type VirtualDondeEntro = { id: string; nombre: string; expedienteId: string };

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

/** Lee `expedientesVirtuales` de la respuesta del servidor (a cuáles entró solo el archivo), ignorando lo que no tenga la forma. */
export function leerVirtualesDondeEntro(valor: unknown): VirtualDondeEntro[] {
	if (!Array.isArray(valor)) return [];
	return valor.flatMap((v: unknown) => {
		const o = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
		return o && typeof o.id === 'string' && typeof o.nombre === 'string' ? [{ id: o.id, nombre: o.nombre, expedienteId: typeof o.expedienteId === 'string' ? o.expedienteId : '' }] : [];
	});
}

/** Los nombres entre comillas y con «y»: «A», «A y B», «A, B y C», «A, B y 2 más». */
function nombres(lista: readonly string[]): string {
	const citados = lista.map((n) => `«${n}»`);
	if (citados.length <= 1) return citados.join('');
	if (citados.length <= 3) return `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}`;
	return `${citados.slice(0, 2).join(', ')} y ${citados.length - 2} más`;
}

/** Lo que se le dice a la persona de un archivo recién clasificado (una línea bajo su nombre) y de qué color: `bien` entró a un virtual, `aviso` pide atención, `neutro` solo informa. */
export type LineaDeClasificacion = { texto: string; tono: 'bien' | 'aviso' | 'neutro' };

export function lineaDeClasificacion(c: ClasificacionDeSubida, virtuales: readonly VirtualDondeEntro[]): LineaDeClasificacion {
	switch (c.estado) {
		case 'clasificado': {
			const tipo = c.tipo?.nombre ?? 'un tipo documental';
			const con = c.confianza === null ? '' : ` (${porcentaje(c.confianza)})`;
			if (virtuales.length > 0) return { tono: 'bien', texto: `Clasificado como «${tipo}»${con}. Entró a ${nombres(virtuales.map((v) => v.nombre))}.` };
			return { tono: 'neutro', texto: `Clasificado como «${tipo}»${con}. Ningún expediente virtual de este expediente lo espera.` };
		}
		case 'sin_tipo':
			return { tono: 'neutro', texto: 'El clasificador no lo reconoció como ninguno de los tipos documentales.' };
		case 'sin_clasificador':
			return { tono: 'neutro', texto: 'No se clasificó: tu organización todavía no tiene tipos documentales activos.' };
		default:
			return { tono: 'aviso', texto: 'No se pudo clasificar; quedó subido sin tipo documental.' };
	}
}
