<script lang="ts">
	/**
	 * El aviso rojo: el «Alert error» del Figma, hermano de `AvisoVerde` para lo que
	 * salió mal. Lo usan el alta de usuarios y de organizaciones, el reenvío de
	 * invitaciones, los correos que no salieron y las entregas fallidas de webhooks.
	 *
	 * MEDIDAS DEL DISEÑO (2026-10-19), sacadas de una captura del «Alert error» de
	 * «No fue posible crear el usuario», no de adivinar:
	 *  - fondo PLANO `red-50` (#fef2f2) y borde rojo VIVO de 1 px, de la familia
	 *    `red-500`: los píxeles del trazo salen más oscuros que un `red-300`, que es lo
	 *    que había antes (y mezclar con el fondo solo aclara, así que no puede ser más
	 *    claro). Antes: `red-50/60` con borde `red-300`.
	 *  - título Y cuerpo de 14 px, el título en seminegritas. Ojo: NO es lo mismo que
	 *    el verde, donde el título es de 16 y el cuerpo de 14. Se decidió por el alto de
	 *    mayúscula de la «N» del título (10.3 px) frente a la «O» del cuerpo (11.6), y
	 *    por el ancho: a 14 px el título ocupa 194 px y con la corrección de ~12 % que
	 *    la fuente de la app trae respecto de Figma da 219, contra los 214 del diseño;
	 *    a 16 px daría 250.
	 *  - el ícono es un círculo RELLENO de `red-500` con el «!» en blanco, no el contorno
	 *    de antes. A 20 px de lucide el disco rojo visible mide 15 px (el diseño: 14.6).
	 *  - padding de 16 a la derecha, 12 a la izquierda (el ícono de 20 trae aire propio
	 *    dentro de su caja), 10 arriba y 12 abajo, y 4 px entre el título y el cuerpo.
	 *    Con 22 px de interlineado la caja mide ~95 px con dos líneas de cuerpo, que es
	 *    la variante de 684×94 de Figma.
	 *
	 * `red-700` para el texto, no el rojo vivo (#ef4444) que dibuja Figma: ese da ~3.2:1
	 * sobre `red-50` y AA pide 4.5:1; `red-700` da ~6:1.
	 *
	 * A diferencia del verde, el cuerpo es un `children`: aquí van varias líneas
	 * (qué pasó, el motivo, cuándo y con qué código), no una frase.
	 *
	 * Lleva `role="alert"`: aparece por algo que acabas de hacer y que no salió,
	 * y el lector de pantalla tiene que decirlo en el momento.
	 */
	import type { Snippet } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	let { testid, titulo, children }: { testid: string; titulo: string; children: Snippet } = $props();
</script>

<div
	role="alert"
	data-testid={testid}
	class="flex items-start gap-2 rounded-lg border border-red-500 bg-red-50 pt-2.5 pr-4 pb-3 pl-3"
>
	<CircleAlert class="size-5 shrink-0 fill-red-500 text-white" />
	<div class="min-w-0 text-red-700">
		<p class="text-sm leading-[1.6] font-semibold">{titulo}</p>
		<div class="mt-1 max-w-2xl text-sm leading-[1.6]">{@render children()}</div>
	</div>
</div>
