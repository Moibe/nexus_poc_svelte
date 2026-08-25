/**
 * Punto único de contacto con nexus_back (la FastAPI).
 *
 * Vive bajo `$lib/server/` a propósito: SvelteKit se niega a compilar si algo
 * de este directorio se importa desde código que llega al navegador. Eso es
 * justo lo que queremos — la URL de la API es interna (127.0.0.1) y el día que
 * haya credenciales o llaves, no deben poder filtrarse a un bundle de cliente.
 *
 * El navegador NUNCA habla con nexus_back directo: pega a las rutas `/api/*`
 * de este mismo servidor SvelteKit, y estas reenvían. Además de esconder la
 * API, eso evita CORS por completo (mismo origen) y deja un solo lugar donde
 * poner autenticación cuando exista.
 */

import { env } from '$env/dynamic/private';

// `$env/dynamic/private` y no `$env/static/private` porque adapter-node lee las
// variables al ARRANCAR el proceso, no al compilar: así el mismo `build/` sirve
// en local y en el server de CSI sin recompilar.
//
// El default cubre los dos escenarios reales sin necesidad de .env: en local,
// scripts/dev.mjs levanta uvicorn en 8083; en el server de CSI, pm2 corre la
// API en el mismo host y puerto. Solo hace falta la variable si algún día la
// API se mueve a otra máquina.
const BASE = (env.NEXUS_API_URL ?? 'http://127.0.0.1:8083').replace(/\/+$/, '');

export function urlNexus(ruta: string): string {
	return `${BASE}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
}

/**
 * Tope de espera para una llamada a nexus_back.
 *
 * Va por ENCIMA del timeout que la propia API aplica contra Document AI
 * (IA_TIMEOUT=120s en su .env). Al revés sería contraproducente: cortaríamos
 * aquí una extracción que allá todavía va a terminar bien, y el usuario vería
 * un error de un trabajo que en realidad se completó. Los 10 segundos de
 * holgura son para el ida y vuelta y el parseo.
 */
export const TIMEOUT_MS = 130_000;
