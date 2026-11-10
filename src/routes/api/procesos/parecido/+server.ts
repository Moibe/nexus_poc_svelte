/**
 * BFF: qué tanto se parecen pares de textos, según IA (operador «Parecido a» del motor de reglas, 2026-11-10).
 *
 * Reenvía `{ pares: [{a, b}] }` a `POST /procesos/parecido` de nexus_back, que le pregunta a Gemini y devuelve `{ resultados: [{porcentaje, razon}] }`
 * en el mismo orden. Lo usa el LIENZO para medir los valores de ejemplo; una EJECUCIÓN no pasa por aquí: el BFF de ejecuciones llama al back directo
 * (`medirParecidos` en `$lib/server/parecido`). Los mensajes de 429/502/503 del back están escritos para la persona y se pasan tal cual.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { medirParecidos } from '$lib/server/parecido';
import { tenantDe } from '$lib/server/nexus';

export const POST: RequestHandler = async ({ cookies, locals, request }) => {
	const datos = (await request.json().catch(() => null)) as { pares?: unknown } | null;
	const pares = Array.isArray(datos?.pares)
		? datos.pares.filter((p): p is { a: string; b: string } => typeof p?.a === 'string' && typeof p?.b === 'string' && p.a.trim() !== '' && p.b.trim() !== '')
		: [];
	if (pares.length === 0) return json({ mensaje: 'No hay textos que comparar.' }, { status: 400 });
	const r = await medirParecidos(cookies, tenantDe(locals), pares);
	return r.ok ? json({ resultados: r.resultados }, { headers: { 'Cache-Control': 'no-store' } }) : json({ mensaje: r.mensaje }, { status: r.status });
};
