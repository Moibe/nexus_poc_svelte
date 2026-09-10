<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import DocumentoRow from './DocumentoRow.svelte';
	import BarraAccionesPanel, { type AccionPanel } from './BarraAccionesPanel.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import Play from '@lucide/svelte/icons/play';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import { documentosEnBandeja } from '$lib/state/bandeja.svelte';
	import { iniciarPipeline, sePuedeProcesar } from '$lib/state/pipeline.svelte';

	const seleccionados = $derived(documentosEnBandeja.filter((d) => d.seleccionado));

	// "Iniciar pipeline" solo aparece si hay algo seleccionado que de verdad se
	// pueda mandar. Un archivo protegido o corrupto es seleccionable pero no es
	// procesable, y ofrecer el botón para que luego no pase nada es peor que no
	// ofrecerlo.
	const procesables = $derived(seleccionados.filter(sePuedeProcesar));

	// "Detalle" NO va en esta barra, aunque la barra vieja lo traía: un
	// documento que sigue en la Bandeja todavía no tiene resultado de OCR que
	// mostrar, así que ahí estuvo siempre apagado. Ese es justo el tipo de ruido
	// que se quitó al darle a cada bandeja su propia barra.
	const acciones = $derived<AccionPanel[]>([
		...(procesables.length > 0
			? [
					{
						etiqueta: `Iniciar pipeline (${procesables.length})`,
						icono: Play,
						alHacerClic: iniciarPipeline,
						testid: 'accion-iniciar-pipeline'
					}
				]
			: []),
		// Sin comportamiento todavía: es destructivo y merece su propio modal de
		// confirmación, no un confirm() del navegador. Nace deshabilitado a
		// propósito, igual que en la barra anterior.
		{ etiqueta: 'Descartar', icono: CircleX, peligro: true, testid: 'accion-descartar-bandeja' }
	]);
</script>

<div class="relative flex h-full flex-col gap-2.5 rounded-2xl border-2 border-border bg-card p-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-base font-medium text-foreground">Bandeja de preparación documental</p>
			<p class="text-xs text-muted-foreground">Lista de archivos para procesamiento.</p>
		</div>
		<PanelIconCluster />
	</div>

	{#if documentosEnBandeja.length > 0}
		<!-- El `pb-16` deja libre el carril de la barra: sin él, la píldora tapa
		     el último renglón de una lista larga y no hay forma de llegar a él. -->
		<div class={['flex flex-col gap-2 overflow-y-auto', seleccionados.length > 0 && 'pb-16']}>
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

	{#if seleccionados.length > 0}
		<BarraAccionesPanel {acciones} />
	{/if}
</div>
