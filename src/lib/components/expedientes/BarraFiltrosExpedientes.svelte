<script lang="ts">
	/**
	 * Los filtros del listado de expedientes (2026-10-25, pedido de Moibe), en una barra bajo el encabezado y NO en un modal con
	 * «Aplicar»: filtrar un listado es ir viendo qué queda, así que cada cambio se aplica al instante. Son tres, con los mismos
	 * controles de «Filtrar documentos» de la Bandeja (`DesplegableMultiple` y `SelectorRangoFechas`) en su variante compacta:
	 *   · el TIPO de expediente (varios a la vez), que es lo que más importa;
	 *   · con documentos / sin documentos (los dos juntos no filtran);
	 *   · la fecha de creación, por rango (solo cuenta con los dos extremos).
	 * El texto del buscador también es un filtro y vive en el encabezado, pero «Limpiar filtros» lo quita junto con los demás. A la
	 * derecha dice cuántos expedientes quedan de los que hay, y solo mientras algo filtra.
	 */
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';

	import { Button } from '$lib/components/ui/button/index.js';
	import DesplegableMultiple from '$lib/components/ui/DesplegableMultiple.svelte';
	import SelectorRangoFechas from '$lib/components/ui/SelectorRangoFechas.svelte';
	import { OPCIONES_FILTRO_DOCUMENTOS, type FiltrosExpedientes } from '$lib/expedientes/expedientes';

	let {
		filtros = $bindable(),
		tipos,
		filtrando,
		mostrados,
		total,
		alLimpiar
	}: {
		filtros: FiltrosExpedientes;
		/** Los tipos de expediente de la organización: lo que ofrece el filtro por tipo. */
		tipos: { id: string; nombre: string }[];
		/** ¿Hay algo filtrando (texto incluido)? Solo entonces salen «Limpiar filtros» y la cuenta. */
		filtrando: boolean;
		/** Cuántos expedientes quedan con los filtros puestos, de `total`. */
		mostrados: number;
		total: number;
		alLimpiar: () => void;
	} = $props();

	const opcionesTipos = $derived(tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre })));
</script>

<div role="group" aria-label="Filtros del listado" class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3" data-testid="barra-filtros-expedientes">
	<span class="flex items-center gap-1.5 pr-1 text-xs font-medium text-muted-foreground">
		<SlidersHorizontal class="size-3.5" aria-hidden="true" />
		Filtrar por
	</span>
	<div class="w-56">
		<DesplegableMultiple
			compacto
			id="filtro-tipo-expediente-campo"
			testid="filtro-tipo-expediente"
			marcador="Tipo de expediente"
			opciones={opcionesTipos}
			bind:valor={filtros.tipos}
		/>
	</div>
	<div class="w-44">
		<DesplegableMultiple
			compacto
			id="filtro-documentos-expediente-campo"
			testid="filtro-documentos-expediente"
			marcador="Documentos"
			opciones={OPCIONES_FILTRO_DOCUMENTOS}
			bind:valor={filtros.documentos}
		/>
	</div>
	<div class="w-56">
		<SelectorRangoFechas
			compacto
			id="filtro-fecha-expediente-campo"
			testid="filtro-fecha-expediente"
			marcador="Fecha de creación"
			bind:desde={filtros.desde}
			bind:hasta={filtros.hasta}
		/>
	</div>
	{#if filtrando}
		<Button variant="link" class="h-auto p-0 text-xs text-destructive" data-testid="limpiar-filtros-expedientes" onclick={alLimpiar}>
			Limpiar filtros
		</Button>
	{/if}
	<!-- Siempre montado, con el texto adentro solo si hay algo filtrando: una región `aria-live` que se monta junto con su texto no se anuncia. -->
	<p class="ml-auto text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="resultados-expedientes">
		{#if filtrando}
			Mostrando {mostrados} de {total}
		{/if}
	</p>
</div>
