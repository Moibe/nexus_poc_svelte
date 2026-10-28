<script lang="ts">
	/**
	 * El aviso verde de éxito: el «Alert Success» del Figma. Es el mismo bloque con
	 * otro texto en las API Keys, los Webhooks, el alta de organizaciones y de
	 * usuarios y el reenvío de invitaciones, por eso es un componente. Quien lo
	 * monte lo pone dentro de un contenedor con `role="status" aria-live="polite"`
	 * SIEMPRE montado: una región que se monta junto con su texto no se anuncia.
	 *
	 * MEDIDAS DEL DISEÑO (2026-10-19), sacadas de una captura del «Alert Success»
	 * de «Usuario creado correctamente», no de adivinar:
	 *  - fondo PLANO `green-50` (#f0fdf4 en todos los puntos muestreados) y borde
	 *    `green-400`; antes era un degradado hacia `emerald-100` con borde `green-200`.
	 *    El borde se midió por sus píxeles: los del diseño son más OSCUROS que un
	 *    `green-300` (123,241,168), y mezclar con el fondo solo aclara, así que el
	 *    trazo real es de la familia 400/500, no más claro.
	 *  - padding de 16 a los lados y 12 arriba y abajo (antes 20 y 16)
	 *  - título de 16 px con interlineado de 20, 4 px de aire y cuerpo de 14 px con
	 *    22 de interlineado: con eso la tarjeta mide ~72 px con una línea de cuerpo y
	 *    ~95 con dos, que son justo las dos variantes que trae Figma (684×72 y
	 *    684×94), y el título queda a la altura que tiene en el diseño.
	 *    Antes eran 14 y 12 px, así que se veía más chica que el diseño.
	 *  - el sello es el de lucide a 20 px: llena menos su caja que el de Hugeicons del
	 *    diseño, y a 20 px el sello se ve del mismo tamaño que allá.
	 *
	 * ANCHO (2026-10-22, incidencia de QA en «Gestionar rol de usuario»): el diseño dibuja este aviso de **684 px** de ancho,
	 * no a todo lo ancho de la pantalla, que es lo que hacía mientras no tenía tope y vivía en una página de 1440. Ahora mide
	 * como mucho 684 px, alineado a la izquierda; dentro de un panel más angosto se adapta, porque el tope solo recorta lo que
	 * sobra. (El `AvisoRojo` NO lo lleva todavía aunque su variante del diseño también es de 684: nadie lo ha reportado.)
	 *
	 * `green-700` para el texto, no el verde más vivo que parece dibujar Figma: el 600
	 * sobre `green-50` da ~3.1:1 y AA pide 4.5:1.
	 *
	 * OJO: este NO es el único verde del proyecto. Siguen con el estilo chico y el
	 * degradado de antes los avisos que flotan (`AvisosFlotantes`) y el de «Nuevo tipo
	 * documental agregado» de la Biblioteca (en `ModuloConfiguracion`), que son bloques
	 * propios y no pasan por aquí.
	 */
	import BadgeCheck from '@lucide/svelte/icons/badge-check';

	let { testid, titulo, cuerpo }: { testid: string; titulo: string; cuerpo: string } = $props();
</script>

<div
	data-testid={testid}
	class="mb-6 flex max-w-171 items-start gap-2 rounded-lg border border-green-400 bg-green-50 px-4 py-3"
>
	<BadgeCheck class="size-5 shrink-0 fill-green-500 text-white" />
	<div class="min-w-0">
		<p class="text-base leading-5 font-semibold text-green-700">{titulo}</p>
		<p class="mt-1 max-w-2xl text-sm leading-[1.6] text-green-700">{cuerpo}</p>
	</div>
</div>
