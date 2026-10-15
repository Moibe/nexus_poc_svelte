/**
 * BFF: lo que está pendiente en la bandeja de preparación porque llegó por la
 * API de clientes (`POST /bandeja/` de nexus_back).
 *
 * La bandeja lo consulta cada pocos segundos (ver `sincronizarEntradasApi` en
 * `bandeja.svelte.ts`). El tenant NO lo manda el navegador: lo fija el
 * servidor, desde la organización de la sesión (`tenantDe`), para que nadie pueda pedir la bandeja de otro
 * cliente cambiando un parámetro. Y se reenvía el JWT de la persona: nexus_back comprueba, por su cuenta,
 * que pueda operar en ese tenant (HU11).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const GET: RequestHandler = async ({ cookies, locals, url }) => {
	const tenant = tenantDe(locals);
	// `?estado=descartados` trae lo descartado (el filtro «Descartado» de la bandeja); lo demás, lo pendiente de siempre.
	const estado = url.searchParams.get('estado') === 'descartados' ? 'descartados' : 'pendientes';
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/bandeja/?tenant=${encodeURIComponent(tenant)}&estado=${estado}`), {
			headers: cabecerasConSesion(cookies),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		return json(
			{ mensaje: mensajeDeError(cuerpo, respuesta.status) },
			{ status: respuesta.status }
		);
	}
	return json({ entradas: Array.isArray(cuerpo?.entradas) ? cuerpo.entradas : [] });
};
