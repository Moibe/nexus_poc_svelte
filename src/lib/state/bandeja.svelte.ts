/**
 * Estado compartido de la bandeja de preparación documental.
 *
 * PROVISIONAL: solo vive en memoria del navegador (se pierde al refrescar).
 * Es a propósito mientras el DBA termina SQL Server — cuando esté lista la
 * base, esto se reemplaza por datos reales vía nexus_back y HU027.
 *
 * Por lo mismo, la detección de duplicados de aquí SOLO ve lo que ya está en
 * esta lista en memoria en esta sesión del navegador — si refrescas la página
 * o subes el mismo archivo en otro momento, no hay historial contra el cual
 * comparar. HU024 (calcular Y ALMACENAR el hash) es justo lo que resuelve esto
 * de verdad: el valor real de esta función aparece hasta que el hash se
 * compare contra todo lo que ya se ingirió antes, vía SQL Server.
 */

import { sha256 } from 'js-sha256';

import { detectarProblema } from '$lib/documentos/validar';

export type DocumentoEnBandeja = {
	id: string;
	nombre: string;
	extension: string;
	tamanioBytes: number;
	origen: 'Manual';
	agregadoEn: Date;
	estado: 'en_cola' | 'subiendo' | 'listo' | 'duplicado' | 'protegido' | 'corrupto';
	progreso: number; // 0-100; solo relevante mientras estado === 'subiendo'
	hashSha256: string | null; // null mientras estado === 'subiendo'
	seleccionado: boolean;
	// El File original. Se guarda porque el pipeline necesita volver a leer los
	// bytes cuando el usuario le da "Iniciar pipeline", que puede ser mucho
	// después de la carga. No cuesta memoria: un File es una referencia al
	// archivo en disco, no su contenido — el navegador lo lee cuando se le pide.
	// Svelte no lo envuelve en un proxy de $state (solo lo hace con objetos
	// planos y arrays), así que llega intacto a fetch().
	archivo: File;
};

// Mismas restricciones que ya anuncia la UI del dropzone. Centralizadas aquí
// porque drag&drop no respeta el atributo `accept` del <input> (eso solo
// filtra el diálogo nativo de selección), así que hace falta validar en
// código sin importar por cuál de las dos vías llegó el archivo.
const EXTENSIONES_PERMITIDAS = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'tiff'];
const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024;

const DURACION_ANIMACION_MS = 900;
const INTERVALO_TICK_MS = 60;

// NO usar crypto.randomUUID(): esa API solo existe en "contextos seguros"
// (HTTPS o localhost), y el server de CSI expone esta app por HTTP plano en su
// IP interna (sin nginx ni TLS) — ahí `crypto.randomUUID` ni siquiera existe
// como función, y truena la app entera al intentar agregar un archivo.
// Confirmado 2026-08-18 en producción (funcionaba en local porque `localhost`
// cuenta como contexto seguro aunque sea HTTP). Este generador no toca
// crypto en absoluto: es suficientemente único para una lista efímera en
// memoria del navegador, que es todo lo que necesita hoy.
let contadorId = 0;
function generarId(): string {
	contadorId += 1;
	return `${Date.now().toString(36)}-${contadorId}-${Math.random().toString(36).slice(2, 8)}`;
}

// Mismo problema de contexto seguro con la huella del documento: la forma
// "normal" de sacar un SHA-256 en el navegador es `crypto.subtle.digest`, pero
// esa API también está restringida a contexto seguro y truena igual en el
// server de CSI. `js-sha256` calcula el hash en JavaScript puro, sin tocar
// `crypto` en absoluto — funciona igual en HTTP plano (verificado leyendo su
// código fuente antes de instalarla).
function calcularHash(buffer: ArrayBuffer): string {
	return sha256(buffer);
}

export const documentosEnBandeja = $state<DocumentoEnBandeja[]>([]);

/**
 * Cola de lectura de archivos: se procesa UNO A LA VEZ.
 *
 * Antes se lanzaban todas las lecturas a la par. Con dos o tres archivos no se
 * nota, pero soltar veinte de varios MB significaba veinte `arrayBuffer()`
 * simultáneos — o sea los veinte archivos COMPLETOS en memoria al mismo tiempo,
 * más el hashing y el escaneo de firmas encima, todo peleando por el mismo hilo.
 * En fila, el pico de memoria es el del archivo más grande, no la suma.
 *
 * Las filas aparecen en la bandeja de inmediato (todas, en cuanto se sueltan);
 * lo que se serializa es la LECTURA. Por eso existe el estado 'en_cola': una
 * barra de progreso en 0% se ve trabada, y decir "En cola" es la verdad.
 *
 * Es la misma forma que ya usa el pipeline para llamar a Document AI, por las
 * mismas razones.
 */
const colaDeLectura: Array<() => Promise<void>> = [];
let drenando = false;

async function drenarCola() {
	if (drenando) return;
	drenando = true;
	try {
		while (colaDeLectura.length > 0) {
			// shift() no puede devolver undefined aquí: es el único consumidor y
			// acaba de comprobar que hay elementos.
			await colaDeLectura.shift()!();
		}
	} finally {
		drenando = false;
	}
}

/**
 * Huellas de documentos que YA salieron de la bandeja rumbo al pipeline.
 *
 * Sin esto, la detección de duplicados se rompía en cuanto se usaba el
 * pipeline: al mover un documento al tercer panel desaparece de
 * `documentosEnBandeja`, y volver a subir el mismo archivo ya no encontraba
 * contra qué compararse. Justo el caso más probable — procesar algo y volverlo
 * a subir sin querer — quedaba sin detectar.
 *
 * NO se registran aquí los que el usuario quita con la X: eso significa "no
 * quería ese archivo", no "ese archivo ya se ingirió". Solo cuenta lo que de
 * verdad entró al pipeline.
 */
const huellasProcesadas = new Set<string>();

export function agregarArchivos(files: FileList) {
	for (const file of Array.from(files)) {
		const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
		if (!EXTENSIONES_PERMITIDAS.includes(extension)) continue;
		if (file.size > TAMANO_MAXIMO_BYTES) continue;

		const id = generarId();
		documentosEnBandeja.push({
			id,
			nombre: file.name,
			extension: extension.toUpperCase(),
			tamanioBytes: file.size,
			origen: 'Manual',
			agregadoEn: new Date(),
			estado: 'en_cola',
			progreso: 0,
			hashSha256: null,
			seleccionado: false,
			archivo: file
		});
		colaDeLectura.push(() => procesarArchivo(id, file, extension));
		drenarCola();
	}
}

// La animación de progreso y el cálculo del hash corren en paralelo, pero solo
// el hash decide cuándo termina de verdad: el timer nunca pasa de 90% ni marca
// "listo" por sí solo (por eso el tope), así que nunca declaramos completo un
// archivo antes de saber si es duplicado. Si el hash tarda más que la
// animación (archivo grande, equipo lento), la barra simplemente se queda en
// 90% esperando el resultado real en vez de mentir.
function animarProgresoMientrasSube(id: string) {
	const inicio = Date.now();
	const intervalo = setInterval(() => {
		const doc = documentosEnBandeja.find((d) => d.id === id);
		if (!doc || doc.estado !== 'subiendo') {
			clearInterval(intervalo);
			return;
		}
		const transcurrido = Date.now() - inicio;
		doc.progreso = Math.min(90, Math.round((transcurrido / DURACION_ANIMACION_MS) * 90));
	}, INTERVALO_TICK_MS);
}

async function procesarArchivo(id: string, file: File, extension: string) {
	const enTurno = documentosEnBandeja.find((d) => d.id === id);
	if (!enTurno) return; // lo quitaron mientras esperaba turno
	enTurno.estado = 'subiendo';

	animarProgresoMientrasSube(id);

	// Se lee el archivo UNA sola vez y de ahí salen las dos cosas: la huella y
	// la revisión de integridad. Leerlo dos veces significaría cargar hasta
	// 20 MB de más a memoria por documento.
	let buffer: ArrayBuffer;
	try {
		buffer = await file.arrayBuffer();
	} catch {
		// Pasa de verdad: el archivo se movió, se desmontó la USB, o el navegador
		// negó el permiso. Sin este catch la promesa quedaba rechazada sin dueño,
		// la fila se quedaba en 'subiendo' PARA SIEMPRE (con su setInterval vivo)
		// y el checkbox nunca se habilitaba.
		const perdido = documentosEnBandeja.find((d) => d.id === id);
		if (perdido) {
			perdido.progreso = 100;
			perdido.estado = 'corrupto';
		}
		return;
	}

	const hash = calcularHash(buffer);
	const problema = detectarProblema(new Uint8Array(buffer), extension);

	const doc = documentosEnBandeja.find((d) => d.id === id);
	if (!doc) return; // lo quitaron (botón "quitar") mientras se procesaba

	doc.hashSha256 = hash;
	doc.progreso = 100;

	// Prioridad: un archivo que no se puede abrir (corrupto o con contraseña) no
	// va a poder procesarse aunque además sea duplicado, así que ese problema
	// manda sobre la marca de duplicado.
	if (problema) {
		doc.estado = problema;
		return;
	}

	const esDuplicado =
		huellasProcesadas.has(hash) ||
		documentosEnBandeja.some((d) => d.id !== id && d.hashSha256 === hash);
	doc.estado = esDuplicado ? 'duplicado' : 'listo';
}

/** Saca un documento de la bandeja PORQUE entró al pipeline, recordando su
 *  huella. Es distinto de `quitarDocumento`, que es el descarte del usuario. */
export function moverDocumentoAlPipeline(id: string) {
	const doc = documentosEnBandeja.find((d) => d.id === id);
	if (doc?.hashSha256) huellasProcesadas.add(doc.hashSha256);
	quitarDocumento(id);
}

export function quitarDocumento(id: string) {
	const indice = documentosEnBandeja.findIndex((doc) => doc.id === id);
	if (indice !== -1) documentosEnBandeja.splice(indice, 1);
}

export function alternarSeleccion(id: string) {
	const doc = documentosEnBandeja.find((d) => d.id === id);
	if (doc) doc.seleccionado = !doc.seleccionado;
}

export function formatearTamano(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
	return `${(kb / 1024).toFixed(1)} MB`;
}

// PROVISIONAL igual que el resto de este archivo: hoy es la hora del navegador
// de quien sube el archivo, formateada a mano (sin Intl.DateTimeFormat porque
// el formato DD/MM/AAAA, HH:MM ya está fijo y no necesita localización). Se
// reemplaza por la fecha real que registre SQL Server (columna de ingesta)
// cuando exista HU027.
export function formatearFecha(fecha: Date): string {
	const dia = String(fecha.getDate()).padStart(2, '0');
	const mes = String(fecha.getMonth() + 1).padStart(2, '0');
	const anio = fecha.getFullYear();
	const horas = String(fecha.getHours()).padStart(2, '0');
	const minutos = String(fecha.getMinutes()).padStart(2, '0');
	return `${dia}/${mes}/${anio}, ${horas}:${minutos}`;
}
