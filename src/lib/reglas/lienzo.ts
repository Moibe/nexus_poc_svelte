/**
 * Lo que comparten las piezas del lienzo del motor de reglas (piloto 1, 2026-10-20).
 */

/** Lo que lleva un nodo de tipo documental: solo cuál es. Sus campos se leen en vivo de la biblioteca. */
export type DatosNodoTipo = { tipoId: string };

/** El tipo de nodo que registra el lienzo (`nodeTypes`). */
export const NODO_TIPO = 'tipo-documental';

/** Con qué se arrastra un tipo desde la paleta hasta el lienzo (`DataTransfer`). */
export const MIME_TIPO_DOCUMENTAL = 'application/x-nexusdoc-tipo-documental';

/**
 * Un proceso corre sobre un expediente, o sea un conjunto de documentos, así que cada tipo documental aparece UNA vez: el nodo
 * «Acta constitutiva» es el acta de ESTE expediente. De ahí que el id del nodo salga del tipo y no se pueda repetir.
 */
export const idNodoDeTipo = (tipoId: string) => `tipo-${tipoId}`;
