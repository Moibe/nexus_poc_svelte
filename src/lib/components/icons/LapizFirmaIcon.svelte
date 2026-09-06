<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	Réplica del ícono compartido en Figma para "Editar" en Calibración: un
	lápiz en diagonal que se resuelve en un garabato, SIN la línea base que
	trae el ícono "signature" de lucide (con ella se veía distinto al frame —
	comparado en carne propia con una captura zoomeada, no a ojo). Mismo
	trazo/tamaño que cualquier ícono de lucide (`viewBox 0 0 24 24`,
	`stroke-width 2`, puntas y uniones redondeadas) para que conviva sin
	desentonar junto a los demás íconos de la fila. Pedido explícito
	2026-09-05, sin librería nueva — es el mismo path de
	`@lucide/svelte/icons/signature`, solo que sin su segundo `<path>`.
-->
<svg
	class={className}
	xmlns="http://www.w3.org/2000/svg"
	width="24"
	height="24"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	<path
		d="m21 17-2.156-1.868A.5.5 0 0 0 18 15.5v.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1c0-2.545-3.991-3.97-8.5-4a1 1 0 0 0 0 5c4.153 0 4.745-11.295 5.708-13.5a2.5 2.5 0 1 1 3.31 3.284"
	/>
</svg>
