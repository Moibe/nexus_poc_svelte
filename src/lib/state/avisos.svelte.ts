/**
 * Los avisos verdes que salen abajo a la izquierda y se van solos (Figma, «Documento enviado a descartados» y «Documento
 * conservado correctamente»). Son de ÉXITO y no piden nada: lo que sí exige una respuesta va en un panel
 * (`ConfirmarAccion`).
 *
 * Es un estado compartido y no una prop porque quien avisa (el descarte de la bandeja) y quien pinta
 * (`AvisosFlotantes`, montado una vez en el layout) no tienen ningún componente en común.
 */

export type Aviso = { id: number; titulo: string; cuerpo: string };

export const avisos = $state<Aviso[]>([]);

const DURACION_MS = 6000;
let contador = 0;

/** Muestra un aviso de éxito y lo quita solo a los pocos segundos. */
export function avisarExito(titulo: string, cuerpo: string, duracionMs: number = DURACION_MS): void {
	contador += 1;
	const id = contador;
	avisos.push({ id, titulo, cuerpo });
	setTimeout(() => quitarAviso(id), duracionMs);
}

export function quitarAviso(id: number): void {
	const i = avisos.findIndex((a) => a.id === id);
	if (i !== -1) avisos.splice(i, 1);
}
