<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import DocumentoPipelineRow from './DocumentoPipelineRow.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { goto } from '$app/navigation';
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
		<div class="flex items-center gap-2">
			<PanelIconCluster />
			<!-- El ⋮ del diseño (Figma Sprint 5, HUN1): lleva a «Archivos procesados», con los documentos procesados y los expedientes. -->
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							aria-label="Más opciones del pipeline documental"
							data-testid="menu-pipeline"
							class="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted data-[state=open]:bg-muted"
						>
							<MoreVerticalIcon />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-64 p-2">
					<DropdownMenu.Item data-testid="ver-archivos-procesados" class="h-10 gap-3 px-2 whitespace-nowrap" onSelect={() => goto('/archivos-procesados')}>
						<FolderOpen class="size-4 text-muted-foreground" />
						Ver archivos procesados
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
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
