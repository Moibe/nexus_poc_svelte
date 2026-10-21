<script lang="ts">
	/**
	 * La paginación del Figma: «Registros 8 de 15» a la izquierda y, a la derecha, «Anterior · 1 2 ··· 10 · Siguiente» con la
	 * página actual en una caja. Es la misma de las listas de Usuarios y de la Bandeja de preparación.
	 *
	 * `total` son TODOS los registros (ya filtrados) y `porPagina` el tamaño de página; `pagina` empieza en 1 y se recorta sola
	 * si la lista se encoge (un filtro, un descarte) y la página que se veía ya no existe.
	 */
	let {
		total,
		porPagina,
		pagina = $bindable(1),
		testid = 'paginacion'
	}: { total: number; porPagina: number; pagina?: number; testid?: string } = $props();

	const paginas = $derived(Math.max(1, Math.ceil(total / porPagina)));
	const actual = $derived(Math.min(Math.max(1, pagina), paginas));
	const mostrados = $derived(Math.max(0, Math.min(porPagina, total - (actual - 1) * porPagina)));

	$effect(() => {
		if (pagina !== actual) pagina = actual;
	});

	/** Los números que se dibujan: todos si son pocos; si no, la primera, la última y las vecinas de la actual, con `…` en los
	 *  huecos. */
	const numeros = $derived.by<(number | '…')[]>(() => {
		if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
		const vistos = new Set([1, paginas, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= paginas));
		const ordenados = [...vistos].sort((a, b) => a - b);
		const salida: (number | '…')[] = [];
		ordenados.forEach((n, i) => {
			if (i > 0 && n - ordenados[i - 1] > 1) salida.push('…');
			salida.push(n);
		});
		return salida;
	});

	const claseBoton =
		'flex h-7 items-center justify-center rounded-md px-2 text-xs text-foreground transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40';
</script>

<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" data-testid={testid}>
	<span data-testid="{testid}-registros">Registros {mostrados} de {total}</span>
	<nav class="flex items-center gap-1" aria-label="Paginación">
		<button type="button" class={claseBoton} disabled={actual <= 1} onclick={() => (pagina = actual - 1)} data-testid="{testid}-anterior">
			Anterior
		</button>
		{#each numeros as n, i (typeof n === 'number' ? n : `p${i}`)}
			{#if n === '…'}
				<span class="px-1" aria-hidden="true">···</span>
			{:else}
				<button
					type="button"
					class="{claseBoton} min-w-7 {n === actual ? 'border border-border bg-card font-medium' : ''}"
					aria-current={n === actual ? 'page' : undefined}
					onclick={() => (pagina = n)}
					data-testid="{testid}-pagina-{n}"
				>
					{n}
				</button>
			{/if}
		{/each}
		<button type="button" class={claseBoton} disabled={actual >= paginas} onclick={() => (pagina = actual + 1)} data-testid="{testid}-siguiente">
			Siguiente
		</button>
	</nav>
</div>
