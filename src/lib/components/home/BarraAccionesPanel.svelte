<script lang="ts" module>
	import type { Component } from 'svelte';

	/** Una acción de la barra contextual. */
	export type AccionPanel = {
		/** Texto visible. Único dentro de SU grupo, no de toda la barra:
		 *  "Descartar" existe en dos bandejas a la vez y las dos se dibujan. */
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

	/** Lo que aporta UNA bandeja a la barra común. */
	export type GrupoAcciones = {
		/** El nombre de la bandeja. Se dibuja solo si hay más de un grupo. */
		bandeja: string;
		acciones: AccionPanel[];
	};
</script>

<script lang="ts">
	/**
	 * LA píldora de acciones. Una sola, con las acciones de las tres bandejas.
	 *
	 * ## Una barra, no una por bandeja (2026-10-01)
	 *
	 * Hasta hoy había una píldora por bandeja, apiladas en un carril. Se pidió
	 * juntarlas: *"que la barra de menú ya no sean barras independientes, para
	 * las 3 bandejas usarán la misma barra"*.
	 *
	 * Eso obligó a resolver lo que la separación evitaba: **las bandejas pueden
	 * tener selección al mismo tiempo**, así que una barra única tiene que decir
	 * sobre cuál actúa cada acción. Si no, "Iniciar pipeline (2)" y "Detalle"
	 * conviven sin que nada diga que hablan de selecciones distintas, y dos
	 * "Descartar" seguidos no se distinguen entre sí.
	 *
	 * La respuesta son los GRUPOS: la barra recibe un grupo por bandeja con
	 * acciones que mostrar, y cuando hay más de uno cada grupo se abre con el
	 * nombre de su bandeja. Con un solo grupo no se dibuja ningún nombre y se ve
	 * exactamente como el frame, que siempre dibuja una sola bandeja activa.
	 *
	 * La llave del `{#each}` lleva el nombre de la bandeja por delante. No es
	 * cosmético: "Descartar" aparece en dos grupos a la vez, y con la etiqueta
	 * sola Svelte vería dos llaves iguales y reventaría.
	 */
	let { grupos }: { grupos: GrupoAcciones[] } = $props();

	const conNombre = $derived(grupos.length > 1);

	const claseBoton =
		'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40';
</script>

<div
	class="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-0.5 overflow-x-auto rounded-full bg-[#141b34] px-1.5 py-1.5 shadow-lg"
	data-testid="barra-acciones"
>
	{#each grupos as grupo, iGrupo (grupo.bandeja)}
		{#if conNombre}
			{#if iGrupo > 0}
				<span class="h-5 w-px shrink-0 bg-white/15" aria-hidden="true"></span>
			{/if}
			<span
				class="shrink-0 pr-1 pl-2.5 text-[11px] whitespace-nowrap text-white/50"
				data-testid="grupo-bandeja"
			>
				{grupo.bandeja}
			</span>
		{/if}
		{#each grupo.acciones as accion, iAccion (grupo.bandeja + ':' + accion.etiqueta)}
			{@const Icono = accion.icono}
			{#if conNombre || iGrupo > 0 || iAccion > 0}
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
	{/each}
</div>
