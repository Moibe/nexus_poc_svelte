/**
 * Los PROCESOS del motor de reglas de la organización (2026-10-20): leerlos, guardarlos y borrarlos en nexus_back
 * (`/procesos`, a través del BFF `/api/procesos`).
 *
 * Un proceso guardado es su `nombre`, su `descripcion`, si está `activo` y el dibujo del lienzo (`nodos` y `aristas`). A diferencia de la
 * biblioteca de tipos documentales —que se guarda sola, en segundo plano—, un proceso se guarda cuando la persona lo pide: un lienzo a medio
 * armar no es algo que convenga publicar a cada movimiento, y cada guardado es una revisión.
 *
 * Un proceso corre sobre CUALQUIER expediente de la organización: hasta el 2026-11-05 llevaba además el tipo de expediente virtual sobre el que
 * corría (`tipoExpedienteVirtualId`); Moibe quitó los expedientes virtuales y el campo desapareció. Los procesos guardados antes pueden seguir
 * trayéndolo: se ignora, y no se reenvía al guardar (`sinCamposRetirados`).
 *
 * ## Dos personas editando lo mismo
 *
 * Cada proceso trae una `revision`. Si otra persona lo guardó antes, el servidor responde 409 con la `revisionActual`: aquí se
 * devuelve como `conflicto: true` y NO se pisa nada; la pantalla decide qué hacer.
 */
import { NODO_RESULTADO, NODO_TIPO, resultadoConectado } from '$lib/reglas/reglas';
import { hexAleatorio } from '$lib/state/configuracion.svelte';

export type DatosProceso = {
	nombre: string;
	descripcion: string;
	nodos: unknown[];
	aristas: unknown[];
	/**
	 * Si el proceso está activo (2026-10-29, la lista de procesos del Figma Sprint 5). Ausente = activo: los procesos guardados antes de
	 * este campo siguen siéndolo. nexus_back lo conserva sin interpretarlo (guarda lo que venga dentro de `datos`), así que no hizo falta
	 * tocarlo. Lo respeta Ejecuciones: solo ofrece los procesos activos.
	 */
	activo?: boolean;
};

/**
 * Los campos que un proceso guardado pudo traer y que ya no existen: `tipoExpedienteVirtualId`, el tipo de expediente virtual sobre el que corría
 * (Moibe, 2026-11-05: se quitaron los expedientes virtuales). nexus_back ya no lo devuelve y, si lo recibe, lo ignora; aquí tampoco se reenvía.
 * Importa porque «Activar» y «Desactivar» desde la lista guardan `{ ...p.datos, activo }`: si el campo viniera en `datos` (un back anterior, una
 * respuesta vieja) volvería a viajar tal cual.
 */
const CAMPOS_RETIRADOS = ['tipoExpedienteVirtualId'] as const;

/** Una copia de `datos` sin los campos retirados. No toca el original (es el que está en la lista en pantalla). */
export function sinCamposRetirados<T extends object>(datos: T): T {
	const limpio = { ...datos } as Record<string, unknown>;
	for (const campo of CAMPOS_RETIRADOS) delete limpio[campo];
	return limpio as T;
}

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

/**
 * ¿Tiene su nodo de «Resultado»? (2026-11-03, Moibe: «sí, que sea obligatorio el Resultado»). Desde entonces un proceso no se guarda sin él, pero
 * los guardados ANTES pueden no tenerlo: se siguen abriendo y se pueden activar o desactivar desde la lista, pero no se pueden ejecutar hasta que
 * se les agregue (sin la palabra con la que termina, no hay con qué contestar).
 */
export const tieneResultado = (p: ProcesoGuardado): boolean => p.datos.nodos.some((n) => (n as { type?: unknown } | null)?.type === NODO_RESULTADO);

/** ¿Su Resultado tiene una regla conectada? Sin eso el proceso no se puede ejecutar aunque el nodo exista (2026-11-06; ver `resultadoConectado`). */
export const resultadoConectadoDe = (p: ProcesoGuardado): boolean => resultadoConectado({ nodos: p.datos.nodos, aristas: p.datos.aristas });

/** Cuántos tipos documentales componen el proceso: los nodos de tipo documental de su dibujo («Documentos configurados | 3»). */
export function tiposDelProceso(p: ProcesoGuardado): number {
	return p.datos.nodos.filter((n) => (n as { type?: unknown } | null)?.type === NODO_TIPO).length;
}

/**
 * Los procesos de la lista que usan un tipo documental, con cuántos nodos de ese tipo lleva cada uno (2026-11-04, NEX-544: archivar un tipo avisa
 * a qué procesos afecta). Se lee de la lista que ya se tiene: quien lo llama la refresca antes con `cargarProcesos`.
 */
export function procesosQueUsanElTipo(tipoId: string): { nombre: string; nodos: number }[] {
	return estadoProcesos.lista.flatMap((p) => {
		const nodos = p.datos.nodos.filter((n) => {
			const nodo = n as { type?: unknown; data?: { tipoId?: unknown } } | null;
			return nodo?.type === NODO_TIPO && nodo.data?.tipoId === tipoId;
		}).length;
		return nodos > 0 ? [{ nombre: p.datos.nombre, nodos }] : [];
	});
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
	| { ok: false; conflicto: boolean; status: number; mensaje: string; codigo?: string };

/** Crea (`revision` 0) o guarda un proceso. Un 409 vuelve como `conflicto: true`. */
export async function guardarProceso(id: string, revision: number, datos: DatosProceso): Promise<ResultadoGuardado> {
	let res: Response;
	try {
		res = await fetch(`/api/procesos/${encodeURIComponent(id)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ revision, datos: sinCamposRetirados(datos) })
		});
	} catch {
		return { ok: false, conflicto: false, status: 0, mensaje: 'No se pudo contactar al servidor.' };
	}
	const cuerpo = await cuerpoDe(res);
	if (!res.ok) {
		return {
			ok: false,
			// Un 409 es un conflicto de revisión (otra persona lo guardó antes) salvo que sea `ya_existe`: el nombre lo tiene otro proceso.
			conflicto: res.status === 409 && cuerpo?.codigo !== 'ya_existe',
			status: res.status,
			mensaje: typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : 'No se pudo guardar el proceso.',
			codigo: typeof cuerpo?.codigo === 'string' ? cuerpo.codigo : undefined
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
