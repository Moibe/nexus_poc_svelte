/** BFF: crear un usuario en mi organización (HU06). El back le manda su bienvenida por correo; la
 *  respuesta trae su contraseña temporal SOLO si el correo no salió, así que va con `no-store`. */

import { json, type RequestHandler } from '@sveltejs/kit';

import { esTexto, esTextoONulo, soloCampos } from '$lib/server/seguridad';
import { TIMEOUT_MS, urlNexus } from '$lib/server/nexus';
import { cabecerasConSesion } from '$lib/server/sesion';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const datos = await request.json().catch(() => null);
	if (!datos || typeof datos !== 'object') {
		return json({ codigo: 'datos_invalidos', mensaje: 'Faltan los datos del usuario.' }, { status: 400 });
	}

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/usuarios/'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			// Lista blanca (NEX-551): el rol se pide, sí, pero el back lo valida contra su catálogo; nada de banderas ni de organización escritas por el navegador.
			body: JSON.stringify(
				soloCampos(datos, {
					nombre: esTexto,
					apellidos: esTexto,
					apellidoPaterno: esTexto,
					apellidoMaterno: esTexto,
					email: esTexto,
					telefono: esTextoONulo,
					rol: esTexto
				})
			),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return json({ codigo: 'sin_servidor', mensaje: 'No se pudo contactar al servidor. Intenta de nuevo.' }, { status: 504 });
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) {
		const detalle = cuerpo?.detail;
		const error =
			detalle && typeof detalle === 'object'
				? detalle
				: { codigo: 'error', mensaje: typeof detalle === 'string' ? detalle : `El servidor respondió ${respuesta.status}.` };
		return json(error, { status: respuesta.status, headers: { 'Cache-Control': 'no-store' } });
	}
	return json(cuerpo, { status: 201, headers: { 'Cache-Control': 'no-store' } });
};
