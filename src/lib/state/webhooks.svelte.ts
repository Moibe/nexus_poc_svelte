/**
 * Los webhooks configurados: endpoints de un cliente a los que NexusDoc le
 * avisará cuando un documento suyo termine de procesarse, falle o sea rechazado.
 *
 * DESDE EL 2026-10-01 VIVEN EN EL SERVIDOR. Los registra y los guarda nexus_back
 * (`/webhooks/`, vía el BFF `/api/webhooks`), en un registro provisional en el
 * NAS como el de las API Keys, mientras el DBA arma las tablas. Este módulo
 * guarda en memoria el listado que devolvió el servidor; nada se escribe en el
 * navegador. Es el mismo paso que dieron las API Keys el 2026-09-30.
 *
 * EL SECRET DE FIRMA, UNA SOLA VEZ. Cada webhook nace con un secret
 * (`whsec_...`) que genera el servidor y que `registrarWebhook` devuelve para
 * mostrarlo esa única vez. A diferencia de una API Key, el servidor NO guarda su
 * hash sino el secret CIFRADO, porque lo necesita para firmar cada aviso; pero
 * el listado nunca lo trae, que es lo que sostiene la promesa de la pantalla
 * ("no volveremos a mostrarlo después de cerrar esta vista").
 *
 * TODAVÍA NO SE ENVÍA NADA. Falta el envío —dispararlo desde el pipeline,
 * firmar, reintentar, registrar las entregas y la guarda contra SSRF al
 * entregar—. Hasta entonces registrar un webhook no hace que nadie reciba nada,
 * y las métricas salen vacías.
 *
 * LOS DE ANTES SE BORRAN. Hasta ese día vivían en el `localStorage` de cada
 * navegador, sin secret, y el servidor no los conocía. Se borran de ese
 * navegador al cargar este módulo: había que darlos de alta otra vez, y así se
 * dijo al decidir el cambio.
 */
import { browser } from '$app/environment';

/**
 * Los eventos de suscripción de un webhook, en el orden del diseño. `valor` es
 * el nombre que lleva el aviso (`documento.completado`); `etiqueta` es como lo
 * dice el diseño (`Documento_completado`).
 *
 *   · completado → el documento se procesó y la extracción terminó.
 *   · fallido    → NexusDoc falló al procesarlo (un error del servicio). El
 *                  documento puede estar bien: reintentar tiene sentido.
 *   · rechazado  → el documento no se puede procesar como vino: formato no
 *                  admitido o tipo no reconocido. Reintentar igual no sirve.
 *   · expediente_completado → todos los documentos de un expediente
 *                  terminaron. OJO: el expediente todavía no existe como
 *                  concepto (ver `ExpedientesSheet.svelte`), así que hoy es una
 *                  suscripción que se puede guardar pero que no tendría qué
 *                  disparar aunque el envío existiera.
 *
 * "Fallido" y "rechazado" se separaron el 2026-10-01, cuando el diseño trajo
 * los dos: hasta entonces "rechazado" cubría también el error del servicio. La
 * línea que los divide es de quién es la culpa, porque eso decide qué hace el
 * cliente: ante un fallido reintenta, ante un rechazado corrige el archivo.
 *
 * Avisar "archivo subido" no está: quien sube por la API ya recibe su 201. Lo
 * que el cliente no puede saber solo es qué pasó después.
 */
export const EVENTOS_WEBHOOK = [
	{
		valor: 'documento.completado',
		etiqueta: 'Documento_completado',
		descripcion: 'El documento se procesó y la extracción terminó.'
	},
	{
		valor: 'documento.fallido',
		etiqueta: 'Documento_fallido',
		descripcion: 'NexusDoc falló al procesarlo por un error del servicio; se puede reintentar.'
	},
	{
		valor: 'documento.rechazado',
		etiqueta: 'Documento_rechazado',
		descripcion: 'El documento no se puede procesar: formato no admitido o tipo no reconocido.'
	},
	{
		valor: 'expediente.completado',
		etiqueta: 'Expediente_completado',
		descripcion: 'Todos los documentos de un expediente terminaron de procesarse.'
	}
] as const;

export type EventoWebhook = (typeof EVENTOS_WEBHOOK)[number]['valor'];
export type EstadoWebhook = 'activo' | 'inactivo';

export type WebhookGuardado = {
	id: string;
	/** La URL como la normalizó el servidor (esquema y host en minúsculas, sin
	 *  el puerto de siempre): así dos formas de escribir la misma no cuentan como
	 *  dos webhooks. */
	url: string;
	eventos: EventoWebhook[];
	estado: EstadoWebhook;
	/** ISO-8601, en UTC. */
	creadoEn: string;
};

/** Los webhooks del servidor, del más nuevo al más viejo. */
export const webhooks = $state<WebhookGuardado[]>([]);

export const estadoWebhooks = $state<{
	/** Pidiendo el listado al servidor. */
	cargando: boolean;
	/** El listado no se pudo traer. Se muestra en la pantalla, con reintento. */
	errorCarga: string;
	/** Un alta, un cambio de estado o una baja que no salió como se pidió, dicho
	 *  tal cual: la pantalla lo muestra en un aviso y lo baja con
	 *  `reconocerError`. */
	error: string;
	/** Los webhooks con un cambio en vuelo: sus opciones se apagan, para que un
	 *  segundo clic no mande otro mientras el primero no contesta. */
	enVuelo: string[];
}>({ cargando: false, errorCarga: '', error: '', enVuelo: [] });

export function reconocerError() {
	estadoWebhooks.error = '';
}

/** Los eventos de un webhook como se leen en la tarjeta:
 *  `Documento_completado, Documento_rechazado`. */
export function etiquetaEventos(w: Pick<WebhookGuardado, 'eventos'>): string {
	return EVENTOS_WEBHOOK.filter((e) => w.eventos.includes(e.valor))
		.map((e) => e.etiqueta)
		.join(', ');
}

// ── Validación de la URL ────────────────────────────────────────────────────

export const LARGO_MAXIMO_URL = 2048;

export type ResultadoUrl = { ok: true; url: string } | { ok: false; motivo: string };

/**
 * ¿Sirve esta URL como destino de un webhook? Solo mira la FORMA: que sea
 * `https` (o `http` a `localhost`, para probar en local), sin usuario ni
 * contraseña y sin fragmento. No comprueba que exista ni que conteste.
 *
 * NO es la defensa contra mandar avisos a direcciones internas de CSI. Esa
 * defensa (SSRF) tiene que vivir en el servidor, al momento de ENTREGAR y
 * resolviendo el nombre: lo que se ve aquí se puede saltar. Llega con el
 * envío, y tiene que estar antes de activarlo. (El servidor repite esta misma
 * regla de forma al registrar: `servicios/webhooks_cliente.py`.)
 */
export function validarUrlWebhook(texto: string): ResultadoUrl {
	const limpio = texto.trim();
	if (limpio === '') return { ok: false, motivo: 'Escribe la URL de destino.' };
	if (limpio.length > LARGO_MAXIMO_URL) {
		return { ok: false, motivo: `La URL no puede pasar de ${LARGO_MAXIMO_URL} caracteres.` };
	}
	let u: URL;
	try {
		u = new URL(limpio);
	} catch {
		return {
			ok: false,
			motivo: 'No parece una URL válida. Ejemplo: https://api.empresa.com/webhooks/nexusdoc'
		};
	}
	const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
	if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
		return { ok: false, motivo: 'La URL tiene que empezar con https:// (http:// solo se acepta para localhost).' };
	}
	if (u.username || u.password) {
		return { ok: false, motivo: 'La URL no puede llevar usuario ni contraseña: los avisos se autentican con su firma.' };
	}
	if (u.hash) return { ok: false, motivo: 'La URL no puede llevar fragmento (#…).' };
	return { ok: true, url: u.href };
}

// ── El servidor ─────────────────────────────────────────────────────────────

/** Valida UNO que llegó del servidor. `null` si no tiene la forma esperada: se
 *  descarta ese y los demás siguen. */
function leerWebhook(crudo: unknown): WebhookGuardado | null {
	if (typeof crudo !== 'object' || crudo === null) return null;
	const d = crudo as Record<string, unknown>;
	if (typeof d.id !== 'string' || d.id === '' || typeof d.url !== 'string') return null;
	const recibidos = Array.isArray(d.eventos) ? (d.eventos as unknown[]) : [];
	return {
		id: d.id,
		url: d.url,
		eventos: EVENTOS_WEBHOOK.map((e) => e.valor).filter((v) => recibidos.includes(v)),
		// Un estado ilegible se lee como INACTIVO, no como activo: un webhook mal
		// leído no debe verse como si estuviera mandando avisos.
		estado: d.estado === 'activo' ? 'activo' : 'inactivo',
		creadoEn:
			typeof d.creadoEn === 'string' && !Number.isNaN(Date.parse(d.creadoEn))
				? d.creadoEn
				: new Date(0).toISOString()
	};
}

/** Sin respuesta del servidor: error de red, o el 504 con el que el BFF dice
 *  que nexus_back no contestó a tiempo. En esos casos NO se sabe si el cambio
 *  ocurrió, y no se puede decir "no se hizo" de algo que quizá sí se hizo. */
function sinRespuesta(status: number | null): boolean {
	return status === null || status === 504;
}

async function motivo(r: Response): Promise<string> {
	const cuerpo = await r.json().catch(() => null);
	return typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : `El servidor respondió ${r.status}.`;
}

/** Qué carga del listado es la vigente: solo la ÚLTIMA en empezar puede
 *  escribirlo, para que una respuesta vieja no pise una más nueva (mismo
 *  criterio que `cargarApiKeys`). */
let cargaVigente = 0;

/** Trae el listado del servidor. */
export async function cargarWebhooks(): Promise<void> {
	const turno = ++cargaVigente;
	estadoWebhooks.cargando = true;
	try {
		const r = await fetch('/api/webhooks');
		if (turno !== cargaVigente) return;
		if (!r.ok) {
			estadoWebhooks.errorCarga = await motivo(r);
			return;
		}
		const datos = await r.json().catch(() => null);
		if (turno !== cargaVigente) return;
		const lista = (Array.isArray(datos?.webhooks) ? datos.webhooks : [])
			.map(leerWebhook)
			.filter((w: WebhookGuardado | null): w is WebhookGuardado => w !== null);
		webhooks.splice(0, webhooks.length, ...lista);
		estadoWebhooks.errorCarga = '';
	} catch {
		if (turno === cargaVigente) estadoWebhooks.errorCarga = 'No se pudo contactar al servidor.';
	} finally {
		if (turno === cargaVigente) estadoWebhooks.cargando = false;
	}
}

export type ResultadoAlta =
	| { ok: true; secret: string; webhook: WebhookGuardado }
	/** `mensaje` es un rechazo que el formulario puede explicar (URL inválida o
	 *  repetida) y se muestra en él; `null` es que el motivo ya quedó en
	 *  `estadoWebhooks.error`, que la pantalla muestra en un aviso. */
	| { ok: false; mensaje: string | null };

/**
 * Registra un webhook EN EL SERVIDOR y devuelve su secret para mostrarlo esa
 * única vez.
 *
 * Si el servidor lo rechazó, no se perdió nada: el secret lo genera él, así que
 * no existe. Si NO contestó, pudo quedar registrado sin que nadie viera su
 * secret: se dice así, y se recarga el listado para que se vea y se elimine.
 */
export async function registrarWebhook(datos: {
	url: string;
	eventos: EventoWebhook[];
}): Promise<ResultadoAlta> {
	const url = validarUrlWebhook(datos.url);
	if (!url.ok) return { ok: false, mensaje: url.motivo };
	const eventos = EVENTOS_WEBHOOK.map((e) => e.valor).filter((v) => datos.eventos.includes(v));
	if (eventos.length === 0) return { ok: false, mensaje: 'Elige al menos un evento de suscripción.' };

	let r: Response;
	try {
		r = await fetch('/api/webhooks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: url.url, eventos })
		});
	} catch {
		return altaIncierta();
	}
	if (sinRespuesta(r.status)) return altaIncierta();
	// Repetida o con forma inválida: el formulario lo explica, bajo la URL.
	if (r.status === 400 || r.status === 409) return { ok: false, mensaje: await motivo(r) };
	if (!r.ok) {
		estadoWebhooks.error = `No se registró el webhook: ${await motivo(r)}`;
		return { ok: false, mensaje: null };
	}
	const cuerpo = await r.json().catch(() => null);
	const webhook = leerWebhook(cuerpo?.webhook);
	if (typeof cuerpo?.secret !== 'string' || !webhook) {
		estadoWebhooks.error =
			'El servidor respondió sin el webhook. Si aparece en el listado, elimínalo y vuelve a crearlo: su secret no se puede recuperar.';
		void cargarWebhooks();
		return { ok: false, mensaje: null };
	}
	// Al frente: el recién creado es el que se viene a ver. Si una carga del
	// listado ya lo trajo, no se duplica.
	if (!webhooks.some((w) => w.id === webhook.id)) webhooks.unshift(webhook);
	return { ok: true, secret: cuerpo.secret, webhook };
}

function altaIncierta(): { ok: false; mensaje: null } {
	estadoWebhooks.error =
		'No se pudo confirmar si el webhook se registró: el servidor no contestó a tiempo. Revisa el listado — si aparece, elimínalo y vuelve a crearlo, porque su secret no se puede recuperar.';
	void cargarWebhooks();
	return { ok: false, mensaje: null };
}

/** Marca un webhook con un cambio en vuelo mientras corre `trabajo`. Si ya
 *  tenía uno, no hace nada y devuelve `siOcupado`. */
async function conCambioEnVuelo<T>(id: string, trabajo: () => Promise<T>, siOcupado: T): Promise<T> {
	if (estadoWebhooks.enVuelo.includes(id)) return siOcupado;
	estadoWebhooks.enVuelo.push(id);
	try {
		return await trabajo();
	} finally {
		const i = estadoWebhooks.enVuelo.indexOf(id);
		if (i !== -1) estadoWebhooks.enVuelo.splice(i, 1);
	}
}

/**
 * Activa o desactiva un webhook EN EL SERVIDOR. Devuelve si quedó como se pidió.
 *
 * Si el servidor lo rechazó se dice por qué y no cambió nada. Si ya no existe
 * (lo eliminaron desde otra pestaña), se recarga el listado. Si NO contestó, no
 * se sabe: se recarga, y si ya viene como se pidió cuenta como éxito.
 */
export function cambiarEstadoWebhook(id: string, estado: EstadoWebhook): Promise<boolean> {
	return conCambioEnVuelo(
		id,
		async () => {
			const url = webhooks.find((w) => w.id === id)?.url ?? id;
			const accion = estado === 'activo' ? 'activó' : 'desactivó';
			let r: Response | null = null;
			try {
				r = await fetch(`/api/webhooks/${encodeURIComponent(id)}/estado`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ estado })
				});
			} catch {
				r = null;
			}
			if (r && r.ok) {
				// Se busca OTRA VEZ: una carga del listado pudo haber cambiado los
				// objetos mientras esto esperaba, y escribirle al de antes no se vería.
				const actual = webhooks.find((w) => w.id === id);
				if (actual) actual.estado = estado;
				return true;
			}
			if (r && r.status === 404) {
				await cargarWebhooks();
				estadoWebhooks.error = `"${url}" ya no está en tu listado: lo eliminaron desde otro lado.`;
				return false;
			}
			if (r && !sinRespuesta(r.status)) {
				estadoWebhooks.error = `No se ${accion} "${url}": ${await motivo(r)}`;
				return false;
			}
			await cargarWebhooks();
			if (webhooks.find((w) => w.id === id)?.estado === estado) return true;
			estadoWebhooks.error = `No se pudo confirmar si "${url}" se ${accion}: el servidor no contestó a tiempo. Revisa su estado en el listado e inténtalo de nuevo.`;
			return false;
		},
		false
	);
}

/**
 * Elimina un webhook EN EL SERVIDOR. Devuelve si ya no está.
 *
 * Que ya no existiera (otra pestaña se adelantó) cuenta como éxito: el
 * resultado que se pidió es el que hay. Si NO contestó, se recarga y se ve.
 */
export function eliminarWebhook(id: string): Promise<boolean> {
	return conCambioEnVuelo(
		id,
		async () => {
			const url = webhooks.find((w) => w.id === id)?.url ?? id;
			let r: Response | null = null;
			try {
				r = await fetch(`/api/webhooks/${encodeURIComponent(id)}/eliminar`, { method: 'POST' });
			} catch {
				r = null;
			}
			if (r && (r.ok || r.status === 404)) {
				const i = webhooks.findIndex((w) => w.id === id);
				if (i !== -1) webhooks.splice(i, 1);
				return true;
			}
			if (r && !sinRespuesta(r.status)) {
				estadoWebhooks.error = `No se eliminó "${url}": ${await motivo(r)} Sigue en tu listado.`;
				return false;
			}
			await cargarWebhooks();
			if (!webhooks.some((w) => w.id === id)) return true;
			estadoWebhooks.error = `No se pudo confirmar si "${url}" se eliminó: el servidor no contestó a tiempo. Revisa el listado e inténtalo de nuevo si sigue ahí.`;
			return false;
		},
		false
	);
}

// Los de antes: se borran de este navegador. Ver el docstring de arriba.
if (browser) {
	try {
		window.localStorage.removeItem('nexusdoc:webhooks:v1');
	} catch {
		// localStorage bloqueado: no hay nada que borrar que se pueda leer.
	}
}

// ── Métricas ────────────────────────────────────────────────────────────────

/** Las cifras de las entregas de un periodo, como las devolverá el servidor. */
export type ResumenEntregas = {
	solicitudes: number;
	errores: number;
	/** % de entregas que fallaron, o `null` si no hubo ninguna. */
	tasaError: number | null;
	p50Ms: number | null;
	p90Ms: number | null;
	p99Ms: number | null;
};

export type MetricasWebhook = {
	desde: string;
	hasta: string;
	actual: ResumenEntregas;
	anterior: ResumenEntregas;
};

const numero = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

function leerResumen(cruda: unknown): ResumenEntregas | null {
	if (typeof cruda !== 'object' || cruda === null) return null;
	const d = cruda as Record<string, unknown>;
	const solicitudes = numero(d.solicitudes);
	const errores = numero(d.errores);
	if (solicitudes === null || errores === null || solicitudes < 0 || errores < 0) return null;
	return {
		solicitudes,
		errores,
		tasaError: numero(d.tasaError),
		p50Ms: numero(d.p50Ms),
		p90Ms: numero(d.p90Ms),
		p99Ms: numero(d.p99Ms)
	};
}

/**
 * Las métricas de entregas de un webhook en un periodo (`desde` y `hasta`:
 * instantes ISO 8601 con zona, `[desde, hasta)`; los arma `limitesDelPeriodo`),
 * por el BFF. Lanza con el motivo si no se pudieron traer: quien
 * la llama decide cómo mostrarlo.
 *
 * Hoy el BFF contesta siempre vacío, porque no hay entregas que contar (ver
 * el docstring del archivo). El formato ya es el definitivo.
 */
export async function cargarMetricasWebhook(id: string, desde: string, hasta: string): Promise<MetricasWebhook> {
	let r: Response;
	try {
		r = await fetch(`/api/webhooks/${encodeURIComponent(id)}/metricas?${new URLSearchParams({ desde, hasta })}`);
	} catch {
		throw new Error('No se pudo contactar al servidor.');
	}
	const cuerpo = await r.json().catch(() => null);
	if (!r.ok) {
		throw new Error(typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : `El servidor respondió ${r.status}.`);
	}
	const actual = leerResumen(cuerpo?.actual);
	const anterior = leerResumen(cuerpo?.anterior);
	if (!actual || !anterior) throw new Error('El servidor respondió con un formato que no se entiende.');
	return { desde, hasta, actual, anterior };
}
