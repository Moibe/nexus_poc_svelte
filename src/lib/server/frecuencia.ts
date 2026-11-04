/**
 * Topes de frecuencia y de subidas simultáneas del BFF (NEX-559, NEX-563 y NEX-548 de la auditoría de seguridad 2026-10-30).
 *
 * La tabla de qué ruta tiene qué tope está en `guardia-de-rutas.ts` (`reglaDeLimite`, `esSubida`); aquí vive el estado en memoria y la lectura
 * de las variables de entorno con que se ajustan. Cada tope se puede cambiar sin tocar el código con `LIMITE_<NOMBRE>_USUARIO` y
 * `LIMITE_<NOMBRE>_IP` (peticiones por minuto; el nombre en mayúsculas y con guion bajo: `LIMITE_VALIDAR_WEBHOOK_USUARIO`), y las subidas
 * que caben a la vez con `SUBIDAS_SIMULTANEAS` (6 por defecto).
 *
 * El contador vive en la memoria del proceso: con un solo proceso del front alcanza, y reiniciarlo lo deja en cero. No es una cuenta de lo que
 * pasó, es un freno contra el abuso; nexus_back sigue teniendo los suyos.
 */

import { env } from '$env/dynamic/private';

import { reglaDeLimite } from '$lib/server/guardia-de-rutas';
import { Limitador, Tope } from '$lib/server/seguridad';

const VENTANA_MS = 60_000;

const limitadores = new Map<string, { usuario: Limitador; ip: Limitador }>();

function numeroDeEntorno(nombre: string, porDefecto: number): number {
	const v = Number(env[nombre]);
	return Number.isFinite(v) && v > 0 ? v : porDefecto;
}

/**
 * Anota la petición y dice si hay que frenarla. Con sesión cuenta por persona Y por IP; sin ella (`usuarioGuid` nulo) solo por IP. Devuelve
 * cuántos segundos esperar, o `null` si pasa (o si la ruta no tiene tope).
 */
export function frenarPorFrecuencia(ruta: string, metodo: string, usuarioGuid: string | null, ip: string): { reintentarEnSeg: number } | null {
	const regla = reglaDeLimite(ruta, metodo);
	if (!regla) return null;
	const sufijo = regla.nombre.toUpperCase().replace(/-/g, '_');
	let par = limitadores.get(regla.nombre);
	if (!par) {
		par = {
			usuario: new Limitador(numeroDeEntorno(`LIMITE_${sufijo}_USUARIO`, regla.usuario), VENTANA_MS),
			ip: new Limitador(numeroDeEntorno(`LIMITE_${sufijo}_IP`, regla.ip), VENTANA_MS)
		};
		limitadores.set(regla.nombre, par);
	}
	const porIp = par.ip.intentar(ip);
	if (!porIp.permitido) return { reintentarEnSeg: porIp.reintentarEnSeg };
	if (usuarioGuid) {
		const porUsuario = par.usuario.intentar(usuarioGuid);
		if (!porUsuario.permitido) return { reintentarEnSeg: porUsuario.reintentarEnSeg };
	}
	return null;
}

/** Cuántas subidas de archivos caben a la vez: cada una se carga entera en memoria (hasta 20 MB). */
export const topeDeSubidas = new Tope(numeroDeEntorno('SUBIDAS_SIMULTANEAS', 6));
