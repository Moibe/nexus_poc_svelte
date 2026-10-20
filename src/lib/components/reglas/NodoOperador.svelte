<script lang="ts">
	/**
	 * Un OPERADOR en el lienzo del motor de reglas (2026-10-20): una regla. Todos se dibujan igual y cambian en su catálogo
	 * (`OPERADORES`):
	 *
	 *   · de COMPARACIÓN (igual, distinto, contiene, mayor, menor): sus entradas reciben VALORES: un campo de un documento, un valor
	 *     fijo, o el número que entrega `Cantidad` o `Suma`. Dan pasa / no pasa.
	 *   · de LISTAS (cantidad, suma, alguno, todos, unicos): reciben una LISTA (un campo «1 a N» o una columna de un grupo que se repite;
	 *     «Cantidad» también las filas de un grupo). `Cantidad` y `Suma` entregan un número; los demás, pasa / no pasa.
	 *   · LÓGICOS (Y, O, No): sus entradas reciben el pasa / no pasa de OTRAS reglas. Así se encadenan.
	 *
	 * Como el lienzo todavía no corre sobre un expediente de verdad, cada entrada que viene de un CAMPO trae una cajita de VALOR DE
	 * EJEMPLO (si es una lista, un área con un elemento por renglón): se escribe lo que traería el campo y el nodo dice qué daría la
	 * regla. Los valores viven en el nodo, no en el campo. Lo que viene de un valor fijo o de otra regla no se escribe aquí: se ve.
	 *
	 * Lo que evaluó el lienzo para todo el grafo (`evaluar`) se lo ofrece a los nodos por contexto: una regla que depende de otra tiene
	 * que ver el estado y el valor actuales de ésa.
	 */
	import { Handle, Position, useNodeConnections, useNodes, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Equal from '@lucide/svelte/icons/equal';
	import X from '@lucide/svelte/icons/x';
	import { getContext } from 'svelte';

	import { tiposDocumentales } from '$lib/state/configuracion.svelte';
	import {
		CLAVE_VEREDICTOS,
		NODO_CONSTANTE,
		NODO_OPERADOR,
		NODO_TIPO,
		SALIDA_RESULTADO,
		esNumero,
		lineasDeEjemplo,
		numeroDeOperador,
		operadorDe,
		salidaDeCampo,
		type DatosNodoConstante,
		type DatosNodoOperador,
		type DatosNodoTipo,
		type Entrada,
		type Estado,
		type Salida
	} from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoOperador>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();
	const nodos = useNodes();
	const evaluado = getContext<{ readonly todos: Record<string, Estado>; readonly valores: Record<string, string> }>(CLAVE_VEREDICTOS);
	const conexiones = {
		a: useNodeConnections({ handleType: 'target', handleId: 'a' }),
		b: useNodeConnections({ handleType: 'target', handleId: 'b' })
	};

	const def = $derived(operadorDe(data.operador));
	const estado = $derived<Estado>(evaluado.todos[id] ?? 'sin_conexion');
	const valorDeSalida = $derived(evaluado.valores[id]);
	const esLogico = $derived(def?.grupo === 'logico');
	const entregaValor = $derived(def?.salida === 'valor');

	type Origen =
		| { clase: 'campo'; salida: Salida }
		| { clase: 'fijo'; numero: string; valor: string }
		| { clase: 'regla'; nombre: string; estado: Estado; valor: string | undefined; entrega: 'veredicto' | 'valor' };

	/** Lo que llega a una entrada: un campo, un valor fijo o la regla de la que viene; `null` si no hay nada (o lo conectado ya no existe). */
	function origenDe(entrada: Entrada): Origen | null {
		const conexion = conexiones[entrada].current[0];
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
	}

	const ESTADO_CORTO: Record<Estado, string> = { pasa: 'Pasa', no_pasa: 'No pasa', sin_valores: 'Sin valores', sin_conexion: 'Incompleta', listo: 'Listo' };

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
			case 'pasa':
				return def.textoPasa;
			case 'no_pasa':
				return def.textoNoPasa;
			case 'listo':
				return `Resultado: ${valorDeSalida ?? ''}`;
			case 'sin_valores': {
				if (esLogico) return 'Falta el veredicto de alguna regla';
				const mala = lineaQueNoEsNumero();
				if (mala !== null) return `«${mala}» no es un número`;
				return def.grupo === 'lista' ? 'Escribe los valores de ejemplo (uno por renglón)' : 'Escribe un valor de ejemplo en cada lado';
			}
			default:
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
			{@const origen = origenDe(entrada.id)}
			<div class="relative border-b border-border px-3 py-2.5" data-testid="entrada-operador" data-entrada={entrada.id}>
				<Handle type="target" position={Position.Left} id={entrada.id} />
				<p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{entrada.etiqueta}</p>
				{#if origen?.clase === 'campo'}
					<p class="mt-0.5 truncate text-xs font-medium" data-testid="origen-entrada" title="{origen.salida.campo} · {origen.salida.tipo}">
						{origen.salida.campo} <span class="font-normal text-muted-foreground">· {origen.salida.tipo}</span>
					</p>
					{#if origen.salida.forma === 'valor'}
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
					{:else}
						<textarea
							data-testid="valor-de-ejemplo"
							aria-label="Valores de ejemplo de «{entrada.etiqueta}»"
							placeholder={origen.salida.forma === 'filas' ? 'Una fila por renglón' : 'Un elemento por renglón'}
							rows="3"
							value={data[entrada.id] ?? ''}
							class="nodrag nowheel mt-1.5 min-h-16 w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
							oninput={(e) => updateNodeData(id, { [entrada.id]: e.currentTarget.value })}
							onkeydown={(e) => e.stopPropagation()}
						></textarea>
					{/if}
				{:else if origen?.clase === 'fijo'}
					<p class="mt-0.5 flex items-center justify-between gap-2 text-xs font-medium" data-testid="origen-entrada">
						<span class="truncate">Valor fijo #{origen.numero}</span>
						<span class="max-w-32 shrink-0 truncate rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium" data-testid="valor-de-origen" title={origen.valor}>{origen.valor || '—'}</span>
					</p>
				{:else if origen?.clase === 'regla'}
					<p class="mt-0.5 flex items-center justify-between gap-2 text-xs font-medium" data-testid="origen-entrada">
						<span class="truncate">{origen.nombre}</span>
						{#if origen.entrega === 'valor'}
							<span
								class="max-w-32 shrink-0 truncate rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium"
								data-testid="valor-de-origen"
								data-estado={origen.estado}
								title={origen.valor ?? ''}>{origen.valor !== undefined ? `= ${origen.valor}` : 'Sin valor'}</span
							>
						{:else}
							<span
								class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium {origen.estado === 'pasa'
									? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
									: origen.estado === 'no_pasa'
										? 'bg-destructive/10 text-destructive'
										: 'bg-muted text-muted-foreground'}"
								data-testid="veredicto-de-origen"
								data-estado={origen.estado}>{ESTADO_CORTO[origen.estado]}</span
							>
						{/if}
					</p>
				{:else}
					<p class="mt-0.5 text-xs text-muted-foreground italic" data-testid="entrada-sin-conexion">
						{esLogico ? 'Conecta el resultado de una regla' : entrada.acepta === 'lista' ? 'Conecta una lista' : 'Conecta un campo o un valor fijo'}
					</p>
				{/if}
			</div>
		{/each}

		<div class="relative flex items-center gap-2 px-3 py-3 text-xs font-medium {claseDelEstado}">
			{#if estado === 'pasa'}
				<CircleCheck class="size-4 shrink-0" />
			{:else if estado === 'no_pasa'}
				<CircleX class="size-4 shrink-0" />
			{:else if estado === 'listo'}
				<Equal class="size-4 shrink-0" />
			{:else}
				<CircleDashed class="size-4 shrink-0" />
			{/if}
			<span data-testid="resultado-operador" data-estado={estado} data-valor={valorDeSalida ?? ''}>{textoDelEstado}</span>
			<Handle
				type="source"
				position={Position.Right}
				id={SALIDA_RESULTADO}
				title={entregaValor ? 'El número que calculó: conéctalo a una comparación' : 'Resultado de la regla: conéctalo a un operador Y, O o No'}
			/>
		</div>
	</div>
{/if}
