/**
 * Las API keys emitidas.
 *
 * QUÉ SE GUARDA, Y QUÉ NO. Aquí vive la METADATA de cada llave —nombre,
 * descripción, id público, cuándo se creó, cuándo expira, si fue revocada— y
 * NUNCA el secret. Esa es toda la regla y es la que sostiene la promesa que
 * imprime la pantalla de alta ("no volveremos a mostrarlo después de cerrar
 * esta vista"): si el secret se guardara, el listado podría volver a enseñarlo y
 * esa frase sería mentira. Un sistema real hace exactamente esto, solo que del
 * lado del servidor y guardando además el HASH del secret para poder
 * verificarlo; aquí no hay nada que verificar todavía, así que ni el hash se
 * guarda.
 *
 * POR QUÉ localStorage. Es lo que hay: `nexus_back` no tiene concepto de API
 * keys. Mismo mecanismo que la Biblioteca de tipos documentales, con las mismas
 * tres precauciones que allá: llave versionada, lectura defensiva (lo que sale
 * de localStorage es entrada NO confiable) y un fallo de escritura que se
 * REPORTA en vez de tragarse — ver `estadoApiKeys`.
 *
 * EL ESTADO NO SE GUARDA, SE CALCULA. "Expirada" sale de comparar `expiraEn`
 * contra el reloj, no de una bandera: una llave guardada como "activa" seguiría
 * diciéndolo para siempre, porque nada la vuelve a tocar después de emitirla.
 * Lo único que sí se persiste es la revocación, que es un hecho, no un cálculo.
 */
import { browser } from '$app/environment';
import { generarApiKey } from '$lib/apiKeys/formato';

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
	/** ISO-8601 o `null` si sigue viva. Es el ÚNICO estado que se persiste. */
	revocadaEn: string | null;
};

const LLAVE = 'nexusdoc:api-keys:v1';

/** Las llaves emitidas, de la más nueva a la más vieja. */
export const apiKeys = $state<ApiKeyGuardada[]>([]);

/** Lo mismo que `estadoBiblioteca` en `configuracion.svelte.ts`, y por la misma
 *  razón: un `catch` vacío haría que la pantalla confirmara guardados que no
 *  ocurrieron. Aquí importa más todavía — una llave perdida no se puede
 *  recapturar como un tipo documental, porque su secret ya no existe. */
export const estadoApiKeys = $state<{ falloAlGuardar: boolean }>({ falloAlGuardar: false });

export function reconocerFallaDeGuardado() {
	estadoApiKeys.falloAlGuardar = false;
}

function almacen(): Storage | null {
	// En el render del servidor no hay `window`, y tocar localStorage ahí truena
	// el render entero.
	if (!browser) return null;
	try {
		return window.localStorage;
	} catch {
		// Puede LANZAR, no solo venir vacío: navegación privada y los navegadores
		// con "datos de sitios" bloqueados tiran al acceder a la propiedad.
		return null;
	}
}

/** Valida UNA llave venida de localStorage. `null` si no tiene la forma
 *  esperada: se descarta esa y las demás siguen, en vez de tirar el listado
 *  entero por una fila corrupta. */
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
			typeof d.revocadaEn === 'string' && !Number.isNaN(Date.parse(d.revocadaEn))
				? d.revocadaEn
				: null
	};
}

function hidratar() {
	const store = almacen();
	if (!store) return;
	const crudo = store.getItem(LLAVE);
	if (!crudo) return;
	try {
		const datos: unknown = JSON.parse(crudo);
		if (!Array.isArray(datos)) return;
		for (const fila of datos) {
			const llave = leerLlave(fila);
			if (llave) apiKeys.push(llave);
		}
	} catch {
		// JSON corrupto: se arranca vacío. No se borra la llave de localStorage a
		// propósito, por si alguien quiere rescatarla a mano desde la consola.
	}
}

hidratar();

/** Escribe el listado completo. Devuelve si lo logró — quien llama TIENE que
 *  mirar el resultado, porque de eso depende que la pantalla diga la verdad. */
function guardar(): boolean {
	const store = almacen();
	// Sin localStorage (render en servidor) no hay nada que escribir ni que
	// reportar: no es un fallo, es que no hay navegador.
	if (!store) return true;
	try {
		if (apiKeys.length === 0) store.removeItem(LLAVE);
		else store.setItem(LLAVE, JSON.stringify($state.snapshot(apiKeys)));
		estadoApiKeys.falloAlGuardar = false;
		return true;
	} catch {
		// Cuota llena, almacenamiento bloqueado o modo privado. No se distingue el
		// motivo: para quien mira la pantalla las tres cosas significan lo mismo.
		estadoApiKeys.falloAlGuardar = true;
		return false;
	}
}

/** En qué estado está una llave AHORA. Ver la nota de arriba: solo la
 *  revocación se guarda; lo demás se calcula contra el reloj. */
export function estadoDe(llave: ApiKeyGuardada, ahora: number = Date.now()): EstadoApiKey {
	if (llave.revocadaEn) return 'revocada';
	if (Date.parse(llave.expiraEn) <= ahora) return 'expirada';
	return 'activa';
}

/**
 * Emite una llave nueva: genera el secret, guarda SOLO su metadata y devuelve el
 * secret para que la pantalla lo muestre esa única vez.
 *
 * Devuelve `guardada: false` si localStorage no aceptó la escritura. La llave se
 * devuelve igual —el secret ya existe y quien lo pidió tiene derecho a verlo—,
 * pero la pantalla tiene que avisar que NO va a aparecer en el listado. Fingir
 * que se guardó sería el mismo error que ya se corrigió en la Biblioteca.
 */
export function emitirApiKey(datos: {
	nombre: string;
	descripcion: string;
	diasParaExpirar: number;
}): { secret: string; llave: ApiKeyGuardada; guardada: boolean } {
	const { id, secret } = generarApiKey();
	const ahora = new Date();
	const llave: ApiKeyGuardada = {
		id,
		nombre: datos.nombre.trim(),
		descripcion: datos.descripcion.trim(),
		creadaEn: ahora.toISOString(),
		expiraEn: new Date(
			ahora.getTime() + datos.diasParaExpirar * 24 * 60 * 60 * 1000
		).toISOString(),
		revocadaEn: null
	};
	// Al frente: la recién creada es la que se viene a ver.
	apiKeys.unshift(llave);
	const guardada = guardar();
	// Si no se pudo guardar, no se deja una fila fantasma en pantalla que
	// desaparecería al refrescar.
	if (!guardada) apiKeys.shift();
	return { secret, llave, guardada };
}

/** Revoca una llave. Es lo único que se puede hacer con una llave ya emitida:
 *  no se puede "editar" un secret que nadie guardó, y borrarla del listado
 *  dejaría de contar que existió. Devuelve si se pudo persistir. */
export function revocarApiKey(id: string): boolean {
	const llave = apiKeys.find((k) => k.id === id);
	if (!llave || llave.revocadaEn) return true;
	llave.revocadaEn = new Date().toISOString();
	const ok = guardar();
	if (!ok) llave.revocadaEn = null;
	return ok;
}
