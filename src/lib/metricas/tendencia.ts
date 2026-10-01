/**
 * La tendencia de una cifra contra el periodo anterior: "▴ 12% vs. semana
 * anterior". Compartida por los paneles de "Métricas de consumo" de las API
 * Keys y de los Webhooks, que dibujan las cifras igual.
 *
 * El servidor compara contra el periodo anterior de la MISMA duración. El
 * rótulo dice "semana" solo cuando el periodo dura 7 días, que es lo que
 * dibuja el diseño; con cualquier otra duración dice "periodo anterior".
 *
 * Sin dato anterior no se inventa una tendencia: devuelve `null` y la cifra se
 * muestra sola.
 */
import type { CalendarDate } from '@internationalized/date';
import type { DateRange } from 'bits-ui';

export type Tendencia = { texto: string; buena: boolean } | null;

export function rotuloAnterior(rango: DateRange): string {
	if (!rango.start || !rango.end) return 'periodo anterior';
	const dias = (rango.end as CalendarDate).compare(rango.start as CalendarDate) + 1;
	return dias === 7 ? 'semana anterior' : 'periodo anterior';
}

/**
 * @param pp            comparar en PUNTOS porcentuales (para un % de éxito o de
 *                      error), no en % del valor: "0.3 pp", como el diseño.
 * @param menorEsMejor  errores y latencias: si bajan, es bueno (verde).
 */
export function tendencia(
	actual: number | null,
	anterior: number | null,
	rotulo: string,
	opciones: { pp?: boolean; menorEsMejor?: boolean } = {}
): Tendencia {
	if (actual === null || anterior === null) return null;
	let delta: number;
	let texto: string;
	if (opciones.pp) {
		delta = actual - anterior;
		texto = `${Math.abs(delta).toFixed(1)} pp`;
	} else {
		if (anterior === 0) return null;
		delta = ((actual - anterior) / anterior) * 100;
		texto = `${Math.abs(Math.round(delta))}%`;
	}
	if (Math.abs(delta) < 0.05) return { texto: `sin cambio vs. ${rotulo}`, buena: true };
	const sube = delta > 0;
	return {
		texto: `${sube ? '▴' : '▾'} ${texto} vs. ${rotulo}`,
		buena: opciones.menorEsMejor ? !sube : sube
	};
}
