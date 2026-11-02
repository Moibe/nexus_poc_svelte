/**
 * Lo que la pantalla de Ejecuciones sabe de una ejecución ya guardada (2026-11-03): sus tipos y cómo se escribe cada cosa. Lo que SALE de correr un
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
	virtual: { id: string; nombre: string; tipoNombre: string | null };
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

/** A dónde lleva el expediente virtual de una ejecución. */
export const rutaDelVirtual = (expedienteId: string, virtualId: string) => `/expediente/${encodeURIComponent(expedienteId)}/virtual/${encodeURIComponent(virtualId)}`;
