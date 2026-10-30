<script lang="ts">
	/**
	 * Expediente · un expediente abierto (2026-10-24, Figma Sprint 5 HUN2, detalle `5397:104132`): «Atrás», el nombre del expediente con
	 * el total de archivos, buscador y «Ordenar», y una tarjeta por documento. Cuelga de la pestaña «Expedientes» de `/expediente`.
	 *
	 * Un expediente vacío se dice como tal. El diseño no trae ese estado; se hizo con el mismo lenguaje del estado vacío del listado y
	 * SIN prometer una forma de agregar documentos que todavía no existe en pantalla.
	 *
	 * Lo que se aparta del diseño: el encabezado lleva el NOMBRE del expediente y no un folio. Los documentos no traen páginas ni tipo
	 * documental (el servidor aún no los guarda); ver `TarjetaDocumento`.
	 *
	 * **Expedientes virtuales (2026-10-29, decisión de Moibe).** El expediente dejó de tener tipo: es el receptáculo. Debajo de sus
	 * documentos van sus expedientes virtuales, grupitos de esos documentos que son instancia de un tipo («la solicitud de crédito de
	 * Juan Pérez»), cada uno con su tipo y cuántos de los documentos del expediente tiene; se abren en `/expediente/[id]/virtual/[vid]`.
	 * Quien organiza crea uno con «Nuevo expediente virtual» (`ExpedienteVirtualModal`). No hay diseño para esto en el Figma: se hizo con
	 * el lenguaje de esta misma pantalla.
	 */
	import { invalidateAll } from '$app/navigation';
	import Folder from '@lucide/svelte/icons/folder';
	import FolderTree from '@lucide/svelte/icons/folder-tree';
	import Plus from '@lucide/svelte/icons/plus';
	import Undo2 from '@lucide/svelte/icons/undo-2';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import ExpedienteVirtualModal from '$lib/components/expedientes/ExpedienteVirtualModal.svelte';
	import OrdenarMenu from '$lib/components/expedientes/OrdenarMenu.svelte';
	import TarjetaDocumento from '$lib/components/expedientes/TarjetaDocumento.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		documentosDelVirtual,
		normalizar,
		OPCIONES_ORDEN_DOCUMENTOS,
		ordenarDocumentos,
		type OrdenDocumentos
	} from '$lib/expedientes/expedientes';

	let { data } = $props();

	const expediente = $derived(data.expediente);
	const virtuales = $derived(expediente.expedientesVirtuales ?? []);

	let busqueda = $state('');
	let orden = $state<OrdenDocumentos>('recientes');
	let altaVirtual = $state(false);
	let aviso = $state<{ testid: string; titulo: string; cuerpo: string } | null>(null);

	const visibles = $derived.by(() => {
		const q = normalizar(busqueda);
		const coinciden = q ? expediente.documentos.filter((d) => normalizar(d.nombreOriginal).includes(q)) : expediente.documentos;
		return ordenarDocumentos(coinciden, orden);
	});
</script>

<svelte:head><title>Biblioratum — {expediente.nombre}</title></svelte:head>

<div role="status" aria-live="polite">
	{#if aviso}
		<div class="mb-4"><AvisoVerde testid={aviso.testid} titulo={aviso.titulo} cuerpo={aviso.cuerpo} /></div>
	{/if}
</div>

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

<section class="mt-6 rounded-2xl border-2 border-border bg-card p-3" data-testid="seccion-expedientes-virtuales" aria-labelledby="titulo-virtuales">
	<div class="flex min-h-12.5 flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
				<FolderTree class="size-4" />
			</span>
			<div>
				<h3 id="titulo-virtuales" class="text-sm font-medium text-foreground">Expedientes virtuales</h3>
				<p class="flex items-center gap-1 text-xs text-muted-foreground">
					<span class="flex size-4.25 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-medium text-primary" data-testid="total-virtuales"
						>{virtuales.length}</span
					>
					Grupos de documentos de este expediente, cada uno de un tipo
				</p>
			</div>
		</div>
		{#if data.puedeOrganizar}
			<Button
				data-testid="nuevo-expediente-virtual"
				onclick={() => {
					aviso = null;
					altaVirtual = true;
				}}
			>
				<Plus class="size-4" />
				Nuevo expediente virtual
			</Button>
		{/if}
	</div>

	{#if virtuales.length === 0}
		<p class="px-2 py-8 text-center text-sm text-muted-foreground" data-testid="sin-expedientes-virtuales">
			Este expediente todavía no tiene expedientes virtuales. Un expediente virtual toma algunos de sus documentos —por ejemplo, los de una
			solicitud de crédito— para usarlos juntos en el motor de reglas.
		</p>
	{:else}
		<div class="mt-2 overflow-x-auto">
			<table class="w-full min-w-xl text-left text-sm" data-testid="tabla-expedientes-virtuales">
				<thead>
					<tr class="border-y border-border text-xs text-muted-foreground">
						<th class="py-2 pr-4 pl-2 font-normal">Expediente virtual</th>
						<th class="py-2 pr-4 font-normal">Tipo</th>
						<th class="py-2 pr-2 font-normal">Documentos</th>
					</tr>
				</thead>
				<tbody>
					{#each virtuales as v (v.id)}
						<tr class="relative border-b border-border transition-colors last:border-0 hover:bg-muted/50" data-testid="fila-expediente-virtual" data-virtual-id={v.id}>
							<td class="py-3 pr-4 pl-2">
								<a
									href={`/expediente/${expediente.id}/virtual/${v.id}`}
									class="block truncate font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
									data-testid="virtual-nombre"
									title={v.nombre}>{v.nombre}</a
								>
							</td>
							<td class="py-3 pr-4">
								<span
									class="inline-block max-w-full truncate rounded-sm border border-primary/20 bg-primary/10 px-2 py-0.5 align-middle text-xs font-medium text-primary"
									data-testid="virtual-tipo"
									title={v.tipo.nombre}>{v.tipo.nombre}</span
								>
							</td>
							<td class="py-3 pr-2 text-foreground tabular-nums" data-testid="virtual-documentos">
								{documentosDelVirtual(v.totalDocumentos, expediente.documentos.length)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<ExpedienteVirtualModal
	bind:open={altaVirtual}
	expediente={{ id: expediente.id, nombre: expediente.nombre }}
	documentos={expediente.documentos}
	tipos={data.tiposVirtuales}
	puedeCrearTipo={data.puedeAdministrar}
	alCrear={async (v) => {
		// El virtual YA está guardado: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		const n = v.totalDocumentos;
		aviso = {
			testid: 'expediente-virtual-creado-aviso',
			titulo: 'Expediente virtual creado',
			cuerpo: `«${v.nombre}» (${v.tipo.nombre}) quedó en «${expediente.nombre}» con ${n} ${n === 1 ? 'documento' : 'documentos'}.`
		};
		await invalidateAll();
	}}
/>
