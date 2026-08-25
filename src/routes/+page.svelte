<script lang="ts">
	import CargaDocumentalPanel from '$lib/components/home/CargaDocumentalPanel.svelte';
	import BandejaPreparacionPanel from '$lib/components/home/BandejaPreparacionPanel.svelte';
	import PipelineDocumentalPanel from '$lib/components/home/PipelineDocumentalPanel.svelte';
	import BarraAccionesSeleccion from '$lib/components/home/BarraAccionesSeleccion.svelte';
	import DetalleDocumentoSheet from '$lib/components/home/DetalleDocumentoSheet.svelte';
	import { documentosEnPipeline } from '$lib/state/pipeline.svelte';

	// El detalle se controla desde aquí, no dentro del panel, porque hay dos
	// disparadores: la fila del pipeline y el botón "Detalle" de la barra
	// flotante. Tenerlo en el ancestro común evita un estado global solo para
	// coordinar un modal.
	//
	// Se guarda el ID y no el documento: así, si la extracción termina con el
	// modal abierto, el $derived vuelve a leer el objeto vivo del estado y el
	// contenido se actualiza solo.
	let idDetalle = $state<string | null>(null);
	let detalleAbierto = $state(false);

	const documentoDetalle = $derived(
		idDetalle === null ? null : (documentosEnPipeline.find((d) => d.id === idDetalle) ?? null)
	);

	function abrirDetalle(id: string) {
		idDetalle = id;
		detalleAbierto = true;
	}
</script>

<svelte:head><title>NexusDoc AI — Inicio</title></svelte:head>

<p class="text-xs text-muted-foreground">NexusDoc AI / Inicio</p>

<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Bienvenido al centro operativo documental</h1>
	<p class="mt-1.5 text-sm text-muted-foreground">
		Administra los conectores de integración utilizados para, sincronizar y procesar diferentes
		repositorios.
	</p>
</div>

<div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
	<div class="min-h-175"><CargaDocumentalPanel /></div>
	<div class="min-h-175"><BandejaPreparacionPanel /></div>
	<div class="min-h-175"><PipelineDocumentalPanel alAbrirDetalle={abrirDetalle} /></div>
</div>

<BarraAccionesSeleccion alAbrirDetalle={abrirDetalle} />

<DetalleDocumentoSheet bind:open={detalleAbierto} documento={documentoDetalle} />
