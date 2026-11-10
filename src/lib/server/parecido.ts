/**
 * La llamada a `POST /procesos/parecido` de nexus_back («Parecido a», 2026-11-10), compartida por el BFF del lienzo (`/api/procesos/parecido`) y el de
 * ejecuciones (`/api/ejecuciones`, que mide los valores REALES antes de correr). Parte los pedidos en tandas de lo que el back acepta (`MAX_PARES`).
 */
import type { Cookies } from '@sveltejs/kit';

import type { MedidaDeParecido } from '$lib/reglas/reglas';
import { mensajeDeError, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

/** Lo que acepta el back por petición (`servicios/parecido.py`). */
const MAX_PARES = 20;
const ESPERA_MS = 60_000;

export type Medicion = { ok: true; resultados: MedidaDeParecido[] } | { ok: false; status: number; mensaje: string };

export async function medirParecidos(cookies: Cookies, tenant: string, pares: readonly { a: string; b: string }[]): Promise<Medicion> {
	const resultados: MedidaDeParecido[] = [];
	for (let i = 0; i < pares.length; i += MAX_PARES) {
		const tanda = pares.slice(i, i + MAX_PARES).map((p) => ({ a: p.a.slice(0, 500), b: p.b.slice(0, 500) }));
		let respuesta: Response;
		try {
			respuesta = await fetch(urlNexus('/procesos/parecido'), {
				method: 'POST',
				headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
				body: JSON.stringify({ tenant, pares: tanda }),
				signal: AbortSignal.timeout(ESPERA_MS)
			});
		} catch {
			return { ok: false, status: 504, mensaje: 'No se pudo medir el parecido: el servidor no respondió.' };
		}
		const cuerpo = await respuesta.json().catch(() => null);
		if (!respuesta.ok) return { ok: false, status: respuesta.status, mensaje: mensajeDeError(cuerpo, respuesta.status) };
		const lista = (cuerpo as { resultados?: unknown } | null)?.resultados;
		if (!Array.isArray(lista) || lista.length !== tanda.length) return { ok: false, status: 502, mensaje: 'No se pudo medir el parecido: la respuesta no se entiende.' };
		for (const r of lista as { porcentaje?: unknown; razon?: unknown }[]) {
			const p = typeof r?.porcentaje === 'number' ? Math.max(0, Math.min(100, Math.round(r.porcentaje))) : null;
			if (p === null) return { ok: false, status: 502, mensaje: 'No se pudo medir el parecido: la respuesta no se entiende.' };
			resultados.push({ porcentaje: p, razon: typeof r.razon === 'string' ? r.razon : '' });
		}
	}
	return { ok: true, resultados };
}
