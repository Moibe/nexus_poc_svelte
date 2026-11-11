/**
 * BFF: ejecutar un proceso sobre un expediente (POST) y pedir más renglones del historial (GET) (2026-11-03, Moibe: «adelante, házlo»).
 *
 * POST es donde se EJECUTA, y se ejecuta AQUÍ, en el servidor del front, no en el navegador ni en nexus_back: el navegador solo dice QUÉ
 * (`expedienteId` y `procesoId`), el resultado no lo puede inventar nadie. Tres pasos:
 *
 *   1. `GET /ejecuciones/preparar` a nexus_back: el proceso con su dibujo, los tipos documentales que usa y los valores REALES de los documentos del
 *      expediente (o los duplicados). El back ya comprobó que el proceso es de la organización, está activo y trae su Resultado con una regla
 *      conectada; cada cosa que falta vuelve con su `codigo`.
 *   2. `correr` (`$lib/reglas/ejecutar`): la MISMA lógica del lienzo con esos valores en lugar de los de ejemplo. Con duplicados, o una regla incompleta,
 *      NO se corre: no hay con qué decidir, y eso no se guarda (409 con su `codigo` y, con duplicados, cuáles).
 *   3. `POST /ejecuciones` a nexus_back: guarda lo que salió en el historial. El back toma los nombres y el dibujo del proceso de su base y comprueba que
 *      la palabra del Resultado sea la del proceso; si el proceso cambió mientras tanto, 409 `proceso_cambio` y hay que volver a ejecutar.
 *
 * Desde el 2026-11-05 (Moibe: quitar los expedientes virtuales) se ejecuta sobre el EXPEDIENTE completo: ya no viaja `virtualId`, ni a `preparar` ni al
 * historial, y un proceso corre sobre cualquier expediente de la organización (ya no hay `no_corre_aqui`). Si un navegador con la pantalla vieja todavía
 * manda `virtualId`, se ignora.
 *
 * El tenant lo fija el servidor desde la sesión (`tenantDe`), nunca el navegador, y se reenvía el JWT de la persona para que nexus_back lo compruebe
 * (HU11). Quién puede ejecutar lo decide el back (`roles.PUEDEN_ORGANIZAR`): a los demás roles responde 403 `sin_permiso` y aquí se reenvía tal cual.
 *
 * El historial de un expediente se lee en el `load` de `/expediente/[id]` (que ya corre en el servidor); el GET de aquí solo trae las páginas siguientes («Ver más»).
 */

import { json, type RequestHandler } from '@sveltejs/kit';

import { correr, paresPorMedir, parecidosMedidos, type Preparacion } from '$lib/reglas/ejecutar';
import type { Parecidos } from '$lib/reglas/reglas';
import { codigoDe } from '$lib/server/expediente';
import { mensajeDeError, tenantDe, urlNexus } from '$lib/server/nexus';
import { medirParecidos } from '$lib/server/parecido';
import { cabecerasConSesion } from '$lib/server/sesion';

const ESPERA_MS = 60_000;

const sinRespuesta = () => json({ mensaje: 'No se pudo contactar a nexus_back.' }, { status: 504 });

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
	const datos = await request.json().catch(() => null);
	const { expedienteId, procesoId } = (datos ?? {}) as Record<string, unknown>;
	if ([expedienteId, procesoId].some((x) => typeof x !== 'string' || !x)) {
		return json({ mensaje: 'Elige el expediente y el proceso que quieres ejecutar.' }, { status: 400 });
	}
	const tenant = tenantDe(locals);

	// 1 · Preparar: el proceso y los datos reales.
	let preparada: Response;
	try {
		const consulta = new URLSearchParams({ tenant, expediente: expedienteId as string, proceso: procesoId as string });
		preparada = await fetch(urlNexus(`/ejecuciones/preparar?${consulta}`), { headers: cabecerasConSesion(cookies), signal: AbortSignal.timeout(ESPERA_MS) });
	} catch {
		return sinRespuesta();
	}
	const preparacion = await preparada.json().catch(() => null);
	if (!preparada.ok) return json({ mensaje: mensajeDeError(preparacion, preparada.status), codigo: codigoDe(preparacion) }, { status: preparada.status });

	// 2 · Medir con IA los «Parecido a» (2026-11-10): con los valores REALES, antes de correr. Si la IA no responde NO se ejecuta: guardar la corrida como
	// «faltan datos» culparía a los documentos de algo que no les falta.
	let medidos: Parecidos = {};
	try {
		const pares = paresPorMedir(preparacion as Preparacion);
		if (pares.length > 0) {
			const m = await medirParecidos(cookies, tenant, pares);
			if (!m.ok) return json({ mensaje: `No se ejecutó: ${m.mensaje}`, codigo: 'parecido_no_disponible' }, { status: m.status === 429 ? 429 : 502 });
			medidos = parecidosMedidos(pares, m.resultados);
		}
	} catch (e) {
		console.error('No se pudieron preparar los «Parecido a» del proceso', e);
		return json({ mensaje: 'No se pudo ejecutar el proceso: lo que entregó nexus_back no se entiende.' }, { status: 502 });
	}

	// 3 · Correr: la lógica del lienzo con los valores reales.
	let salida: ReturnType<typeof correr>;
	try {
		salida = correr(preparacion as Preparacion, medidos);
	} catch (e) {
		console.error('No se pudo correr el proceso', e);
		return json({ mensaje: 'No se pudo ejecutar el proceso: lo que entregó nexus_back no se entiende.' }, { status: 502 });
	}
	if (!salida.corre) {
		const { codigo, mensaje } = salida.motivo;
		return json({ mensaje, codigo, ...(salida.motivo.codigo === 'duplicados' ? { duplicados: salida.motivo.duplicados } : {}) }, { status: 409 });
	}

	// 4 · Guardar en el historial.
	let guardada: Response;
	try {
		guardada = await fetch(urlNexus('/ejecuciones/'), {
			method: 'POST',
			headers: cabecerasConSesion(cookies, { 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				tenant,
				expedienteId,
				procesoId,
				procesoRevision: (preparacion as Preparacion).proceso.revision,
				resultado: salida.corrida.resultado,
				valoresFinales: salida.corrida.valoresFinales,
				detalle: salida.corrida.detalle
			}),
			signal: AbortSignal.timeout(ESPERA_MS)
		});
	} catch {
		return sinRespuesta();
	}
	const cuerpo = await guardada.json().catch(() => null);
	if (!guardada.ok) return json({ mensaje: mensajeDeError(cuerpo, guardada.status), codigo: codigoDe(cuerpo) }, { status: guardada.status });
	return json(cuerpo, { status: 201, headers: { 'Cache-Control': 'no-store' } });
};

/**
 * El historial: más renglones (`?expediente=<id>&antes=<id de la última que ya se vio>&limite=`). Desde el 2026-11-07 el historial se ve DENTRO de cada expediente
 * (Moibe: «quita ejecuciones de la sección aparte»), así que lo único que se pide es el de un expediente. Lo demás que traiga la dirección se descarta (también
 * los filtros de la pantalla vieja: fecha, proceso, estado y persona; nexus_back los sigue entendiendo, pero ya nadie los manda), y el tenant es el de la sesión.
 */
export const GET: RequestHandler = async ({ cookies, locals, url }) => {
	const consulta = new URLSearchParams({ tenant: tenantDe(locals) });
	for (const clave of ['expediente', 'limite', 'antes']) {
		const valor = url.searchParams.get(clave);
		if (valor) consulta.set(clave, valor);
	}
	let respuesta: Response;
	try {
		respuesta = await fetch(urlNexus(`/ejecuciones/?${consulta}`), { headers: cabecerasConSesion(cookies), signal: AbortSignal.timeout(ESPERA_MS) });
	} catch {
		return sinRespuesta();
	}
	const cuerpo = await respuesta.json().catch(() => null);
	if (!respuesta.ok) return json({ mensaje: mensajeDeError(cuerpo, respuesta.status) }, { status: respuesta.status });
	return json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
};
