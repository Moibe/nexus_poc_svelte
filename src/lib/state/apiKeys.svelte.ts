/**
 * Las API keys de cliente.
 *
 * DESDE EL 2026-09-30 SON DE VERDAD. Las genera y las guarda nexus_back
 * (`/llaves/`, vía el BFF `/api/llaves`), y un cliente las usa para mandar
 * documentos a `POST /bandeja/`: abren esa ruta y ninguna otra, y lo que suban
 * se va al cliente dueño de la llave. Este módulo guarda en memoria el listado
 * que devolvió el servidor; nada de eso se escribe en el navegador.
 *
 * EL SECRET, UNA SOLA VEZ. `emitirApiKey` devuelve el secret que generó el
 * servidor y la pantalla lo muestra esa única vez. El servidor guarda solo su
 * hash; el listado nunca lo trae. Es lo que sostiene la promesa que imprime la
 * pantalla de alta ("no volveremos a mostrarlo después de cerrar esta vista").
 *
 * LAS DE ANTES SE BORRAN. Hasta ese día las llaves se generaban y guardaban en
 * el `localStorage` de cada navegador, el servidor no las conocía y no
 * autenticaban nada; tampoco se guardó nunca su hash, así que no hay forma de
 * volverlas válidas. Se borran de ese navegador al cargar este módulo (pedido
 * explícito, 2026-09-30: "las llaves viejas mejor bórralas").
 *
 * EL ESTADO NO SE GUARDA, SE CALCULA. "Expirada" sale de comparar `expiraEn`
 * contra el reloj; lo único que se registra es la revocación, que es un hecho.
 */
import { browser } from '$app/environment';

export type EstadoApiKey = 'activa' | 'expirada' | 'revocada';

export type ApiKeyGuardada = {
	/** El tramo público de la llave (`a7K9`). Es lo que permite reconocerla sin
	 *  el secret — ver `$lib/apiKeys/formato`. */
	id: string;
	nombre: string;
	descripcion: string;
	/** ISO-8601. Se guarda en UTC y se formatea en la hora de quien mira. */
	creadaEn: string;
	expiraEn: string;
	/** ISO-8601 o `null` si sigue viva. Es el ÚNICO estado que se registra. */
	revocadaEn: string | null;
	/** ISO-8601 de la última llamada con esta llave, o `null` si nunca se usó.
	 *  Lo calcula el servidor a partir del registro de uso. */
	ultimoUso: string | null;
};

/** Lo que devuelve `GET /api/llaves/{id}/metricas`. */
export type ResumenUso = {
	solicitudes: number;
	exitosas: number;
	errores: number;
	porcentajeExito: number | null;
	latenciaP50Ms: number | null;
	bytes: number;
};

export type MetricasApiKey = {
	desde: string;
	hasta: string;
	actual: ResumenUso;
	anterior: ResumenUso;
	porDia: { dia: string; solicitudes: number }[];
	limiteSemanal: { consumo: number; limite: number; fraccion: number; avisoDesde: number; semanaDesde: string };
	ultimoUso: string | null;
};

/** Las llaves del servidor, de la más nueva a la más vieja. */
export const apiKeys = $state<ApiKeyGuardada[]>([]);

export const estadoApiKeys = $state<{
	/** Pidiendo el listado al servidor. */
	cargando: boolean;
	/** El listado no se pudo traer. Se muestra en la pantalla, con reintento. */
	errorCarga: string;
	/** Una emisión o una revocación que no salió como se pidió, dicho tal cual:
	 *  la pantalla lo muestra en un aviso y lo baja con `reconocerError`. */
	error: string;
	/** Las llaves con una revocación en vuelo: su "Revocar" se apaga, para que
	 *  un segundo clic no mande otra mientras la primera no contesta. */
	revocando: string[];
}>({ cargando: false, errorCarga: '', error: '', revocando: [] });

export function reconocerError() {
	estadoApiKeys.error = '';
}

/** En qué estado está una llave AHORA. Solo la revocación se registra; lo demás
 *  se calcula contra el reloj. */
export function estadoDe(llave: ApiKeyGuardada, ahora: number = Date.now()): EstadoApiKey {
	if (llave.revocadaEn) return 'revocada';
	if (Date.parse(llave.expiraEn) <= ahora) return 'expirada';
	return 'activa';
}

/** Valida UNA llave que llegó del servidor. `null` si no tiene la forma
 *  esperada: se descarta esa y las demás siguen. */
function leerLlave(cruda: unknown): ApiKeyGuardada | null {
	if (typeof cruda !== 'object' || cruda === null) return null;
	const d = cruda as Record<string, unknown>;
	if (typeof d.id !== 'string' || d.id === '') return null;
	if (typeof d.creadaEn !== 'string' || Number.isNaN(Date.parse(d.creadaEn))) return null;
	if (typeof d.expiraEn !== 'string' || Number.isNaN(Date.parse(d.expiraEn))) return null;
	return {
		id: d.id,
		nombre: typeof d.nombre === 'string' ? d.nombre : '',
		descripcion: typeof d.descripcion === 'string' ? d.descripcion : '',
		creadaEn: d.creadaEn,
		expiraEn: d.expiraEn,
		revocadaEn:
			typeof d.revocadaEn === 'string' && !Number.isNaN(Date.parse(d.revocadaEn)) ? d.revocadaEn : null,
		ultimoUso: typeof d.ultimoUso === 'string' && !Number.isNaN(Date.parse(d.ultimoUso)) ? d.ultimoUso : null
	};
}

/** Las métricas de una llave en un periodo. Lanza con el motivo si no se
 *  pudieron traer: quien la llama decide cómo mostrarlo. */
export async function cargarMetricas(id: string, desde: string, hasta: string): Promise<MetricasApiKey> {
	let r: Response;
	try {
		r = await fetch(`/api/llaves/${encodeURIComponent(id)}/metricas?${new URLSearchParams({ desde, hasta })}`);
	} catch {
		throw new Error('No se pudo contactar al servidor.');
	}
	if (!r.ok) throw new Error(await motivo(r));
	return (await r.json()) as MetricasApiKey;
}

/**
 * ¿El servidor CONTESTÓ con un rechazo, o no se sabe qué pasó?
 *
 * No es lo mismo, y la pantalla no debe afirmar lo que no sabe. Un 4xx o un
 * 503 que devolvió nexus_back es un "no" seguro. Un 504 del BFF (se le acabó el
 * tiempo esperando a nexus_back) o un error de red NO dicen nada: la operación
 * pudo haberse hecho del otro lado — una llave emitida que nadie vio, o una
 * revocación que sí ocurrió. En esos casos se recarga el listado para saberlo.
 */
function sinRespuesta(status: number | null): boolean {
	return status === null || status === 504;
}

async function motivo(r: Response): Promise<string> {
	const cuerpo = await r.json().catch(() => null);
	return typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : `El servidor respondió ${r.status}.`;
}

/**
 * Qué carga del listado es la vigente. Dos cargas pueden cruzarse (abrir y
 * cerrar rápido, o una recarga mientras se revoca): solo la ÚLTIMA en empezar
 * puede escribir el listado, para que una respuesta vieja no pise una más nueva
 * —p. ej. que deje "Activa" una llave que se acaba de revocar—.
 */
let cargaVigente = 0;

/** Trae el listado del servidor. */
export async function cargarApiKeys(): Promise<void> {
	const turno = ++cargaVigente;
	estadoApiKeys.cargando = true;
	try {
		const r = await fetch('/api/llaves');
		if (turno !== cargaVigente) return;
		if (!r.ok) {
			estadoApiKeys.errorCarga = await motivo(r);
			return;
		}
		const datos = await r.json().catch(() => null);
		if (turno !== cargaVigente) return;
		const llaves = (Array.isArray(datos?.llaves) ? datos.llaves : [])
			.map(leerLlave)
			.filter((x: ApiKeyGuardada | null): x is ApiKeyGuardada => x !== null);
		apiKeys.splice(0, apiKeys.length, ...llaves);
		estadoApiKeys.errorCarga = '';
	} catch {
		if (turno === cargaVigente) estadoApiKeys.errorCarga = 'No se pudo contactar al servidor.';
	} finally {
		if (turno === cargaVigente) estadoApiKeys.cargando = false;
	}
}

/**
 * Emite una llave nueva EN EL SERVIDOR y devuelve el secret para mostrarlo esa
 * única vez. `null` si no hay secret que mostrar, con el motivo en
 * `estadoApiKeys.error`.
 *
 * Si el servidor la rechazó, no se perdió nada: el secret lo genera él, así
 * que no existe. Si NO contestó, pudo quedar emitida sin que nadie viera su
 * secret: se dice así, y se recarga el listado para que se vea y se revoque.
 */
export async function emitirApiKey(datos: {
	nombre: string;
	descripcion: string;
	diasParaExpirar: number;
}): Promise<{ secret: string; llave: ApiKeyGuardada } | null> {
	let r: Response;
	try {
		r = await fetch('/api/llaves', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				nombre: datos.nombre.trim(),
				descripcion: datos.descripcion.trim(),
				dias: datos.diasParaExpirar
			})
		});
	} catch {
		return emisionIncierta();
	}
	if (sinRespuesta(r.status)) return emisionIncierta();
	if (!r.ok) {
		estadoApiKeys.error = `No se creó la API Key: ${await motivo(r)}`;
		return null;
	}
	const cuerpo = await r.json().catch(() => null);
	const llave = leerLlave(cuerpo?.llave);
	if (typeof cuerpo?.secret !== 'string' || !llave) {
		estadoApiKeys.error =
			'El servidor respondió sin la llave. Si aparece en el listado, revócala y emite otra: su secret no se puede recuperar.';
		void cargarApiKeys();
		return null;
	}
	// Al frente: la recién creada es la que se viene a ver. Si una carga del
	// listado ya la trajo, no se duplica.
	if (!apiKeys.some((k) => k.id === llave.id)) apiKeys.unshift(llave);
	return { secret: cuerpo.secret, llave };
}

function emisionIncierta(): null {
	estadoApiKeys.error =
		'No se pudo confirmar si la API Key se creó: el servidor no contestó a tiempo. Revisa el listado — si aparece una nueva, revócala y emite otra, porque su secret no se puede recuperar.';
	void cargarApiKeys();
	return null;
}

/**
 * Revoca una llave EN EL SERVIDOR. Devuelve si quedó revocada.
 *
 * Revocar una que ya estaba revocada también es éxito (el servidor es
 * idempotente). Si el servidor la rechazó, la llave SIGUE SIRVIENDO y se dice
 * así. Si no contestó, no se sabe: se recarga el listado, y si ya viene
 * revocada cuenta como éxito; si no, se dice que no se pudo confirmar.
 */
export async function revocarApiKey(id: string): Promise<boolean> {
	const nombre = apiKeys.find((k) => k.id === id)?.nombre ?? id;
	if (estadoApiKeys.revocando.includes(id)) return false;
	estadoApiKeys.revocando.push(id);
	try {
		let r: Response | null = null;
		try {
			r = await fetch(`/api/llaves/${encodeURIComponent(id)}/revocar`, { method: 'POST' });
		} catch {
			r = null;
		}
		if (r && r.ok) {
			const cuerpo = await r.json().catch(() => null);
			// Se busca OTRA VEZ en el arreglo: una carga del listado pudo haber
			// cambiado los objetos mientras esto esperaba, y escribirle al de antes
			// no se vería en pantalla.
			const actual = apiKeys.find((k) => k.id === id);
			if (actual) actual.revocadaEn = typeof cuerpo?.revocadaEn === 'string' ? cuerpo.revocadaEn : new Date().toISOString();
			return true;
		}
		if (r && !sinRespuesta(r.status)) {
			estadoApiKeys.error = `No se revocó "${nombre}": ${await motivo(r)} La llave sigue activa.`;
			return false;
		}
		await cargarApiKeys();
		if (apiKeys.find((k) => k.id === id)?.revocadaEn) return true;
		estadoApiKeys.error = `No se pudo confirmar si "${nombre}" quedó revocada: el servidor no contestó a tiempo. Revisa su estado en el listado e inténtalo de nuevo si sigue activa.`;
		return false;
	} finally {
		const i = estadoApiKeys.revocando.indexOf(id);
		if (i !== -1) estadoApiKeys.revocando.splice(i, 1);
	}
}

// Las de antes: se borran de este navegador. Ver el docstring de arriba.
if (browser) {
	try {
		window.localStorage.removeItem('nexusdoc:api-keys:v1');
	} catch {
		// localStorage bloqueado: no hay nada que borrar que se pueda leer.
	}
}
