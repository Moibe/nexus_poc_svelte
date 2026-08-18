/**
 * Estado compartido de la bandeja de preparación documental.
 *
 * PROVISIONAL: solo vive en memoria del navegador (se pierde al refrescar).
 * Es a propósito mientras el DBA termina SQL Server — cuando esté lista la
 * base, esto se reemplaza por datos reales vía nexus_back y HU027.
 */

export type DocumentoEnBandeja = {
	id: string;
	nombre: string;
	extension: string;
	tamanioBytes: number;
	origen: 'Manual';
	agregadoEn: Date;
};

// Mismas restricciones que ya anuncia la UI del dropzone. Centralizadas aquí
// porque drag&drop no respeta el atributo `accept` del <input> (eso solo
// filtra el diálogo nativo de selección), así que hace falta validar en
// código sin importar por cuál de las dos vías llegó el archivo.
const EXTENSIONES_PERMITIDAS = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'tiff'];
const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024;

export const documentosEnBandeja = $state<DocumentoEnBandeja[]>([]);

export function agregarArchivos(files: FileList) {
	for (const file of Array.from(files)) {
		const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
		if (!EXTENSIONES_PERMITIDAS.includes(extension)) continue;
		if (file.size > TAMANO_MAXIMO_BYTES) continue;

		documentosEnBandeja.push({
			id: crypto.randomUUID(),
			nombre: file.name,
			extension: extension.toUpperCase(),
			tamanioBytes: file.size,
			origen: 'Manual',
			agregadoEn: new Date()
		});
	}
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
