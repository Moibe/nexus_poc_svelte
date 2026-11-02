/**
 * Lo que el clasificador hace SOLO con los expedientes virtuales, dicho a la persona (2026-11-02, Moibe: «los dos clasifican… el mínimo sea 75% y
 * sea mencionado por ahí»).
 *
 * La regla vive en nexus_back (`servicios/expedientes_virtuales.py`): un documento que el clasificador reconoce como de un tipo documental, con
 * cierta confianza como mínimo, entra solo a los expedientes virtuales de su expediente que esperan ese tipo; si hay dos del mismo tipo, a los dos.
 * El número del mínimo NO se copia aquí: llega en `clasificacionAutomatica.confianzaMinima` de la API y todos estos textos lo reciben como dato.
 * Sin él (un servidor viejo, una respuesta rara) dicen «suficiente confianza» en vez de romperse.
 *
 * Es lógica PURA (sin Svelte ni red) para poder probarla sola.
 */

/**
 * La confianza como se dice en pantalla: «92.5%», «75%». Sin ceros de relleno y con hasta dos decimales, para que 74.99% no se lea como «75%»
 * junto al mínimo de 75%.
 */
export function porcentaje(valor: number): string {
	return `${Number(valor.toFixed(2))}%`;
}

/** «al menos 75% de confianza», o «suficiente confianza» si no se sabe el mínimo. */
export function confianzaNecesaria(minimo?: number): string {
	return typeof minimo === 'number' && Number.isFinite(minimo) ? `al menos ${porcentaje(minimo)} de confianza` : 'suficiente confianza';
}

/** La nota fija de la ventana de subir archivos a un expediente. */
export function notaDeSubida(minimo?: number): string {
	return `Cada archivo se clasifica al subirlo. Si el clasificador lo reconoce con ${confianzaNecesaria(minimo)}, entra solo a los expedientes virtuales de este expediente que esperan ese tipo documental.`;
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
export function notaDeVirtual(minimo?: number): string {
	return `El clasificador agrega solo los documentos del expediente que reconoce como de alguno de estos tipos con ${confianzaNecesaria(minimo)}. Los que agregó dicen «Agregado por el clasificador» y se quitan como cualquier otro.`;
}

/** La nota de la ventana «Nuevo expediente virtual»: lo ya clasificado entra solo al crearlo. */
export function notaAlCrearVirtual(minimo?: number): string {
	return `Los documentos del expediente que el clasificador ya reconoció como de alguno de los tipos del esquema, con ${confianzaNecesaria(minimo)}, entran solos al crearlo. Los demás los marcas tú.`;
}

// ── El clasificador al subir (Moibe, 2026-11-02: «clasifican al subir»; mínimo 75%, y «sea mencionado por ahí») ──────────────────

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
	/** La confianza mínima con que el clasificador puede meterlo SOLO a un expediente virtual (la fija nexus_back). */
	minimo: number;
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
		confianza: typeof v.confianza === 'number' ? v.confianza : null,
		minimo: typeof v.minimo === 'number' ? v.minimo : 0
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
			if (c.confianza !== null && c.confianza < c.minimo) {
				return { tono: 'aviso', texto: `Clasificado como «${tipo}»${con}, por debajo del mínimo de ${porcentaje(c.minimo)} para entrar solo a un expediente virtual.` };
			}
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
