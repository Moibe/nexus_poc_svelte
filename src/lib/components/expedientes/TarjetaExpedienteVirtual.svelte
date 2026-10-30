<script lang="ts">
	/**
	 * La tarjeta de un expediente virtual en el mosaico de los de un tipo (2026-10-30, pedido de Moibe): la misma tarjeta de 210 px de los
	 * expedientes (`TarjetaExpediente`) con su carpeta en azul y punteada (`CarpetaVirtualIlustracion`), el nombre del virtual, el expediente
	 * al que pertenece y «N de M documentos». TODA es un enlace a su pantalla (`/expediente/<id>/virtual/<id>`).
	 *
	 * El mosaico junta los virtuales de TODOS los expedientes de la organización, por eso la tarjeta dice de qué expediente es cada uno; el
	 * tipo no se repite aquí porque la página ya lo dice y es el mismo para todas.
	 */
	import CarpetaVirtualIlustracion from '$lib/components/icons/CarpetaVirtualIlustracion.svelte';
	import { documentosDelVirtual, type ExpedienteVirtualDeTipo } from '$lib/expedientes/expedientes';

	let { virtual }: { virtual: ExpedienteVirtualDeTipo } = $props();
</script>

<a
	href={`/expediente/${encodeURIComponent(virtual.expediente.id)}/virtual/${encodeURIComponent(virtual.id)}`}
	data-testid="tarjeta-expediente-virtual"
	data-virtual-id={virtual.id}
	class="block w-52.5 overflow-hidden rounded-xl border-2 border-border bg-card transition-colors outline-none hover:border-primary/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
>
	<div class="p-3">
		<div class="flex items-center justify-center rounded-md border border-border bg-background p-6">
			<CarpetaVirtualIlustracion />
		</div>
	</div>
	<div class="flex flex-col gap-1.5 px-3 pb-4">
		<p class="truncate text-xs font-medium text-foreground" data-testid="virtual-tarjeta-nombre" title={virtual.nombre}>{virtual.nombre}</p>
		<p class="truncate text-xs text-muted-foreground" data-testid="virtual-tarjeta-expediente" title={`Expediente: ${virtual.expediente.nombre}`}>
			Expediente: {virtual.expediente.nombre}
		</p>
		<p class="text-xs font-medium text-muted-foreground" data-testid="virtual-tarjeta-documentos">
			{documentosDelVirtual(virtual.totalDocumentos, virtual.expediente.totalDocumentos)}
		</p>
	</div>
</a>
