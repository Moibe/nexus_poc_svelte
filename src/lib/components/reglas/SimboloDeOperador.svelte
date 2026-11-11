<script lang="ts">
	/**
	 * El cuadrito con el símbolo de un operador, en la paleta y en el encabezado del nodo. Casi todos son un carácter (`=`, `≥`, `Σ`…); el que tiene
	 * un ícono propio en el diseño lo dibuja con lucide (2026-11-10: el reloj de «Antigüedad contra hoy»).
	 */
	import Clock from '@lucide/svelte/icons/clock';
	import type { DefOperador } from '$lib/reglas/reglas';

	let { operador, class: clase = '' }: { operador: DefOperador; class?: string } = $props();
</script>

<span class="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary {clase}" aria-hidden="true" data-testid="simbolo-operador">
	{#if operador.clave === 'antiguedad'}
		<Clock class="size-3.5" strokeWidth={2.25} />
	{:else}
		{operador.simbolo}
	{/if}
</span>
