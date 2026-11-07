/**
 * Unir lo que propone «Generar a partir de un documento» cuando la persona da VARIOS documentos de ejemplo (2026-11-07, Moibe: «sí, me gusta esa propuesta,
 * hazla así»). Con un solo documento la propuesta de Google cambia de corrida a corrida y juzga todo desde un ejemplo (una variante del documento, un campo
 * que ese ejemplo no trae); con dos o tres se ve qué campos se REPITEN en todos y cuáles aparecen en uno solo. Lógica pura, sin pantalla ni red.
 *
 * Reglas:
 *   · Un campo es «el mismo» si su nombre es igual sin importar mayúsculas, acentos ni espacios de más (`Fecha de emisión` = `fecha emision`).
 *   · Sale con la definición del PRIMER documento donde aparece (nombre, tipo, descripción); la cardinalidad es «múltiple» si CUALQUIERA lo propuso así
 *     (un campo que se repite en un ejemplo y no en otro es un campo que se repite: lo contrario perdería filas), y las listas y los grupos juntan sus valores
 *     y subcampos de todos los documentos.
 *   · `apariciones` cuenta en cuántos documentos salió y `total` cuántos se leyeron. Con varios documentos, uno que NO salió en todos es OPCIONAL
 *     (`opcionalSugerido`): el documento que no lo trae existe, así que exigirlo haría fallar a documentos válidos.
 *   · Una misma propuesta no cuenta dos veces un nombre repetido dentro de un documento.
 */
import type { CampoPropuesto } from '$lib/state/configuracion.svelte';

/** Un campo propuesto y, cuando se leyó más de un documento, en cuántos salió. */
export type CampoUnido = CampoPropuesto & { apariciones: number; total: number; opcionalSugerido: boolean };

/** La llave con la que se decide que dos propuestas son el mismo campo. */
export function llaveDeCampo(nombre: string): string {
	return nombre
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[\s_-]+/g, ' ')
		.trim();
}

/** ¿Este campo se agrega marcado de entrada? Los que salieron en más de la mitad de los documentos (con uno solo, siempre). */
export function sugeridoPorOmision(campo: Pick<CampoUnido, 'apariciones' | 'total'>): boolean {
	return campo.apariciones * 2 > campo.total;
}

/** «En los 3 documentos», «En 2 de 3 documentos», «Solo en 1 de 3 documentos»; vacío si solo se leyó uno (no hay con qué comparar). */
export function textoDeApariciones(campo: Pick<CampoUnido, 'apariciones' | 'total'>): string {
	if (campo.total <= 1) return '';
	if (campo.apariciones === campo.total) return `En los ${campo.total} documentos`;
	if (campo.apariciones === 1) return `Solo en 1 de ${campo.total} documentos`;
	return `En ${campo.apariciones} de ${campo.total} documentos`;
}

function unirSubcampos(base: CampoPropuesto['subcampos'], otros: CampoPropuesto['subcampos']): CampoPropuesto['subcampos'] {
	const vistos = new Set(base.map((s) => llaveDeCampo(s.nombre)));
	const unidos = [...base];
	for (const s of otros) {
		const llave = llaveDeCampo(s.nombre);
		if (llave === '' || vistos.has(llave)) continue;
		vistos.add(llave);
		unidos.push(s);
	}
	return unidos;
}

function unirValores(base: string[], otros: string[]): string[] {
	const vistos = new Set(base.map((v) => v.trim().toLowerCase()));
	const unidos = [...base];
	for (const v of otros) {
		const llave = v.trim().toLowerCase();
		if (llave === '' || vistos.has(llave)) continue;
		vistos.add(llave);
		unidos.push(v);
	}
	return unidos;
}

/** Une las propuestas de cada documento leído (una lista por documento, en el orden en que se leyeron). */
export function unirPropuestas(porDocumento: CampoPropuesto[][]): CampoUnido[] {
	const total = porDocumento.length;
	const unidos = new Map<string, CampoUnido>();
	for (const campos of porDocumento) {
		const vistosEnEste = new Set<string>();
		for (const campo of campos) {
			const llave = llaveDeCampo(campo.nombre);
			if (llave === '' || vistosEnEste.has(llave)) continue;
			vistosEnEste.add(llave);
			const previo = unidos.get(llave);
			if (!previo) {
				unidos.set(llave, {
					...campo,
					valoresLista: [...campo.valoresLista],
					subcampos: [...campo.subcampos],
					apariciones: 1,
					total,
					opcionalSugerido: false
				});
				continue;
			}
			previo.apariciones += 1;
			if (previo.descripcion.trim() === '') previo.descripcion = campo.descripcion;
			if (campo.cardinalidad === 'multiple') previo.cardinalidad = 'multiple';
			previo.valoresLista = unirValores(previo.valoresLista, campo.valoresLista);
			previo.subcampos = unirSubcampos(previo.subcampos, campo.subcampos);
		}
	}
	const salida = [...unidos.values()];
	for (const c of salida) c.opcionalSugerido = total > 1 && c.apariciones < total;
	return salida;
}
