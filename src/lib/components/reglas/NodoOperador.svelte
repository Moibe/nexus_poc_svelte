<script lang="ts">
	/**
	 * Un OPERADOR en el lienzo del motor de reglas (2026-10-20): una regla. Todos se dibujan igual y cambian en su catálogo
	 * (`OPERADORES`):
	 *
	 *   · de COMPARACIÓN (igual, distinto, contiene, mayor, menor): sus entradas reciben CAMPOS de los documentos del expediente.
	 *     Como el lienzo todavía no corre sobre un expediente de verdad, cada entrada con campo trae una cajita de VALOR DE EJEMPLO:
	 *     se escribe lo que traería el campo y el nodo dice si la regla pasaría. Los valores viven en el nodo, no en el campo.
	 *   · LÓGICOS (Y, O, No): sus entradas reciben el pasa / no pasa de OTRAS reglas. Así se encadenan.
	 *
	 * Todos entregan su resultado por el punto de la derecha. El veredicto lo calcula el lienzo para todo el grafo (`evaluar`) y se lo
	 * ofrece a los nodos por contexto: una regla que depende de otra tiene que ver el veredicto actual de ésa.
	 */
	import { Handle, Position, useNodeConnections, useNodes, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import X from '@lucide/svelte/icons/x';
	import { getContext } from 'svelte';

	import { tiposDocumentales } from '$lib/state/configuracion.svelte';
	import {
		CLAVE_VEREDICTOS,
		NODO_OPERADOR,
		NODO_TIPO,
		SALIDA_RESULTADO,
		numeroDeOperador,
		operadorDe,
		salidaDeCampo,
		type DatosNodoOperador,
		type DatosNodoTipo,
		type Entrada,
		type Salida,
		type Veredicto
	} from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoOperador>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();
	const nodos = useNodes();
	const veredictos = getContext<{ readonly todos: Record<string, Veredicto> }>(CLAVE_VEREDICTOS);
	const conexiones = {
		a: useNodeConnections({ handleType: 'target', handleId: 'a' }),
		b: useNodeConnections({ handleType: 'target', handleId: 'b' })
	};

	const def = $derived(operadorDe(data.operador));
	const veredicto = $derived(veredictos.todos[id] ?? 'sin_conexion');
	const esLogico = $derived(def?.grupo === 'logico');

	type Origen =
		| { clase: 'campo'; salida: Salida }
		| { clase: 'regla'; nombre: string; veredicto: Veredicto };

	/** Lo que llega a una entrada: un campo, o la regla de la que viene; `null` si no hay nada (o lo conectado ya no existe). */
	function origenDe(entrada: Entrada): Origen | null {
		const conexion = conexiones[entrada].current[0];
		const nodo = conexion && nodos.current.find((n) => n.id === conexion.source);
		if (!nodo) return null;
		if (nodo.type === NODO_TIPO) {
			const salida = salidaDeCampo(tiposDocumentales, (nodo.data as DatosNodoTipo).tipoId, conexion.sourceHandle ?? '');
			return salida ? { clase: 'campo', salida } : null;
		}
		if (nodo.type === NODO_OPERADOR) {
			const otro = operadorDe(String((nodo.data as DatosNodoOperador).operador));
			return otro
				? { clase: 'regla', nombre: `${otro.etiqueta} #${numeroDeOperador(nodo.id)}`, veredicto: veredictos.todos[nodo.id] ?? 'sin_conexion' }
				: null;
		}
		return null;
	}

	const VEREDICTO_CORTO: Record<Veredicto, string> = { pasa: 'Pasa', no_pasa: 'No pasa', sin_valores: 'Sin valores', sin_conexion: 'Incompleta' };

	const textoDelVeredicto = $derived.by(() => {
		if (!def) return '';
		switch (veredicto) {
			case 'pasa':
				return def.textoPasa;
			case 'no_pasa':
				return def.textoNoPasa;
			case 'sin_valores':
				return esLogico ? 'Falta el veredicto de alguna regla' : 'Escribe un valor de ejemplo en cada lado';
			default:
				return esLogico ? (def.entradas.length === 1 ? 'Conecta una regla' : 'Conecta una regla a cada entrada') : 'Conecta un campo a cada entrada';
		}
	});
	const claseDelVeredicto = $derived(
		veredicto === 'pasa' ? 'text-green-700 dark:text-green-400' : veredicto === 'no_pasa' ? 'text-destructive' : 'text-muted-foreground'
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
			{@const origen = origenDe(entrada.id)}
			<div class="relative border-b border-border px-3 py-2.5" data-testid="entrada-operador" data-entrada={entrada.id}>
				<Handle type="target" position={Position.Left} id={entrada.id} />
				<p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{entrada.etiqueta}</p>
				{#if origen?.clase === 'campo'}
					<p class="mt-0.5 truncate text-xs font-medium" data-testid="origen-entrada" title="{origen.salida.campo} · {origen.salida.tipo}">
						{origen.salida.campo} <span class="font-normal text-muted-foreground">· {origen.salida.tipo}</span>
					</p>
					<input
						type="text"
						data-testid="valor-de-ejemplo"
						aria-label="Valor de ejemplo de «{entrada.etiqueta}»"
						placeholder="Valor de ejemplo"
						autocomplete="off"
						value={data[entrada.id] ?? ''}
						class="nodrag nowheel mt-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
						oninput={(e) => updateNodeData(id, { [entrada.id]: e.currentTarget.value })}
						onkeydown={(e) => e.stopPropagation()}
					/>
				{:else if origen?.clase === 'regla'}
					<p class="mt-0.5 flex items-center justify-between gap-2 text-xs font-medium" data-testid="origen-entrada">
						<span class="truncate">{origen.nombre}</span>
						<span
							class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium {origen.veredicto === 'pasa'
								? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
								: origen.veredicto === 'no_pasa'
									? 'bg-destructive/10 text-destructive'
									: 'bg-muted text-muted-foreground'}"
							data-testid="veredicto-de-origen"
							data-estado={origen.veredicto}>{VEREDICTO_CORTO[origen.veredicto]}</span
						>
					</p>
				{:else}
					<p class="mt-0.5 text-xs text-muted-foreground italic" data-testid="entrada-sin-conexion">
						{esLogico ? 'Conecta el resultado de una regla' : 'Conecta un campo'}
					</p>
				{/if}
			</div>
		{/each}

		<div class="relative flex items-center gap-2 px-3 py-3 text-xs font-medium {claseDelVeredicto}">
			{#if veredicto === 'pasa'}
				<CircleCheck class="size-4 shrink-0" />
			{:else if veredicto === 'no_pasa'}
				<CircleX class="size-4 shrink-0" />
			{:else}
				<CircleDashed class="size-4 shrink-0" />
			{/if}
			<span data-testid="resultado-operador" data-estado={veredicto}>{textoDelVeredicto}</span>
			<Handle type="source" position={Position.Right} id={SALIDA_RESULTADO} title="Resultado de la regla: conéctalo a un operador Y, O o No" />
		</div>
	</div>
{/if}
