/**
 * El formato de las API keys de NexusDoc.
 *
 * ESTE ARCHIVO ES LA ESPECIFICACIÓN. El día que `nexus_back` valide llaves,
 * tiene que reimplementar exactamente esto en Python — cada paso trae anotada su
 * equivalencia — así que un cambio aquí es un cambio de contrato entre los dos
 * repos, no un detalle de presentación.
 *
 * LA FORMA
 *
 *   nxdoc_live_a7K9_sk_8fJ2xQ7mL4pV9nR6cT3yW1zH5bK0dS2
 *   └─┬─┘ └─┬┘ └┬─┘ └┬┘ └───────────┬────────┘└──┬───┘
 *  producto amb.  id  tipo      aleatorio     checksum
 *
 *  · `nxdoc` — prefijo del producto, fijo y ESTABLE. Es lo que deja que un
 *    escáner de secretos (GitHub secret scanning, TruffleHog, un hook de
 *    pre-commit) reconozca una llave pegada por error en un repo o en un ticket.
 *    Cambiarlo tira ese reconocimiento, así que no se cambia nunca.
 *  · `live` — el ambiente. Hoy solo se emite `live`; `test` queda reservado para
 *    cuando exista un sandbox. Sirve para notar de un vistazo que alguien está
 *    usando una llave de producción donde no debía.
 *  · `a7K9` — el IDENTIFICADOR de la llave, y NO es secreto. Es la pieza que
 *    permite dos cosas que el secret no puede: (1) que el listado diga CUÁL
 *    llave estás por revocar sin volver a mostrar el secret (ver `enmascarar`),
 *    y (2) que el servidor busque la fila por índice en vez de recorrer todas
 *    las llaves comparando hashes — recibe el secret, le saca el id con `idDe`,
 *    trae ESA fila y compara un solo hash.
 *  · `sk` — secret key. Deja lugar a un `pk` (clave pública) si algún día hay
 *    algo que no sea secreto, sin rehacer el formato.
 *  · 26 caracteres base62 — la parte aleatoria. log2(62) ≈ 5.95 bits por
 *    carácter, o sea ~155 bits, bastante arriba del piso de 128 que se considera
 *    infalsificable por fuerza bruta. (El id no cuenta como entropía: es
 *    público.)
 *  · 6 caracteres base62 — el checksum, ver `checksumDe`.
 *
 * LARGO TOTAL: 51 caracteres. Es estable: cualquier validador puede exigirlo.
 *
 * LO QUE NO ES
 *
 * Hoy estas llaves no autentican nada: `nexus_back` no las conoce y la app no
 * tiene autenticación. Cuando eso cambie, las reglas son las de siempre y NO se
 * negocian: la llave se genera EN EL SERVIDOR, la base guarda el hash y nunca el
 * secret, y en claro solo quedan el id y el ambiente para poder listarlas.
 *
 * Para el hash de guardado, SHA-256 pelón es lo correcto y no hace falta bcrypt
 * ni argon2: esos existen para defender contraseñas humanas, que tienen poca
 * entropía y se atacan por diccionario. Contra 155 bits aleatorios no hay
 * diccionario que sirva, y un hash lento solo costaría latencia en cada request.
 */
import { sha256 } from 'js-sha256';

/** Prefijo del producto. Ver arriba: es estable a propósito. */
export const PREFIJO = 'nxdoc';

/** Único ambiente que se emite hoy. */
export const AMBIENTE = 'live';

const TIPO = 'sk';
const LARGO_ID = 4;
const LARGO_ALEATORIO = 26;
const LARGO_CHECKSUM = 6;

/** base62. Sin caracteres fuera de [A-Za-z0-9] para que la llave viaje en URLs,
 *  headers y variables de entorno sin escaparse. */
const ALFABETO = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Cadena aleatoria en base62.
 *
 *  `crypto.getRandomValues` SÍ existe en contexto inseguro: el veto escrito en
 *  `bandeja.svelte.ts` y `configuracion.svelte.ts` es a `crypto.randomUUID` y a
 *  `crypto.subtle`, que son las que NO están definidas en el server de CSI (HTTP
 *  plano por IP) y tronaron la app el 2026-08-18. Aun así se verifica antes de
 *  llamarla y hay plan B: este proyecto ya se quemó dos veces dando por hecho
 *  que una API de `crypto` estaba ahí.
 *
 *  OJO con el plan B: `Math.random` NO es criptográficamente seguro. Es
 *  aceptable hoy porque la llave no autentica nada; el día que autentique, esto
 *  se genera en el servidor (`secrets.token_bytes` en Python) y esta función se
 *  queda solo para la demo.
 *
 *  El rechazo de bytes >= 248 no es adorno: 256 % 62 = 8, así que con
 *  `byte % 62` a secas las primeras ocho letras del alfabeto saldrían ~1.6% más
 *  seguido que el resto. */
function azar(largo: number): string {
	const hayCrypto =
		typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
	let salida = '';
	while (salida.length < largo) {
		// Se piden de más porque el rechazo descarta algunos bytes.
		const bytes = new Uint8Array((largo - salida.length) * 2);
		if (hayCrypto) crypto.getRandomValues(bytes);
		else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
		for (const b of bytes) {
			if (b >= 248) continue;
			salida += ALFABETO[b % 62];
			if (salida.length === largo) break;
		}
	}
	return salida;
}

/** Entero sin signo a base62, rellenado a la izquierda hasta `largo`. */
function aBase62(n: number, largo: number): string {
	let salida = '';
	let resto = n;
	do {
		salida = ALFABETO[resto % 62] + salida;
		resto = Math.floor(resto / 62);
	} while (resto > 0);
	return salida.padStart(largo, ALFABETO[0]);
}

/** Los seis caracteres finales de la llave.
 *
 *  PARA QUÉ SIRVE: que una herramienta decida si una cadena con esta pinta es
 *  una llave de verdad SIN llamar a la API. Es lo que baja los falsos positivos
 *  de los escáneres de secretos, y de paso atrapa un dedazo al pegarla. NO es
 *  seguridad: quien genera llaves falsas puede calcular el checksum igual que
 *  nosotros. La autenticación la da el hash guardado en la base, nada más.
 *
 *  POR QUÉ SHA-256 Y NO CRC32, que es lo que usa GitHub: las dos sirven para
 *  esto, pero CRC32 hay que escribirlo a mano en los dos lenguajes y tiene tres
 *  variantes que se confunden fácil (polinomio reflejado o no, valor inicial,
 *  XOR final). Un desacuerdo ahí entre JavaScript y Python rechazaría llaves
 *  buenas en silencio. SHA-256 ya es dependencia de este repo (`js-sha256`, en
 *  JS puro porque `crypto.subtle` tampoco existe en el server de CSI) y del otro
 *  lado es `hashlib`, sin nada que implementar.
 *
 *  EN PYTHON, literal:
 *    import hashlib
 *    d = hashlib.sha256(cuerpo.encode()).hexdigest()[:8]
 *    n = int(d, 16)   # y de ahí a base62 con el mismo alfabeto de arriba
 */
export function checksumDe(cuerpo: string): string {
	// Los primeros 4 bytes del digest (8 caracteres hex) como entero de 32 bits.
	// 62^6 ≈ 5.7e10 > 2^32 ≈ 4.3e9, así que seis caracteres siempre alcanzan.
	return aBase62(parseInt(sha256(cuerpo).slice(0, 8), 16), LARGO_CHECKSUM);
}

/** Una llave nueva: el id (público) y el secret completo (que ya lo contiene).
 *
 *  Se devuelven los dos aunque el id se pueda sacar del secret con `idDe`,
 *  porque son dos cosas con destinos opuestos: el id se GUARDA y se muestra; el
 *  secret se enseña una vez y no se guarda nunca. Tenerlos separados desde el
 *  origen es lo que evita que alguien acabe persistiendo el string entero. */
export function generarApiKey(): { id: string; secret: string } {
	const id = azar(LARGO_ID);
	const cuerpo = `${PREFIJO}_${AMBIENTE}_${id}_${TIPO}_${azar(LARGO_ALEATORIO)}`;
	return { id, secret: `${cuerpo}${checksumDe(cuerpo)}` };
}

/** Divide una llave en sus partes, o `null` si no tiene esta forma. Lo usan
 *  `validarFormato` e `idDe`; se exporta por separado porque el servidor va a
 *  querer también el ambiente. */
export function partesDe(
	secret: string
): { ambiente: string; id: string; cuerpo: string; checksum: string } | null {
	// El patrón se arma con las constantes de arriba, no con números escritos a
	// mano: si un largo cambia, el validador cambia con él.
	const patron = new RegExp(
		`^${PREFIJO}_([a-z]+)_([A-Za-z0-9]{${LARGO_ID}})_${TIPO}_` +
			`([A-Za-z0-9]{${LARGO_ALEATORIO}})([A-Za-z0-9]{${LARGO_CHECKSUM}})$`
	);
	const m = patron.exec(secret);
	if (!m) return null;
	return {
		ambiente: m[1],
		id: m[2],
		cuerpo: secret.slice(0, secret.length - LARGO_CHECKSUM),
		checksum: m[4]
	};
}

/** ¿Esta cadena tiene forma de llave nuestra Y su checksum cuadra?
 *
 *  Es la primera puerta del servidor: descarta basura sin tocar la base. NO
 *  dice que la llave exista ni que siga viva — eso es buscar el id y comparar el
 *  hash. */
export function validarFormato(secret: string): boolean {
	const partes = partesDe(secret);
	if (!partes) return false;
	return checksumDe(partes.cuerpo) === partes.checksum;
}

/** El id de una llave ya emitida, o `null` si la cadena no es una llave. */
export function idDe(secret: string): string | null {
	return partesDe(secret)?.id ?? null;
}

/** Cómo se nombra una llave en el listado, donde el secret ya no existe:
 *  `nxdoc_live_a7K9_sk_••••`. Es exactamente para lo que sirve tener un id. */
export function enmascarar(id: string): string {
	return `${PREFIJO}_${AMBIENTE}_${id}_${TIPO}_${'•'.repeat(4)}`;
}
