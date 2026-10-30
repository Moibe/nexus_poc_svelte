<script lang="ts">
	/**
	 * Expediente · un expediente abierto (2026-10-24, Figma Sprint 5 HUN2, detalle `5397:104132`): «Atrás», el nombre del expediente con
	 * el total de archivos, buscador y «Ordenar», y una tarjeta por documento. Cuelga de la pestaña «Expedientes» de `/expediente`.
	 *
	 * Un expediente vacío se dice como tal. El diseño no trae ese estado; se hizo con el mismo lenguaje del estado vacío del listado y
	 * SIN prometer una forma de agregar documentos que todavía no existe en pantalla.
	 *
	 * Lo que se aparta del diseño: el encabezado lleva el NOMBRE del expediente y no un folio, y agrega el tipo del que es instancia
	 * como etiqueta. Los documentos no traen páginas ni tipo documental (el servidor aún no los guarda); ver `TarjetaDocumento`.
	 */
	import Folder from '@lucide/svelte/icons/folder';
	import Undo2 from '@lucide/svelte/icons/undo-2';

	import OrdenarMenu from '$lib/components/expedientes/OrdenarMenu.svelte';
	import TarjetaDocumento from '$lib/components/expedientes/TarjetaDocumento.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { normalizar, OPCIONES_ORDEN_DOCUMENTOS, ordenarDocumentos, type OrdenDocumentos } from '$lib/expedientes/expedientes';

	let { data } = $props();

	const expediente = $derived(data.expediente);

	let busqueda = $state('');
	let orden = $state<OrdenDocumentos>('recientes');

	const visibles = $derived.by(() => {
		const q = normalizar(busqueda);
		const coinciden = q ? expediente.documentos.filter((d) => normalizar(d.nombreOriginal).includes(q)) : expediente.documentos;
		return ordenarDocumentos(coinciden, orden);
	});
</script>

<svelte:head><title>Biblioratum — {expediente.nombre}</title></svelte:head>

<div class="rounded-2xl border-2 border-border bg-card p-3">
	<div class="flex min-h-12.5 flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<a
				href="/expediente"
				data-testid="volver-a-expedientes"
				class="flex shrink-0 items-center gap-2 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				<Undo2 class="size-6 text-primary" />
				Atrás
			</a>
			<span class="h-4 w-px shrink-0 bg-border" aria-hidden="true"></span>
			<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
				<Folder class="size-4" />
			</span>
			<div class="min-w-0">
				<h2 class="truncate text-sm font-medium text-foreground" data-testid="expediente-detalle-nombre" title={expediente.nombre}>
					{expediente.nombre}
				</h2>
				<div class="flex items-center gap-1 text-xs text-muted-foreground">
					<span
						class="flex size-4.25 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-medium text-primary"
						data-testid="total-documentos">{expediente.documentos.length}</span
					>
					<span class="shrink-0">Total de archivos</span>
					{#if expediente.tipo?.nombre}
						<span class="ml-2 min-w-0 truncate rounded-sm border border-border bg-secondary px-2 py-0.5" data-testid="expediente-detalle-tipo" title={expediente.tipo.nombre}>
							{expediente.tipo.nombre}
						</span>
					{/if}
				</div>
			</div>
		</div>

		{#if expediente.documentos.length > 0}
			<div class="flex flex-wrap items-center gap-2">
				<div class="flex h-9 w-58.5 items-center gap-3 rounded-lg border border-border bg-background px-3">
					<SearchIcon />
					<input
						type="search"
						placeholder="Buscar documento"
						aria-label="Buscar documento"
						bind:value={busqueda}
						data-testid="buscar-documento"
						class="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
					/>
				</div>
				<span class="h-9 w-px bg-border" aria-hidden="true"></span>
				<OrdenarMenu valor={orden} opciones={OPCIONES_ORDEN_DOCUMENTOS} alCambiar={(valor) => (orden = valor)} testid="ordenar-documentos" />
			</div>
		{/if}
	</div>

	{#if expediente.documentos.length === 0}
		<div class="flex flex-col items-center gap-2 py-24 text-center" data-testid="expediente-sin-documentos">
			<h3 class="text-2xl font-semibold text-foreground">Este expediente todavía no tiene documentos</h3>
			<p class="max-w-xl text-base text-muted-foreground">Cuando se agreguen documentos a «{expediente.nombre}», aparecerán aquí.</p>
		</div>
	{:else if visibles.length === 0}
		<p class="py-16 text-center text-sm text-muted-foreground" data-testid="documentos-sin-resultados">
			No encontramos documentos con «{busqueda.trim()}». Revisa el nombre e intenta de nuevo.
		</p>
	{:else}
		<ul class="mt-3 flex flex-wrap gap-3" data-testid="lista-documentos">
			{#each visibles as documento (documento.id)}
				<li><TarjetaDocumento {documento} /></li>
			{/each}
		</ul>
	{/if}
</div>
