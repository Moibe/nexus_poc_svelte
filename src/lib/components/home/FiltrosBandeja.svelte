<script lang="ts">
	/**
	 * «Filtrar documentos» de la Bandeja de preparación (Figma: «Filtros avanzados · Filtrar documentos · Localizar rápidamente
	 * registros»): Estado y Canal con casillas, Fecha por rango, «Limpiar filtros» y «Aplicar filtros». Mismo molde que
	 * `FiltrosAvanzados` (el de los outputs).
	 *
	 * Al abrir, el borrador se llena con lo que está aplicado: quien vuelve a abrir espera encontrar lo que eligió. «Aplicar
	 * filtros» nace apagado hasta que haya algo elegido, como en la captura; «Limpiar filtros» quita el borrador Y lo aplicado.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';

	import { Button } from '$lib/components/ui/button/index.js';
	import DesplegableMultiple from '$lib/components/ui/DesplegableMultiple.svelte';
	import SelectorRangoFechas from '$lib/components/ui/SelectorRangoFechas.svelte';
	import {
		CANALES,
		ESTADOS,
		aplicarFiltros,
		cuantosEn,
		filtros,
		limpiarFiltros,
		type CanalFiltro,
		type EstadoFiltro
	} from '$lib/state/filtrosBandeja.svelte';

	let { abierto = false, onCerrar }: { abierto?: boolean; onCerrar: () => void } = $props();

	let estados = $state<EstadoFiltro[]>([]);
	let canales = $state<CanalFiltro[]>([]);
	let desde = $state<Date | null>(null);
	let hasta = $state<Date | null>(null);

	$effect(() => {
		if (!abierto) return;
		estados = [...filtros.estados];
		canales = [...filtros.canales];
		desde = filtros.desde;
		hasta = filtros.hasta;
	});

	const hayAlgo = $derived(estados.length > 0 || canales.length > 0 || (desde !== null && hasta !== null));
	// Un rango a medias no se aplica: el calendario solo lo guarda con los dos extremos.
	const conteos = $derived({ duplicado: cuantosEn('duplicado') });

	function limpiar() {
		estados = [];
		canales = [];
		desde = hasta = null;
		limpiarFiltros();
	}

	function aplicar() {
		aplicarFiltros({ estados, canales, desde, hasta });
		onCerrar();
	}
</script>

<DialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) onCerrar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-filtros-bandeja"
			class="fixed top-1/2 left-1/2 z-60 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-lg"
		>
			<p class="px-6 pt-5 text-sm text-muted-foreground">Filtros avanzados</p>

			<div class="flex items-center gap-3 px-6 pt-5">
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
					<SlidersHorizontal class="size-4.5" />
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg font-semibold text-foreground">Filtrar documentos</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-sm text-muted-foreground">
						Localizar rápidamente registros
					</DialogPrimitive.Description>
				</div>
			</div>

			<div class="mt-5 border-t border-border"></div>

			<div class="flex flex-col gap-5 px-6 py-5">
				<div class="flex flex-col gap-2">
					<label for="filtro-estado-bandeja" class="text-sm font-medium text-foreground">Estado</label>
					<DesplegableMultiple
						id="filtro-estado-bandeja"
						testid="filtro-estado"
						marcador="Selecciona un estado"
						opciones={ESTADOS}
						bind:valor={estados}
						{conteos}
					/>
				</div>
				<div class="flex flex-col gap-2">
					<label for="filtro-canal-bandeja" class="text-sm font-medium text-foreground">Canal</label>
					<DesplegableMultiple
						id="filtro-canal-bandeja"
						testid="filtro-canal"
						marcador="Selecciona un canal o conector"
						opciones={CANALES}
						bind:valor={canales}
					/>
				</div>
				<div class="flex flex-col gap-2">
					<label for="filtro-fecha-bandeja" class="text-sm font-medium text-foreground">Fecha</label>
					<SelectorRangoFechas id="filtro-fecha-bandeja" testid="filtro-fecha" bind:desde bind:hasta />
				</div>
			</div>

			<div class="border-t border-border"></div>

			<div class="flex items-center justify-end gap-4 px-6 py-4">
				<Button variant="link" class="h-auto p-0 text-destructive" data-testid="filtros-bandeja-limpiar" onclick={limpiar}>
					Limpiar filtros
				</Button>
				<Button data-testid="filtros-bandeja-aplicar" disabled={!hayAlgo} onclick={aplicar}>Aplicar filtros</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
