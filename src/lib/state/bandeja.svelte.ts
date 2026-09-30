/**
 * Estado compartido de la bandeja de preparación documental.
 *
 * PROVISIONAL: solo vive en memoria del navegador (se pierde al refrescar).
 * Es a propósito mientras el DBA termina SQL Server — cuando esté lista la
 * base, esto se reemplaza por datos reales vía nexus_back y HU027.
 *
 * La excepción, desde el 2026-09-30, es lo que llega por la API de clientes
 * (`POST /bandeja/` de nexus_back): eso SÍ vive en el servidor, y la bandeja
 * lo trae con `sincronizarEntradasApi` — aparece con origen "API REST",
 * sobrevive a refrescar y lo ven todos los navegadores. Lo que se sube a mano
 * sigue siendo solo de esta pestaña.
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
	origen: 'Manual' | 'API REST';
	/** Solo para lo que llegó por la API: el id de su entrada en el servidor,
	 *  con el que se retira de la bandeja al procesarla o descartarla. */
	idEntrada?: string;
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
	//
	// `null` solo mientras un documento que llegó por la API todavía no se baja
	// del almacén: en cuanto se baja, pasa por la misma revisión que uno subido
	// a mano, y ningún documento sin archivo llega a 'listo'.
	archivo: File | null;
};

/**
 * Un archivo recién elegido/soltado que TODAVÍA no entra a la bandeja ni al
 * pipeline: solo se quedó en el primer panel ("Carga documental") esperando a
 * que el usuario confirme con "Subir documentos" (o lo descarte con
 * "Cancelar"). Sin campo `estado`: mientras es pendiente el único estado
 * posible es "Pendiente de carga", así que no hace falta modelarlo como enum.
 */
export type ArchivoPendienteDeCarga = {
	id: string;
	nombre: string;
	extension: string;
	tamanioBytes: number;
	agregadoEn: Date;
	seleccionado: boolean;
	archivo: File;
};

// Mismas restricciones que ya anuncia la UI del dropzone. Centralizadas aquí
// porque drag&drop no respeta el atributo `accept` del <input> (eso solo
// filtra el diálogo nativo de selección), así que hace falta validar en
// código sin importar por cuál de las dos vías llegó el archivo.
// PNG se agregó el 2026-08-25 y NO viene del Figma original, que solo listaba
// PDF/DOCX/XLSX/JPG/JPEG/TIFF. La razón es medida, no de gusto: en el corpus
// real de INEs del usuario (548 archivos) el 17% son PNG, así que una sexta
// parte de los documentos que de verdad se van a procesar no se podía ni subir.
// El back y Document AI ya lo aceptaban; el único que lo bloqueaba era este
// listado.
// DOCX y XLSX se QUITARON el 2026-09-06, a pedido explícito: Document AI no
// los procesa (ver MIME_POR_EXTENSION en pipeline.svelte.ts), así que antes
// se podían subir hasta la Bandeja de preparación y solo fallaban hasta
// picarle a "Iniciar pipeline" — un archivo que nunca se iba a poder
// procesar ya no debería aceptarse desde el primer paso.
// Si el UX actualiza el frame, alinear el texto del dropzone también.
const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png', 'tiff'];
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

/** Archivos elegidos/soltados en "Carga documental" que esperan confirmación
 *  ("Subir documentos") antes de pasar a `documentosEnBandeja`. Ver
 *  `ArchivoPendienteDeCarga`. */
export const archivosPendientesDeCarga = $state<ArchivoPendienteDeCarga[]>([]);

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

/** Valida y encola archivos en el primer panel ("Carga documental") como
 *  pendientes de carga. NO toca `documentosEnBandeja` ni la cola de lectura
 *  todavía — eso solo pasa cuando el usuario confirma con
 *  `confirmarCargaPendiente` (botón "Subir documentos"). */
export function agregarArchivosPendientes(files: FileList) {
	for (const file of Array.from(files)) {
		const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
		if (!EXTENSIONES_PERMITIDAS.includes(extension)) continue;
		if (file.size > TAMANO_MAXIMO_BYTES) continue;

		archivosPendientesDeCarga.push({
			id: generarId(),
			nombre: file.name,
			extension: extension.toUpperCase(),
			tamanioBytes: file.size,
			agregadoEn: new Date(),
			// Arranca MARCADO (pedido explícito 2026-09-11). Esto REVIERTE la
			// decisión contraria del 2026-09-06, que razonaba que marcar debía
			// ser deliberado archivo por archivo. En la práctica el caso normal
			// es subir todo lo que se acaba de arrastrar, así que el default
			// desmarcado obligaba a un clic por archivo antes de poder avanzar
			// —y dejaba "Subir documentos" apagado, que se leía como si algo
			// estuviera mal—. Desmarcar lo que no se quiere sigue siendo un clic.
			seleccionado: true,
			archivo: file
		});
	}
}

export function alternarSeleccionPendiente(id: string) {
	const archivo = archivosPendientesDeCarga.find((a) => a.id === id);
	if (archivo) archivo.seleccionado = !archivo.seleccionado;
}

export function quitarArchivoPendiente(id: string) {
	const indice = archivosPendientesDeCarga.findIndex((a) => a.id === id);
	if (indice !== -1) archivosPendientesDeCarga.splice(indice, 1);
}

/** "Cancelar": descarta TODOS los pendientes sin subir nada. Sin
 *  confirmación — nada se subió ni se persistió todavía, así que rehacer esto
 *  cuesta segundos (mismo criterio que otras acciones no-destructivas-de-
 *  verdad ya usado en este proyecto). */
export function cancelarCargaPendiente() {
	archivosPendientesDeCarga.splice(0, archivosPendientesDeCarga.length);
}

/** "Subir documentos": mueve a la bandeja de preparación SOLO los pendientes
 *  con la palomita marcada (pedido explícito 2026-09-06 — antes subía todos
 *  sin importar la selección, lo cual volvía la palomita puramente decorativa).
 *  Los que se queden SIN marcar no se pierden: siguen esperando en la lista
 *  de pendientes para una próxima confirmación. */
export function confirmarCargaPendiente() {
	const seleccionados = archivosPendientesDeCarga.filter((a) => a.seleccionado);
	for (const pendiente of seleccionados) {
		const { id, archivo } = pendiente;
		const extensionEnMinusculas = pendiente.extension.toLowerCase();
		documentosEnBandeja.push({
			id,
			nombre: pendiente.nombre,
			extension: pendiente.extension,
			tamanioBytes: pendiente.tamanioBytes,
			origen: 'Manual',
			agregadoEn: new Date(),
			estado: 'en_cola',
			progreso: 0,
			hashSha256: null,
			seleccionado: false,
			archivo
		});
		colaDeLectura.push(() => procesarArchivo(id, archivo, extensionEnMinusculas));
	}
	for (const { id } of seleccionados) {
		const indice = archivosPendientesDeCarga.findIndex((a) => a.id === id);
		if (indice !== -1) archivosPendientesDeCarga.splice(indice, 1);
	}
	drenarCola();
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
	quitarDocumento(id, 'pipeline');
}

/** Saca un documento de la bandeja. Si llegó por la API, además le avisa al
 *  servidor, para que no reaparezca en la siguiente consulta ni al refrescar. */
export function quitarDocumento(id: string, motivo: 'pipeline' | 'descartado' = 'descartado') {
	const indice = documentosEnBandeja.findIndex((doc) => doc.id === id);
	if (indice === -1) return;
	const [doc] = documentosEnBandeja.splice(indice, 1);
	if (doc.idEntrada) retirarEntrada(doc.idEntrada, motivo);
}

// ── Lo que llega por la API de clientes ────────────────────────────────────

type EntradaApi = {
	id: string;
	rutaRelativa: string;
	sha256: string;
	tamanoBytes: number;
	mime: string;
	nombreOriginal: string;
	recibidoEn: string;
};

/** Los mismos cuatro formatos que acepta `POST /bandeja/` y que procesa el
 *  pipeline. La extensión sale del MIME y no del nombre: el nombre lo pone
 *  el cliente y puede venir sin extensión o con una que no es. */
const EXTENSION_POR_MIME: Record<string, string> = {
	'application/pdf': 'PDF',
	'image/jpeg': 'JPG',
	'image/png': 'PNG',
	'image/tiff': 'TIFF'
};

/**
 * Entradas que ESTA pestaña ya sacó de la bandeja. Sin esto, una entrada
 * recién mandada al pipeline podría volver a pintarse si la siguiente
 * consulta llega antes de que el servidor registre el retiro.
 */
const entradasRetiradas = new Set<string>();

function retirarEntrada(idEntrada: string, motivo: 'pipeline' | 'descartado') {
	entradasRetiradas.add(idEntrada);
	fetch(`/api/bandeja/${encodeURIComponent(idEntrada)}/retirar`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ motivo })
	})
		.then((r) => {
			// Un 404 es que ya había salido (otro navegador la tomó primero): no es
			// un problema. Cualquier otro fallo sí: al refrescar va a reaparecer.
			if (!r.ok && r.status !== 404) {
				console.warn(`[bandeja] No se pudo retirar la entrada ${idEntrada} (${r.status}).`);
			}
		})
		.catch(() => console.warn(`[bandeja] No se pudo retirar la entrada ${idEntrada}: sin conexión.`));
}

let sincronizando = false;

/**
 * Trae lo que está pendiente en el servidor y pone al día la bandeja: agrega
 * lo nuevo y quita lo que ya salió (porque otro navegador lo mandó al
 * pipeline o lo descartó). Lo llama `BandejaPreparacionPanel` al montarse y
 * cada pocos segundos. Si el servidor no contesta, no toca nada: lo ya
 * pintado se queda y la siguiente consulta lo vuelve a intentar.
 */
export async function sincronizarEntradasApi() {
	if (sincronizando) return;
	sincronizando = true;
	try {
		const r = await fetch('/api/bandeja');
		if (!r.ok) return;
		const datos = await r.json().catch(() => null);
		if (!Array.isArray(datos?.entradas)) return;
		const entradas = datos.entradas as EntradaApi[];
		const vigentes = new Set(entradas.map((e) => e.id));

		for (let i = documentosEnBandeja.length - 1; i >= 0; i--) {
			const d = documentosEnBandeja[i];
			if (d.idEntrada && !vigentes.has(d.idEntrada)) documentosEnBandeja.splice(i, 1);
		}

		for (const e of entradas) {
			if (entradasRetiradas.has(e.id)) continue;
			if (documentosEnBandeja.some((d) => d.idEntrada === e.id)) continue;
			const extension = EXTENSION_POR_MIME[e.mime];
			if (!extension) continue; // el servidor no debería aceptarlo; no se inventa nada
			const id = generarId();
			documentosEnBandeja.push({
				id,
				idEntrada: e.id,
				nombre: e.nombreOriginal || `archivo.${extension.toLowerCase()}`,
				extension,
				tamanioBytes: e.tamanoBytes,
				origen: 'API REST',
				agregadoEn: new Date(e.recibidoEn),
				estado: 'en_cola',
				progreso: 0,
				hashSha256: null,
				seleccionado: false,
				archivo: null
			});
			colaDeLectura.push(() => traerDelAlmacen(id, e, extension.toLowerCase()));
		}
		drenarCola();
	} catch {
		/* sin conexión: se reintenta en la siguiente consulta */
	} finally {
		sincronizando = false;
	}
}

/**
 * Baja del almacén los bytes de una entrada de la API y la pasa por la MISMA
 * revisión que un archivo subido a mano (huella, corrupto o protegido,
 * duplicado): a partir de aquí son indistinguibles, salvo por su origen.
 */
async function traerDelAlmacen(id: string, e: EntradaApi, extension: string) {
	if (!documentosEnBandeja.some((d) => d.id === id)) return; // la quitaron mientras esperaba
	let archivo: File;
	try {
		const r = await fetch(`/api/archivos/${e.rutaRelativa}?mime=${encodeURIComponent(e.mime)}`);
		if (!r.ok) throw new Error(String(r.status));
		archivo = new File([await r.blob()], e.nombreOriginal || `archivo.${extension}`, { type: e.mime });
	} catch {
		// El almacén no contestó. Se quita de la vista SIN retirarla del servidor:
		// la siguiente consulta la vuelve a traer y se intenta otra vez.
		const i = documentosEnBandeja.findIndex((d) => d.id === id);
		if (i !== -1) documentosEnBandeja.splice(i, 1);
		return;
	}
	const doc = documentosEnBandeja.find((d) => d.id === id);
	if (!doc) return;
	doc.archivo = archivo;
	await procesarArchivo(id, archivo, extension);
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
