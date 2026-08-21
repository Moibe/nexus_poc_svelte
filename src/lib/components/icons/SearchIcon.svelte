<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	Exportado de Figma (header, nodo `icon . search`).

	El grupo lleva un espejeo horizontal porque en Figma el ícono se usa con
	`-scale-x-100`: tal cual viene exportado, el mango de la lupa apunta abajo a
	la IZQUIERDA. La transformación va horneada aquí (translate + scale negativo
	sobre el ancho del viewBox) en vez de como clase de Tailwind, para que el
	componente se vea bien sin depender de nada externo.
-->
<svg class={className} preserveAspectRatio="none" overflow="visible" style="display: block;" width="14.6667" height="14.6667" viewBox="0 0 14.6667 14.6667" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="elements" transform="translate(14.6667, 0) scale(-1, 1)">
<path id="Vector (Stroke)" fill-rule="evenodd" clip-rule="evenodd" d="M4.13807 10.5286C3.87772 10.2682 3.45561 10.2682 3.19526 10.5286L0.195262 13.5286C-0.0650873 13.7889 -0.0650873 14.2111 0.195262 14.4714C0.455612 14.7318 0.877722 14.7318 1.13807 14.4714L4.13807 11.4714C4.39842 11.2111 4.39842 10.7889 4.13807 10.5286Z" fill="#475569"/>
<path id="Vector (Stroke)_2" fill-rule="evenodd" clip-rule="evenodd" d="M14.6667 6.66667C14.6667 2.98477 11.6819 0 8 0C4.3181 0 1.33334 2.98477 1.33334 6.66667C1.33334 10.3486 4.3181 13.3333 8 13.3333C11.6819 13.3333 14.6667 10.3486 14.6667 6.66667ZM8 1.33333C10.9455 1.33333 13.3333 3.72115 13.3333 6.66667C13.3333 9.61218 10.9455 12 8 12C5.05448 12 2.66667 9.61218 2.66667 6.66667C2.66667 3.72115 5.05448 1.33333 8 1.33333Z" fill="#475569"/>
</g>
</svg>
