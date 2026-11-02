<script lang="ts">
	/**
	 * Un VALOR FINAL en el lienzo del motor de reglas (2026-11-03, Moibe: «un valor final es aquel que ya no se compara más y que pertenecerá a un
	 * listado de valores finales de la corrida»). Es un dato que el proceso entrega al terminar: se le conecta un campo, una lista, un valor fijo,
	 * un número que calculó una regla (`Cantidad`, `Suma`) o el pasa / no pasa de una regla, y entra a la lista con el NOMBRE que se le escribe
	 * aquí (sin nombre, «Valor final #N»). No tiene salida: de aquí no sale nada a otra regla, por eso es «final».
	 *
	 * Como una entrada de un operador, si lo que llega es un campo trae su cajita de VALOR DE EJEMPLO (el lienzo aún no corre sobre un expediente
	 * de verdad) y el nodo dice qué valor entraría a la lista. Lo que viene de un valor fijo o de una regla se ve, no se escribe.
	 *
	 * Dos valores finales con el mismo nombre se avisan en ámbar (en la lista de la corrida se confundirían), pero se pueden guardar.
	 */
	import { Handle, Position, useNodes, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import Flag from '@lucide/svelte/icons/flag';
	import X from '@lucide/svelte/icons/x';
	import { getContext } from 'svelte';

	import OrigenDeEntrada from '$lib/components/reglas/OrigenDeEntrada.svelte';
	import { usarOrigenes } from '$lib/components/reglas/origenes';
	import {
		CLAVE_VEREDICTOS,
		ENTRADA_FINAL,
		MAX_NOMBRE_FINAL,
		nombreDeValorFinal,
		numeroDeOperador,
		valoresFinalesRepetidos,
		type DatosNodoValorFinal,
		type EvaluadoDelLienzo
	} from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoValorFinal>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();
	const nodos = useNodes();
	const evaluado = getContext<EvaluadoDelLienzo>(CLAVE_VEREDICTOS);
	const origenDe = usarOrigenes([ENTRADA_FINAL]);

	const entrada = { id: ENTRADA_FINAL, etiqueta: 'Valor', acepta: 'valor' } as const;
	const final = $derived(evaluado.finales[id] ?? { estado: 'sin_conexion' as const });
	const nombre = $derived(nombreDeValorFinal(id, data));
	const repetido = $derived(valoresFinalesRepetidos(nodos.current).has(id));

	/** Qué falta cuando está conectado pero todavía no hay valor. */
	const textoSinValores = $derived.by(() => {
		const origen = origenDe(ENTRADA_FINAL);
		return origen?.clase === 'campo' ? 'Escribe un valor de ejemplo' : origen?.clase === 'fijo' ? 'El valor fijo está vacío' : 'Falta el valor de la regla conectada';
	});
</script>

<div
	data-testid="nodo-valor-final"
	class="w-72 rounded-xl border bg-card text-card-foreground shadow-sm {selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'}"
>
	<div class="flex items-start gap-2 rounded-t-xl border-b border-border bg-muted/50 px-3 py-2.5">
		<span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary" aria-hidden="true"><Flag class="size-3" /></span>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold">
				<span data-testid="valor-final-titulo">Valor final</span>
				<span class="font-normal text-muted-foreground" data-testid="valor-final-numero">#{numeroDeOperador(id)}</span>
			</p>
			<p class="text-xs text-muted-foreground">Un dato que entrega el proceso al terminar</p>
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

	<div class="border-b border-border px-3 py-2.5">
		<label for="nombre-{id}" class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Nombre en la lista</label>
		<input
			id="nombre-{id}"
			type="text"
			data-testid="valor-final-nombre"
			maxlength={MAX_NOMBRE_FINAL}
			placeholder="Valor final #{numeroDeOperador(id)}"
			autocomplete="off"
			value={data.nombre ?? ''}
			class="nodrag nowheel mt-1.5 h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary {repetido ? 'border-amber-400' : 'border-border'}"
			oninput={(e) => updateNodeData(id, { nombre: e.currentTarget.value })}
			onkeydown={(e) => e.stopPropagation()}
		/>
		{#if repetido}
			<p class="mt-1 text-[11px] text-amber-700 dark:text-amber-400" data-testid="valor-final-repetido">Otro valor final se llama igual: en la lista de la corrida se confundirían.</p>
		{/if}
	</div>

	<div class="relative border-b border-border px-3 py-2.5" data-testid="entrada-final" data-entrada={ENTRADA_FINAL}>
		<Handle type="target" position={Position.Left} id={ENTRADA_FINAL} />
		<p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{entrada.etiqueta}</p>
		<OrigenDeEntrada
			{entrada}
			origen={origenDe(ENTRADA_FINAL)}
			ejemplo={String(data.a ?? '')}
			alEscribir={(texto) => updateNodeData(id, { a: texto })}
			sinOrigen="Conecta un campo, un valor fijo o el resultado de una regla"
		/>
	</div>

	<div class="flex items-center gap-2 px-3 py-3 text-xs font-medium {final.estado === 'listo' ? 'text-foreground' : 'text-muted-foreground'}">
		{#if final.estado === 'listo'}
			<Flag class="size-4 shrink-0" />
		{:else}
			<CircleDashed class="size-4 shrink-0" />
		{/if}
		<span
			class="min-w-0 flex-1 truncate"
			data-testid="valor-final-estado"
			data-estado={final.estado}
			data-valor={final.valor ?? ''}
			title={final.estado === 'listo' ? `${nombre}: ${final.valor}` : undefined}
		>
			{#if final.estado === 'listo'}
				{nombre}: {final.valor}
			{:else if final.estado === 'sin_valores'}
				{textoSinValores}
			{:else}
				Conecta un campo, un valor fijo o una regla
			{/if}
		</span>
	</div>
</div>
