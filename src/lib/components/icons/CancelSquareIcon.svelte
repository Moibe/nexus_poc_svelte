<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	Exportado de Figma (`cancel-square`, botón de cerrar del Modulo de
	configuración). El glifo ya trae el recuadro alrededor de la X — no hay que
	envolverlo en un botón con borde, eso duplicaría el marco.

	El trazo va en currentColor (en Figma es #475569) para que el contenedor
	pueda oscurecerlo en hover.
-->
<svg class={className} preserveAspectRatio="none" overflow="visible" style="display: block;" width="20.5" height="20.5" viewBox="0 0 20.5 20.5" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="elements">
<path id="Vector" d="M13.25 7.25L7.25 13.2496M13.25 13.25L7.25 7.25039" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path id="Rectangle 1772" d="M0.75 10.25C0.75 5.77166 0.75 3.53249 2.14124 2.14124C3.53249 0.75 5.77166 0.75 10.25 0.75C14.7283 0.75 16.9675 0.75 18.3588 2.14124C19.75 3.53249 19.75 5.77166 19.75 10.25C19.75 14.7283 19.75 16.9675 18.3588 18.3588C16.9675 19.75 14.7283 19.75 10.25 19.75C5.77166 19.75 3.53249 19.75 2.14124 18.3588C0.75 16.9675 0.75 14.7283 0.75 10.25Z" stroke="currentColor" stroke-width="1.5"/>
</g>
</svg>
