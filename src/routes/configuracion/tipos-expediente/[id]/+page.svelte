<script lang="ts">
	/**
	 * Configuración · los expedientes virtuales de UN tipo (2026-10-30, pedido de Moibe): lo que hay detrás de la cuenta de la columna
	 * «Expedientes virtuales» de la tabla de tipos. Son las INSTANCIAS del tipo: cada una es un grupito de documentos de algún expediente
	 * («la solicitud de crédito de Juan Pérez»), y esta pantalla las junta todas en un mosaico, vengan del expediente que vengan.
	 *
	 * Cada tarjeta lleva a la pantalla del virtual (`/expediente/<id>/virtual/<id>`). Aquí no se crea ni se borra nada: los virtuales se arman
	 * dentro de cada expediente y esta pantalla solo los enseña. Sin diseño en el Figma (el tipo de expediente virtual tampoco lo tiene): se
	 * tomó el lenguaje del listado de expedientes, con su tarjeta y su mosaico.
	 *
	 * La ve cualquier rol (como la tabla de tipos). A esta pantalla solo se llega picando una cuenta mayor que cero; si alguien entra por la
	 * dirección a un tipo sin virtuales, lo dice.
	 */
	import FolderOpen from '@lucide/svelte/icons/folder-open';

	import TarjetaExpedienteVirtual from '$lib/components/expedientes/TarjetaExpedienteVirtual.svelte';

	let { data } = $props();

	const virtuales = $derived(data.virtuales);
</script>

<svelte:head><title>Biblioratum — Expedientes virtuales de {data.tipo.nombre}</title></svelte:head>

<p class="text-xs text-muted-foreground">
	<a href="/configuracion" class="transition-colors hover:text-foreground">Configuración</a> /
	<a href="/configuracion/tipos-expediente" class="transition-colors hover:text-foreground" data-testid="volver-a-tipos-expediente"
		>Tipos de expediente virtual</a
	>
	/ {data.tipo.nombre}
</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground" data-testid="titulo-expedientes-del-tipo">Expedientes virtuales de «{data.tipo.nombre}»</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Los expedientes virtuales de este tipo que hay en tu organización, de todos sus expedientes. Pica uno para abrirlo.
	</p>
</div>

<div class="mt-6 rounded-2xl border-2 border-border bg-card p-3">
	<div class="flex min-h-12.5 items-center gap-3">
		<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
			<FolderOpen class="size-4" />
		</span>
		<div>
			<p class="text-sm font-medium text-foreground">Listado de expedientes virtuales</p>
			<p class="flex items-center gap-1 text-xs text-muted-foreground">
				<span
					class="flex size-4.25 min-w-4.25 items-center justify-center rounded-sm bg-primary/10 px-1 text-[10px] font-medium text-primary"
					data-testid="total-expedientes-virtuales-del-tipo">{virtuales.length}</span
				>
				{virtuales.length === 1 ? 'Expediente virtual en total' : 'Expedientes virtuales en total'}
			</p>
		</div>
	</div>

	{#if virtuales.length === 0}
		<p class="py-16 text-center text-sm text-muted-foreground" data-testid="sin-expedientes-virtuales-del-tipo">
			Este tipo todavía no tiene expedientes virtuales. Se arman dentro de cada <a href="/expediente" class="text-primary underline-offset-2 hover:underline">expediente</a>.
		</p>
	{:else}
		<ul class="mt-3 flex flex-wrap gap-3" data-testid="mosaico-expedientes-virtuales">
			{#each virtuales as virtual (virtual.id)}
				<li><TarjetaExpedienteVirtual {virtual} /></li>
			{/each}
		</ul>
	{/if}
</div>
