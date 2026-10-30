/**
 * Ejecuciones · lo que se puede ejecutar para el expediente elegido (2026-10-30, pedido de Moibe).
 *
 * Una ejecución junta un EXPEDIENTE VIRTUAL con un PROCESO del motor de reglas. Los procesos corren sobre un tipo de expediente virtual
 * (`tipoExpedienteVirtualId`), así que para un expediente las cosas ejecutables son los pares «expediente virtual × proceso activo de su
 * tipo». Se arman aquí, en el servidor, que es quien tiene el JWT en la cookie.
 *
 * El expediente elegido viaja en la dirección (`?expediente=<id>`), no en un estado de la página: recargar o compartir el enlace deja
 * lo mismo, y cambiar el selector es navegar. Un id que no es de la lista de la organización se ignora (la pantalla dice que ya no
 * existe), igual que uno de otra organización (HU11).
 *
 * Los procesos de cada virtual salen de su propio detalle (`procesos`), que nexus_back da a todo rol que pueda ver el virtual aunque no
 * pueda editar procesos: la lista `/procesos` es solo de quien administra y aquí no hace falta. Un proceso inactivo no se ofrece.
 *
 * El historial de ejecuciones todavía no existe en el servidor: la pantalla enseña su tabla vacía.
 */

import { isRedirect } from '@sveltejs/kit';

import type { Expediente, ExpedienteVirtualResumen } from '$lib/expedientes/expedientes';
import { leerDeNexus, listaDe } from '$lib/server/expediente';
import { tenantDe } from '$lib/server/nexus';
import type { PageServerLoad } from './$types';

/** Una cosa ejecutable: un expediente virtual y un proceso activo que corre sobre su tipo. */
export type Ejecutable = {
	virtualId: string;
	virtualNombre: string;
	tipoNombre: string;
	procesoId: string;
	procesoNombre: string;
};

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const sesion = { cookies, url };
	const lista = listaDe<Expediente>(await leerDeNexus(`/expedientes/?tenant=${tenant}`, sesion, 'No se pudieron cargar los expedientes.'), 'expedientes');
	const expedientes = lista.map((e) => ({ id: e.id, nombre: e.nombre }));

	const pedido = url.searchParams.get('expediente');
	const elegido = pedido ? (expedientes.find((e) => e.id === pedido) ?? null) : null;
	const base = { expedientes, elegido, expedienteAusente: Boolean(pedido && !elegido) };
	if (!elegido) return { ...base, virtuales: 0, ejecutables: [] as Ejecutable[], sinLeer: [] as string[] };

	const detalle = await leerDeNexus(`/expedientes/${encodeURIComponent(elegido.id)}?tenant=${tenant}`, sesion, 'No se pudo cargar el expediente.', 'Ese expediente no existe.');
	const virtuales = listaDe<ExpedienteVirtualResumen>(detalle, 'expedientesVirtuales');

	const sinLeer: string[] = [];
	const ejecutables: Ejecutable[] = [];
	const detalles = await Promise.all(
		virtuales.map((v) =>
			leerDeNexus(`/expedientes/${encodeURIComponent(elegido.id)}/virtuales/${encodeURIComponent(v.id)}?tenant=${tenant}`, sesion, 'No se pudieron leer los procesos.').catch((e) => {
				if (isRedirect(e)) throw e;
				return null;
			})
		)
	);
	virtuales.forEach((v, i) => {
		const procesos = detalles[i] === null ? null : listaDe<{ id: string; nombre: string; activo: boolean }>(detalles[i], 'procesos');
		if (procesos === null) {
			sinLeer.push(v.nombre);
			return;
		}
		for (const p of procesos) {
			if (p.activo) ejecutables.push({ virtualId: v.id, virtualNombre: v.nombre, tipoNombre: v.tipo.nombre, procesoId: p.id, procesoNombre: p.nombre });
		}
	});
	return { ...base, virtuales: virtuales.length, ejecutables, sinLeer };
};
