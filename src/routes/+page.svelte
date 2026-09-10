<script lang="ts">
	import CargaDocumentalPanel from '$lib/components/home/CargaDocumentalPanel.svelte';
	import BandejaPreparacionPanel from '$lib/components/home/BandejaPreparacionPanel.svelte';
	import PipelineDocumentalPanel from '$lib/components/home/PipelineDocumentalPanel.svelte';
	import DetalleDocumentoSheet from '$lib/components/home/DetalleDocumentoSheet.svelte';
	import RegistroOtSheet from '$lib/components/home/RegistroOtSheet.svelte';
	import { documentosEnPipeline } from '$lib/state/pipeline.svelte';

	// Los dos paneles laterales se controlan desde aquí y no dentro del panel
	// del Pipeline porque son hermanos de las tres columnas, no hijos de una:
	// montarlos dentro de la tarjeta los metería en un contenedor con
	// `overflow-y-auto`. Sus disparadores viven los dos en esa columna (la fila
	// y la barra de acciones) y les llegan por props.
	//
	// Se guarda el ID y no el documento: así, si la extracción termina con el
	// panel abierto, el $derived vuelve a leer el objeto vivo del estado y el
	// contenido se actualiza solo.
	//
	// UNO A LA VEZ, por construcción. Los dos son `Sheet` con `side="right"`:
	// mismo z-index y misma caja, así que dos abiertos se taparían. Abrir uno
	// cierra el otro aquí, en vez de confiar en que quien llame se acuerde.
	// (En la práctica el usuario tampoco puede abrir los dos desde la barra: con
	// un panel abierto su overlay cubre la pantalla y la barra queda debajo.
	// Esto es el segundo candado, no el único.)
	let idPanel = $state<string | null>(null);
	let detalleAbierto = $state(false);
	let registroOtAbierto = $state(false);

	const documentoPanel = $derived(
		idPanel === null ? null : (documentosEnPipeline.find((d) => d.id === idPanel) ?? null)
	);

	function abrirDetalle(id: string) {
		idPanel = id;
		registroOtAbierto = false;
		detalleAbierto = true;
	}

	function abrirRegistroOt(id: string) {
		idPanel = id;
		detalleAbierto = false;
		registroOtAbierto = true;
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
	<div class="min-h-175">
		<PipelineDocumentalPanel alAbrirDetalle={abrirDetalle} alAbrirRegistroOt={abrirRegistroOt} />
	</div>
</div>

<DetalleDocumentoSheet bind:open={detalleAbierto} documento={documentoPanel} />

<RegistroOtSheet bind:open={registroOtAbierto} documento={documentoPanel} />
