<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import DocumentoPipelineRow from './DocumentoPipelineRow.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import { documentosEnPipeline } from '$lib/state/pipeline.svelte';

	// La píldora de acciones de esta bandeja ya no se monta aquí: flota al pie de
	// la ventana y la arma `BarrasAccionesFlotantes` (2026-10-01). Dentro de la
	// columna no cabía. `espacioParaBarra` es lo único que queda de ella aquí: el
	// hueco al final de la lista para que la píldora no tape el último renglón.
	let { espacioParaBarra = false }: { espacioParaBarra?: boolean } = $props();
</script>

<div class="flex h-full flex-col gap-2.5 rounded-2xl border-2 border-border bg-card p-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-base font-medium text-foreground">Pipeline documental</p>
			<p class="text-xs text-muted-foreground">Progreso de los documentos procesados</p>
		</div>
		<PanelIconCluster />
	</div>

	{#if documentosEnPipeline.length > 0}
		<!-- El hueco deja libre el carril de la píldora flotante: sin él tapa el
		     último renglón de una lista larga y no hay forma de llegar a él. -->
		<div class={['flex flex-col gap-2 overflow-y-auto', espacioParaBarra && 'pb-16']}>
			{#each documentosEnPipeline as documento (documento.id)}
				<DocumentoPipelineRow {documento} />
			{/each}
		</div>
	{:else}
		<div class="flex flex-1 items-center justify-center">
			<EmptyState
				icon={ClockBadgeIcon}
				title="Monitoreo del pipeline documental"
				description="Los documentos aparecerán aquí una vez que sean enviados para su análisis"
			/>
		</div>
	{/if}
</div>
