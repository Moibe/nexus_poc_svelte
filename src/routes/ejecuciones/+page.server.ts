/**
 * Ejecuciones · lo que se puede ejecutar para el expediente elegido (2026-10-30, pedido de Moibe; 2026-11-03: «es la combinación de ambas lo
 * que se ejecuta», se elige también el proceso).
 *
 * Una ejecución junta un EXPEDIENTE con un PROCESO del motor de reglas. Se elige en orden: el EXPEDIENTE y luego el PROCESO, entre TODOS los procesos
 * activos de la organización. Desde el 2026-11-05 (Moibe: quitar los expedientes virtuales: «ahora podremos meter el expediente completo a la ejecución
 * de un proceso») un proceso ya no se limita a nada, así que corre sobre cualquier expediente; hasta ese día la elección llevaba un tercer paso, el
 * EXPEDIENTE VIRTUAL, y los procesos que se ofrecían eran los que corrían sobre el tipo de alguno de los virtuales del expediente.
 * Todo se arma aquí, en el servidor, que es quien tiene el JWT en la cookie.
 *
 * La elección viaja en la dirección (`?expediente=…&proceso=…`), no en un estado de la página: recargar o compartir el enlace deja lo mismo, y
 * cambiar un selector es navegar. Un id que no es de lo que se ofrece se ignora (la pantalla dice que ya no existe o que ya no se ofrece), igual
 * que uno de otra organización (HU11); cambiar de expediente borra el proceso.
 *
 * Los procesos salen de `GET /ejecuciones/procesos`, que nexus_back da a todo rol de la organización aunque no pueda editar procesos (la lista
 * `/procesos` es solo de quien administra y aquí no hace falta). Vienen todos, los activos y los inactivos, y aquí se ofrecen solo los activos. Si no se
 * pueden leer, la pantalla lo dice (`procesosFallo`) en vez de afirmar que no hay ninguno.
 *
 * Desde el 2026-11-03 se puede EJECUTAR (Moibe: «adelante, házlo»): `/api/ejecuciones` corre el proceso con los datos reales y lo guarda en el historial,
 * que esta carga lee (`GET /ejecuciones`, de la más reciente a la más antigua, de 50 en 50). Si el historial no se puede leer, la pantalla lo dice y
 * sigue sirviendo para ejecutar. Cada proceso ofrecido dice si es EJECUTABLE (trae su Resultado con una regla conectada): los de antes de que el
 * Resultado fuera obligatorio no lo traen y se ofrecen, pero con su razón y sin poder ejecutarse. Ejecutar es de quien organiza (`puedeEjecutar`);
 * los demás roles ven el historial y no el botón. nexus_back es quien manda: contesta 403 a cualquier otro rol (Moibe lo confirmó el 2026-11-03: «así está ok»).
 *
 * El historial se puede filtrar por fecha, proceso, estado y persona (2026-11-03, Moibe: «agrega dichos filtros»). Los filtros los aplica nexus_back y los pide la
 * pantalla por `/api/ejecuciones`; esta carga solo trae la primera página SIN filtros y, aparte, lo que se puede elegir para filtrar (`opciones`: los procesos y las
 * personas que aparecen en el historial, de `GET /ejecuciones/filtros`).
 */

import { isRedirect } from '@sveltejs/kit';

import type { Historial } from '$lib/ejecuciones/ejecuciones';
import { SIN_OPCIONES, type OpcionesDeFiltro } from '$lib/ejecuciones/filtros';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import { puedeOrganizar } from '$lib/usuarios/permisos';
import type { PageServerLoad } from './$types';

/** Un proceso activo de la organización: se puede ofrecer para correrlo sobre el expediente elegido. */
export type ProcesoOfrecido = { id: string; nombre: string; ejecutable: boolean };

/** Las primeras 50 ejecuciones del historial. Si no se pueden leer (el servidor falló, o es una instancia sin base), la pantalla lo dice y no se cae. */
async function leerHistorial(tenant: string, sesion: Parameters<typeof leerDeNexus>[1]): Promise<{ historial: Historial; historialFallo: boolean }> {
	try {
		const cuerpo = await leerDeNexus(`/ejecuciones/?tenant=${tenant}&limite=50`, sesion, 'No se pudo cargar el historial de ejecuciones.');
		const ejecuciones = listaDe<Historial['ejecuciones'][number]>(cuerpo, 'ejecuciones');
		return { historial: { ejecuciones, total: typeof cuerpo?.total === 'number' ? cuerpo.total : ejecuciones.length, hayMas: cuerpo?.hayMas === true }, historialFallo: false };
	} catch (e) {
		if (isRedirect(e)) throw e;
		return { historial: { ejecuciones: [], total: 0, hayMas: false }, historialFallo: true };
	}
}

/**
 * Lo que el historial ofrece para filtrar por proceso y por persona (los que aparecen en él). Si no se puede leer, la pantalla sigue sirviendo: los filtros de
 * fecha y de estado no dependen de esto, y los otros dos quedan sin opciones.
 */
async function leerOpciones(tenant: string, sesion: Parameters<typeof leerDeNexus>[1]): Promise<OpcionesDeFiltro> {
	try {
		const cuerpo = await leerDeNexus(`/ejecuciones/filtros?tenant=${tenant}`, sesion, 'No se pudieron cargar las opciones para filtrar el historial.');
		return { procesos: listaDe<OpcionesDeFiltro['procesos'][number]>(cuerpo, 'procesos'), personas: listaDe<OpcionesDeFiltro['personas'][number]>(cuerpo, 'personas') };
	} catch (e) {
		if (isRedirect(e)) throw e;
		return SIN_OPCIONES;
	}
}

/**
 * Los procesos activos de la organización, en el orden en que se crearon. «Activo» sigue la regla de todo el front (`procesoActivo`): lo que no diga `false`
 * expreso lo está. Si no se pueden leer, `fallo` lo dice y la lista queda vacía.
 */
async function leerProcesos(tenant: string, sesion: Parameters<typeof leerDeNexus>[1]): Promise<{ procesos: ProcesoOfrecido[]; fallo: boolean }> {
	try {
		const cuerpo = await leerDeNexus(`/ejecuciones/procesos?tenant=${tenant}`, sesion, 'No se pudieron leer los procesos.');
		const procesos = listaDe<{ id: string; nombre: string; activo?: boolean; ejecutable?: boolean }>(cuerpo, 'procesos')
			.filter((p) => p.activo !== false)
			.map((p) => ({ id: p.id, nombre: p.nombre, ejecutable: p.ejecutable !== false }));
		return { procesos, fallo: false };
	} catch (e) {
		if (isRedirect(e)) throw e;
		return { procesos: [], fallo: true };
	}
}

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const sesion = { cookies, url };
	const [{ historial, historialFallo }, opciones] = await Promise.all([leerHistorial(tenant, sesion), leerOpciones(tenant, sesion)]);
	const puedeEjecutar = puedeOrganizar(locals.usuario);
	const lista = listaDe<{ id: string; nombre: string }>(await leerDeNexus(`/expedientes/?tenant=${tenant}`, sesion, 'No se pudieron cargar los expedientes.'), 'expedientes');
	const expedientes = lista.map((e) => ({ id: e.id, nombre: e.nombre }));

	const pedido = url.searchParams.get('expediente');
	const elegido = pedido ? (expedientes.find((e) => e.id === pedido) ?? null) : null;
	const base = { expedientes, elegido, expedienteAusente: Boolean(pedido && !elegido), historial, historialFallo, opciones, puedeEjecutar };
	const vacio = { procesos: [] as ProcesoOfrecido[], procesoElegido: null as ProcesoOfrecido | null, procesoAusente: false, procesosFallo: false };
	if (!elegido) return { ...base, ...vacio };

	// Los procesos no dependen del expediente (cualquiera corre sobre cualquiera), pero solo se leen cuando ya hay uno elegido: es lo que se ofrece después.
	const { procesos, fallo } = await leerProcesos(tenant, sesion);
	const procesoPedido = url.searchParams.get('proceso');
	const procesoElegido = procesoPedido ? (procesos.find((x) => x.id === procesoPedido) ?? null) : null;
	// Si los procesos no se pudieron leer no se sabe cuáles hay: «ya no se ofrece» sería falso (la pantalla dice, en cambio, que no se pudieron leer).
	return { ...base, procesos, procesoElegido, procesoAusente: !fallo && Boolean(procesoPedido && !procesoElegido), procesosFallo: fallo };
};
