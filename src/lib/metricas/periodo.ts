/**
 * El periodo de las métricas, tal como viaja al servidor.
 *
 * Se manda como DOS INSTANTES con zona —la medianoche local del primer día y la
 * del día siguiente al último— y no como fechas sueltas. El registro de uso
 * guarda UTC, pero "hoy" para quien mira es el día de SU zona: con fechas, y el
 * servidor leyéndolas como días UTC, todo lo que entraba después de las 18:00
 * en México (que ya es mañana en UTC) quedaba fuera de "hoy" (visto el
 * 2026-09-30). Con instantes cada extremo lleva su propio desfase, así que
 * también cuadra si el periodo cruza un cambio de horario.
 *
 * El periodo es semiabierto, `[desde, hasta)`: incluye el instante `desde` y
 * excluye `hasta`. Para el rango de calendario 30 de sep – 30 de sep en México:
 *
 *     desde = 2026-09-30T00:00:00-06:00
 *     hasta = 2026-10-01T00:00:00-06:00
 *
 * Lo comparten las métricas de las API Keys y las de los Webhooks, y el
 * validador de los dos BFF (`/api/llaves/[id]/metricas` y
 * `/api/webhooks/[id]/metricas`).
 */
import { getLocalTimeZone, toCalendarDate, toZoned, type DateValue } from '@internationalized/date';
import type { DateRange } from 'bits-ui';

export type LimitesDelPeriodo = { desde: string; hasta: string };

/** La medianoche de ese día en esa zona, como ISO 8601 con su desfase. El
 *  `ZonedDateTime` la escribe con el nombre de la zona entre corchetes
 *  (`…-06:00[America/Mexico_City]`), que el servidor no entiende: se quita. */
function medianoche(dia: DateValue, zona: string): string {
	return toZoned(toCalendarDate(dia), zona).toString().replace(/\[.*\]$/, '');
}

/**
 * Los dos extremos del rango del calendario, o `null` si el rango está a
 * medias (hay un solo extremo elegido).
 *
 * @param zona  la del navegador salvo que se indique otra (las pruebas).
 */
export function limitesDelPeriodo(rango: DateRange, zona: string = getLocalTimeZone()): LimitesDelPeriodo | null {
	if (!rango.start || !rango.end) return null;
	const siguiente = toCalendarDate(rango.end).add({ days: 1 });
	return { desde: medianoche(rango.start, zona), hasta: medianoche(siguiente, zona) };
}

/** `2026-09-30T00:00:00-06:00`, `…Z`, con o sin fracción de segundo. */
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/** ¿Son dos instantes ISO 8601 CON zona y el fin va después del inicio? Es lo
 *  que revisan los BFF antes de reenviar, para contestar 400 sin molestar al
 *  servidor. */
export function periodoValido(desde: string, hasta: string): boolean {
	if (!INSTANTE.test(desde) || !INSTANTE.test(hasta)) return false;
	const a = Date.parse(desde);
	const b = Date.parse(hasta);
	return Number.isFinite(a) && Number.isFinite(b) && b > a;
}
