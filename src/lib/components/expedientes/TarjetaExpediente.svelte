<script lang="ts">
	/**
	 * La tarjeta de un expediente en el listado (Figma, Sprint 5, HUN2, `.Folder_preview`): la carpeta amarilla arriba y abajo, su
	 * nombre y «N Archivos · X MB». Mide 210 px de ancho y es TODA un enlace a su detalle.
	 *
	 * Dos cosas se apartan del diseño porque chocan con cómo se llama y se organiza un expediente aquí: la tarjeta lleva el NOMBRE del
	 * expediente y no un folio (`EXP-2026-00011`), y agrega el TIPO del que es instancia como etiqueta en su propio renglón, con el
	 * mismo estilo de etiqueta que el diseño da a los documentos. El menú de tres puntos del diseño no está: todavía no hay nada que
	 * hacer desde él (no se renombra ni se borra un expediente).
	 */
	import CarpetaIlustracion from '$lib/components/icons/CarpetaIlustracion.svelte';
	import { etiquetaDeArchivos, formatearTamano, type Expediente } from '$lib/expedientes/expedientes';

	let { expediente }: { expediente: Expediente } = $props();

	// Un servidor anterior al peso no lo manda: sin dato se calla, en vez de decir «0 MB» de algo que sí tiene documentos.
	const resumen = $derived(
		expediente.tamanoBytes === undefined
			? etiquetaDeArchivos(expediente.totalDocumentos)
			: `${etiquetaDeArchivos(expediente.totalDocumentos)} · ${formatearTamano(expediente.tamanoBytes)}`
	);
</script>

<a
	href={`/expediente/${expediente.id}`}
	data-testid="tarjeta-expediente"
	class="block w-52.5 overflow-hidden rounded-xl border-2 border-border bg-card transition-colors outline-none hover:border-primary/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
>
	<div class="p-3">
		<div class="flex items-center justify-center rounded-md border border-border bg-background p-6">
			<CarpetaIlustracion />
		</div>
	</div>
	<div class="flex flex-col gap-1.5 px-3 pb-4">
		<p class="truncate text-xs font-medium text-foreground" data-testid="expediente-nombre" title={expediente.nombre}>{expediente.nombre}</p>
		<p class="text-xs font-medium text-muted-foreground" data-testid="expediente-resumen">{resumen}</p>
		{#if expediente.tipo?.nombre}
			<!-- Renglón PROPIO: junto a una fecha la etiqueta se cortaba en «Expediente …» y dos tipos que empiezan igual
			     («Expediente médico», «Expediente de un choque») se veían idénticos. -->
			<span
				class="max-w-full self-start truncate rounded-sm border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
				data-testid="expediente-tipo"
				title={expediente.tipo.nombre}
			>
				{expediente.tipo.nombre}
			</span>
		{/if}
	</div>
</a>
