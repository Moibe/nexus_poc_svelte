/**
 * De dónde viene lo que le llega a la entrada de un nodo del lienzo del motor de reglas (2026-11-03: se sacó de `NodoOperador` cuando los nodos
 * finales —«Valor final» y «Resultado»— también necesitaron mostrar su origen). Se llama UNA vez al montar el nodo, porque usa los ganchos de
 * la librería y el contexto del lienzo; devuelve la función que, dada una entrada, dice qué le llega.
 *
 * Lo que llega a una entrada es un campo de un documento, un valor fijo o la regla de la que viene; `null` si no hay nada conectado (o lo
 * conectado ya no existe: el tipo se borró, el operador ya no está en el catálogo).
 */
import { useNodeConnections, useNodes } from '@xyflow/svelte';
import { getContext } from 'svelte';

import {
	CLAVE_VEREDICTOS,
	NODO_CONSTANTE,
	NODO_OPERADOR,
	NODO_TIPO,
	numeroDeOperador,
	operadorDe,
	salidaDeCampo,
	type DatosNodoConstante,
	type DatosNodoOperador,
	type DatosNodoTipo,
	type EvaluadoDelLienzo,
	type OrigenDeEntrada
} from '$lib/reglas/reglas';
import { tiposDocumentales } from '$lib/state/configuracion.svelte';

/** `entradas` son los ids de los puntos de entrada del nodo (`a`, `b`…). */
export function usarOrigenes(entradas: readonly string[]): (entrada: string) => OrigenDeEntrada | null {
	const nodos = useNodes();
	const evaluado = getContext<EvaluadoDelLienzo>(CLAVE_VEREDICTOS);
	const conexiones = new Map(entradas.map((entrada) => [entrada, useNodeConnections({ handleType: 'target', handleId: entrada })]));

	return (entrada) => {
		const conexion = conexiones.get(entrada)?.current[0];
		const nodo = conexion && nodos.current.find((n) => n.id === conexion.source);
		if (!nodo) return null;
		if (nodo.type === NODO_TIPO) {
			const salida = salidaDeCampo(tiposDocumentales, (nodo.data as DatosNodoTipo).tipoId, conexion.sourceHandle ?? '');
			return salida ? { clase: 'campo', salida } : null;
		}
		if (nodo.type === NODO_CONSTANTE) {
			return { clase: 'fijo', numero: numeroDeOperador(nodo.id), valor: String((nodo.data as DatosNodoConstante).valor ?? '') };
		}
		if (nodo.type === NODO_OPERADOR) {
			const otro = operadorDe(String((nodo.data as DatosNodoOperador).operador));
			return otro
				? {
						clase: 'regla',
						nombre: `${otro.etiqueta} #${numeroDeOperador(nodo.id)}`,
						estado: evaluado.todos[nodo.id] ?? 'sin_conexion',
						valor: evaluado.valores[nodo.id],
						entrega: otro.salida
					}
				: null;
		}
		return null;
	};
}
