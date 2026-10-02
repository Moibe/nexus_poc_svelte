/**
 * Avisarle al servidor que un documento terminó, para que se lo avise a los
 * webhooks del cliente (2026-10-01).
 *
 * El pipeline corre en el NAVEGADOR, así que el servidor no se entera solo de
 * cómo terminó un documento: se lo dice esta función, que llama `pasarA` en
 * cada cambio de estado. El servidor comprueba que la entrada sea real y haya
 * pasado al pipeline, y entrega y reintenta por su cuenta
 * (`servicios/entregas_webhooks.py` en nexus_back).
 *
 * SOLO LO QUE LLEGÓ POR LA API. Son los únicos documentos cuyo identificador
 * conoce el cliente: el `id` que recibió al subirlo, que aquí es `idEntrada`.
 * Lo que se subió a mano en esta pantalla no lo mandó él, y no tendría con qué
 * reconocerlo.
 *
 * UNA VEZ POR DOCUMENTO, cuando el pipeline termina con él. El motivo viaja
 * como CÓDIGO de una lista cerrada, nunca como el texto que ve el operador:
 * ese texto habla de la configuración interna ("Calíbralo en el Módulo de
 * configuración") y no es para el cliente.
 */

import type { DocumentoEnPipeline, EstadoPipeline } from './pipeline.svelte';

type Aviso = {
	tipo: 'documento.completado' | 'documento.fallido' | 'documento.rechazado';
	motivo: string | null;
};

/**
 * Qué se avisa en cada estado en el que el pipeline termina con un documento.
 *
 *   · `pendiente_revision` se avisa como FALLIDO, `tipo_sin_configurar`, cuando
 *     se llega DIRECTO: el documento sí se reconoció, pero su tipo no tiene
 *     extractor o no está calibrado. Es del lado de NexusDoc, no del archivo, y
 *     reenviarlo cuando quede configurado sí serviría. Si se llega desde
 *     `no_configurado` ("Continuar sin configuración"), ese ya avisó y no se
 *     repite.
 *   · `no_configurado` es RECHAZADO aunque la pantalla todavía ofrezca
 *     opciones: ninguna de ellas vuelve a procesar el documento.
 */
const AVISO_POR_ESTADO: Partial<Record<EstadoPipeline, Aviso>> = {
	procesado: { tipo: 'documento.completado', motivo: null },
	fallido: { tipo: 'documento.fallido', motivo: 'error_del_servicio' },
	pendiente_revision: { tipo: 'documento.fallido', motivo: 'tipo_sin_configurar' },
	no_soportado: { tipo: 'documento.rechazado', motivo: 'formato_no_soportado' },
	no_reconocido: { tipo: 'documento.rechazado', motivo: 'documento_no_reconocido' },
	no_configurado: { tipo: 'documento.rechazado', motivo: 'tipo_no_identificado' }
};

/** Al momento, y dos reintentos si el servidor no contesta. Si aun así no se
 *  pudo, ese aviso se pierde: es el costo de que el pipeline viva en el
 *  navegador, y se va el día que pase al servidor. */
const ESPERAS_MS = [0, 2_000, 10_000];

export function avisarSiTermino(doc: DocumentoEnPipeline): void {
	if (!doc.idEntrada || doc.avisado) return;
	const aviso = AVISO_POR_ESTADO[doc.estado];
	if (!aviso) return;
	doc.avisado = true;
	void mandar({
		tipo: aviso.tipo,
		entradaId: doc.idEntrada,
		tipoDocumental: doc.tipoDetectado,
		motivo: aviso.motivo
	});
}

async function mandar(cuerpo: Record<string, string | null>, intento = 0): Promise<void> {
	if (ESPERAS_MS[intento] > 0) await new Promise((ok) => setTimeout(ok, ESPERAS_MS[intento]));
	try {
		const r = await fetch('/api/webhooks/eventos', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(cuerpo)
		});
		if (r.ok) return;
		// 400, 404, 409: el servidor ya dijo que no, y repetirlo no lo cambia.
		if (r.status >= 400 && r.status < 500 && r.status !== 429) {
			console.warn(`[webhooks] El servidor no aceptó el aviso de la entrada ${cuerpo.entradaId} (${r.status}).`);
			return;
		}
	} catch {
		// sin conexión: se reintenta abajo
	}
	if (intento + 1 < ESPERAS_MS.length) return mandar(cuerpo, intento + 1);
	console.warn(`[webhooks] No se pudo avisar al servidor que terminó la entrada ${cuerpo.entradaId}.`);
}
