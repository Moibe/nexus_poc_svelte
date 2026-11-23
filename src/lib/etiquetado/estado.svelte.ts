/**
 * El estado de «Ejemplo documental» de UN tipo (2026-11-23): las etiquetas guardadas de sus documentos de ejemplo, la revisión que la persona
 * está haciendo de cada uno y las mediciones. Lo comparten el panel de la medición (`MedicionDeTipo.svelte`) y el de etiquetar
 * (`EtiquetarEjemplo.svelte`); lo crea `ModuloConfiguracion` al abrir la pantalla. Habla con el BFF (`/api/tipos-documentales/{id}/…`).
 */

import {
	borradorDesdeEtiquetas,
	borradorDesdeLectura,
	etiquetasParaGuardar,
	hayCambios,
	type EtiquetasDeDocumento,
	type FilaDeRevision,
	type Lectura,
	type Medicion
} from './etiquetado';

/** Cómo va UN documento de ejemplo. */
export type EstadoDeDocumento =
	| { fase: 'sin-leer' }
	| { fase: 'leyendo' }
	| { fase: 'error'; mensaje: string }
	| { fase: 'revision'; filas: FilaDeRevision[]; base: string | null; desdeLectura: boolean };

async function pedir<T>(url: string, init?: RequestInit): Promise<{ ok: true; datos: T } | { ok: false; mensaje: string; status: number }> {
	let r: Response;
	try {
		r = await fetch(url, init);
	} catch {
		return { ok: false, mensaje: 'No se pudo contactar al servidor.', status: 0 };
	}
	const cuerpo = await r.json().catch(() => null);
	if (!r.ok) return { ok: false, mensaje: (cuerpo as { mensaje?: string } | null)?.mensaje ?? 'No se pudo completar la operación.', status: r.status };
	return { ok: true, datos: cuerpo as T };
}

export class EstadoEtiquetado {
	readonly tipoId: string;
	cargando = $state(true);
	errorCarga = $state('');
	/** Las etiquetas guardadas, por documento de ejemplo. */
	etiquetas = $state<Record<string, EtiquetasDeDocumento>>({});
	/** La revisión en curso de cada documento (lo que se ve y se edita). */
	documentos = $state<Record<string, EstadoDeDocumento>>({});
	guardando = $state<Record<string, boolean>>({});
	errorGuardar = $state<Record<string, string>>({});
	/** El historial, la más reciente primero (solo ella trae su detalle). */
	mediciones = $state<Medicion[]>([]);
	midiendo = $state(false);
	errorMedir = $state('');

	constructor(tipoId: string) {
		this.tipoId = tipoId;
	}

	private get base() {
		return `/api/tipos-documentales/${encodeURIComponent(this.tipoId)}`;
	}

	/** Lee lo guardado: las etiquetas y el historial de mediciones. */
	async cargar(): Promise<void> {
		this.cargando = true;
		this.errorCarga = '';
		const [etq, med] = await Promise.all([
			pedir<{ etiquetas: EtiquetasDeDocumento[] }>(`${this.base}/etiquetas`),
			pedir<{ mediciones: Medicion[] }>(`${this.base}/mediciones?limite=10`)
		]);
		if (etq.ok) this.etiquetas = Object.fromEntries(etq.datos.etiquetas.map((e) => [e.ejemplo, e]));
		else this.errorCarga = etq.mensaje;
		if (med.ok) this.mediciones = med.datos.mediciones;
		else if (!this.errorCarga) this.errorCarga = med.mensaje;
		this.cargando = false;
	}

	/** Cómo va un documento. Uno etiquetado que todavía no se abrió se enseña con lo guardado. */
	estadoDe(ejemplo: string): EstadoDeDocumento {
		const actual = this.documentos[ejemplo];
		if (actual) return actual;
		const guardadas = this.etiquetas[ejemplo];
		if (guardadas) return { fase: 'revision', filas: borradorDesdeEtiquetas(guardadas), base: null, desdeLectura: false };
		return { fase: 'sin-leer' };
	}

	/** Lo lee Biblioratum con la definición actual del tipo (cuesta una extracción). Lo que la persona ya había etiquetado se conserva. */
	async leer(ejemplo: string): Promise<void> {
		this.documentos[ejemplo] = { fase: 'leyendo' };
		const r = await pedir<Lectura>(`${this.base}/ejemplos/${encodeURIComponent(ejemplo)}/leer`, { method: 'POST' });
		if (!r.ok) {
			this.documentos[ejemplo] = { fase: 'error', mensaje: r.mensaje };
			return;
		}
		this.documentos[ejemplo] = { fase: 'revision', filas: borradorDesdeLectura(r.datos, this.etiquetas[ejemplo]), base: r.datos.base, desdeLectura: true };
	}

	/** Cambia un renglón de la revisión (su valor, «no aparece» o su recuadro). */
	editar(ejemplo: string, ruta: string, cambios: Partial<Pick<FilaDeRevision, 'valor' | 'ausente' | 'caja' | 'pagina'>>): void {
		const estado = this.estadoDe(ejemplo);
		if (estado.fase !== 'revision') return;
		const filas = estado.filas.map((f) => (f.ruta === ruta ? { ...f, ...cambios } : f));
		this.documentos[ejemplo] = { ...estado, filas };
		if (this.errorGuardar[ejemplo]) this.errorGuardar[ejemplo] = '';
	}

	/** ¿La revisión de ese documento tiene algo que no se ha guardado? */
	sinGuardar(ejemplo: string): boolean {
		const estado = this.documentos[ejemplo];
		if (!estado || estado.fase !== 'revision') return false;
		// Una lectura nueva siempre está pendiente de guardar (trae lo que leyó Google, que se guarda con las etiquetas); una revisión que salió de lo
		// guardado, solo si la persona cambió algo.
		return estado.desdeLectura || hayCambios(estado.filas, this.etiquetas[ejemplo]);
	}

	/** Los documentos (de los que se pasan) con algo sin guardar. */
	pendientes(ejemplos: string[]): string[] {
		return ejemplos.filter((e) => this.sinGuardar(e));
	}

	async guardar(ejemplo: string): Promise<boolean> {
		const estado = this.estadoDe(ejemplo);
		if (estado.fase !== 'revision') return false;
		this.guardando[ejemplo] = true;
		this.errorGuardar[ejemplo] = '';
		const r = await pedir<EtiquetasDeDocumento>(`${this.base}/ejemplos/${encodeURIComponent(ejemplo)}/etiquetas`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ campos: etiquetasParaGuardar(estado.filas), base: estado.base })
		});
		this.guardando[ejemplo] = false;
		if (!r.ok) {
			this.errorGuardar[ejemplo] = r.mensaje;
			return false;
		}
		this.etiquetas[ejemplo] = r.datos;
		// Lo guardado ES ahora la revisión: se enseña desde ahí (con sus rótulos y lo que falta por etiquetar).
		delete this.documentos[ejemplo];
		return true;
	}

	/** Al quitar el documento de ejemplo: sus etiquetas se van con él. Si falla, no estorba (las de un documento que ya no está no cuentan). */
	async quitar(ejemplo: string): Promise<void> {
		delete this.documentos[ejemplo];
		delete this.etiquetas[ejemplo];
		await pedir(`${this.base}/ejemplos/${encodeURIComponent(ejemplo)}/etiquetas`, { method: 'DELETE' });
	}

	/** Descarta lo que no se guardó de un documento. */
	descartar(ejemplo: string): void {
		delete this.documentos[ejemplo];
	}

	/** Vuelve a leer todos los documentos etiquetados y compara (cuesta una extracción por documento). */
	async medir(): Promise<void> {
		this.midiendo = true;
		this.errorMedir = '';
		const r = await pedir<Medicion>(`${this.base}/mediciones`, { method: 'POST' });
		this.midiendo = false;
		if (!r.ok) {
			this.errorMedir = r.mensaje;
			return;
		}
		this.mediciones = [r.datos, ...this.mediciones.map(({ detalle: _d, ...m }) => m)].slice(0, 10);
	}
}
