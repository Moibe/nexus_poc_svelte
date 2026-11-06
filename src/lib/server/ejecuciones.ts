/**
 * Ejecuciones · lo que el servidor lee de nexus_back para OFRECER procesos que ejecutar (2026-11-06). Lo piden dos pantallas —la de Ejecuciones y el expediente
 * abierto, donde desde hoy se ejecuta (Moibe: «Ejecuciones ahora existirá dentro del Expediente»)— y falla igual en las dos, así que se lee aquí.
 *
 * Corre en el servidor, que es quien tiene el JWT en la cookie.
 */
import { isRedirect } from '@sveltejs/kit';

import type { ProcesoOfrecido } from '$lib/ejecuciones/ejecuciones';
import { leerDeNexus, listaDe } from '$lib/server/expediente';

/**
 * Los procesos activos de la organización, en el orden en que se crearon. Salen de `GET /ejecuciones/procesos`, que nexus_back da a todo rol de la organización aunque
 * no pueda editar procesos (la lista `/procesos` es solo de quien administra y aquí no hace falta). Vienen todos, los activos y los inactivos, y aquí se ofrecen solo
 * los activos: «activo» sigue la regla de todo el front (`procesoActivo`): lo que no diga `false` expreso lo está. Cada uno dice si es EJECUTABLE (trae su Resultado
 * con una regla conectada).
 *
 * Si no se pueden leer, `fallo` lo dice y la lista queda vacía: la pantalla no debe afirmar que «no hay procesos» cuando lo que pasó es que no se pudieron leer. Una
 * sesión cerrada sí manda al inicio de sesión (la redirección se deja pasar).
 */
export async function leerProcesosOfrecidos(
	tenant: string,
	sesion: Parameters<typeof leerDeNexus>[1]
): Promise<{ procesos: ProcesoOfrecido[]; fallo: boolean }> {
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
