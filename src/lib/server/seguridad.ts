/**
 * Piezas de seguridad del BFF que no dependen de SvelteKit (por eso se pueden probar con `node --experimental-strip-types`).
 *
 * Nacen de la auditoría de seguridad de código del 2026-10-30 (NEX-546): cada función dice en su comentario de qué hallazgo viene.
 * Nada de aquí decide permisos: el back sigue siendo la autoridad; esto es la primera red.
 */

// ── Frecuencia (NEX-559) ─────────────────────────────────────────────────────

/**
 * Cuenta cuántas veces se hizo algo en una ventana de tiempo, por clave (usuario, IP…). Vive en la memoria del proceso: con un solo proceso
 * del front alcanza, y si se reinicia el contador empieza de cero (es un tope contra abuso, no una cuenta de lo que pasó).
 */
export class Limitador {
	private readonly visitas = new Map<string, number[]>();
	private llamadas = 0;

	constructor(
		readonly maximo: number,
		readonly ventanaMs: number
	) {}

	/** Anota una visita de `clave` y dice si cabe. Una visita rechazada NO se anota: quien insiste no se alarga su propio castigo. */
	intentar(clave: string, ahora: number = Date.now()): { permitido: boolean; reintentarEnSeg: number } {
		if (++this.llamadas % 200 === 0) this.podar(ahora);
		const desde = ahora - this.ventanaMs;
		const recientes = (this.visitas.get(clave) ?? []).filter((t) => t > desde);
		if (recientes.length >= this.maximo) {
			this.visitas.set(clave, recientes);
			return { permitido: false, reintentarEnSeg: Math.max(1, Math.ceil((recientes[0] + this.ventanaMs - ahora) / 1000)) };
		}
		recientes.push(ahora);
		this.visitas.set(clave, recientes);
		return { permitido: true, reintentarEnSeg: 0 };
	}

	private podar(ahora: number): void {
		const desde = ahora - this.ventanaMs;
		for (const [clave, tiempos] of this.visitas) {
			const vivos = tiempos.filter((t) => t > desde);
			if (vivos.length === 0) this.visitas.delete(clave);
			else this.visitas.set(clave, vivos);
		}
	}

	/** Cuántas claves tiene en memoria (para las pruebas). */
	get claves(): number {
		return this.visitas.size;
	}
}

/**
 * Un tope de cosas haciéndose a la vez (NEX-563): las subidas se cargan enteras en memoria, y varias de 20 MB juntas pueden acabar con el
 * proceso. `entrar()` devuelve la función que hay que llamar al terminar, o `null` si ya no cabe (quien llama responde 429 o 503).
 */
export class Tope {
	private dentro = 0;

	constructor(readonly maximo: number) {}

	entrar(): (() => void) | null {
		if (this.dentro >= this.maximo) return null;
		this.dentro++;
		let liberado = false;
		return () => {
			if (liberado) return;
			liberado = true;
			this.dentro--;
		};
	}

	get ocupados(): number {
		return this.dentro;
	}
}

// ── Archivos (NEX-563) ───────────────────────────────────────────────────────

export type FirmaDeArchivo = 'pdf' | 'jpeg' | 'png' | 'tiff';

/**
 * Qué clase de archivo es por sus PRIMEROS BYTES, no por su nombre ni por el tipo que dijo el navegador (que escribe quien sube). `null` si no
 * es uno de los cuatro que la app procesa: PDF, JPEG, PNG o TIFF. El PDF puede traer basura antes de su `%PDF-` (la norma deja hasta 1024 bytes),
 * así que se busca en ese tramo.
 */
export function firmaDeArchivo(bytes: Uint8Array): FirmaDeArchivo | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
	if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
	if (bytes.length >= 4) {
		const ii = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00;
		const mm = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a;
		if (ii || mm) return 'tiff';
	}
	const tramo = Math.min(bytes.length - 4, 1024);
	for (let i = 0; i <= tramo; i++) {
		if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) return 'pdf';
	}
	return null;
}

/** El tipo de contenido que le corresponde a cada firma: el que se pone al SERVIR un archivo (NEX-558), nunca el que pide quien lo pide. */
export const TIPO_DE_CONTENIDO: Record<FirmaDeArchivo, string> = {
	pdf: 'application/pdf',
	jpeg: 'image/jpeg',
	png: 'image/png',
	tiff: 'image/tiff'
};

/** Los tipos de contenido que la app sirve para un archivo (lista blanca, NEX-558). */
export const TIPOS_PERMITIDOS: ReadonlySet<string> = new Set(Object.values(TIPO_DE_CONTENIDO));

/**
 * El tipo de contenido con que se sirve un archivo (NEX-558): el que dice nexus_back si está en la lista blanca; si no, el que pidió el
 * navegador (`?mime=`) solo si está en la lista; si tampoco, el genérico (`application/octet-stream`, que el navegador descarga y no ejecuta).
 * Nunca se deja pasar algo como `text/html` o `image/svg+xml`, que desde el mismo origen que la app ejecutarían un script.
 */
export function tipoDeContenidoSeguro(deLaApi: string | null | undefined, pedido: string | null | undefined): string {
	const limpio = (t: string | null | undefined) => (t ?? '').split(';')[0].trim().toLowerCase();
	const a = limpio(deLaApi);
	if (TIPOS_PERMITIDOS.has(a)) return a;
	const b = limpio(pedido);
	if (TIPOS_PERMITIDOS.has(b)) return b;
	return 'application/octet-stream';
}

// ── Cuerpos (NEX-566) ────────────────────────────────────────────────────────

export type LecturaDeJson = { ok: true; datos: unknown } | { ok: false; status: 400 | 413 };

/**
 * Lee el cuerpo JSON de una petición SIN dejar que pese más de `maximo` bytes (NEX-566). El límite global de la app es de 25 MB (por las subidas
 * de documentos) y `request.json()` lo cargaría completo en memoria aunque quien manda no tenga sesión: login y recuperación solo necesitan
 * unos cuantos cientos de bytes. Se mira `content-length` y, como puede mentir o faltar (transferencia por trozos), también se corta la lectura.
 */
export async function leerJsonAcotado(request: Request, maximo: number): Promise<LecturaDeJson> {
	const declarado = Number(request.headers.get('content-length'));
	if (Number.isFinite(declarado) && declarado > maximo) return { ok: false, status: 413 };
	const lector = request.body?.getReader();
	if (!lector) return { ok: false, status: 400 };
	const trozos: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await lector.read();
		if (done) break;
		total += value.byteLength;
		if (total > maximo) {
			await lector.cancel().catch(() => undefined);
			return { ok: false, status: 413 };
		}
		trozos.push(value);
	}
	const bytes = new Uint8Array(total);
	let desde = 0;
	for (const t of trozos) {
		bytes.set(t, desde);
		desde += t.byteLength;
	}
	try {
		return { ok: true, datos: JSON.parse(new TextDecoder().decode(bytes)) };
	} catch {
		return { ok: false, status: 400 };
	}
}

// ── Origen de las peticiones que cambian algo (NEX-562) ─────────────────────

const METODOS_QUE_NO_CAMBIAN_NADA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * ¿Es una petición que cambia algo y viene de OTRO sitio? (NEX-562). La comprobación que trae SvelteKit solo mira los formularios; una petición
 * con cuerpo JSON no pasa por ella y solo la frenan las cookies `SameSite=Lax`. Aquí se compara `Origin` —que el navegador pone solo y un
 * sitio ajeno no puede cambiar— contra el origen de la app y los de confianza. Sin `Origin` (un script, `curl`, un navegador viejo) no se
 * rechaza: no es el ataque que esto frena, y esas peticiones no llevan las cookies de nadie sin que quien las manda las tenga.
 */
export function esPeticionDeOrigenAjeno(metodo: string, origin: string | null, origenPropio: string, confiables: readonly string[]): boolean {
	if (METODOS_QUE_NO_CAMBIAN_NADA.has(metodo.toUpperCase())) return false;
	if (origin === null) return false;
	if (origin === origenPropio) return false;
	return !confiables.includes(origin);
}

// ── Cookies (NEX-547) ────────────────────────────────────────────────────────

/**
 * ¿La conexión de la persona es HTTPS? Delante del servidor hay un proxy que termina el TLS y le habla al proceso por HTTP plano, así que
 * `url.protocol` dice «http:» aunque la persona entre por HTTPS: sin mirar `X-Forwarded-Proto`, las cookies de sesión de quien entra por el
 * dominio saldrían SIN `Secure` (NEX-547). Si alguien manda la cabecera a mano por HTTP plano, solo se perjudica a sí mismo: el navegador no
 * guarda una cookie `Secure` que llega por HTTP.
 */
export function esConexionSegura(url: URL, cabeceras: Headers): boolean {
	if (url.protocol === 'https:') return true;
	return (cabeceras.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase() === 'https';
}

// ── La gracia de la renovación (NEX-560) ─────────────────────────────────────

export type Cliente = { ip: string; userAgent: string | null };

const familiaDeIp = (ip: string) => (ip.includes(':') ? 6 : 4);

/**
 * ¿Son el mismo cliente? Se usa para que la gracia de la renovación de la sesión (los pocos segundos en que un refresh ya canjeado todavía recibe la
 * sesión nueva, porque el navegador manda con él las peticiones que salieron antes de recibir las cookies nuevas) solo la reciba quien pidió la
 * renovación, y no cualquiera que presente ese refresh (NEX-560, auditoría de seguridad 2026-10-30). Mismo `User-Agent` y misma IP; una IPv4 y una
 * IPv6 cuentan como la misma persona, porque un navegador con las dos sale por una o por otra en peticiones simultáneas y no se le puede cerrar la
 * sesión por eso.
 */
export function esMismoCliente(a: Cliente, b: Cliente): boolean {
	if ((a.userAgent ?? '') !== (b.userAgent ?? '')) return false;
	if (a.ip === b.ip) return true;
	return familiaDeIp(a.ip) !== familiaDeIp(b.ip);
}

// ── Cuerpos que se reenvían (NEX-551) ───────────────────────────────────────

/** Dice si el valor de un campo es de la forma que se espera. */
export type Validador = (valor: unknown) => boolean;

export const esTexto: Validador = (v) => typeof v === 'string';
export const esTextoONulo: Validador = (v) => v === null || typeof v === 'string';
export const esBooleano: Validador = (v) => typeof v === 'boolean';

/**
 * Arma el cuerpo que se reenvía a nexus_back campo por campo, con una lista blanca (NEX-551, hallazgo NX-22): solo pasan los campos que la ruta
 * declara y con la forma esperada; todo lo demás que mande el navegador —`rol`, una bandera de administrador, `tenant`, lo que se le ocurra— se
 * descarta aquí, sin esperar a que el back lo ignore. Lo que falta o viene con otra forma NO se inventa ni se rechaza: simplemente no pasa, y
 * el back contesta su 422 con lo que le haga falta.
 */
export function soloCampos(datos: unknown, permitidos: Record<string, Validador>): Record<string, unknown> {
	const salida: Record<string, unknown> = {};
	if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) return salida;
	const crudo = datos as Record<string, unknown>;
	for (const [campo, valido] of Object.entries(permitidos)) {
		const valor = crudo[campo];
		if (valor !== undefined && valido(valor)) salida[campo] = valor;
	}
	return salida;
}

/** La «recuperación» del perfil y de la organización (correo y teléfono de recuperación): un objeto con solo esos dos campos de texto, o nada. */
export function recuperacionDe(valor: unknown): Record<string, unknown> | undefined {
	if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return undefined;
	return soloCampos(valor, { telefono: esTextoONulo, email: esTextoONulo });
}
