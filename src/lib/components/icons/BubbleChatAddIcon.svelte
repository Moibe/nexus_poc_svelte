<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	`bubble-chat-add` (Hugeicons), el ícono de «Agrega un motivo por…» en la ventana
	"Registro de motivo" (Figma 555:27543 y 561:26135): una burbuja de chat abierta
	arriba a la derecha, con un «+» en ese hueco y tres puntos adentro.

	REDIBUJADO A MANO, no exportado: la cuota de Figma se agotó (2026-10-19) justo
	antes de bajar el SVG, así que la silueta sale de medir el recorte del frame
	—burbuja de radio 10 con cola abajo a la izquierda, hueco de 12 a 3 en punto,
	plus de ±3.25 en la esquina, puntos en 8/12/16— y no del archivo original.
	Si aparece el export real, reemplaza este archivo completo por él.

	Trazo en `currentColor` y de 1.5, como el resto de los íconos de Hugeicons del
	proyecto: el color lo pone quien lo usa (`text-primary` en la ventana).
-->
<svg
	class={className}
	width="24"
	height="24"
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<path
		d="M12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22C17.5228 22 22 17.5228 22 12"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d="M8 12.8H8.00898M12 12.8H12.009M16 12.8H16.009"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d="M18.75 3V9.5M15.5 6.25H22"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
