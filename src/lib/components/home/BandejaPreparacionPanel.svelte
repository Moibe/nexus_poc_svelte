<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import DocumentoRow from './DocumentoRow.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import { documentosEnBandeja, sincronizarEntradasApi } from '$lib/state/bandeja.svelte';

	// La píldora de acciones de esta bandeja ya no se monta aquí: flota al pie de
	// la ventana y la arma `BarrasAccionesFlotantes` (2026-10-01). Dentro de la
	// columna no cabía. `espacioParaBarra` es lo único que queda de ella aquí: el
	// hueco al final de la lista para que la píldora no tape el último renglón.
	let { espacioParaBarra = false }: { espacioParaBarra?: boolean } = $props();

	// Lo que los clientes mandan por la API aparece solo: se consulta al entrar,
	// cada 10 segundos, y en cuanto la pestaña vuelve a estar a la vista (así no
	// hay que esperar el siguiente ciclo después de cambiar de ventana). Con la
	// pestaña oculta no se consulta: nadie está mirando.
	const CADA_MS = 10_000;
	$effect(() => {
		const consultar = () => {
			if (document.visibilityState === 'visible') void sincronizarEntradasApi();
		};
		consultar();
		const intervalo = setInterval(consultar, CADA_MS);
		document.addEventListener('visibilitychange', consultar);
		return () => {
			clearInterval(intervalo);
			document.removeEventListener('visibilitychange', consultar);
		};
	});

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
		<!-- El hueco deja libre el carril de la píldora flotante: sin él tapa el
		     último renglón de una lista larga y no hay forma de llegar a él. -->
		<div class={['flex flex-col gap-2 overflow-y-auto', espacioParaBarra && 'pb-16']}>
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
