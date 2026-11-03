/**
 * Un GRUPO como lo devuelve nexus_back (`/grupos`, 2026-11-03, decisión de Moibe): el nivel de arriba de los expedientes. Varios expedientes
 * viven juntos en un grupo, y cada organización lo usa como quiere (áreas, departamentos, trimestres del año…), así que el nombre genérico
 * es «Grupo». Es UN SOLO nivel: un grupo tiene expedientes y nada más. Se crea antes, en Configuración, y al crear un expediente se elige a
 * cuál pertenece; los expedientes anteriores a los grupos no tienen y se les asigna después. Sin dependencias, para poder probarlo suelto
 * (`node --experimental-strip-types`).
 */

/** Lo que dice la lista de cada grupo. */
export type Grupo = {
	id: string;
	nombre: string;
	/** Cuántos expedientes tiene. */
	totalExpedientes: number;
	creadoPor: string | null;
	creadoEn: string | null;
	actualizadoEn?: string | null;
};

/** El grupo de un expediente, como viene dentro de él (`null`: todavía no tiene). */
export type GrupoDeExpediente = { id: string; nombre: string };

/** El tope del nombre: el mismo que impone nexus_back (`servicios/grupos.py`). */
export const MAX_NOMBRE_GRUPO = 200;

/** «1 expediente», «3 expedientes», «ningún expediente». */
export function expedientesDelGrupo(total: number): string {
	if (total === 0) return 'ningún expediente';
	return `${total} ${total === 1 ? 'expediente' : 'expedientes'}`;
}

/** Lo que se le dice a quien intenta borrar un grupo que todavía tiene expedientes. */
export function motivoDeNoBorrarGrupo(nombre: string, total: number): string {
	return `«${nombre}» tiene ${expedientesDelGrupo(total)}: un grupo con expedientes no se puede borrar. Pasa sus expedientes a otro grupo y vuelve a intentarlo.`;
}

/** Cuánto cambió al renombrar, para el aviso verde. */
export function avisoDeRenombrarGrupo(antes: string, despues: string, cambiado: boolean): { testid: string; titulo: string; cuerpo: string } | null {
	if (!cambiado) return null;
	return { testid: 'grupo-renombrado-aviso', titulo: 'Grupo renombrado', cuerpo: `«${antes}» ahora se llama «${despues}».` };
}
