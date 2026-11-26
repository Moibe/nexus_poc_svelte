/**
 * BFF: corregir a mano un dato extraído de un documento (HU073, 2026-11-26) → `POST /expedientes/documentos/{id}/datos/correcciones` de nexus_back. La corrección queda
 * aparte, con quién y cuándo; el dato extraído no se toca. Devuelve el campo como queda.
 *
 * El `tenant` lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador (HU11), y se reenvía el JWT de la persona: nexus_back exige que su rol pueda
 * organizar (403 para quien solo consulta; la guardia de rutas ya lo corta antes). Un documento de otra organización contesta 404 igual que uno que no existe.
 * Del cuerpo solo pasan `ruta`, `valor` y `motivo`, y con su forma: lo demás se ignora.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { reenviarANexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

const MAX_RUTA = 300;
const MAX_VALOR = 4000;
const MAX_MOTIVO = 500;

export const POST: RequestHandler = async ({ params, cookies, locals, request }) => {
	const cuerpo = (await request.json().catch(() => null)) as { ruta?: unknown; valor?: unknown; motivo?: unknown } | null;
	const ruta = typeof cuerpo?.ruta === 'string' ? cuerpo.ruta : '';
	const valor = typeof cuerpo?.valor === 'string' ? cuerpo.valor.trim() : '';
	const motivo = typeof cuerpo?.motivo === 'string' ? cuerpo.motivo.trim() : '';
	if (!ruta || ruta.length > MAX_RUTA) return json({ mensaje: 'Falta el campo que se corrige.' }, { status: 400 });
	if (!valor || valor.length > MAX_VALOR) return json({ mensaje: 'Escribe el valor como aparece en el documento.' }, { status: 400 });
	if (motivo.length > MAX_MOTIVO) return json({ mensaje: `El motivo no puede pasar de ${MAX_MOTIVO} caracteres.` }, { status: 400 });
	return reenviarANexus(cookies, 'POST', `/expedientes/documentos/${encodeURIComponent(params.id ?? '')}/datos/correcciones`, {
		tenant: tenantDe(locals),
		ruta,
		valor,
		motivo: motivo || null
	});
};
