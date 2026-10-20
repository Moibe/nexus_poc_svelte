<script lang="ts">
	/**
	 * El operador «Igual a» en el lienzo del motor de reglas (piloto 2, 2026-10-20).
	 *
	 * Dos entradas, A y B, a las que se conectan CAMPOS de los documentos del expediente, y un resultado: pasa o no pasa. Cada
	 * entrada dice qué campo de qué documento le llega. Lo que se compara es por significado, no por cómo está escrito (ver
	 * `sonIguales`): «$1,250.50» y «1250.5» son el mismo número.
	 *
	 * El lienzo todavía no corre sobre un expediente de verdad, así que para ver la regla funcionar cada lado tiene una cajita de
	 * VALOR DE EJEMPLO: se escribe lo que traería el campo y el nodo dice si pasaría. Esos valores viven en el nodo, no en el campo.
	 *
	 * El resultado ya tiene su punto de salida (para encadenar reglas), aún sin conexión: no hay nada a lo que llegar.
	 */
	import { Handle, Position, useNodeConnections, useNodes, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Equal from '@lucide/svelte/icons/equal';
	import X from '@lucide/svelte/icons/x';

	import { tiposDocumentales } from '$lib/state/configuracion.svelte';
	import {
		LADOS,
		comparar,
		familiaDe,
		salidaDeCampo,
		type DatosNodoIgual,
		type DatosNodoTipo,
		type Lado,
		type Salida
	} from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoIgual>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();
	const nodos = useNodes();
	const conexiones: Record<Lado, ReturnType<typeof useNodeConnections>> = {
		a: useNodeConnections({ handleType: 'target', handleId: 'a' }),
		b: useNodeConnections({ handleType: 'target', handleId: 'b' })
	};

	/** El campo que llega a cada lado, o `null` si no hay nada conectado (o el campo ya no existe). */
	function origenDe(lado: Lado): Salida | null {
		const conexion = conexiones[lado].current[0];
		const nodo = conexion && nodos.current.find((n) => n.id === conexion.source);
		return nodo ? salidaDeCampo(tiposDocumentales, (nodo.data as DatosNodoTipo).tipoId, conexion.sourceHandle ?? '') : null;
	}
	const origen = $derived({ a: origenDe('a'), b: origenDe('b') });

	const resultado = $derived.by(() => {
		const { a, b } = origen;
		if (!a || !b) return 'sin_conexion' as const;
		const familia = familiaDe(a.tipoDato);
		return familia ? comparar(familia, data.a ?? '', data.b ?? '') : ('sin_conexion' as const);
	});

	const VEREDICTO = {
		sin_conexion: { texto: 'Conecta un campo a cada lado', clase: 'text-muted-foreground' },
		sin_valores: { texto: 'Escribe un valor de ejemplo en cada lado', clase: 'text-muted-foreground' },
		pasa: { texto: 'Pasa: los dos valores son iguales', clase: 'text-green-700 dark:text-green-400' },
		no_pasa: { texto: 'No pasa: los valores son distintos', clase: 'text-destructive' }
	} as const;
</script>

<div
	data-testid="nodo-igual"
	class="w-72 rounded-xl border bg-card text-card-foreground shadow-sm {selected
		? 'border-primary ring-2 ring-primary/30'
		: 'border-border'}"
>
	<div class="flex items-start gap-2 rounded-t-xl border-b border-border bg-muted/50 px-3 py-2.5">
		<Equal class="mt-0.5 size-4 shrink-0 text-primary" />
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold">Igual a</p>
			<p class="text-xs text-muted-foreground">Pasa si los dos valores son iguales</p>
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

	{#each LADOS as lado (lado)}
		{@const campo = origen[lado]}
		<div class="relative border-b border-border px-3 py-2.5" data-testid="lado-igual" data-lado={lado}>
			<Handle type="target" position={Position.Left} id={lado} />
			<p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Lado {lado}</p>
			{#if campo}
				<p class="mt-0.5 truncate text-xs font-medium" data-testid="origen-lado" title="{campo.campo} · {campo.tipo}">
					{campo.campo} <span class="font-normal text-muted-foreground">· {campo.tipo}</span>
				</p>
				<input
					type="text"
					data-testid="valor-de-ejemplo"
					aria-label="Valor de ejemplo del lado {lado.toUpperCase()}"
					placeholder="Valor de ejemplo"
					autocomplete="off"
					value={data[lado] ?? ''}
					class="nodrag nowheel mt-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
					oninput={(e) => updateNodeData(id, { [lado]: e.currentTarget.value })}
					onkeydown={(e) => e.stopPropagation()}
				/>
			{:else}
				<p class="mt-0.5 text-xs text-muted-foreground italic" data-testid="lado-sin-campo">Conecta un campo</p>
			{/if}
		</div>
	{/each}

	<div class="relative flex items-center gap-2 px-3 py-3 text-xs font-medium {VEREDICTO[resultado].clase}">
		{#if resultado === 'pasa'}
			<CircleCheck class="size-4 shrink-0" />
		{:else if resultado === 'no_pasa'}
			<CircleX class="size-4 shrink-0" />
		{:else}
			<CircleDashed class="size-4 shrink-0" />
		{/if}
		<span data-testid="resultado-igual" data-estado={resultado}>{VEREDICTO[resultado].texto}</span>
		<Handle type="source" position={Position.Right} id="resultado" isConnectable={false} title="Resultado de la regla (aún no se puede conectar)" />
	</div>
</div>
