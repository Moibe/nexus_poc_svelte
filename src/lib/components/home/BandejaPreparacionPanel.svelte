<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import DocumentoRow from './DocumentoRow.svelte';
	import DocumentoDescartadoRow from './DocumentoDescartadoRow.svelte';
	import FiltrosBandeja from './FiltrosBandeja.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import Paginacion from '$lib/components/ui/Paginacion.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import {
		documentosDescartados,
		documentosEnBandeja,
		sincronizarDescartados,
		sincronizarEntradasApi
	} from '$lib/state/bandeja.svelte';
	import {
		POR_PAGINA,
		chipsDeFiltros,
		cuantosEn,
		cuantosFiltros,
		filasDe,
		filtros,
		limpiarFiltros,
		quitarFiltro,
		vista
	} from '$lib/state/filtrosBandeja.svelte';

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
			if (document.visibilityState !== 'visible') return;
			void sincronizarEntradasApi();
			// Lo descartado solo se trae cuando alguien lo está mirando (el filtro «Descartado»).
			if (filtros.estados.includes('descartado')) void sincronizarDescartados();
		};
		consultar();
		const intervalo = setInterval(consultar, CADA_MS);
		document.addEventListener('visibilitychange', consultar);
		return () => {
			clearInterval(intervalo);
			document.removeEventListener('visibilitychange', consultar);
		};
	});

	// Al poner el filtro «Descartado» se traen de una vez, sin esperar el siguiente ciclo.
	$effect(() => {
		if (filtros.estados.includes('descartado')) void sincronizarDescartados();
	});

	let filtrosAbiertos = $state(false);

	// Lo que cumple los filtros, y de eso la página que se ve. La página se recorta sola si la lista se encoge (un descarte, un
	// filtro) y la que se veía ya no existe.
	const filas = $derived(filasDe());
	const total = $derived(filas.length);
	const paginaActual = $derived(Math.min(Math.max(1, vista.pagina), Math.max(1, Math.ceil(total / POR_PAGINA))));
	const deLaPagina = $derived(filas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA));
	const activos = $derived(cuantosFiltros());
	const chips = $derived(chipsDeFiltros());
	/** La insignia roja del botón «Filtros» (Figma): cuántos DUPLICADOS hay, que es lo que pide atención. Se va cuando hay filtros
	 *  puestos, porque entonces los chips ya dicen qué se está viendo. */
	const duplicados = $derived(cuantosEn('duplicado'));
	/** «La bandeja está vacía» solo si de verdad no hay nada: ni activo ni descartado. Con filtros puestos y sin resultados se dice
	 *  otra cosa, con la salida a la mano. */
	const hayAlgo = $derived(documentosEnBandeja.length > 0 || (documentosDescartados.length > 0 && filtros.estados.includes('descartado')));
</script>

<div class="flex h-full flex-col gap-2.5 rounded-2xl border-2 border-border bg-card p-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-base font-medium text-foreground">Bandeja de preparación documental</p>
			<p class="text-xs text-muted-foreground">Lista de archivos para procesamiento.</p>
		</div>
		<PanelIconCluster />
	</div>

	{#if documentosEnBandeja.length > 0 || activos > 0}
		<!-- «Todos [n]» y el botón «Filtros» con la insignia roja de cuántos filtros hay puestos (Figma). -->
		<div class="flex items-center justify-between gap-3">
			<div class="flex min-w-0 flex-wrap items-center gap-1.5">
				{#if chips.length === 0}
					<span class="text-sm font-medium text-foreground">Todos</span>
				{/if}
				<!-- El total: visible junto a «Todos» y, con filtros puestos (donde mandan los chips), solo para lectores de pantalla. -->
				<span
					class={chips.length === 0 ? 'rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] leading-none text-primary' : 'sr-only'}
					data-testid="total-bandeja">{total}</span
				>
				{#each chips as chip (chip.clave)}
					<span
						class="flex items-center gap-1.5 rounded-lg border border-border bg-background py-1 pr-1.5 pl-2.5 text-xs text-foreground"
						data-testid="chip-filtro-{chip.clave}"
					>
						<span class="max-w-36 truncate">{chip.texto}</span>
						{#if chip.cuantos}
							<span class="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] leading-none text-primary">{chip.cuantos}</span>
						{/if}
						<button
							type="button"
							class="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
							aria-label={`Quitar el filtro ${chip.texto}`}
							data-testid="quitar-filtro-{chip.clave}"
							onclick={() => quitarFiltro(chip.clave)}
						>
							<CircleX class="size-3.5" />
						</button>
					</span>
				{/each}
			</div>
			<button
				type="button"
				data-testid="abrir-filtros-bandeja"
				class="relative flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs text-foreground transition-colors hover:bg-muted"
				onclick={() => (filtrosAbiertos = true)}
			>
				<SlidersHorizontal class="size-3.5" />
				Filtros
				{#if activos === 0 && duplicados > 0}
					<span
						class="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white"
						data-testid="insignia-duplicados"
					>
						{duplicados}
					</span>
				{/if}
			</button>
		</div>
	{/if}

	{#if hayAlgo && deLaPagina.length > 0}
		<!-- El hueco deja libre el carril de la píldora flotante: sin él tapa el
		     último renglón de una lista larga y no hay forma de llegar a él. -->
		<div class={['flex flex-col gap-2 overflow-y-auto', espacioParaBarra && 'pb-16']}>
			{#each deLaPagina as fila (fila.tipo + fila.doc.id)}
				{#if fila.tipo === 'activo'}
					<DocumentoRow documento={fila.doc} />
				{:else}
					<DocumentoDescartadoRow documento={fila.doc} />
				{/if}
			{/each}
		</div>
		{#if total > POR_PAGINA}
			<div class="mt-auto pt-2">
				<Paginacion {total} porPagina={POR_PAGINA} bind:pagina={vista.pagina} testid="paginacion-bandeja" />
			</div>
		{/if}
	{:else if activos > 0}
		<!-- «No encontramos resultados» (Figma HU001 | 89), con el botón que los restablece. -->
		<div class="flex flex-1 items-center justify-center" data-testid="sin-resultados-bandeja">
			<EmptyState
				icon={ClockBadgeIcon}
				title="No encontramos resultados"
				description="Ningún registro coincide con los filtros seleccionados. Restablece los filtros para visualizar más resultados."
			>
				<Button size="sm" data-testid="limpiar-desde-lista" onclick={limpiarFiltros}>Limpiar filtros</Button>
			</EmptyState>
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

<FiltrosBandeja abierto={filtrosAbiertos} onCerrar={() => (filtrosAbiertos = false)} />
