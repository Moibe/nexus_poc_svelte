/**
 * BFF: reenvía la activación de un tipo documental a `POST /procesadores/activar`
 * de nexus_back, que crea (o adopta) su Custom Extractor en Document AI y le
 * sube el esquema armado desde los campos del wizard.
 *
 * Mismo patrón que /api/pipeline/extraer: el navegador pega aquí (mismo origen) y
 * esta capa agrega la llave. La respuesta se devuelve tal cual — trae
 * `procesadorId` y `versionDefault`, que el cliente persiste junto al tipo.
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { TIMEOUT_MS, tenantDe, urlNexus } from '$lib/server/nexus';
import { esBooleano, esTexto, soloCampos } from '$lib/server/seguridad';
import { cabecerasConSesion } from '$lib/server/sesion';

function fallo(mensaje: string, status: number) {
	return json({ mensaje }, { status });
}

/**
 * Un 422 de validación de FastAPI trae `detail` como LISTA (`[{ loc: ['body', 'campos', 1, 'nombre'], msg }]`), no como texto.
 * Hasta el 2026-10-30 eso llegaba a la pantalla como «HTTP 422» a secas (incidencia de QA en staging), sin decir qué revisar.
 * Aquí se traduce al nombre del campo, que es lo único accionable para quien configura el tipo.
 */
function mensajeDeValidacion(errores: unknown[], cuerpo: unknown): string {
	const campos = (cuerpo as { campos?: { nombre?: unknown }[] } | null)?.campos ?? [];
	const loc = (errores[0] as { loc?: unknown[] } | undefined)?.loc ?? [];
	const i = loc[1] === 'campos' && typeof loc[2] === 'number' ? loc[2] : null;
	if (i === null) return 'La configuración de este modelo tiene un dato inválido. Revísala y vuelve a intentar.';
	const nombre = typeof campos[i]?.nombre === 'string' && campos[i].nombre ? `«${campos[i].nombre}»` : `número ${i + 1}`;
	if (loc[3] === 'subcampos') return `El campo ${nombre} tiene un campo de grupo sin nombre. Revísalo y vuelve a intentar.`;
	if (loc[3] === 'nombre') return `El campo ${nombre} no tiene nombre. Revísalo y vuelve a intentar.`;
	return `Revisa el campo ${nombre}: tiene un dato inválido.`;
}

/** Un campo del tipo con solo lo que el back conoce (NEX-551): lo demás que traiga el navegador no se reenvía. Se conserva el ORDEN y la cantidad: el
 *  mensaje de validación de arriba (`mensajeDeValidacion`) señala el campo por su posición. */
const esNumero = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const esListaDeTextos = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const CAMPOS_DE_SUBCAMPO = { nombre: esTexto, tipoDato: esTexto, descripcion: esTexto, valorEstructura: esTexto, obligatorio: esBooleano, valoresLista: esListaDeTextos };
const acotarCampo = (c: unknown): Record<string, unknown> => ({
	...soloCampos(c, { ...CAMPOS_DE_SUBCAMPO, cardinalidad: esTexto }),
	...(Array.isArray((c as { subcampos?: unknown } | null)?.subcampos) ? { subcampos: (c as { subcampos: unknown[] }).subcampos.map((s) => soloCampos(s, CAMPOS_DE_SUBCAMPO)) } : {})
});

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	// La organización sale de la sesión, nunca del navegador (NEX-550): nexus_back comprueba con el JWT que quien pide administre esa organización.
	// Se pide ANTES de leer el cuerpo: `tenantDe` lanza el 403 de quien no pertenece a ninguna.
	const tenant = tenantDe(locals);
	let entrada: unknown;
	try {
		entrada = await request.json();
	} catch {
		return fallo('La petición no traía JSON válido.', 400);
	}
	const crudo = (entrada ?? {}) as Record<string, unknown>;
	// Lista blanca (NEX-551): solo el tipo y sus campos, con la organización de la sesión (si el navegador mandó otra, se descarta).
	const cuerpo = {
		...soloCampos(crudo, { id: esTexto, nombre: esTexto, descripcion: esTexto, instrucciones: esTexto, version: esNumero }),
		...(Array.isArray(crudo.campos) ? { campos: crudo.campos.map(acotarCampo) } : {}),
		tenant
	};

	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus('/procesadores/activar'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify(cuerpo),
			// La activación son tres llamadas a Google, una de ellas con polling.
			// Medida anda en segundos; el timeout generoso es para el día malo.
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const esTimeout = err instanceof Error && err.name === 'TimeoutError';
		return fallo(
			esTimeout
				? 'La activación tardó demasiado y se canceló. El procesador puede haberse creado: reintentar es seguro, no duplica.'
				: 'No se pudo contactar a nexus_back. ¿Está arriba la API en el 8083?',
			504
		);
	}

	let texto: string;
	try {
		texto = await respuesta.text();
	} catch {
		return fallo('La conexión con la API se cortó a media respuesta.', 502);
	}

	let datos: Record<string, unknown>;
	try {
		datos = JSON.parse(texto);
	} catch {
		return fallo(`La API devolvió algo que no es JSON (HTTP ${respuesta.status}).`, 502);
	}

	if (!respuesta.ok) {
		// FastAPI pone el mensaje en `detail`; el cliente espera `mensaje`.
		const detalle =
			typeof datos.detail === 'string'
				? datos.detail
				: Array.isArray(datos.detail)
					? mensajeDeValidacion(datos.detail, cuerpo)
					: `HTTP ${respuesta.status}`;
		return fallo(detalle, respuesta.status);
	}

	return json(datos);
};
