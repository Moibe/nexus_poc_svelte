<script lang="ts" module>
	import type { Component } from 'svelte';

	/** Una acción de la barra contextual de un panel. */
	export type AccionPanel = {
		/** Texto visible. Sirve además de llave del `{#each}`, así que tiene que
		 *  ser único dentro de una misma barra. */
		etiqueta: string;
		icono: Component;
		/** Sin `alHacerClic` el botón nace deshabilitado: es la forma de decir
		 *  "esto todavía no existe" sin un `onclick` vacío que engañe al leer. */
		alHacerClic?: () => void;
		deshabilitada?: boolean;
		/** Rojo. Para acciones que destruyen algo. */
		peligro?: boolean;
		testid?: string;
	};
</script>

<script lang="ts">
	/**
	 * Barra contextual de UN panel. Vive DENTRO de la tarjeta de su bandeja y
	 * solo actúa sobre la selección de esa bandeja.
	 *
	 * Antes había UNA sola barra flotante al pie de la ventana, compartida por
	 * la Bandeja de preparación y el Pipeline (`BarraAccionesSeleccion.svelte`,
	 * borrado el 2026-09-10). Se partió en tres a pedido explícito, y el motivo
	 * que dio el usuario es el correcto: las tres bandejas pueden tener
	 * selección AL MISMO TIEMPO, así que una barra única no podía decir sobre
	 * cuál de las tres iba a actuar. "Iniciar pipeline (1)" junto a "Detalle"
	 * eran, de hecho, órdenes a dos bandejas distintas en el mismo control.
	 *
	 * Cada barra muestra SOLO lo que aplica a su bandeja. Eso es lo que se
	 * ganó al partirla: en la Bandeja de preparación ya no aparece "Detalle"
	 * apagado para siempre (no hay resultado que ver todavía), y en el Pipeline
	 * ya no aparece "Iniciar pipeline" (esos documentos ya pasaron por ahí).
	 *
	 * Es más compacta que la barra vieja —texto de 12px, menos aire— porque
	 * ahora tiene que caber en el ancho de una columna y no en el de la
	 * ventana. Los colores son los mismos tokens de Figma que ya traía:
	 * fondo --Dark (#141B34), rojo --error/error-2 (#ef4444).
	 */
	let { acciones }: { acciones: AccionPanel[] } = $props();

	// `px-2` y no `px-2.5`: con la tipografía real (Plus Jakarta Sans, más ancha
	// que la del sistema) las cuatro acciones del Pipeline pedían 423px y la
	// columna da 433. Medido en el navegador, no calculado. El `overflow-x-auto`
	// del contenedor es la red por si algún día se agrega una quinta acción o la
	// ventana se hace muy angosta: preferible que ruede a que rompa la tarjeta.
	const claseBoton =
		'flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40';
</script>

<!-- `pointer-events-none` en el contenedor y `auto` en la píldora: el
     contenedor mide todo el ancho de la tarjeta para poder centrar, y sin esto
     se comería los clics de la fila que queda debajo. -->
<div class="pointer-events-none absolute inset-x-2 bottom-4 z-30 flex justify-center">
	<div
		class="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-[#141b34] px-1.5 py-1.5 shadow-lg"
	>
		{#each acciones as accion, indice (accion.etiqueta)}
			{@const Icono = accion.icono}
			{#if indice > 0}
				<span class="h-5 w-px shrink-0 bg-white/15" aria-hidden="true"></span>
			{/if}
			<button
				type="button"
				data-testid={accion.testid}
				disabled={accion.deshabilitada || !accion.alHacerClic}
				onclick={accion.alHacerClic}
				class="{claseBoton} {accion.peligro
					? 'text-red-500 enabled:hover:bg-red-500/10'
					: 'text-[#f9fafb] enabled:hover:bg-white/10'}"
			>
				<Icono class="size-4 shrink-0" />
				{accion.etiqueta}
			</button>
		{/each}
	</div>
</div>
