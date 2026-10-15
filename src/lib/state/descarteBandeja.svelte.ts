/**
 * El flujo de DESCARTAR documentos de la bandeja, que se pide desde dos lugares (el botón «Descartar» de la barra de acciones y
 * la X de cada renglón) y se confirma en UN solo panel (montado en `BarraAccionesFlotante`).
 *
 * Es estado compartido porque quien pide y quien pregunta no tienen un componente en común. Todo pasa por aquí, y por eso la X
 * ya no retira por su cuenta: antes sacaba el documento sin preguntar, sin rastro y sin que el servidor revisara el rol.
 *
 * Los avisos son los del Figma: «Documento enviado a descartados.» al descartar y «Documento conservado correctamente.» al
 * elegir conservarlo (se deduce del diseño: dos avisos, uno por cada botón del panel; el frame del panel no se ha compartido).
 */

import { avisarExito } from '$lib/state/avisos.svelte';
import { descartarDocumentos } from '$lib/state/bandeja.svelte';

export const descarte = $state({
	/** Los documentos por los que se pregunta, o `null` si no hay panel abierto. */
	ids: null as string[] | null,
	motivo: '',
	enviando: false,
	/** Si se detuvo a la mitad o el servidor lo negó: el aviso de error que sale encima del panel. */
	error: ''
});

export function pedirDescarte(ids: string[]): void {
	if (ids.length === 0) return;
	descarte.ids = ids;
	descarte.motivo = '';
}

export function cerrarPanelDeDescarte(): void {
	descarte.ids = null;
}

/** «Conservar»: no se toca nada y se avisa. */
export function conservar(): void {
	const n = descarte.ids?.length ?? 0;
	if (n === 0) return;
	if (n === 1) {
		avisarExito(
			'Documento conservado correctamente.',
			'El archivo permanecerá disponible en tu bandeja para continuar con su gestión y seguimiento.'
		);
	} else {
		avisarExito(
			'Documentos conservados correctamente.',
			`Los ${n} archivos permanecerán disponibles en tu bandeja para continuar con su gestión y seguimiento.`
		);
	}
}

/** «Descartar»: lo pide al servidor (si llegó por la API), lo mueve a descartados y avisa. */
export async function confirmarDescarte(): Promise<void> {
	const ids = descarte.ids ?? [];
	if (ids.length === 0 || descarte.enviando) return;
	descarte.enviando = true;
	try {
		const r = await descartarDocumentos(ids, descarte.motivo);
		if (r.descartados > 0) {
			if (r.descartados === 1) {
				avisarExito(
					'Documento enviado a descartados.',
					'El archivo fue removido de la bandeja activa y movido correctamente a la sección de descartados.'
				);
			} else {
				avisarExito(
					'Documentos enviados a descartados.',
					`Los ${r.descartados} archivos fueron removidos de la bandeja activa y movidos correctamente a la sección de descartados.`
				);
			}
		}
		if (r.error) descarte.error = r.descartados > 0 ? `${r.error} Se descartaron ${r.descartados} de ${ids.length}.` : r.error;
	} finally {
		descarte.enviando = false;
	}
}
