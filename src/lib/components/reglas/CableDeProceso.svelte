<script lang="ts">
	/**
	 * El cable del lienzo de procesos (2026-11-03, Moibe: «quiero alguna forma de desconectar el extremo de un cuadro ya previamente unido»).
	 *
	 * Hasta ahora un cable solo se quitaba escogiéndolo y pulsando Supr: nada en pantalla lo decía. Ahora:
	 *  - **Se arrastra de cualquiera de sus extremos** para soltarlo en otro punto de conexión (el lienzo decide si cabe, igual que con un
	 *    cable nuevo) o en el vacío, y ahí se desconecta. El extremo de la ENTRADA siempre se puede tomar; el de la SALIDA solo con el cable
	 *    escogido, porque una salida admite varios cables y un asa fija encima estorbaría al sacar uno nuevo de ahí.
	 *  - **Con el cable escogido** salen un puntito en cada extremo y una × en medio que lo quita de un clic.
	 */
	import { BaseEdge, EdgeLabel, EdgeReconnectAnchor, getBezierPath, useSvelteFlow, type EdgeProps } from '@xyflow/svelte';
	import X from '@lucide/svelte/icons/x';

	let { id, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerStart, markerEnd, style, interactionWidth }: EdgeProps = $props();

	const { deleteElements } = useSvelteFlow();

	const [camino, medioX, medioY] = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }));

	/** Mientras se arrastra un extremo, el asa no se dibuja: debajo está el cable de verdad y el puntito estorba. */
	let moviendoOrigen = $state(false);
	let moviendoDestino = $state(false);
</script>

<BaseEdge {id} path={camino} {markerStart} {markerEnd} {style} {interactionWidth} />

{#snippet punto()}
	<span class="block size-3 rounded-full border-2 border-primary bg-card shadow-sm" aria-hidden="true"></span>
{/snippet}

<EdgeReconnectAnchor type="target" class="z-1000!" bind:reconnecting={moviendoDestino} position={{ x: targetX, y: targetY }} size={16} data-testid="extremo-cable-entrada" title="Arrastra para cambiar de entrada o soltar en el vacío para desconectar">
	{#if selected}{@render punto()}{/if}
</EdgeReconnectAnchor>

{#if selected}
	<EdgeReconnectAnchor type="source" class="z-1000!" bind:reconnecting={moviendoOrigen} position={{ x: sourceX, y: sourceY }} size={16} data-testid="extremo-cable-salida" title="Arrastra para cambiar de salida o soltar en el vacío para desconectar">
		{@render punto()}
	</EdgeReconnectAnchor>

	{#if !moviendoOrigen && !moviendoDestino}
		<EdgeLabel x={medioX} y={medioY} class="nodrag nopan z-1000!">
			<button
				type="button"
				data-testid="quitar-cable"
				aria-label="Desconectar este cable"
				title="Desconectar"
				class="flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
				onclick={() => deleteElements({ edges: [{ id }] })}
			>
				<X class="size-3" />
			</button>
		</EdgeLabel>
	{/if}
{/if}
