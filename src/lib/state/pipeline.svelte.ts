/**
 * Estado del Pipeline documental (el tercer panel del Home).
 *
 * Un documento llega aquí cuando el usuario le da "Iniciar pipeline" en la
 * Bandeja de preparación. El movimiento es INMEDIATO: sale de la bandeja y
 * aparece aquí en cola, aunque la extracción tarde. Así lo muestra Figma
 * (HU001|106: la bandeja queda vacía y todo está del lado derecho) y además es
 * más honesto — el documento ya salió de "preparación", ya no se puede editar
 * ni descartar como si nada hubiera pasado.
 *
 * PROVISIONAL igual que la bandeja: vive solo en memoria del navegador. Cuando
 * exista SQL Server, cada corrida de aquí se convierte en un `extraction_run`
 * con sus `entity_fact`, y este módulo pasa a leer de la base en vez de
 * guardar el resultado en RAM.
 */

import {
	documentosEnBandeja,
	moverDocumentoAlPipeline,
	type DocumentoEnBandeja
} from './bandeja.svelte';
import { tiposDocumentales } from './configuracion.svelte';
import type { ResultadoIne } from '$lib/types/ine';

export type EstadoPipeline =
	| 'en_cola' // esperando turno; ver NOTA sobre por qué se procesa de a uno
	| 'clasificando'
	| 'procesando'
	| 'procesado' // extracción exitosa
	| 'no_reconocido' // el clasificador SÍ ubicó un tipo, pero su extractor no reconoció el documento
	| 'no_configurado' // el clasificador no encontró ningún tipo documental activo que corresponda
	| 'pendiente_revision' // no_configurado + el usuario eligió seguir sin configurar el tipo
	| 'no_soportado' // formato que Document AI no procesa (DOCX, XLSX)
	| 'fallido'; // error de red, timeout o error del servicio

export type DocumentoEnPipeline = {
	id: string;
	nombre: string;
	extension: string;
	tamanioBytes: number;
	origen: 'Manual';
	agregadoEn: Date;
	hashSha256: string | null;
	archivo: File;
	seleccionado: boolean;

	estado: EstadoPipeline;
	/** Venía marcado como duplicado en la bandeja y aun así se mandó a procesar.
	 *  Figma lo etiqueta "Duplicado procesado de forma explícita". */
	eraDuplicado: boolean;
	enviadoEn: Date;
	terminadoEn: Date | null;
	resultado: ResultadoIne | null;
	error: string | null;
};

/**
 * Lo que Document AI acepta, por extensión de la bandeja.
 *
 * DOCX y XLSX NO están porque Document AI no los procesa — y desde el
 * 2026-09-06 la Bandeja ya ni los admite (`EXTENSIONES_PERMITIDAS` en
 * `bandeja.svelte.ts`), así que este caso hoy es defensivo, no el camino
 * esperado. Se deja el guardia igual: si algún día se vuelve a admitir un
 * formato que Document AI no procesa, se marca `no_soportado` sin gastar la
 * llamada — que además cuesta dinero — en vez de mandarlo y recibir un error
 * del proveedor.
 */
const MIME_POR_EXTENSION: Record<string, string> = {
	PDF: 'application/pdf',
	JPG: 'image/jpeg',
	JPEG: 'image/jpeg',
	PNG: 'image/png',
	TIFF: 'image/tiff'
};

export const documentosEnPipeline = $state<DocumentoEnPipeline[]>([]);

/**
 * Candado del lote en curso. Vive en el MÓDULO y no en el componente de la
 * barra flotante a propósito: esa barra se desmonta en cuanto la selección
 * queda vacía —que es justo lo que pasa al mover los documentos al pipeline—
 * así que un `let enviando` local se perdía al instante y no impedía nada. Con
 * el candado aquí, seleccionar más archivos y volver a picar "Iniciar
 * pipeline" mientras el primer lote corre ya no arranca un segundo lote en
 * paralelo (que serían llamadas simultáneas a Document AI, o sea costo).
 */
let loteEnCurso = $state(false);

export function hayLoteEnCurso(): boolean {
	return loteEnCurso;
}

/** Solo lo que se puede mandar: un archivo que sigue subiendo no tiene bytes
 *  confirmados, y uno protegido o corrupto no se va a poder abrir del otro
 *  lado. Un duplicado SÍ se puede mandar a propósito — es una decisión del
 *  usuario, y así lo contempla el diseño. */
export function sePuedeProcesar(doc: DocumentoEnBandeja): boolean {
	return doc.estado === 'listo' || doc.estado === 'duplicado';
}

/**
 * Manda a la API los documentos seleccionados en la Bandeja.
 *
 * NOTA sobre el orden: los documentos se procesan de UNO EN UNO, no en
 * paralelo. Cada llamada a Document AI se cobra y tiene límite de tasa; si
 * alguien selecciona veinte archivos, veinte llamadas simultáneas son un pico
 * de costo y un 429 casi seguro. La cola se ve en la UI (`en_cola`) para que la
 * espera sea explícita en vez de parecer que la app se colgó.
 */
export async function iniciarPipeline() {
	if (loteEnCurso) return;
	const elegibles = documentosEnBandeja.filter((d) => d.seleccionado && sePuedeProcesar(d));
	if (elegibles.length === 0) return;
	loteEnCurso = true;

	// Se mueven TODOS primero y después se procesan: si se hiciera de a uno, la
	// bandeja se iría vaciando poco a poco y el usuario vería saltar las filas
	// mientras las mira.
	const recienLlegados: DocumentoEnPipeline[] = [];
	for (const doc of elegibles) {
		const entrada: DocumentoEnPipeline = {
			id: doc.id,
			nombre: doc.nombre,
			extension: doc.extension,
			tamanioBytes: doc.tamanioBytes,
			origen: doc.origen,
			agregadoEn: doc.agregadoEn,
			hashSha256: doc.hashSha256,
			archivo: doc.archivo,
			seleccionado: false,
			estado: 'en_cola',
			eraDuplicado: doc.estado === 'duplicado',
			enviadoEn: new Date(),
			terminadoEn: null,
			resultado: null,
			error: null
		};
		documentosEnPipeline.push(entrada);
		recienLlegados.push(entrada);
		moverDocumentoAlPipeline(doc.id);
	}

	try {
		for (const entrada of recienLlegados) {
			await procesarUno(entrada.id);
		}
	} finally {
		loteEnCurso = false;
	}
}

/**
 * La categoría de escape del clasificador: "no es ninguno de los tipos
 * documentales configurados". La agrega SIEMPRE el back
 * (`CATEGORIA_OTRO` en `servicios/esquema.py`) y este nombre tiene que
 * coincidir con el de allá — si divergen, lo desconocido deja de caer en
 * "manda esto a revisión" y cae en "categoría que no sé mapear".
 */
const CATEGORIA_OTRO = 'otro';

/**
 * Misma normalización que `normalizar_nombre` de `servicios/esquema.py`, con
 * la que el back nombra cada categoría del clasificador. Se replica en vez de
 * pedirla al server porque es pura y minúscula, y el mapeo
 * categoría -> tipo documental tiene que poder hacerse sin una llamada más.
 * No se replica el relleno de `campo_` para nombres que no empiezan con
 * letra: los ids que genera el front (`tipo-{base36}-{n}`) y los nombres de
 * tipo documental siempre empiezan con letra.
 */
function normalizarCategoria(valor: string): string {
	return valor
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // fuera los diacríticos que NFD separó
		.replace(/ñ/gi, 'n')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9_-]/g, '')
		.replace(/_+/g, '_')
		.replace(/^[_-]+|[_-]+$/g, '')
		.slice(0, 64);
}

async function procesarUno(id: string) {
	const doc = documentosEnPipeline.find((d) => d.id === id);
	if (!doc) return; // lo quitaron mientras esperaba turno

	const mime = MIME_POR_EXTENSION[doc.extension];
	if (!mime) {
		doc.estado = 'no_soportado';
		doc.terminadoEn = new Date();
		doc.error = `Document AI no procesa archivos ${doc.extension}. Se aceptan PDF, JPG, JPEG y TIFF.`;
		return;
	}

	// Se reconstruye el File con el MIME correcto en vez de mandar el original:
	// el navegador deja `File.type` vacío para extensiones que no conoce (pasa
	// seguido con .tiff), y el back valida justamente ese header. Sin esto, un
	// TIFF válido se rechazaría con "formato no soportado" sin motivo real.
	const archivo = new File([doc.archivo], doc.nombre, { type: mime });

	doc.estado = 'clasificando';
	const categoria = await clasificar(id, archivo);
	if (categoria === null) return; // clasificar() ya dejó el documento en 'fallido'

	const vivo = documentosEnPipeline.find((d) => d.id === id);
	if (!vivo) return; // lo quitaron mientras se clasificaba

	// El clasificador nombra cada categoría con el ID del tipo documental (ver
	// `esquema_clasificador_desde_tipos`), así que mapear de vuelta es buscar
	// ese id entre los tipos ACTIVOS de la Biblioteca. Antes esto era una
	// comparación contra un `procesadorId` fijo, con un comentario que afirmaba
	// que las categorías se nombraban por procesador — era falso, y quedó al
	// descubierto el 2026-09-07: en cuanto el front empezó a sincronizar el
	// clasificador de verdad, ninguna categoría empató y TODO caía en el error
	// "el front todavía no sabe a qué extractor mandarla".
	const tipo =
		categoria === CATEGORIA_OTRO
			? undefined
			: tiposDocumentales.find(
					(t) => t.estado === 'activo' && normalizarCategoria(t.id) === categoria
				);

	if (categoria === CATEGORIA_OTRO || !tipo) {
		// Ningún tipo documental activo corresponde: no hay extractor al que
		// mandarlo, así que aquí termina — mandarlo de todos modos a /ia/ine
		// sería repetir el bug original (todo se procesaba como INE sin
		// importar qué fuera). Desde aquí el renglón ofrece las dos salidas
		// reales: "Continuar sin configuración" (revisión humana) o
		// "Configurar" (darlo de alta como tipo nuevo).
		//
		// El `!tipo` cae en el MISMO desenlace a propósito, aunque signifique
		// algo distinto (el clasificador nombró una categoría que ya no existe
		// en la Biblioteca — un tipo archivado o borrado cuya sincronización
		// no alcanzó a correr): para quien está viendo la pantalla el
		// resultado es idéntico —no hay tipo configurado que aplique— y
		// ofrecerle las mismas dos salidas es más útil que un error técnico.
		vivo.estado = 'no_configurado';
		vivo.terminadoEn = new Date();
		return;
	}

	if (!tipo.procesadorId) {
		// Tipo activo sin procesador guardado: no debería pasar (activar lo
		// escribe antes de marcar el estado), pero si pasa no hay con qué
		// extraer. Va a revisión humana y no a 'fallido' porque el documento SÍ
		// se entendió — lo que falta es la configuración del tipo, y eso no se
		// arregla reintentando.
		vivo.estado = 'pendiente_revision';
		vivo.terminadoEn = new Date();
		vivo.error = `Se identificó como "${tipo.nombre}", pero ese tipo documental no tiene un procesador de extracción asociado. Vuelve a activarlo desde el Módulo de configuración.`;
		return;
	}

	// SIN excepciones por tipo: cada documento se extrae con el Custom
	// Extractor que "Activar" le creó a SU tipo documental. Hubo por unas horas
	// una tabla `EXTRACTORES_DEDICADOS` que mandaba el tipo llamado "INE" al
	// endpoint `/ia/ine` (el procesador INE LEGADO del `.env`, con más campos
	// ya afinados); se quitó a pedido explícito — "no quiero que el procesador
	// de INE sea mi genérico que ya tenía ahí, quiero que sea el que
	// genuinamente le toca al procesador que construí". El costo asumido es
	// justo ese: se extraen los campos que el tipo tenga configurados en el
	// wizard, ni uno más, y las dos limpiezas propias de una credencial (el
	// punto de `estado`, partir `fecha_registro`) dejan de aplicarse porque
	// viven del lado de `/ia/ine`.
	vivo.estado = 'procesando';
	await extraerConProcesador(id, archivo, tipo.procesadorId, tipo.procesadorVersion);
}

/** Llama a `/api/pipeline/clasificar`. Devuelve la categoría ganadora
 *  ("otro" incluido), o `null` si algo falló — en ese caso ya dejó al
 *  documento en 'fallido' con su mensaje, igual que hacía `procesarUno` antes
 *  de separar este paso. */
async function clasificar(id: string, archivo: File): Promise<string | null> {
	const cuerpo = new FormData();
	cuerpo.append('archivo', archivo);

	try {
		const respuesta = await fetch('/api/pipeline/clasificar', { method: 'POST', body: cuerpo });

		let datos: { mensaje?: string; categoria?: string | null } | null = null;
		try {
			datos = await respuesta.json();
		} catch {
			datos = null;
		}

		const vivo = documentosEnPipeline.find((d) => d.id === id);
		if (!vivo) return null; // lo quitaron mientras se clasificaba

		if (!respuesta.ok || datos === null) {
			vivo.estado = 'fallido';
			vivo.terminadoEn = new Date();
			vivo.error = datos?.mensaje ?? `La API respondió ${respuesta.status} al clasificar.`;
			return null;
		}

		// `categoria: null` es el mismo caso de negocio que "otro" (Document AI
		// respondió sin ninguna entidad) — se contempla en vez de asumir que
		// nunca pasa, pero para quien llama significa exactamente lo mismo.
		return datos.categoria ?? 'otro';
	} catch (err) {
		const vivo = documentosEnPipeline.find((d) => d.id === id);
		if (vivo) {
			vivo.estado = 'fallido';
			vivo.terminadoEn = new Date();
			vivo.error = err instanceof Error ? err.message : 'Error desconocido al clasificar.';
		}
		return null;
	}
}

/**
 * Extrae con el Custom Extractor PROPIO de un tipo documental, vía
 * `/api/pipeline/extraer` (2026-09-07). Es el ÚNICO camino de extracción del
 * pipeline: antes el único extractor estaba atado al procesador de INE del
 * `.env` del back, así que un documento se podía clasificar bien y no tener a
 * dónde ir.
 *
 * `quality_alert` en la respuesta significa que el extractor no reconoció
 * ninguno de los campos que su esquema esperaba — ver
 * `procesarRespuestaExtraccion`.
 */
async function extraerConProcesador(
	id: string,
	archivo: File,
	procesador: string,
	version: string
) {
	const cuerpo = new FormData();
	cuerpo.append('archivo', archivo);
	cuerpo.append('procesador', procesador);
	// La versión viaja solo si el tipo la tiene guardada. Sin ella Google usa
	// su default, que puede cambiar sin aviso — mismo criterio que
	// DOCAI_VERSION_INE en el back.
	if (version) cuerpo.append('version', version);

	await procesarRespuestaExtraccion(
		id,
		fetch('/api/pipeline/extraer', { method: 'POST', body: cuerpo })
	);
}

/** El manejo de la respuesta de una extracción. Sigue aparte de
 *  `extraerConProcesador` —aunque hoy solo lo llame él— porque separa dos
 *  cosas que cambian por motivos distintos: a quién se le pide la extracción,
 *  y cómo se lee lo que contestó. */
async function procesarRespuestaExtraccion(id: string, promesa: Promise<Response>) {
	try {
		const respuesta = await promesa;

		// Se parsea con red: no todo error llega del BFF con forma {mensaje}. Un
		// 502 de infraestructura o una página de error devuelven HTML, y hacer
		// .json() a ciegas convertía eso en un SyntaxError de parseo que tapaba
		// el error real con un mensaje sobre JSON.
		let datos: { mensaje?: string; _metadata?: { quality_alert?: boolean } } | null = null;
		try {
			datos = await respuesta.json();
		} catch {
			datos = null;
		}

		const vivo = documentosEnPipeline.find((d) => d.id === id);
		if (!vivo) return; // lo quitaron mientras se procesaba

		vivo.terminadoEn = new Date();

		if (!respuesta.ok || datos === null) {
			vivo.estado = 'fallido';
			vivo.error = datos?.mensaje ?? `La API respondió ${respuesta.status}.`;
			return;
		}

		vivo.resultado = datos as ResultadoIne;
		// `quality_alert` no es un error: la API funcionó y su respuesta es que
		// el extractor no reconoció ninguno de los campos que su esquema
		// esperaba. Se distingue de `fallido` para que el usuario sepa que no
		// tiene nada que reintentar. Y es distinto de 'no_configurado': aquí el
		// clasificador SÍ ubicó el tipo documental, pero su extractor, ya
		// viendo el documento con detalle, no encontró nada — un segundo
		// chequeo, más fino, que puede discrepar del primero.
		vivo.estado = datos?._metadata?.quality_alert ? 'no_reconocido' : 'procesado';
	} catch (err) {
		const vivo = documentosEnPipeline.find((d) => d.id === id);
		if (!vivo) return;
		vivo.estado = 'fallido';
		vivo.terminadoEn = new Date();
		vivo.error = err instanceof Error ? err.message : 'Error desconocido al llamar a la API.';
	}
}

export function alternarSeleccionPipeline(id: string) {
	const doc = documentosEnPipeline.find((d) => d.id === id);
	if (doc) doc.seleccionado = !doc.seleccionado;
}

/**
 * "Continuar sin configuración": el documento se queda en el pipeline pero
 * SIN extraerse, esperando a que una persona decida qué hacer con él.
 *
 * No es un estado de error ni de reintento: la clasificación funcionó
 * perfecto, su respuesta fue "esto no es ninguno de tus tipos", y el usuario
 * decidió no configurar uno ahora. Se distingue de `no_configurado` (que aún
 * ofrece las dos opciones) porque la decisión ya se tomó — por eso las
 * opciones desaparecen al pasar aquí.
 */
export function continuarSinConfiguracion(id: string) {
	const doc = documentosEnPipeline.find((d) => d.id === id);
	if (!doc || doc.estado !== 'no_configurado') return;
	doc.estado = 'pendiente_revision';
}

export function quitarDelPipeline(id: string) {
	const indice = documentosEnPipeline.findIndex((d) => d.id === id);
	if (indice !== -1) documentosEnPipeline.splice(indice, 1);
}

/** Texto y color de cada estado, en un solo lugar, para que la fila y el modal
 *  de detalle no se contradigan. */
export const ETIQUETA_ESTADO: Record<EstadoPipeline, { texto: string; tono: 'ok' | 'error' | 'proceso' }> = {
	en_cola: { texto: 'En cola', tono: 'proceso' },
	clasificando: { texto: 'Clasificando', tono: 'proceso' },
	procesando: { texto: 'Procesando', tono: 'proceso' },
	procesado: { texto: 'Listo', tono: 'ok' },
	// "como INE" hasta el 2026-09-07, cuando el pipeline dejó de tener un solo
	// extractor: el mismo estado ahora puede venir del extractor de cualquier
	// tipo documental, y nombrar a INE ahí sería mentira en todos los demás.
	no_reconocido: { texto: 'No se reconocieron sus campos', tono: 'error' },
	no_configurado: { texto: 'Tipo documental no configurado', tono: 'error' },
	pendiente_revision: { texto: 'Pendiente de revisión humana', tono: 'error' },
	no_soportado: { texto: 'Formato no procesable', tono: 'error' },
	fallido: { texto: 'Falló el procesamiento', tono: 'error' }
};
