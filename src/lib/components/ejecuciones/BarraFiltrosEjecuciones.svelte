<script lang="ts">
	/**
	 * Los filtros del historial de ejecuciones (2026-11-03, pedido de Moibe: «agrega dichos filtros»), en una barra bajo el título y con los mismos controles y la
	 * misma forma que los del listado de expedientes (`BarraFiltrosExpedientes`): cada cambio se aplica al instante, sin «Aplicar». Son cuatro:
	 *   · la fecha de ejecución, por rango (solo cuenta con los dos extremos);
	 *   · el proceso (la «regla»), entre los que aparecen en el historial;
	 *   · el estado: se cumplió, no se cumplió o quedó incompleta (faltaron datos);
	 *   · la persona que ejecutó, entre las que aparecen en el historial.
	 * Los tres desplegables dejan elegir varios (basta con cumplir uno); entre filtros, todos. Lo que se elige se manda al servidor, que es quien filtra
	 * (`$lib/ejecuciones/filtros`). A la derecha dice cuántas ejecuciones cumplen, de las que hay, y solo mientras algo filtra.
	 */
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';

	import { Button } from '$lib/components/ui/button/index.js';
	import DesplegableMultiple from '$lib/components/ui/DesplegableMultiple.svelte';
	import SelectorRangoFechas from '$lib/components/ui/SelectorRangoFechas.svelte';
	import { OPCIONES_ESTADO, PERSONA_SIN_NOMBRE, type FiltrosHistorial, type OpcionesDeFiltro } from '$lib/ejecuciones/filtros';

	let {
		filtros = $bindable(),
		opciones,
		filtrando,
		cuenta,
		alLimpiar
	}: {
		filtros: FiltrosHistorial;
		opciones: OpcionesDeFiltro;
		/** ¿Hay algo filtrando? Solo entonces sale «Limpiar filtros». */
		filtrando: boolean;
		/** Lo que se dice a la derecha («12 de 103 ejecuciones», o «Buscando…»); vacío mientras nada filtra. */
		cuenta: string;
		alLimpiar: () => void;
	} = $props();

	const procesos = $derived(opciones.procesos.map((p) => ({ valor: p.id, etiqueta: p.nombre })));
	const personas = $derived(opciones.personas.map((p) => ({ valor: p.id, etiqueta: p.nombre ?? PERSONA_SIN_NOMBRE })));
</script>

<div role="group" aria-label="Filtros del historial" class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3" data-testid="barra-filtros-ejecuciones">
	<span class="flex items-center gap-1.5 pr-1 text-xs font-medium text-muted-foreground">
		<SlidersHorizontal class="size-3.5" aria-hidden="true" />
		Filtrar por
	</span>
	<div class="w-56">
		<SelectorRangoFechas compacto id="filtro-fecha-ejecucion-campo" testid="filtro-fecha-ejecucion" marcador="Fecha de ejecución" bind:desde={filtros.desde} bind:hasta={filtros.hasta} />
	</div>
	<div class="w-48">
		<DesplegableMultiple compacto id="filtro-proceso-ejecucion-campo" testid="filtro-proceso-ejecucion" marcador="Proceso" opciones={procesos} bind:valor={filtros.procesos} />
	</div>
	<div class="w-44">
		<DesplegableMultiple compacto id="filtro-estado-ejecucion-campo" testid="filtro-estado-ejecucion" marcador="Estado" opciones={OPCIONES_ESTADO} bind:valor={filtros.estados} />
	</div>
	<div class="w-48">
		<DesplegableMultiple compacto id="filtro-persona-ejecucion-campo" testid="filtro-persona-ejecucion" marcador="Persona" opciones={personas} bind:valor={filtros.personas} />
	</div>
	{#if filtrando}
		<Button variant="link" class="h-auto p-0 text-xs text-destructive" data-testid="limpiar-filtros-ejecuciones" onclick={alLimpiar}>Limpiar filtros</Button>
	{/if}
	<!-- Siempre montado, con el texto adentro solo si hay algo que decir: una región `aria-live` que se monta junto con su texto no se anuncia. -->
	<p class="ml-auto text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="resultados-ejecuciones">{cuenta}</p>
</div>
