<script lang="ts" module>
	import type { Component } from 'svelte';

	/** Una acción de la barra contextual de una bandeja. */
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
	 * La píldora de acciones de UNA bandeja. Solo dibuja: dónde se para la
	 * decide `BarrasAccionesFlotantes`, que es quien las junta en un carril.
	 *
	 * SIGUE HABIENDO UNA BARRA POR BANDEJA, y eso no cambió nunca: cada una
	 * muestra solo lo que aplica a su bandeja y actúa solo sobre su selección.
	 * Es lo que se decidió el 2026-09-10, y el motivo sigue vigente: las
	 * bandejas pueden tener selección AL MISMO TIEMPO, así que una barra única
	 * no podría decir sobre cuál de ellas va a actuar.
	 *
	 * Lo que cambió el 2026-10-01 es SOLO dónde se para: de anclada al pie de su
	 * tarjeta, a flotando al pie de la ventana, como en Figma. Dentro de la
	 * columna no cabía —433px de ancho para una píldora que pedía más— y aparecía
	 * una barra de scroll horizontal debajo de ella.
	 *
	 * `nombreBandeja` solo se dibuja cuando hay DOS píldoras a la vista: con una
	 * sola no hay nada que distinguir y el diseño no lo lleva.
	 */
	let {
		acciones,
		nombreBandeja
	}: {
		acciones: AccionPanel[];
		/** El nombre de su bandeja, si hay que distinguirla de otra píldora. */
		nombreBandeja?: string;
	} = $props();

	const claseBoton =
		'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40';
</script>

<div
	class="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-0.5 overflow-x-auto rounded-full bg-[#141b34] px-1.5 py-1.5 shadow-lg"
	data-testid="barra-acciones"
	data-bandeja={nombreBandeja}
>
	{#if nombreBandeja}
		<span class="shrink-0 pr-1 pl-2.5 text-[11px] whitespace-nowrap text-white/50">
			{nombreBandeja}
		</span>
	{/if}
	{#each acciones as accion, indice (accion.etiqueta)}
		{@const Icono = accion.icono}
		{#if indice > 0 || nombreBandeja}
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
