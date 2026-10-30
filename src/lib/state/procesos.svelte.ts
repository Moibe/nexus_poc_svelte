/**
 * Los PROCESOS del motor de reglas de la organización (2026-10-20): leerlos, guardarlos y borrarlos en nexus_back
 * (`/procesos`, a través del BFF `/api/procesos`).
 *
 * Un proceso guardado es su `nombre`, su `descripcion` y el dibujo del lienzo (`nodos` y `aristas`). A diferencia de la biblioteca de
 * tipos documentales —que se guarda sola, en segundo plano—, un proceso se guarda cuando la persona lo pide: un lienzo a medio armar
 * no es algo que convenga publicar a cada movimiento, y cada guardado es una revisión.
 *
 * ## Dos personas editando lo mismo
 *
 * Cada proceso trae una `revision`. Si otra persona lo guardó antes, el servidor responde 409 con la `revisionActual`: aquí se
 * devuelve como `conflicto: true` y NO se pisa nada; la pantalla decide qué hacer.
 */
import { NODO_TIPO } from '$lib/reglas/reglas';
import { hexAleatorio } from '$lib/state/configuracion.svelte';

export type DatosProceso = {
	nombre: string;
	descripcion: string;
	nodos: unknown[];
	aristas: unknown[];
	/**
	 * Si el proceso está activo (2026-10-29, la lista de procesos del Figma Sprint 5). Ausente = activo: los procesos guardados antes de
	 * este campo siguen siéndolo. nexus_back lo conserva sin interpretarlo (guarda lo que venga dentro de `datos`), así que no hizo falta
	 * tocarlo. Hoy solo MARCA el proceso: todavía no hay un motor que corra procesos sobre expedientes y lo respete.
	 */
	activo?: boolean;
};

export type ProcesoGuardado = {
	id: string;
	revision: number;
	datos: DatosProceso;
	creadoPor: string | null;
	creadoEn: string | null;
	modificadoPor: string | null;
	modificadoEn: string | null;
};

/** La lista de la organización. Nace VACÍA: se llena al leerla del servidor (`cargarProcesos`). */
export const estadoProcesos = $state<{
	/** Ya se leyó la lista del servidor. Antes de eso la lista está vacía sin que eso signifique nada. */
	cargada: boolean;
	cargando: boolean;
	/** Por qué no se pudo leer; vacío si no hubo problema. */
	error: string;
	lista: ProcesoGuardado[];
}>({ cargada: false, cargando: false, error: '', lista: [] });

/** ¿Está activo? Todo lo que no diga `false` expreso lo está (los procesos de antes del campo, y un valor que no sea booleano). */
export const procesoActivo = (p: ProcesoGuardado): boolean => p.datos.activo !== false;

/** Cuántos tipos documentales componen el proceso: los nodos de tipo documental de su dibujo («Documentos configurados | 3»). */
export function tiposDelProceso(p: ProcesoGuardado): number {
	return p.datos.nodos.filter((n) => (n as { type?: unknown } | null)?.type === NODO_TIPO).length;
}

/** El id de un proceso: `proceso-` y 32 hexadecimales al azar. Único en TODAS las organizaciones (nexus_back lo exige). */
export function idDeProceso(): string {
	return `proceso-${hexAleatorio(32)}`;
}

/** Suelta lo de la persona anterior: otra sesión en la misma pestaña no debe ver, ni un instante, los procesos de otra organización. */
export function reiniciarProcesos() {
	estadoProcesos.cargada = false;
	estadoProcesos.cargando = false;
	estadoProcesos.error = '';
	estadoProcesos.lista = [];
}

async function cuerpoDe(res: Response): Promise<Record<string, unknown> | null> {
	return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

/** Lee la lista de procesos de la organización. Si ya hay una lectura en curso, se espera a ésa. */
let lecturaEnCurso: Promise<void> | null = null;
export function cargarProcesos(): Promise<void> {
	if (lecturaEnCurso) return lecturaEnCurso;
	estadoProcesos.cargando = true;
	estadoProcesos.error = '';
	lecturaEnCurso = (async () => {
		try {
			const res = await fetch('/api/procesos', { cache: 'no-store' });
			const cuerpo = await cuerpoDe(res);
			if (!res.ok) {
				estadoProcesos.error = typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : 'No se pudieron leer los procesos.';
				return;
			}
			estadoProcesos.lista = Array.isArray(cuerpo?.procesos) ? (cuerpo.procesos as ProcesoGuardado[]) : [];
			estadoProcesos.cargada = true;
		} catch {
			estadoProcesos.error = 'No se pudo contactar al servidor.';
		} finally {
			estadoProcesos.cargando = false;
			lecturaEnCurso = null;
		}
	})();
	return lecturaEnCurso;
}

/** Qué dice la barra del proceso: nunca guardado, con cambios sin guardar, o al día. */
export type EstadoDeProceso = 'nuevo' | 'sin_guardar' | 'cambios' | 'guardado';

/** `status` es el del servidor (0 si ni siquiera se pudo contactar): un 404 aquí significa que otra persona lo borró. */
export type ResultadoGuardado =
	| { ok: true; proceso: ProcesoGuardado }
	| { ok: false; conflicto: boolean; status: number; mensaje: string };

/** Crea (`revision` 0) o guarda un proceso. Un 409 vuelve como `conflicto: true`. */
export async function guardarProceso(id: string, revision: number, datos: DatosProceso): Promise<ResultadoGuardado> {
	let res: Response;
	try {
		res = await fetch(`/api/procesos/${encodeURIComponent(id)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ revision, datos })
		});
	} catch {
		return { ok: false, conflicto: false, status: 0, mensaje: 'No se pudo contactar al servidor.' };
	}
	const cuerpo = await cuerpoDe(res);
	if (!res.ok) {
		return {
			ok: false,
			conflicto: res.status === 409,
			status: res.status,
			mensaje: typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : 'No se pudo guardar el proceso.'
		};
	}
	const proceso = cuerpo as unknown as ProcesoGuardado;
	const i = estadoProcesos.lista.findIndex((p) => p.id === proceso.id);
	if (i >= 0) estadoProcesos.lista[i] = proceso;
	else estadoProcesos.lista.push(proceso);
	return { ok: true, proceso };
}

/** Borra un proceso de la organización. */
export async function borrarProceso(id: string): Promise<{ ok: true } | { ok: false; mensaje: string }> {
	let res: Response;
	try {
		res = await fetch(`/api/procesos/${encodeURIComponent(id)}`, { method: 'DELETE' });
	} catch {
		return { ok: false, mensaje: 'No se pudo contactar al servidor.' };
	}
	// 404: ya no existía (otra persona lo borró antes): para esta pantalla es lo mismo que haberlo borrado.
	if (!res.ok && res.status !== 404) {
		const cuerpo = await cuerpoDe(res);
		return { ok: false, mensaje: typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : 'No se pudo borrar el proceso.' };
	}
	estadoProcesos.lista = estadoProcesos.lista.filter((p) => p.id !== id);
	return { ok: true };
}
