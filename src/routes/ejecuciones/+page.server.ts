/**
 * Ejecuciones · lo que se puede ejecutar para el expediente elegido (2026-10-30, pedido de Moibe; 2026-11-03: «es la combinación de ambas lo
 * que se ejecuta», se elige también el proceso).
 *
 * Una ejecución junta un EXPEDIENTE VIRTUAL con un PROCESO del motor de reglas. Los procesos corren sobre un tipo de expediente virtual
 * (`tipoExpedienteVirtualId`), así que se elige en orden: el EXPEDIENTE; luego el PROCESO, entre los activos que corren sobre el tipo de alguno
 * de sus expedientes virtuales; y por último el EXPEDIENTE VIRTUAL, solo si el expediente tiene más de uno de ese tipo (si hay uno, es ese).
 * Todo se arma aquí, en el servidor, que es quien tiene el JWT en la cookie.
 *
 * La elección viaja en la dirección (`?expediente=…&proceso=…&virtual=…`), no en un estado de la página: recargar o compartir el enlace
 * deja lo mismo, y cambiar un selector es navegar. Un id que no es de lo que se ofrece se ignora (la pantalla dice que ya no existe), igual
 * que uno de otra organización (HU11); cambiar de expediente borra el proceso y el virtual, y cambiar de proceso borra el virtual.
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

/** Un proceso activo que corre sobre el tipo de algún expediente virtual del expediente elegido. */
export type ProcesoOfrecido = { id: string; nombre: string; tipoNombre: string };
/** Un expediente virtual sobre el que el proceso elegido puede correr (su tipo es el del proceso). */
export type VirtualOfrecido = { id: string; nombre: string; tipoNombre: string };

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const tenant = encodeURIComponent(tenantDe(locals));
	const sesion = { cookies, url };
	const lista = listaDe<Expediente>(await leerDeNexus(`/expedientes/?tenant=${tenant}`, sesion, 'No se pudieron cargar los expedientes.'), 'expedientes');
	const expedientes = lista.map((e) => ({ id: e.id, nombre: e.nombre }));

	const pedido = url.searchParams.get('expediente');
	const elegido = pedido ? (expedientes.find((e) => e.id === pedido) ?? null) : null;
	const base = { expedientes, elegido, expedienteAusente: Boolean(pedido && !elegido) };
	const vacio = { virtuales: 0, procesos: [] as ProcesoOfrecido[], procesoElegido: null as ProcesoOfrecido | null, procesoAusente: false, virtualesDelProceso: [] as VirtualOfrecido[], virtualElegido: null as VirtualOfrecido | null, virtualAusente: false, sinLeer: [] as string[] };
	if (!elegido) return { ...base, ...vacio };

	const detalle = await leerDeNexus(`/expedientes/${encodeURIComponent(elegido.id)}?tenant=${tenant}`, sesion, 'No se pudo cargar el expediente.', 'Ese expediente no existe.');
	const virtuales = listaDe<ExpedienteVirtualResumen>(detalle, 'expedientesVirtuales');

	const sinLeer: string[] = [];
	const pares: { virtual: VirtualOfrecido; proceso: ProcesoOfrecido }[] = [];
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
			if (p.activo) pares.push({ virtual: { id: v.id, nombre: v.nombre, tipoNombre: v.tipo.nombre }, proceso: { id: p.id, nombre: p.nombre, tipoNombre: v.tipo.nombre } });
		}
	});

	// Los procesos distintos que se pueden ofrecer, en el orden en que aparecieron.
	const procesos = [...new Map(pares.map((x) => [x.proceso.id, x.proceso])).values()];
	const procesoPedido = url.searchParams.get('proceso');
	const procesoElegido = procesoPedido ? (procesos.find((x) => x.id === procesoPedido) ?? null) : null;
	// Los virtuales sobre los que corre el proceso elegido; si es uno solo, es ese; si son varios, la persona elige.
	const virtualesDelProceso = procesoElegido ? pares.filter((x) => x.proceso.id === procesoElegido.id).map((x) => x.virtual) : [];
	const virtualPedido = url.searchParams.get('virtual');
	const virtualPedidoValido = virtualPedido ? (virtualesDelProceso.find((x) => x.id === virtualPedido) ?? null) : null;
	const virtualElegido = virtualPedidoValido ?? (virtualesDelProceso.length === 1 ? virtualesDelProceso[0] : null);
	return {
		...base,
		virtuales: virtuales.length,
		procesos,
		procesoElegido,
		procesoAusente: Boolean(procesoPedido && !procesoElegido),
		virtualesDelProceso,
		virtualElegido,
		virtualAusente: Boolean(procesoElegido && virtualPedido && !virtualPedidoValido),
		sinLeer
	};
};
