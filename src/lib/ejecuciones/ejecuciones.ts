/**
 * Lo que el expediente sabe de una ejecución ya guardada (2026-11-03; antes lo sabía la pantalla de Ejecuciones, que se quitó el 2026-11-07): sus tipos y cómo se escribe cada cosa. Lo que SALE de correr un
 * proceso vive en `$lib/reglas/ejecutar`; esto es lo que nexus_back devuelve después de guardarlo (`GET /ejecuciones`) y cómo se enseña.
 */
import type { CasoDelResultado } from '$lib/reglas/reglas';
import type { DetalleDeCorrida, Duplicado, ValorFinalDeCorrida } from '$lib/reglas/ejecutar';

/** Un renglón del historial: lo de la tabla, sin la foto pesada. */
export type EjecucionResumen = {
	id: string;
	ejecutadaEn: string;
	ejecutadaPor: { id: string; nombre: string | null };
	expediente: { id: string; nombre: string };
	/**
	 * El expediente virtual sobre el que se corrió, SOLO en las ejecuciones VIEJAS (de antes del 2026-11-05, cuando Moibe quitó los expedientes
	 * virtuales); `null` en las nuevas, que se ejecutan sobre el expediente completo. Es un dato de la foto: el historial es inmutable y sigue
	 * diciendo lo que se corrió, pero la pantalla del virtual ya no existe, así que solo se nombra, sin enlace.
	 */
	virtual: { id: string; nombre: string; tipoNombre: string | null } | null;
	proceso: { id: string; nombre: string; revision: number };
	resultado: { caso: CasoDelResultado; texto: string };
	estado: 'completa' | 'incompleta';
};

/** Una ejecución abierta: el resumen, sus valores finales, cómo salió cada regla y el proceso tal como estaba. */
export type EjecucionCompleta = EjecucionResumen & {
	valoresFinales: ValorFinalDeCorrida[];
	detalle: DetalleDeCorrida;
	definicion: unknown;
};

export type Historial = { ejecuciones: EjecucionResumen[]; total: number; hayMas: boolean };

/** Un proceso activo de la organización: se puede ofrecer para correrlo sobre un expediente. `ejecutable` dice si trae su Resultado con una regla conectada. */
export type ProcesoOfrecido = { id: string; nombre: string; ejecutable: boolean };

/**
 * Por qué un proceso ofrecido todavía no se puede ejecutar, con las palabras que se le dicen a la persona; `null` si sí se puede (o si no hay proceso elegido).
 * Los procesos de antes de que el Resultado fuera obligatorio (2026-11-03) no lo traen —o lo traen sin ninguna regla conectada—: se siguen ofreciendo, pero no corren.
 */
export function motivoSinEjecutar(proceso: Pick<ProcesoOfrecido, 'nombre' | 'ejecutable'> | null | undefined): string | null {
	if (!proceso || proceso.ejecutable) return null;
	return `«${proceso.nombre}» todavía no se puede ejecutar: no tiene su nodo de Resultado, o su Resultado no tiene ninguna regla conectada. Ábrelo en el motor de reglas (Configuración › Procesos): agrega el Resultado o conéctale una regla para poder ejecutarlo.`;
}

/** Lo que contesta `POST /api/ejecuciones` cuando NO se ejecutó: por qué (`codigo`), cómo se le dice a la persona y, con duplicados, cuáles. */
export type NoSeEjecuto = { mensaje: string; codigo?: string; duplicados?: Duplicado[] };

/** «03/11/2026 14:35», en la hora de quien mira. Una fecha ausente o ilegible es «—». */
export function fechaYHora(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	const dos = (n: number) => String(n).padStart(2, '0');
	return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Qué quiso decir la palabra del Resultado, en una frase (la palabra la escribe la organización; esto es lo que significa que haya salido). */
export const TEXTO_DEL_CASO: Record<CasoDelResultado, string> = {
	si: 'La regla se cumplió.',
	no: 'La regla no se cumplió.',
	sin: 'Faltaron datos para decidirlo: la ejecución quedó incompleta.'
};

/** Cómo se llama el estado de una ejecución. */
export const ETIQUETA_DE_ESTADO: Record<EjecucionResumen['estado'], string> = { completa: 'Completa', incompleta: 'Incompleta' };

/** Los colores de la palabra del Resultado: verde si se cumplió, rojo si no, ámbar si faltaron datos. Clases de Tailwind completas (no se arman). */
export const CLASE_DEL_CASO: Record<CasoDelResultado, string> = {
	si: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
	no: 'bg-destructive/10 text-destructive',
	sin: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
};

/** El valor de un valor final como se enseña: el valor, o por qué no hay. */
export function valorParaVer(f: Pick<ValorFinalDeCorrida, 'estado' | 'valor'>): string {
	if (f.estado === 'listo') return f.valor ?? '';
	return f.estado === 'sin_valores' ? 'Sin valor (faltó el dato)' : 'Sin conectar';
}

