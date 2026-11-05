<script lang="ts">
	/**
	 * Un OPERADOR en el lienzo del motor de reglas (2026-10-20): una regla. Todos se dibujan igual y cambian en su catálogo
	 * (`OPERADORES`):
	 *
	 *   · de COMPARACIÓN (igual, distinto, contiene, mayor, menor): sus entradas reciben VALORES: un campo de un documento, un valor
	 *     fijo, o el número que entrega `Cantidad` o `Suma`. Dan pasa / no pasa.
	 *   · de LISTAS (cantidad, suma, alguno, todos, unicos): reciben una LISTA (un campo «1 a N» o una columna de un grupo que se repite;
	 *     «Cantidad» también las filas de un grupo). `Cantidad` y `Suma` entregan un número; los demás, pasa / no pasa.
	 *   · LÓGICOS (Y, O, No, Implica): sus entradas reciben el pasa / no pasa de OTRAS reglas. Así se encadenan. «Implica» tiene una
	 *     entrada «Si (condición)» y otra «Entonces (debe pasar)»; pasa también cuando la condición no se cumple, y el nodo lo dice
	 *     (si no, una regla que «pasa» cuando la regla de entrada no pasa parece un error).
	 *   · «Existe documento»: su entrada recibe el DOCUMENTO entero (el rombo de un tipo documental) y dice si el expediente lo trae.
	 *     Su ejemplo no es un texto sino una elección: el expediente de ejemplo SÍ o NO trae el documento.
	 *
	 * Como el lienzo todavía no corre sobre un expediente de verdad, cada entrada que viene de un CAMPO trae una cajita de VALOR DE
	 * EJEMPLO (si es una lista, un área con un elemento por renglón): se escribe lo que traería el campo y el nodo dice qué daría la
	 * regla. Los valores viven en el nodo, no en el campo. Lo que viene de un valor fijo o de otra regla no se escribe aquí: se ve.
	 *
	 * Lo que evaluó el lienzo para todo el grafo (`evaluar`) se lo ofrece a los nodos por contexto: una regla que depende de otra tiene
	 * que ver el estado y el valor actuales de ésa.
	 */
	import { Handle, Position, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import Equal from '@lucide/svelte/icons/equal';
	import X from '@lucide/svelte/icons/x';
	import { getContext } from 'svelte';

	import OrigenDeEntrada from '$lib/components/reglas/OrigenDeEntrada.svelte';
	import SelloDeVeredicto from '$lib/components/reglas/SelloDeVeredicto.svelte';
	import { usarOrigenes } from '$lib/components/reglas/origenes';
	import {
		CLAVE_VEREDICTOS,
		SALIDA_RESULTADO,
		esNumero,
		lineasDeEjemplo,
		numeroDeOperador,
		operadorDe,
		type DatosNodoOperador,
		type EvaluadoDelLienzo,
		type Estado
	} from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoOperador>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();
	const evaluado = getContext<EvaluadoDelLienzo>(CLAVE_VEREDICTOS);
	/** Lo que llega a cada entrada (un campo, un valor fijo o una regla); lo comparte con los nodos finales. */
	const origenDe = usarOrigenes(['a', 'b']);

	const def = $derived(operadorDe(data.operador));
	const estado = $derived<Estado>(evaluado.todos[id] ?? 'sin_conexion');
	const valorDeSalida = $derived(evaluado.valores[id]);
	const esLogico = $derived(def?.grupo === 'logico');
	const esDocumento = $derived(def?.grupo === 'documento');
	const entregaValor = $derived(def?.salida === 'valor');

	/** El renglón de una lista de ejemplo que no es número, cuando la regla suma: se avisa en vez de dejar un «sin valores» mudo. */
	function lineaQueNoEsNumero(): string | null {
		if (def?.clave !== 'suma') return null;
		const origen = origenDe('a');
		if (origen?.clase !== 'campo') return null;
		return lineasDeEjemplo(String(data.a ?? '')).find((l) => !esNumero(l)) ?? null;
	}

	const textoDelEstado = $derived.by(() => {
		if (!def) return '';
		switch (estado) {
			case 'pasa': {
				// «Implica» pasa de dos maneras: porque se cumple lo que exige, o porque la condición no se cumple y no hay nada que
				// exigir. Se dice cuál, porque lo segundo —pasar cuando la regla de entrada no pasa— parece un error.
				const condicion = def.textoPasaSinCondicion ? origenDe('a') : null;
				return condicion?.clase === 'regla' && condicion.estado === 'no_pasa' ? (def.textoPasaSinCondicion ?? def.textoPasa) : def.textoPasa;
			}
			case 'no_pasa':
				return def.textoNoPasa;
			case 'listo':
				return `Resultado: ${valorDeSalida ?? ''}`;
			case 'sin_valores': {
				if (esLogico) return 'Falta el veredicto de alguna regla';
				if (esDocumento) return 'Elige si el expediente de ejemplo trae el documento';
				const mala = lineaQueNoEsNumero();
				if (mala !== null) return `«${mala}» no es un número`;
				return def.grupo === 'lista' ? 'Escribe los valores de ejemplo (uno por renglón)' : 'Escribe un valor de ejemplo en cada lado';
			}
			default:
				if (esDocumento) return 'Conecta el documento de un tipo documental';
				if (esLogico) return def.entradas.length === 1 ? 'Conecta una regla' : 'Conecta una regla a cada entrada';
				if (def.grupo === 'lista') return def.entradas.length === 1 ? 'Conecta una lista' : 'Conecta una lista y un valor';
				return 'Conecta un campo o un valor fijo a cada entrada';
		}
	});
	const claseDelEstado = $derived(
		estado === 'pasa' ? 'text-green-700 dark:text-green-400' : estado === 'no_pasa' ? 'text-destructive' : estado === 'listo' ? 'text-foreground' : 'text-muted-foreground'
	);
</script>

{#if def}
	<div
		data-testid="nodo-operador"
		data-operador={def.clave}
		class="w-72 rounded-xl border bg-card text-card-foreground shadow-sm {selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'}"
	>
		<div class="flex items-start gap-2 rounded-t-xl border-b border-border bg-muted/50 px-3 py-2.5">
			<span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">{def.simbolo}</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold">
					<span data-testid="operador-nombre">{def.etiqueta}</span>
					<span class="font-normal text-muted-foreground" data-testid="operador-numero">#{numeroDeOperador(id)}</span>
				</p>
				<p class="text-xs text-muted-foreground">{def.descripcion}</p>
			</div>
			<button
				type="button"
				data-testid="quitar-nodo"
				aria-label="Quitar del lienzo"
				title="Quitar del lienzo"
				class="nodrag flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				onclick={() => deleteElements({ nodes: [{ id }] })}
			>
				<X class="size-3.5" />
			</button>
		</div>

		{#each def.entradas as entrada (entrada.id)}
			<div class="relative border-b border-border px-3 py-2.5" data-testid="entrada-operador" data-entrada={entrada.id}>
				<Handle type="target" position={Position.Left} id={entrada.id} />
				<p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{entrada.etiqueta}</p>
				<OrigenDeEntrada
					{entrada}
					origen={origenDe(entrada.id)}
					ejemplo={String(data[entrada.id] ?? '')}
					alEscribir={(texto) => updateNodeData(id, { [entrada.id]: texto })}
				/>
			</div>
		{/each}

		<!-- El veredicto de la regla (2026-11-04, Moibe: «el resultado final, ligeramente más grande, y la palomota más prominente»). El texto sube
		     de 12 a 14 px, y «pasa» y «no pasa» llevan su sello: círculo verde con paloma amarilla, círculo rojo con tache blanco. Todos los estados
		     comparten la misma caja de 24 px para el ícono, así el nodo no cambia de alto ni se mueve su punto de salida al cambiar el veredicto.
		     El sello es decorativo: lo que dice el estado es el texto de al lado. -->
		<div class="relative flex items-center gap-2.5 px-3 py-3 text-sm leading-snug font-medium {claseDelEstado}">
			<span class="flex size-6 shrink-0 items-center justify-center" data-testid="icono-veredicto" data-estado={estado} aria-hidden="true">
				{#if estado === 'pasa'}
					<SelloDeVeredicto tipo="pasa" />
				{:else if estado === 'no_pasa'}
					<SelloDeVeredicto tipo="no_pasa" />
				{:else if estado === 'listo'}
					<Equal class="size-4" />
				{:else}
					<CircleDashed class="size-4" />
				{/if}
			</span>
			<span class="min-w-0" data-testid="resultado-operador" data-estado={estado} data-valor={valorDeSalida ?? ''}>{textoDelEstado}</span>
			<Handle
				type="source"
				position={Position.Right}
				id={SALIDA_RESULTADO}
				title={entregaValor ? 'El número que calculó: conéctalo a una comparación' : 'Resultado de la regla: conéctalo a un operador lógico (Y, O, No o Implica)'}
			/>
		</div>
	</div>
{/if}
