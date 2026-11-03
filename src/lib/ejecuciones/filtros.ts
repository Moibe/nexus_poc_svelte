/**
 * Los filtros del historial de ejecuciones (2026-11-03, Moibe: «agrega dichos filtros»: fecha, regla, estado y persona): qué se puede elegir, cuándo hay
 * algo filtrando y cómo se le pregunta a nexus_back. Es lógica pura (no toca pantalla ni red) para poder probarla sola.
 *
 * Los filtros los aplica EL SERVIDOR (`GET /ejecuciones`): el historial va de 50 en 50, así que filtrar lo que ya se ve dejaría fuera lo que todavía no se
 * ha pedido, y el total no sería el de lo que cumple. Aquí solo se arma la consulta:
 *   · la fecha es un rango de DÍAS en la hora de quien mira (como en el listado de expedientes: extremos incluidos, y solo cuenta con los dos); se manda como
 *     dos instantes, el inicio del primer día y el inicio del día SIGUIENTE al último (que el back no incluye), para que no importe a cuántas horas de UTC
 *     esté quien mira: una ejecución de las 19:00 en México ya es del día siguiente en UTC;
 *   · el proceso (la «regla» de las HU de César) y la persona se eligen entre los que aparecen en el historial (`GET /ejecuciones/filtros`);
 *   · el estado es cómo terminó la ejecución (su caso): las palabras del Resultado las escribe cada organización, el caso es lo que no cambia.
 * Dentro de cada filtro de lista basta con cumplir UNO; entre filtros, todos.
 */
import type { CasoDelResultado } from '$lib/reglas/reglas';

export type FiltrosHistorial = {
	desde: Date | null;
	hasta: Date | null;
	procesos: string[];
	estados: CasoDelResultado[];
	personas: string[];
};

/** Lo que el historial ofrece para filtrar: lo que ESTÁ en él, no el catálogo vivo (un proceso borrado o alguien que ya no está siguen en la foto). */
export type OpcionesDeFiltro = {
	procesos: { id: string; nombre: string }[];
	personas: { id: string; nombre: string | null }[];
};

export const SIN_OPCIONES: OpcionesDeFiltro = { procesos: [], personas: [] };

/** Los estados que se pueden elegir. «Incompleta» es la que terminó sin datos para decidir. */
export const OPCIONES_ESTADO: { valor: CasoDelResultado; etiqueta: string }[] = [
	{ valor: 'si', etiqueta: 'Se cumplió' },
	{ valor: 'no', etiqueta: 'No se cumplió' },
	{ valor: 'sin', etiqueta: 'Incompleta' }
];

/** Lo que se dice de alguien cuyo nombre ya no se puede leer. */
export const PERSONA_SIN_NOMBRE = 'Sin nombre';

/** Lo que se le dice a quien filtró y no le quedó ninguna ejecución: dice que son los filtros, para que no parezca un error. */
export const MENSAJE_SIN_RESULTADOS = 'Ninguna ejecución cumple los filtros elegidos. Quita o cambia alguno e intenta de nuevo.';

export const sinFiltrosHistorial = (): FiltrosHistorial => ({ desde: null, hasta: null, procesos: [], estados: [], personas: [] });

/** ¿Hay algo filtrando? Un rango a medias (solo un extremo) no filtra nada. */
export function hayFiltrosHistorial(f: FiltrosHistorial): boolean {
	return (f.desde !== null && f.hasta !== null) || f.procesos.length > 0 || f.estados.length > 0 || f.personas.length > 0;
}

/** La consulta que se le hace a `/api/ejecuciones` (y de ahí a nexus_back) con estos filtros; vacía si no hay ninguno. */
export function consultaDeFiltros(f: FiltrosHistorial): URLSearchParams {
	const q = new URLSearchParams();
	if (f.desde && f.hasta) {
		q.set('desde', new Date(f.desde.getFullYear(), f.desde.getMonth(), f.desde.getDate()).toISOString());
		// El inicio del día siguiente al último: `Date` ya sabe cuántos días tiene el mes y si ese día dura 23 o 25 horas.
		q.set('hasta', new Date(f.hasta.getFullYear(), f.hasta.getMonth(), f.hasta.getDate() + 1).toISOString());
	}
	for (const id of f.procesos) q.append('proceso', id);
	for (const id of f.personas) q.append('persona', id);
	for (const caso of f.estados) q.append('caso', caso);
	return q;
}

/** «12 de 103 ejecuciones»: cuántas cumplen los filtros, de las que hay. */
export function cuentaDeFiltrado(cumplen: number, total: number): string {
	return `${cumplen} de ${total} ${total === 1 ? 'ejecución' : 'ejecuciones'}`;
}
