/** BFF: ¿ya hay una organización con ese nombre? Alimenta el aviso del alta
 *  ("ID encontrado" / "ID asignado"). Solo lee; no crea nada. */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const nombre = (url.searchParams.get('nombre') ?? '').trim();
	if (!nombre) return json({ coincidencias: [], slugPropuesto: '' });

	try {
		const respuesta = await fetch(
			urlNexus(`/organizaciones/coincidencias?nombre=${encodeURIComponent(nombre)}`),
			{ headers: cabecerasConSesion(cookies), signal: AbortSignal.timeout(TIMEOUT_MS) }
		);
		if (!respuesta.ok) return json({ coincidencias: [], slugPropuesto: '' });
		return json(await respuesta.json());
	} catch {
		// El aviso es una ayuda, no una validación: si falla, el alta sigue.
		return json({ coincidencias: [], slugPropuesto: '' });
	}
};
