<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import DocumentoPipelineRow from './DocumentoPipelineRow.svelte';
	import BarraAccionesPanel, { type AccionPanel } from './BarraAccionesPanel.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import Eye from '@lucide/svelte/icons/eye';
	import FileBadge from '@lucide/svelte/icons/file-badge';
	import Clock from '@lucide/svelte/icons/clock';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import { documentosEnPipeline } from '$lib/state/pipeline.svelte';

	let { alAbrirDetalle }: { alAbrirDetalle: (id: string) => void } = $props();

	const seleccionados = $derived(documentosEnPipeline.filter((d) => d.seleccionado));

	// El detalle es de UN documento: con varios seleccionados no se sabe cuál
	// abrir. Antes esta cuenta tenía que sumar las dos bandejas para saber si
	// "uno solo" era uno solo; ahora la pregunta se contesta dentro del panel.
	const unico = $derived(seleccionados.length === 1 ? seleccionados[0].id : null);

	// "Iniciar pipeline" NO va en esta barra: estos documentos ya pasaron por
	// ahí. Coincide con Figma (HU001|106 muestra solo Detalle / Eventos /
	// Descartar para un documento ya procesado).
	const acciones = $derived<AccionPanel[]>([
		{
			etiqueta: 'Detalle',
			icono: Eye,
			alHacerClic: unico ? () => alAbrirDetalle(unico) : undefined,
			testid: 'accion-detalle'
		},
		// Las tres de abajo nacen deshabilitadas y sin `onclick`, para que al leer
		// el código sea obvio que faltan por cablear:
		//   - Registro de OT → no existe la orden de trabajo como concepto en el
		//     back, ni tabla donde asentarla (agregado el 2026-09-08 con captura).
		//   - Eventos        → necesita `audit_event`, que vive en SQL Server y
		//     todavía no existe.
		//   - Descartar      → es destructivo y merece su propio modal de
		//     confirmación, no un confirm() del navegador.
		{ etiqueta: 'Registro de OT', icono: FileBadge, testid: 'accion-registro-ot' },
		{ etiqueta: 'Eventos', icono: Clock, testid: 'accion-eventos' },
		{ etiqueta: 'Descartar', icono: CircleX, peligro: true, testid: 'accion-descartar-pipeline' }
	]);
</script>

<div class="relative flex h-full flex-col gap-2.5 rounded-2xl border-2 border-border bg-card p-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-base font-medium text-foreground">Pipeline documental</p>
			<p class="text-xs text-muted-foreground">Progreso de los documentos procesados</p>
		</div>
		<PanelIconCluster />
	</div>

	{#if documentosEnPipeline.length > 0}
		<!-- El `pb-16` deja libre el carril de la barra: sin él, la píldora tapa
		     el último renglón de una lista larga y no hay forma de llegar a él. -->
		<div class={['flex flex-col gap-2 overflow-y-auto', seleccionados.length > 0 && 'pb-16']}>
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

	{#if seleccionados.length > 0}
		<BarraAccionesPanel {acciones} />
	{/if}
</div>
