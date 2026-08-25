<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import DocumentoPipelineRow from './DocumentoPipelineRow.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import { documentosEnPipeline } from '$lib/state/pipeline.svelte';

	let { alAbrirDetalle }: { alAbrirDetalle: (id: string) => void } = $props();
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
		<div class="flex flex-col gap-2 overflow-y-auto">
			{#each documentosEnPipeline as documento (documento.id)}
				<DocumentoPipelineRow {documento} {alAbrirDetalle} />
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
