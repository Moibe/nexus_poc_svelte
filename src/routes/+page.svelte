<script lang="ts">
	import CargaDocumentalPanel from '$lib/components/home/CargaDocumentalPanel.svelte';
	import BandejaPreparacionPanel from '$lib/components/home/BandejaPreparacionPanel.svelte';
	import PipelineDocumentalPanel from '$lib/components/home/PipelineDocumentalPanel.svelte';
	import DetalleDocumentoSheet from '$lib/components/home/DetalleDocumentoSheet.svelte';
	import RegistroOtSheet from '$lib/components/home/RegistroOtSheet.svelte';
	import EstadoProcesamientoSheet from '$lib/components/home/EstadoProcesamientoSheet.svelte';
	import ExpedientesSheet from '$lib/components/home/ExpedientesSheet.svelte';
	import BarraAccionesFlotante from '$lib/components/home/BarraAccionesFlotante.svelte';
	import { documentosEnBandeja } from '$lib/state/bandeja.svelte';
	import { documentosEnPipeline } from '$lib/state/pipeline.svelte';

	// Los dos paneles laterales se controlan desde aquí, y desde el 2026-10-01
	// también el carril de píldoras de acciones, por el mismo motivo: son
	// hermanos de las tres columnas, no hijos de una. Montarlos dentro de una
	// tarjeta los metería en un contenedor con `overflow-y-auto`, y a la píldora
	// además la dejaría presa del ancho de la columna, que es justo lo que la
	// rompía. Quien los dispara es la píldora, y le llega por props.
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
	let estadoAbierto = $state(false);
	// Los expedientes NO entran en el grupo de los tres de arriba: no son de UN
	// documento —muestran todas las bandejas— así que no hay `idPanel` que
	// fijar. Se abren y cierran por su cuenta.
	let expedientesAbierto = $state(false);

	// Si hay alguna píldora flotando, las listas dejan un hueco al final para que
	// no tape su último renglón. Se calcula aquí porque la píldora de UNA bandeja
	// flota sobre las TRES columnas.
	const hayPildora = $derived(
		documentosEnBandeja.some((d) => d.seleccionado) || documentosEnPipeline.some((d) => d.seleccionado)
	);

	const documentoPanel = $derived(
		idPanel === null ? null : (documentosEnPipeline.find((d) => d.id === idPanel) ?? null)
	);

	// "Estado" se abre también desde la Bandeja de preparación, así que busca en
	// las dos. "Detalle" y "Registro de OT" siguen leyendo solo del Pipeline:
	// sin OCR no tienen qué mostrar.
	const documentoEstado = $derived(
		idPanel === null
			? null
			: (documentosEnPipeline.find((d) => d.id === idPanel) ??
					documentosEnBandeja.find((d) => d.id === idPanel) ??
					null)
	);

	/** Abre UNO y cierra los otros dos. Los tres son `Sheet` con `side="right"`:
	 *  mismo z-index y misma caja, así que dos abiertos se taparían. */
	function abrir(id: string, cual: 'detalle' | 'registroOt' | 'estado') {
		idPanel = id;
		detalleAbierto = cual === 'detalle';
		registroOtAbierto = cual === 'registroOt';
		estadoAbierto = cual === 'estado';
	}

	// La vista de Detalle y de Registro de OT (documento o JSON). Viven aquí para
	// que el expediente pueda abrirlas ya en una (ver `ExpedientesSheet`); fuera
	// de eso se recuerdan como siempre: quien se pasó a JSON sigue en JSON.
	let detalleEnJson = $state(false);
	let registroOtEnJson = $state(false);
	const abrirDetalle = (id: string) => abrir(id, 'detalle');
	const abrirRegistroOt = (id: string) => abrir(id, 'registroOt');
	const abrirEstado = (id: string) => abrir(id, 'estado');
	const abrirExpedientes = () => (expedientesAbierto = true);
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
	<div class="min-h-175"><BandejaPreparacionPanel espacioParaBarra={hayPildora} /></div>
	<div class="min-h-175"><PipelineDocumentalPanel espacioParaBarra={hayPildora} /></div>
</div>

<BarraAccionesFlotante
	alAbrirDetalle={abrirDetalle}
	alAbrirRegistroOt={abrirRegistroOt}
	alAbrirEstado={abrirEstado}
	alAbrirExpedientes={abrirExpedientes}
/>

<DetalleDocumentoSheet bind:open={detalleAbierto} bind:modoJson={detalleEnJson} documento={documentoPanel} />

<RegistroOtSheet bind:open={registroOtAbierto} bind:modoJson={registroOtEnJson} documento={documentoPanel} />

<EstadoProcesamientoSheet bind:open={estadoAbierto} documento={documentoEstado} />

<!-- Desde el ⋮ de una tarjeta. Se cierra el expediente antes de abrir la otra
     ventana: las dos son Sheet a la derecha, con la misma caja y el mismo
     z-index, así que encimadas se taparían. -->
<ExpedientesSheet
	bind:open={expedientesAbierto}
	alVerJson={(id) => ((expedientesAbierto = false), (detalleEnJson = true), abrirDetalle(id))}
	alVerCampos={(id) => ((expedientesAbierto = false), (registroOtEnJson = false), abrirRegistroOt(id))}
/>
