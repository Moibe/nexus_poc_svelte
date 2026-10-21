<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	El glifo de «La cuenta fue desactivada» (Figma 561:26180, la capa `alert-02`).

	ESTE NO LO HE VISTO. El frame del diseño no se pudo bajar (cuota de Figma
	agotada) y la captura que se compartió es solo la de cerrar sesión. Está
	dibujado en el MISMO lenguaje que `PowerCircleIcon` —relleno slate-300 y
	trazo fino de slate-600— por ser del mismo juego de íconos, pero la forma
	exacta (un triángulo con signo de admiración) es una suposición a partir del
	nombre de la capa. Cuando se tenga el frame, reemplaza este archivo.
-->
<svg
	class={className}
	width="80"
	height="80"
	viewBox="0 0 80 80"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<path
		d="M36.1 12.2C37.9 9.1 42.1 9.1 43.9 12.2L72.3 61.4C74.1 64.5 71.9 68.4 68.3 68.4H11.7C8.1 68.4 5.9 64.5 7.7 61.4L36.1 12.2Z"
		fill="#CBD5E1"
		stroke="#475569"
		stroke-width="1.2"
		stroke-linejoin="round"
	/>
	<path d="M40 30V48" stroke="#475569" stroke-width="1.2" stroke-linecap="round" />
	<circle cx="40" cy="56" r="1.4" fill="#475569" />
</svg>
