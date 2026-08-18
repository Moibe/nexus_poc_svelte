<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import DocumentoRow from './DocumentoRow.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import { documentosEnBandeja } from '$lib/state/bandeja.svelte';
</script>

<div class="flex h-full flex-col gap-2.5 rounded-2xl border-2 border-border bg-card p-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-base font-medium text-foreground">Bandeja de preparación documental</p>
			<p class="text-xs text-muted-foreground">Lista de archivos para procesamiento.</p>
		</div>
		<PanelIconCluster />
	</div>

	{#if documentosEnBandeja.length > 0}
		<div class="flex flex-col gap-2 overflow-y-auto">
			{#each documentosEnBandeja as documento (documento.id)}
				<DocumentoRow {documento} />
			{/each}
		</div>
	{:else}
		<div class="flex flex-1 items-center justify-center">
			<EmptyState
				icon={ClockBadgeIcon}
				title="La bandeja documental está vacía"
				description="Los documentos aparecerán aquí una vez que ingresen al flujo de procesamiento."
			/>
		</div>
	{/if}
</div>
