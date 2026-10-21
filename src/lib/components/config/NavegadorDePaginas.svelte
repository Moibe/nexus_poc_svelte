<script lang="ts">
	/**
	 * Para moverse entre las páginas de un documento: anterior, «3 de 20» (se puede teclear la página a la que se quiere ir) y
	 * siguiente. Lo usan las tres pantallas del etiquetado (2026-10-16): el cuadro donde se sube el ejemplo, el recortador y «ver
	 * el documento completo». No se muestra con una sola página: una INE o un pasaporte se ven exactamente como antes.
	 *
	 * `oscuro` es para la barra flotante negra de las dos primeras; `claro`, para el encabezado de la tercera.
	 */
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let {
		pagina,
		total,
		variante = 'oscuro',
		onCambio
	}: {
		/** La página actual, de 1 a `total`. */
		pagina: number;
		total: number;
		variante?: 'oscuro' | 'claro';
		/** Se llama con la página ya acotada a [1, total] y distinta de la actual. */
		onCambio: (n: number) => void;
	} = $props();

	const oscuro = $derived(variante === 'oscuro');

	function ir(n: number) {
		const destino = Math.min(total, Math.max(1, Math.round(n)));
		if (Number.isFinite(destino) && destino !== pagina) onCambio(destino);
	}

	/** El cuadro de texto se confirma con Enter o al salir de él. Lo que no es un número vuelve a la página actual. */
	function confirmar(e: Event) {
		const caja = e.currentTarget as HTMLInputElement;
		const n = Number.parseInt(caja.value, 10);
		if (Number.isNaN(n)) caja.value = String(pagina);
		else {
			ir(n);
			// Si se acotó (escribió 99 en un PDF de 20), la caja muestra la página real, no lo que se tecleó.
			caja.value = String(Math.min(total, Math.max(1, n)));
		}
	}

	const botonBase = $derived(
		oscuro
			? 'flex size-8 items-center justify-center rounded-full transition-colors hover:bg-card/10 disabled:pointer-events-none disabled:opacity-40'
			: 'flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40'
	);
</script>

<div
	data-testid="navegador-paginas"
	class="flex items-center gap-1 {oscuro ? 'text-white' : 'text-foreground'}"
>
	<button
		type="button"
		data-testid="pagina-anterior"
		aria-label="Página anterior"
		class={botonBase}
		disabled={pagina <= 1}
		onclick={() => ir(pagina - 1)}
	>
		<ChevronLeft class="size-4" />
	</button>
	<span class="flex items-center gap-1.5 text-sm whitespace-nowrap tabular-nums">
		<span class="text-xs {oscuro ? 'text-white/60' : 'text-muted-foreground'}">Página</span>
		<input
			data-testid="pagina-actual"
			aria-label="Número de página"
			inputmode="numeric"
			autocomplete="off"
			value={pagina}
			class="h-7 w-10 rounded-md border bg-transparent text-center text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary {oscuro
				? 'border-white/25'
				: 'border-border'}"
			onchange={confirmar}
			onkeydown={(e) => {
				if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
				// Las teclas de página del recortador no deben salir de la caja mientras se escribe.
				e.stopPropagation();
			}}
		/>
		<span class="whitespace-nowrap {oscuro ? 'text-white/60' : 'text-muted-foreground'}">
			de <span data-testid="total-paginas">{total}</span>
		</span>
	</span>
	<button
		type="button"
		data-testid="pagina-siguiente"
		aria-label="Página siguiente"
		class={botonBase}
		disabled={pagina >= total}
		onclick={() => ir(pagina + 1)}
	>
		<ChevronRight class="size-4" />
	</button>
</div>
