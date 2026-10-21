<script lang="ts">
	/**
	 * Un VALOR FIJO en el lienzo del motor de reglas (2026-10-20): un dato que se escribe en la regla en vez de salir de un documento,
	 * como el «2» de «tiene más de 2 socios» o el «MXN» de «la moneda es MXN». Se conecta a la entrada de un operador igual que un
	 * campo, por su punto de la derecha.
	 *
	 * A diferencia del valor de EJEMPLO de una entrada —que es lo que traería el campo y que luego reemplazará el dato real—, éste es
	 * parte de la regla y se guarda con ella. Lleva su clase (texto, número, fecha o sí/no) porque de ella depende con qué se puede
	 * comparar y cómo (un «10» como número es mayor que un «9»; como texto, no).
	 */
	import { Handle, Position, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import X from '@lucide/svelte/icons/x';

	import { FAMILIAS_DE_VALOR_FIJO, SALIDA_VALOR, numeroDeOperador, type DatosNodoConstante, type Familia } from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoConstante>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();

	const EJEMPLO: Record<Familia, string> = { texto: 'Un texto', numero: 'Un número, como 2', fecha: 'Una fecha, como 2020-03-15', booleano: 'sí o no' };
</script>

<div
	data-testid="nodo-constante"
	class="w-64 rounded-xl border bg-card text-card-foreground shadow-sm {selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'}"
>
	<div class="flex items-start gap-2 rounded-t-xl border-b border-border bg-muted/50 px-3 py-2.5">
		<span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">K</span>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold">
				<span data-testid="constante-nombre">Valor fijo</span>
				<span class="font-normal text-muted-foreground" data-testid="constante-numero">#{numeroDeOperador(id)}</span>
			</p>
			<p class="text-xs text-muted-foreground">Un dato que escribes en la regla</p>
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

	<div class="relative space-y-1.5 px-3 py-2.5">
		<select
			data-testid="constante-familia"
			aria-label="Clase del valor fijo"
			value={data.familia}
			class="nodrag h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
			onchange={(e) => updateNodeData(id, { familia: e.currentTarget.value })}
		>
			{#each FAMILIAS_DE_VALOR_FIJO as f (f.valor)}
				<option value={f.valor}>{f.etiqueta}</option>
			{/each}
		</select>
		<input
			type="text"
			data-testid="constante-valor"
			aria-label="Valor fijo"
			placeholder={EJEMPLO[data.familia] ?? EJEMPLO.texto}
			autocomplete="off"
			value={data.valor ?? ''}
			class="nodrag nowheel h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
			oninput={(e) => updateNodeData(id, { valor: e.currentTarget.value })}
			onkeydown={(e) => e.stopPropagation()}
		/>
		<Handle type="source" position={Position.Right} id={SALIDA_VALOR} title="El valor: conéctalo a la entrada de un operador" />
	</div>
</div>
