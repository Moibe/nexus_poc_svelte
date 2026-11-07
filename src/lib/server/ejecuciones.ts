/**
 * Ejecuciones · lo que el servidor lee de nexus_back para ejecutar procesos desde el expediente y para enseñar su historial. Desde el 2026-11-07 las
 * Ejecuciones ya no son una sección aparte (Moibe: «quita ejecuciones de la sección aparte»): viven DENTRO del expediente, que es el único que las pide.
 *
 * Corre en el servidor, que es quien tiene el JWT en la cookie.
 */
import { isRedirect } from '@sveltejs/kit';

import type { Historial, ProcesoOfrecido } from '$lib/ejecuciones/ejecuciones';
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

/**
 * Las primeras 50 ejecuciones de UN expediente, de la más reciente a la más antigua (`GET /ejecuciones/?expediente=`; las siguientes se piden con «Ver más» por
 * `/api/ejecuciones`). Las ven todos los roles que ven el expediente. Si no se pueden leer (el servidor falló, o es una instancia sin base), `fallo` lo dice y el
 * expediente sigue sirviendo: el historial es un complemento, no puede tumbar la pantalla. Una sesión cerrada sí manda al inicio de sesión.
 *
 * `expedienteId` va SIN codificar: aquí se codifica.
 */
export async function leerHistorialDeExpediente(
	tenant: string,
	expedienteId: string,
	sesion: Parameters<typeof leerDeNexus>[1]
): Promise<{ historial: Historial; fallo: boolean }> {
	try {
		const cuerpo = await leerDeNexus(
			`/ejecuciones/?tenant=${tenant}&expediente=${encodeURIComponent(expedienteId)}&limite=50`,
			sesion,
			'No se pudo cargar el historial de ejecuciones.'
		);
		const ejecuciones = listaDe<Historial['ejecuciones'][number]>(cuerpo, 'ejecuciones');
		return { historial: { ejecuciones, total: typeof cuerpo?.total === 'number' ? cuerpo.total : ejecuciones.length, hayMas: cuerpo?.hayMas === true }, fallo: false };
	} catch (e) {
		if (isRedirect(e)) throw e;
		return { historial: { ejecuciones: [], total: 0, hayMas: false }, fallo: true };
	}
}
