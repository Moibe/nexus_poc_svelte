<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	El glifo de «Sesión finalizada» (Figma 555:28192): un botón de apagado, es
	decir un círculo relleno de slate-300 con una línea vertical que lo cruza por
	arriba. En el diseño el trazo es finísimo (~1 px a 80 px de glifo) y de ahí que
	no use el `Power` de lucide, que es de trazo grueso y sin relleno.

	OJO con el nombre: la capa en Figma se llama `logout-04`, pero lo que dibuja es
	esto. Las instancias conservan el nombre aunque se les cambie el componente.

	REDIBUJADO A MANO desde una captura (la cuota de Figma estaba agotada), midiendo
	solo en horizontal porque la imagen venía estirada ~8 % en vertical: círculo de
	radio ~31 centrado un poco abajo (cy 44.4 en un lienzo de 80), línea de 5.7 a
	34.8. Relleno `#cbd5e1` sacado del píxel, no supuesto. Si aparece el export real,
	reemplaza este archivo completo.
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
	<circle cx="40" cy="44.4" r="30.9" fill="#CBD5E1" stroke="#475569" stroke-width="1.2" />
	<path d="M40 5.7V34.8" stroke="#475569" stroke-width="1.2" stroke-linecap="round" />
</svg>
