<script lang="ts">
	/**
	 * El RESULTADO en el lienzo del motor de reglas (2026-11-03, Moibe: el resultado no es un «cumple / no cumple» fijo sino «un campo de texto final
	 * personalizable», como «Aprobado» o «Certificado»). Es la palabra con la que termina el proceso, y es UNA por proceso.
	 *
	 * Se le conecta una condición —el pasa / no pasa de una regla— y guarda tres palabras que se escriben aquí: la que sale cuando la condición se
	 * cumple, la que sale cuando no, y la que sale cuando no se puede saber por falta de datos (hay un valor de ejemplo sin escribir, un documento
	 * que el expediente no trae). Con los valores de ejemplo, el nodo marca cuál de las tres saldría. No tiene salida: es el final del proceso.
	 *
	 * Una palabra no puede quedar vacía: al salir de la caja vuelve a la de siempre («Aprobado», «Rechazado», «Sin datos»), porque un resultado sin
	 * palabra para un caso no diría nada cuando le tocara.
	 */
	import { Handle, Position, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import X from '@lucide/svelte/icons/x';
	import { getContext } from 'svelte';

	import OrigenDeEntrada from '$lib/components/reglas/OrigenDeEntrada.svelte';
	import SelloDeVeredicto from '$lib/components/reglas/SelloDeVeredicto.svelte';
	import { usarOrigenes } from '$lib/components/reglas/origenes';
	import {
		CASOS_DEL_RESULTADO,
		CLAVE_VEREDICTOS,
		ENTRADA_FINAL,
		MAX_TEXTO_RESULTADO,
		TEXTOS_DEL_RESULTADO,
		type CasoDelResultado,
		type DatosNodoResultado,
		type EvaluadoDelLienzo
	} from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoResultado>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();
	const evaluado = getContext<EvaluadoDelLienzo>(CLAVE_VEREDICTOS);
	const origenDe = usarOrigenes([ENTRADA_FINAL]);

	const entrada = { id: ENTRADA_FINAL, etiqueta: 'Condición', acepta: 'veredicto' } as const;
	const resultado = $derived(evaluado.resultado);

	/** El puntito de color de cada caso: verde cuando se cumple, rojo cuando no, gris cuando no se sabe. */
	const PUNTO: Record<CasoDelResultado, string> = { si: 'bg-green-600', no: 'bg-destructive', sin: 'bg-muted-foreground' };

	/** Al salir de la caja, una palabra vacía vuelve a la de siempre. */
	function alSalir(caso: CasoDelResultado, texto: string) {
		if (!texto.trim()) updateNodeData(id, { [caso]: TEXTOS_DEL_RESULTADO[caso] });
	}
</script>

<div
	data-testid="nodo-resultado"
	class="w-72 rounded-xl border bg-card text-card-foreground shadow-sm {selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'}"
>
	<div class="flex items-start gap-2 rounded-t-xl border-b border-border bg-muted/50 px-3 py-2.5">
		<span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary" aria-hidden="true"><BadgeCheck class="size-3.5" /></span>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold" data-testid="resultado-titulo">Resultado</p>
			<p class="text-xs text-muted-foreground">La palabra con la que termina el proceso</p>
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

	<div class="relative border-b border-border px-3 py-2.5" data-testid="entrada-final" data-entrada={ENTRADA_FINAL}>
		<Handle type="target" position={Position.Left} id={ENTRADA_FINAL} />
		<p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{entrada.etiqueta}</p>
		<OrigenDeEntrada {entrada} origen={origenDe(ENTRADA_FINAL)} ejemplo="" alEscribir={() => undefined} />
	</div>

	<div class="space-y-2 border-b border-border px-3 py-2.5">
		{#each CASOS_DEL_RESULTADO as c (c.caso)}
			{@const activo = resultado?.caso === c.caso}
			<div
				data-testid="caso-resultado"
				data-caso={c.caso}
				data-activo={activo}
				class="rounded-lg border px-2 py-1.5 transition-colors {activo ? 'border-primary bg-primary/5' : 'border-border'}"
			>
				<label for="resultado-{c.caso}-{id}" class="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
					<span class="size-2 shrink-0 rounded-full {PUNTO[c.caso]}" aria-hidden="true"></span>{c.etiqueta}
				</label>
				<input
					id="resultado-{c.caso}-{id}"
					type="text"
					data-testid="resultado-texto"
					data-caso={c.caso}
					maxlength={MAX_TEXTO_RESULTADO}
					autocomplete="off"
					value={data[c.caso] ?? TEXTOS_DEL_RESULTADO[c.caso]}
					class="nodrag nowheel mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
					oninput={(e) => updateNodeData(id, { [c.caso]: e.currentTarget.value })}
					onblur={(e) => alSalir(c.caso, e.currentTarget.value)}
					onkeydown={(e) => e.stopPropagation()}
				/>
			</div>
		{/each}
	</div>

	<!-- Con el mismo trato que el pie de una regla (2026-11-04, Moibe): texto de 14 px y el sello del caso en el que termina —verde con paloma
	     amarilla si se cumple, rojo con tache blanco si no, gris con «?» si faltan datos—, en una caja de 24 px que comparten todos los estados. -->
	<div
		class="flex items-center gap-2.5 px-3 py-3 text-sm leading-snug font-medium {resultado?.caso === 'si' ? 'text-green-700 dark:text-green-400' : resultado?.caso === 'no' ? 'text-destructive' : 'text-muted-foreground'}"
	>
		<span class="flex size-6 shrink-0 items-center justify-center" data-testid="icono-resultado" data-caso={resultado?.caso ?? ''} aria-hidden="true">
			{#if resultado?.texto}
				<SelloDeVeredicto tipo={resultado.caso === 'si' ? 'pasa' : resultado.caso === 'no' ? 'no_pasa' : 'sin_dato'} />
			{:else}
				<CircleDashed class="size-4" />
			{/if}
		</span>
		<span class="min-w-0 flex-1" data-testid="resultado-estado" data-caso={resultado?.caso ?? ''} data-texto={resultado?.texto ?? ''}>
			{#if resultado?.texto}
				Con los valores de ejemplo termina en «{resultado.texto}»
			{:else if origenDe(ENTRADA_FINAL)}
				La regla conectada está incompleta
			{:else}
				Conecta una regla para ver con qué palabra termina
			{/if}
		</span>
	</div>
</div>
