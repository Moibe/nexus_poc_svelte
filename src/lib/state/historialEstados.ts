/**
 * La historia de estados de UN documento: por qué pasó, cuándo, y en qué
 * bandeja estaba. Es lo que muestra "Estado" en la píldora del Pipeline
 * (2026-10-01, a pedido con captura de Figma: "todos los cambios de estado que
 * ha tenido ese documento, o sea desde que fue subido, procesado, etc").
 *
 * ## Esto se REGISTRA, no se deduce
 *
 * Hasta hoy un documento guardaba solo su estado ACTUAL, así que su historia no
 * existía en ningún lado y no había manera de reconstruirla después: cuando un
 * documento llega a "Listo" ya no queda rastro de cuándo se calculó su huella
 * ni de cuánto esperó en la cola. Por eso cada cambio se anota en el momento en
 * que ocurre, con la hora del reloj del navegador.
 *
 * La ETIQUETA se congela al anotar, y es a propósito: "Clasificado: INE" o
 * "Procesando INE" dependen del tipo detectado, que puede cambiar después. Lo
 * que se quiere contar es lo que el documento decía EN ESE MOMENTO.
 *
 * ## Qué tan completa es
 *
 * Cubre toda la vida del documento DENTRO DEL NAVEGADOR: desde que entra a la
 * bandeja —subido a mano o recibido por la API— hasta que el pipeline termina
 * con él. El pipeline corre aquí, así que estas horas son las de verdad.
 *
 * Lo que NO cubre, y hay que saberlo: lo que pasó ANTES de que el navegador se
 * enterara. De un documento que llegó por la API, el servidor sabe cuándo lo
 * recibió —y esa hora sí se usa, viene en `recibidoEn`—, pero cualquier paso
 * intermedio del lado del servidor no está aquí. Tampoco sobrevive a recargar
 * la página: el pipeline vive en memoria. La historia duradera será la tabla de
 * eventos del DBA (`audit_event`), que todavía no existe; es la misma que hace
 * falta para encender el botón "Eventos", que sigue apagado. Cuando exista,
 * este módulo se alimenta de ella y la pantalla no cambia.
 */

export type FaseDocumento = 'bandeja' | 'pipeline';

export type EventoDeEstado = {
	/** El estado crudo, tal como lo guarda el documento (`listo`, `procesado`…).
	 *  Se conserva además de la etiqueta para poder filtrar o colorear sin
	 *  volver a interpretar un texto. */
	estado: string;
	/** Lo que se le dice a la persona, congelado en el momento del cambio. */
	etiqueta: string;
	/** En qué bandeja estaba el documento cuando pasó. */
	fase: FaseDocumento;
	/** El mismo tono que usa el renglón: verde cuando salió bien, rojo cuando
	 *  no, gris mientras va en camino. El diseño pinta todos los puntos verdes,
	 *  pero sus frames solo dibujan un recorrido feliz; un fallo en verde sería
	 *  mentira. */
	tono: 'ok' | 'error' | 'proceso';
	en: Date;
};

/** Los estados de la bandeja, dichos en palabras. Son los mismos que ya
 *  aparecen en su renglón; aquí se nombran para la línea de tiempo. */
export const ETIQUETA_BANDEJA: Record<string, { texto: string; tono: 'ok' | 'error' | 'proceso' }> = {
	en_cola: { texto: 'En espera de lectura', tono: 'proceso' },
	subiendo: { texto: 'Calculando huella y verificando', tono: 'proceso' },
	listo: { texto: 'Listo para procesar', tono: 'ok' },
	// Duplicado NO es un error: se puede mandar a procesar a propósito, y así lo
	// contempla el diseño. Es un aviso.
	duplicado: { texto: 'Duplicado detectado', tono: 'proceso' },
	protegido: { texto: 'Protegido con contraseña', tono: 'error' },
	corrupto: { texto: 'Archivo ilegible', tono: 'error' }
};

/**
 * Anota un cambio de estado, si de verdad es un cambio.
 *
 * Un mismo estado repetido seguido NO se anota dos veces: pasa de verdad (una
 * revisión que vuelve a marcar `pendiente_revision`, un reintento que vuelve a
 * `fallido`) y dos renglones idénticos seguidos no le dicen nada a nadie. Dos
 * estados distintos con la MISMA hora sí se anotan los dos: el pipeline cambia
 * de estado más rápido que el minuto que se muestra.
 */
export function anotarEstado(
	historial: EventoDeEstado[],
	evento: {
		estado: string;
		etiqueta: string;
		fase: FaseDocumento;
		tono: 'ok' | 'error' | 'proceso';
		en?: Date;
	}
): void {
	const ultimo = historial[historial.length - 1];
	if (ultimo && ultimo.estado === evento.estado && ultimo.fase === evento.fase) return;
	historial.push({
		estado: evento.estado,
		etiqueta: evento.etiqueta,
		fase: evento.fase,
		tono: evento.tono,
		en: evento.en ?? new Date()
	});
}

/** El primer renglón de la historia: cómo entró el documento. Lo dice el
 *  ORIGEN, que es lo único que de verdad lo distingue — y para lo que llegó por
 *  la API la hora es la del servidor, no la de este navegador. */
export function eventoDeEntrada(origen: 'Manual' | 'API REST', en: Date): EventoDeEstado {
	return {
		estado: 'recibido',
		etiqueta: origen === 'API REST' ? 'Recibido por la API' : 'Subido desde el equipo',
		fase: 'bandeja',
		tono: 'ok',
		en
	};
}
