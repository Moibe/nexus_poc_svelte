/**
 * Los webhooks configurados: endpoints de un cliente a los que NexusDoc le
 * avisa cuando un documento suyo termina de procesarse o es rechazado.
 *
 * ESTA ES LA PRIMERA ETAPA, y hay que saber qué es y qué no es (2026-09-30):
 *
 *   · Es el módulo de configuración: alta, listado con estado, desactivar,
 *     eliminar y el panel de métricas. Vive en `localStorage`, como vivieron las
 *     API Keys antes de ser reales: solo de este navegador.
 *   · NO ENVÍA NADA TODAVÍA. Falta el backend —eventos disparados desde el
 *     pipeline, firma HMAC, reintentos y el registro de entregas—, que espera a
 *     que avance la base con el DBA. Hasta entonces registrar un webhook no hace
 *     que nadie reciba nada, y las métricas salen vacías.
 *   · Por eso NO hay "secret de firma" en el alta: el secret tiene que generarlo
 *     y guardarlo el servidor (es quien firma), y mostrar uno ahora sería
 *     mostrar un valor inventado que dejaría de servir el día que exista el
 *     backend. Llega con él.
 *   · Cuando exista el backend, lo que cambia es ESTE archivo (del navegador al
 *     servidor, como se hizo con `apiKeys.svelte.ts`) y el BFF de métricas; la
 *     pantalla no. Los webhooks de esta etapa habrá que volver a registrarlos.
 *
 * QUÉ SE GUARDA Y CÓMO. Cada cambio LEE lo que hay en disco, modifica solo lo
 * suyo y escribe eso —no vuelca la memoria de la pestaña encima—, y una pestaña
 * escucha el evento `storage` para ponerse al día con las demás. Sin eso, una
 * pestaña abierta desde hace rato pisaba lo que se hizo en otra (lo encontró la
 * revisión de la migración de ejemplos, el 2026-09-25).
 *
 * UN ESTADO ILEGIBLE SE LEE COMO INACTIVO, no como activo: un webhook mal leído
 * no debe amanecer mandando avisos a un endpoint que alguien había pausado.
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
	/** La URL canónica (`new URL().href`): así dos formas de escribir la misma
	 *  no cuentan como dos webhooks. */
	url: string;
	eventos: EventoWebhook[];
	estado: EstadoWebhook;
	/** ISO-8601, en UTC. */
	creadoEn: string;
};

/** Los webhooks, del más nuevo al más viejo. */
export const webhooks = $state<WebhookGuardado[]>([]);

/** Igual que `estadoBiblioteca` en `configuracion.svelte.ts` y por la misma
 *  razón: un `catch` vacío haría que la pantalla confirmara cambios que no
 *  ocurrieron. */
export const estadoWebhooks = $state<{ falloAlGuardar: boolean }>({ falloAlGuardar: false });

export function reconocerFallaDeGuardado() {
	estadoWebhooks.falloAlGuardar = false;
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
 * resolviendo el nombre: lo que se ve aquí se puede saltar. Está pendiente
 * para cuando exista el backend, y hay que decidirla antes de activar envíos.
 */
export function validarUrlWebhook(texto: string): ResultadoUrl {
	const limpio = texto.trim();
	if (limpio === '') return { ok: false, motivo: 'Escribe la URL del endpoint.' };
	if (limpio.length > LARGO_MAXIMO_URL) {
		return { ok: false, motivo: `La URL no puede pasar de ${LARGO_MAXIMO_URL} caracteres.` };
	}
	let u: URL;
	try {
		u = new URL(limpio);
	} catch {
		return {
			ok: false,
			motivo: 'No parece una URL válida. Ejemplo: https://servicios.empresa.com/webhooks/documentos'
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

// ── Lectura y escritura ─────────────────────────────────────────────────────

const LLAVE = 'nexusdoc:webhooks:v1';

function almacen(): Storage | null {
	// En el render del servidor no hay `window`, y tocar localStorage ahí truena.
	if (!browser) return null;
	try {
		return window.localStorage;
	} catch {
		// Puede LANZAR, no solo venir vacío: navegación privada y los navegadores
		// con "datos de sitios" bloqueados tiran al acceder a la propiedad.
		return null;
	}
}

/** Valida UNO que vino de localStorage (entrada NO confiable). `null` si no
 *  tiene la forma esperada: se descarta ese y los demás siguen. */
function leerWebhook(cruda: unknown): WebhookGuardado | null {
	if (typeof cruda !== 'object' || cruda === null) return null;
	const d = cruda as Record<string, unknown>;
	if (typeof d.id !== 'string' || d.id === '' || typeof d.url !== 'string') return null;
	const url = validarUrlWebhook(d.url);
	if (!url.ok) return null;
	const guardados = Array.isArray(d.eventos) ? (d.eventos as unknown[]) : [];
	const eventos = EVENTOS_WEBHOOK.map((e) => e.valor).filter((v) => guardados.includes(v));
	if (eventos.length === 0) return null;
	return {
		id: d.id,
		url: url.url,
		eventos,
		estado: d.estado === 'activo' ? 'activo' : 'inactivo',
		creadoEn:
			typeof d.creadoEn === 'string' && !Number.isNaN(Date.parse(d.creadoEn))
				? d.creadoEn
				: new Date(0).toISOString()
	};
}

function leerDisco(store: Storage): WebhookGuardado[] {
	const crudo = store.getItem(LLAVE);
	if (!crudo) return [];
	try {
		const datos: unknown = JSON.parse(crudo);
		if (!Array.isArray(datos)) return [];
		return datos.map(leerWebhook).filter((w): w is WebhookGuardado => w !== null);
	} catch {
		// JSON corrupto: se lee vacío. El siguiente cambio escribe limpio encima.
		return [];
	}
}

function escribir(store: Storage, lista: WebhookGuardado[]) {
	if (lista.length === 0) store.removeItem(LLAVE);
	else store.setItem(LLAVE, JSON.stringify(lista));
}

function sincronizar(lista: WebhookGuardado[]) {
	webhooks.splice(0, webhooks.length, ...lista);
}

/** Pone la memoria al día con lo que hay en disco. La llama el módulo al
 *  abrirse y el evento `storage` cuando otra pestaña cambió algo. */
export function recargarWebhooks() {
	const store = almacen();
	if (!store) return;
	try {
		sincronizar(leerDisco(store));
	} catch {
		/* un localStorage que lanza al leer: se deja la memoria como está */
	}
}

// Sin crypto: el server de CSI sirve por HTTP plano, donde `crypto.randomUUID`
// ni existe. Esto solo tiene que ser único dentro de una lista.
let contador = 0;
function nuevoId(): string {
	contador += 1;
	return `wh_${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type ResultadoAlta =
	| { ok: true; webhook: WebhookGuardado }
	| { ok: false; motivo: 'url' | 'eventos' | 'duplicado' | 'guardado'; mensaje: string };

function noSeGuardo(): { ok: false; motivo: 'guardado'; mensaje: string } {
	estadoWebhooks.falloAlGuardar = true;
	return { ok: false, motivo: 'guardado', mensaje: 'No se pudo guardar en este navegador.' };
}

/** Da de alta un webhook ACTIVO. Si el navegador no acepta la escritura no se
 *  deja una fila fantasma en pantalla: la memoria solo cambia si el disco
 *  aceptó. */
export function agregarWebhook(datos: { url: string; eventos: EventoWebhook[] }): ResultadoAlta {
	const url = validarUrlWebhook(datos.url);
	if (!url.ok) return { ok: false, motivo: 'url', mensaje: url.motivo };
	const eventos = EVENTOS_WEBHOOK.map((e) => e.valor).filter((v) => datos.eventos.includes(v));
	if (eventos.length === 0) return { ok: false, motivo: 'eventos', mensaje: 'Elige al menos un evento de suscripción.' };

	const store = almacen();
	if (!store) return noSeGuardo();
	try {
		const lista = leerDisco(store);
		if (lista.some((w) => w.url === url.url)) {
			return {
				ok: false,
				motivo: 'duplicado',
				mensaje: 'Ya tienes un webhook con esa URL. Si quieres otros eventos, elimínalo y vuelve a crearlo.'
			};
		}
		const nuevo: WebhookGuardado = {
			id: nuevoId(),
			url: url.url,
			eventos,
			estado: 'activo',
			creadoEn: new Date().toISOString()
		};
		const nueva = [nuevo, ...lista];
		escribir(store, nueva);
		sincronizar(nueva);
		estadoWebhooks.falloAlGuardar = false;
		return { ok: true, webhook: nuevo };
	} catch {
		return noSeGuardo();
	}
}

/** Activa o desactiva un webhook. Devuelve si quedó como se pidió; si otra
 *  pestaña ya lo había eliminado, la memoria se pone al día y devuelve `false`. */
export function cambiarEstadoWebhook(id: string, estado: EstadoWebhook): boolean {
	const store = almacen();
	if (!store) return noSeGuardo().ok;
	try {
		const lista = leerDisco(store);
		const objetivo = lista.find((w) => w.id === id);
		if (!objetivo) {
			sincronizar(lista);
			return false;
		}
		objetivo.estado = estado;
		escribir(store, lista);
		sincronizar(lista);
		estadoWebhooks.falloAlGuardar = false;
		return true;
	} catch {
		return noSeGuardo().ok;
	}
}

/** Elimina un webhook. Que ya no estuviera (otra pestaña se adelantó) cuenta
 *  como éxito: el resultado que se pidió es el que hay. */
export function eliminarWebhook(id: string): boolean {
	const store = almacen();
	if (!store) return noSeGuardo().ok;
	try {
		const quedan = leerDisco(store).filter((w) => w.id !== id);
		escribir(store, quedan);
		sincronizar(quedan);
		estadoWebhooks.falloAlGuardar = false;
		return true;
	} catch {
		return noSeGuardo().ok;
	}
}

if (browser) {
	recargarWebhooks();
	// Otra pestaña cambió la lista: esta se pone al día (`key === null` es que
	// se limpió todo el almacenamiento).
	window.addEventListener('storage', (e) => {
		if (e.key === LLAVE || e.key === null) recargarWebhooks();
	});
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
