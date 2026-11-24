/**
 * BFF: abrir el ARCHIVO de un documento en el navegador, en una página dada (NEX-608, 2026-11-23: «un renglón que viene de un documento abre ese
 * documento en la página de donde salió el dato»). La búsqueda solo tiene el id del documento; aquí se resuelve dónde está su archivo (lo dice
 * `GET /expedientes/documentos/{id}/datos`, en `documento.rutaRelativa`) y se manda a `/api/archivos/<ruta>#page=N`, que lo sirve `inline`: el
 * visor de PDF del navegador abre esa página. Una imagen no tiene páginas y se abre tal cual. La organización la fija la sesión; un documento de otra
 * responde 404 igual que uno que no existe (HU11).
 */

import { error, redirect, type RequestHandler } from '@sveltejs/kit';

import { leerDeNexus } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';

export const GET: RequestHandler = async ({ params, cookies, locals, url }) => {
	const id = params.id ?? '';
	if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) error(404, 'Ese documento no existe.');
	const datos = await leerDeNexus(
		`/expedientes/documentos/${encodeURIComponent(id)}/datos?tenant=${encodeURIComponent(tenantDe(locals))}`,
		{ cookies, url },
		'No se pudo abrir el documento.',
		'Ese documento no existe.'
	);
	const ruta = (datos as { documento?: { rutaRelativa?: unknown } } | null)?.documento?.rutaRelativa;
	if (typeof ruta !== 'string' || !/^[^/]+\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{64}$/.test(ruta)) error(404, 'Ese documento no tiene archivo que abrir.');
	const pagina = Number.parseInt(url.searchParams.get('pagina') ?? '', 10);
	const fragmento = Number.isInteger(pagina) && pagina > 0 ? `#page=${pagina}` : '';
	redirect(302, `/api/archivos/${ruta.split('/').map(encodeURIComponent).join('/')}${fragmento}`);
};
