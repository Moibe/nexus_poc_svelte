/**
 * Qué rol exige cada ruta `/api/*` que MUEVE o configura algo (NEX-554, auditoría de seguridad 2026-10-30, hallazgo NX-05).
 *
 * Hasta ahora el BFF solo comprobaba que hubiera sesión y fijaba el tenant: el rol lo decidía únicamente nexus_back, y las funciones de
 * `permisos.ts` solo escondían botones. Esta tabla es la primera red: `hooks.server.ts` responde 403 `sin_permiso` ANTES de llamar al back
 * cuando el rol de la sesión no alcanza. El back sigue siendo la autoridad y repite la comprobación (`servicios/aislamiento.py`); esto solo
 * evita que una petición que va a ser rechazada llegue hasta allá, y deja el error en el front aunque el back falle abierto o cambie.
 *
 * Es el espejo de lo que ya exige nexus_back, ruta por ruta; no inventa permisos:
 *   · `administrar` — `roles.PUEDEN_ADMINISTRAR` (Administrador y Supervisor, y el administrador de plataforma): API Keys, webhooks, procesos,
 *     la biblioteca de tipos documentales y todo lo de los procesadores de Document AI. (Los tipos de expediente virtual tenían aquí su
 *     regla; se quitaron con los expedientes virtuales el 2026-11-05 y `/api/tipos-expediente` ya no existe. Igual los grupos de
 *     expedientes: se quitaron el 2026-11-06 y `/api/grupos` ya no existe.)
 *   · `organizar` — `roles.PUEDEN_ORGANIZAR` (además, Analista y Operador): crear expedientes, meter y sacar documentos, ejecutar procesos.
 *
 * LEER (GET) sigue abierto a todo el que opera en la organización, salvo en las rutas donde nexus_back también lo pide a quien administra
 * (API Keys, webhooks y lo de los procesadores). Las rutas que no están aquí (bandeja, documentos, archivos, usuarios, organizaciones, acceso)
 * se quedan como estaban: las decide el back.
 *
 * Es puro (solo texto y regex) para probarlo con una matriz de rol × método × ruta.
 */

export type Exigencia = 'administrar' | 'organizar';

type Regla = { patron: RegExp; metodos: 'todos' | 'escritura'; exige: Exigencia };

const REGLAS: readonly Regla[] = [
	// Administrar — también al leer (nexus_back lo pide así).
	{ patron: /^\/api\/llaves(\/.*)?$/, metodos: 'todos', exige: 'administrar' },
	{ patron: /^\/api\/webhooks(\/.*)?$/, metodos: 'todos', exige: 'administrar' },
	// Procesadores: activar, borrar, consultar, generar campos y el clasificador. `clasificador/asegurar` NO: lo llama el pipeline de cualquier
	// rol que sube documentos (el back lo abre a quien opera en la organización), así que va aparte, sin exigencia.
	{ patron: /^\/api\/procesadores\/activar$/, metodos: 'todos', exige: 'administrar' },
	{ patron: /^\/api\/procesadores\/generar-campos$/, metodos: 'todos', exige: 'administrar' },
	{ patron: /^\/api\/procesadores\/clasificador$/, metodos: 'todos', exige: 'administrar' },
	{ patron: /^\/api\/procesadores\/clasificador\/sincronizar$/, metodos: 'todos', exige: 'administrar' },
	{ patron: /^\/api\/procesadores\/(?!clasificador(\/|$))[^/]+$/, metodos: 'todos', exige: 'administrar' },
	// Administrar — solo al escribir (leer lo abre el back a quien opera en la organización: el pipeline y las pantallas de uso lo necesitan).
	{ patron: /^\/api\/procesos(\/.*)?$/, metodos: 'escritura', exige: 'administrar' },
	{ patron: /^\/api\/tipos-documentales(\/.*)?$/, metodos: 'escritura', exige: 'administrar' },
	// Organizar — solo al escribir.
	{ patron: /^\/api\/expedientes(\/.*)?$/, metodos: 'escritura', exige: 'organizar' },
	{ patron: /^\/api\/ejecuciones(\/.*)?$/, metodos: 'escritura', exige: 'organizar' }
];

const SOLO_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Qué rol exige esa ruta con ese método, o `null` si el BFF no la decide (la decide el back). */
export function exigenciaDeRuta(ruta: string, metodo: string): Exigencia | null {
	const limpia = ruta.replace(/\/+$/, '') || '/';
	const escribe = !SOLO_LECTURA.has(metodo.toUpperCase());
	for (const r of REGLAS) {
		if (!r.patron.test(limpia)) continue;
		if (r.metodos === 'escritura' && !escribe) continue;
		return r.exige;
	}
	return null;
}

// ── Frecuencia y subidas (NEX-559, NEX-563, NEX-548) ─────────────────────────

/** Un tope de peticiones por minuto para una ruta costosa o con efecto afuera: por persona y por IP (la IP va holgada: detrás del proxy puede ser la de todos). */
export type ReglaDeLimite = { nombre: string; usuario: number; ip: number };

const LIMITES: readonly { patron: RegExp; metodo: string; regla: ReglaDeLimite }[] = [
	// Cada llamada a Document AI cuesta: subir varios documentos seguidos no debe toparse (cada documento son 2 o 3 llamadas).
	{ patron: /^\/api\/pipeline\/(clasificar|extraer)$/, metodo: 'POST', regla: { nombre: 'pipeline', usuario: 120, ip: 600 } },
	// Cada sugerencia es una llamada a Gemini (centavos): un clic compulsivo, o un script con una sesión robada, no debe volverse una factura. 20 por
	// minuto por persona sobra para quien captura tipos a mano (con documentos, que cuesta más, comparte el mismo tope: 2026-11-07); la IP va holgada porque detrás del proxy puede ser la de toda la oficina.
	{ patron: /^\/api\/tipos-documentales\/sugerir-descripcion(-con-documentos)?$/, metodo: 'POST', regla: { nombre: 'sugerir-descripcion', usuario: 20, ip: 100 } },
	// Los recuadros de «Generar a partir de un documento» (2026-11-12): marcar, completar y proponer campos son llamadas a Gemini (~US$0.0005 cada una).
	// Una propuesta con 3 documentos hace 6 de golpe y cada ajuste de un recuadro, una más (tras 1.2 s quieto); 60 por minuto por persona sobra para eso.
	{ patron: /^\/api\/procesadores\/(ubicar-campos|describir-campos?|proponer-campo)$/, metodo: 'POST', regla: { nombre: 'recuadros', usuario: 60, ip: 300 } },
	// El servidor le pega a una URL de un tercero (nexus_back ya limita por webhook; esto es el tope por persona).
	{ patron: /^\/api\/webhooks\/[^/]+\/validar$/, metodo: 'POST', regla: { nombre: 'validar-webhook', usuario: 20, ip: 60 } },
	// Cada reenvío es un correo.
	{ patron: /^\/api\/usuarios\/[^/]+\/reenviar-invitacion$/, metodo: 'POST', regla: { nombre: 'reenviar-invitacion', usuario: 10, ip: 30 } },
	{ patron: /^\/api\/organizaciones\/[^/]+\/usuarios\/[^/]+\/reenviar-invitacion$/, metodo: 'POST', regla: { nombre: 'reenviar-invitacion', usuario: 10, ip: 30 } },
	// Sin sesión: solo cuenta la IP. Recuperar la contraseña manda un correo; el login es el blanco de la fuerza bruta (nexus_back cuenta por cuenta
	// y por navegador; este tope por IP corta el rocío de contraseñas sobre muchas cuentas). Holgados por las oficinas que salen por una sola IP.
	{ patron: /^\/api\/auth\/recuperacion$/, metodo: 'POST', regla: { nombre: 'recuperacion', usuario: 20, ip: 20 } },
	{ patron: /^\/api\/auth\/recuperacion\/confirmar$/, metodo: 'POST', regla: { nombre: 'recuperacion-confirmar', usuario: 30, ip: 30 } },
	{ patron: /^\/api\/auth\/login$/, metodo: 'POST', regla: { nombre: 'login', usuario: 120, ip: 120 } }
];

/** El tope que le toca a esa ruta con ese método, o `null` si no tiene. */
export function reglaDeLimite(ruta: string, metodo: string): ReglaDeLimite | null {
	const limpia = ruta.replace(/\/+$/, '') || '/';
	for (const l of LIMITES) if (l.metodo === metodo.toUpperCase() && l.patron.test(limpia)) return l.regla;
	return null;
}

const SUBIDAS: readonly RegExp[] = [
	/^\/api\/archivos$/,
	/^\/api\/documentos$/,
	/^\/api\/pipeline\/(clasificar|extraer)$/,
	/^\/api\/procesadores\/generar-campos$/,
	/^\/api\/expedientes\/[^/]+\/documentos$/
];

/** ¿Es una subida de archivos? Cada una se carga entera en memoria, así que se cuentan para que no quepan más de las que el proceso aguanta (NEX-563). */
export function esSubida(ruta: string, metodo: string): boolean {
	if (metodo.toUpperCase() !== 'POST') return false;
	const limpia = ruta.replace(/\/+$/, '') || '/';
	return SUBIDAS.some((s) => s.test(limpia));
}
