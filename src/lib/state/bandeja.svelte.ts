/**
 * Estado compartido de la bandeja de preparación documental.
 *
 * PROVISIONAL: solo vive en memoria del navegador (se pierde al refrescar).
 * Es a propósito mientras el DBA termina SQL Server — cuando esté lista la
 * base, esto se reemplaza por datos reales vía nexus_back y HU027.
 *
 * El "progreso" de subida también es SIMULADO: hoy no hay ningún envío real a
 * un servidor (no hay backend conectado todavía), así que no existe un evento
 * de progreso real que mostrar. Cuando exista la subida real hacia nexus_back,
 * `simularSubida` se reemplaza por el progreso que reporte esa llamada (ej. el
 * evento `progress` de XHR o de fetch con ReadableStream).
 */

export type DocumentoEnBandeja = {
	id: string;
	nombre: string;
	extension: string;
	tamanioBytes: number;
	origen: 'Manual';
	agregadoEn: Date;
	estado: 'subiendo' | 'listo';
	progreso: number; // 0-100; solo relevante mientras estado === 'subiendo'
};

// Mismas restricciones que ya anuncia la UI del dropzone. Centralizadas aquí
// porque drag&drop no respeta el atributo `accept` del <input> (eso solo
// filtra el diálogo nativo de selección), así que hace falta validar en
// código sin importar por cuál de las dos vías llegó el archivo.
const EXTENSIONES_PERMITIDAS = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'tiff'];
const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024;

const DURACION_SIMULADA_MS = 900;
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

export const documentosEnBandeja = $state<DocumentoEnBandeja[]>([]);

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
			estado: 'subiendo',
			progreso: 0
		});
		simularSubida(id);
	}
}

function simularSubida(id: string) {
	const inicio = Date.now();
	const intervalo = setInterval(() => {
		// Se busca por id en cada tick (en vez de guardar la referencia del
		// objeto) porque $state envuelve en un proxy lo que se hace push aquí;
		// mutar un objeto guardado de antes de insertarlo no dispara reactividad.
		// Buscarlo de nuevo también resuelve solo el caso de que lo hayan quitado
		// (botón "quitar") a medio simular: aquí ya no se encuentra y se limpia.
		const doc = documentosEnBandeja.find((d) => d.id === id);
		if (!doc) {
			clearInterval(intervalo);
			return;
		}

		const transcurrido = Date.now() - inicio;
		doc.progreso = Math.min(100, Math.round((transcurrido / DURACION_SIMULADA_MS) * 100));
		if (transcurrido >= DURACION_SIMULADA_MS) {
			doc.estado = 'listo';
			clearInterval(intervalo);
		}
	}, INTERVALO_TICK_MS);
}

export function quitarDocumento(id: string) {
	const indice = documentosEnBandeja.findIndex((doc) => doc.id === id);
	if (indice !== -1) documentosEnBandeja.splice(indice, 1);
}

export function formatearTamano(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
	return `${(kb / 1024).toFixed(1)} MB`;
}
