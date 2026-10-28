<script lang="ts">
	/**
	 * Archivos procesados · «Gestión de documentos y expedientes» (2026-10-26, pedido de Moibe; Figma Sprint 5, HUN1). Se llega desde el
	 * menú ⋮ de la bandeja «Pipeline documental». Dos pestañas, como el diseño:
	 *   · Documentos procesados: los documentos de la organización, con su nombre, su formato y peso, el canal por el que entraron, la
	 *     fecha de ingesta y el expediente (o expedientes) en que están. Se busca, se ordena y se pagina.
	 *   · Expedientes: el listado de expedientes (la misma tabla de `/expediente`), que se busca y se ordena por encabezado.
	 *
	 * Convive con `/expediente` sin mezclarse con él: aquí solo se LEE, y cada expediente enlaza a su detalle de siempre.
	 *
	 * Lo que se aparta del diseño, porque el servidor todavía no lo guarda: la columna «Tipo documental» y el «Estatus de procesamiento»
	 * del documento no salen (ningún documento guarda su tipo documental ni un estado), y «Canal» ocupa su lugar; tampoco está «Filtrar».
	 */
	import List from '@lucide/svelte/icons/list';

	import OrdenarMenu from '$lib/components/expedientes/OrdenarMenu.svelte';
	import TablaExpedientes from '$lib/components/expedientes/TablaExpedientes.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import Paginacion from '$lib/components/ui/Paginacion.svelte';
	import {
		fechaCorta,
		filtrarExpedientes,
		formatearTamano,
		formatoDe,
		normalizar,
		OPCIONES_ORDEN_DOCUMENTOS,
		ordenAlPicar,
		ordenarDocumentos,
		ordenarExpedientes,
		SIN_FILTROS,
		type ColumnaExpedientes,
		type OrdenDocumentos,
		type OrdenExpedientes
	} from '$lib/expedientes/expedientes';

	let { data } = $props();

	const PESTANAS = [
		{ id: 'documentos', etiqueta: 'Documentos procesados' },
		{ id: 'expedientes', etiqueta: 'Expedientes' }
	] as const;
	let pestana = $state<'documentos' | 'expedientes'>('documentos');

	// ---- documentos
	/** El ID es el lugar en que entró (001, 002…), no cambia al ordenar ni al buscar. */
	const conId = $derived(data.documentos.map((d, i) => ({ ...d, numero: String(i + 1).padStart(3, '0') })));
	let busquedaDocumentos = $state('');
	let ordenDocumentos = $state<OrdenDocumentos>('recientes');
	let pagina = $state(1);
	const POR_PAGINA = 10;
	const documentosVisibles = $derived.by(() => {
		const q = normalizar(busquedaDocumentos);
		const coinciden = q
			? conId.filter((d) => normalizar(`${d.nombreOriginal} ${d.expedientes.map((e) => e.nombre).join(' ')}`).includes(q))
			: conId;
		return ordenarDocumentos(coinciden, ordenDocumentos);
	});
	const paginaDeDocumentos = $derived(documentosVisibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA));

	// ---- expedientes
	let busquedaExpedientes = $state('');
	let ordenExpedientes = $state<OrdenExpedientes>('recientes');
	const expedientesVisibles = $derived(
		ordenarExpedientes(filtrarExpedientes(data.expedientes, { ...SIN_FILTROS, texto: busquedaExpedientes }), ordenExpedientes)
	);
	function picarColumna(columna: ColumnaExpedientes) {
		ordenExpedientes = ordenAlPicar(ordenExpedientes, columna);
	}
</script>

<svelte:head><title>NexusDoc AI — Archivos procesados</title></svelte:head>

<p class="text-xs text-muted-foreground">NexusDoc AI / Archivos procesados</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Gestión de documentos y expedientes</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Da seguimiento a los documentos procesados y consulta cómo se han organizado y asociado dentro de los expedientes.
	</p>
</div>

<div role="tablist" aria-label="Secciones" class="mt-6 flex gap-6 border-b border-border">
	{#each PESTANAS as p (p.id)}
		<button
			type="button"
			role="tab"
			id="pestana-{p.id}"
			aria-selected={pestana === p.id}
			aria-controls="panel-{p.id}"
			data-testid="pestana-{p.id}"
			class="-mb-px border-b-2 pb-2 text-sm transition-colors outline-none focus-visible:text-foreground {pestana === p.id
				? 'border-primary font-medium text-primary'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
			onclick={() => (pestana = p.id)}
		>
			{p.etiqueta}
		</button>
	{/each}
</div>

<div class="mt-4 rounded-2xl border-2 border-border bg-card p-3">
	<div class="flex min-h-12.5 flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
				<List class="size-4" />
			</span>
			<div>
				<p class="text-sm font-medium text-foreground">{pestana === 'documentos' ? 'Listado de documentos' : 'Listado de expedientes'}</p>
				<p class="flex items-center gap-1 text-xs text-muted-foreground">
					<span class="flex min-w-4.25 items-center justify-center rounded-sm bg-primary/10 px-1 text-[10px] font-medium text-primary" data-testid="total-archivos"
						>{pestana === 'documentos' ? data.documentos.length : data.expedientes.length}</span
					>
					{pestana === 'documentos' ? 'Total de documentos' : 'Total de expedientes'}
				</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<div class="flex h-9 w-58.5 items-center gap-3 rounded-lg border border-border bg-background px-3">
				<SearchIcon />
				{#if pestana === 'documentos'}
					<input
						type="search"
						placeholder="Buscar documento"
						aria-label="Buscar documento"
						bind:value={busquedaDocumentos}
						oninput={() => (pagina = 1)}
						data-testid="buscar-archivo"
						class="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
					/>
				{:else}
					<input
						type="search"
						placeholder="Buscar expediente"
						aria-label="Buscar expediente"
						bind:value={busquedaExpedientes}
						data-testid="buscar-expediente-archivos"
						class="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
					/>
				{/if}
			</div>
			{#if pestana === 'documentos'}
				<OrdenarMenu valor={ordenDocumentos} opciones={OPCIONES_ORDEN_DOCUMENTOS} alCambiar={(v) => (ordenDocumentos = v)} testid="ordenar-archivos" />
			{/if}
		</div>
	</div>

	{#if pestana === 'documentos'}
		<div role="tabpanel" id="panel-documentos" aria-labelledby="pestana-documentos">
			{#if data.documentos.length === 0}
				<p class="py-16 text-center text-sm text-muted-foreground" data-testid="archivos-vacio">
					Todavía no hay documentos procesados. Aparecerán aquí cuando entren por la bandeja.
				</p>
			{:else if documentosVisibles.length === 0}
				<p class="py-16 text-center text-sm text-muted-foreground" data-testid="archivos-sin-resultados">
					No encontramos documentos con «{busquedaDocumentos.trim()}». Revisa el nombre o el expediente e intenta de nuevo.
				</p>
			{:else}
				<div class="mt-3 overflow-x-auto">
					<table class="w-full min-w-3xl text-left text-sm" data-testid="tabla-documentos">
						<thead>
							<tr class="border-y border-border text-xs text-muted-foreground">
								<th scope="col" class="w-16 py-2.5 pr-4 pl-2 font-normal">ID</th>
								<th scope="col" class="py-2.5 pr-4 font-normal">Nombre de archivo</th>
								<th scope="col" class="py-2.5 pr-4 font-normal">Canal</th>
								<th scope="col" class="py-2.5 pr-4 font-normal">Fecha de ingesta</th>
								<th scope="col" class="py-2.5 pr-2 font-normal">Expediente asociado</th>
							</tr>
						</thead>
						<tbody>
							{#each paginaDeDocumentos as d (d.id)}
								<tr class="border-b border-border last:border-0" data-testid="fila-documento">
									<td class="py-3 pr-4 pl-2 text-xs text-muted-foreground" data-testid="documento-id">{d.numero}</td>
									<td class="min-w-0 py-3 pr-4">
										<p class="max-w-md truncate font-medium text-foreground" title={d.nombreOriginal} data-testid="documento-nombre">{d.nombreOriginal}</p>
										<p class="text-xs text-muted-foreground">{formatoDe(d)} | {formatearTamano(d.tamanoBytes)}</p>
									</td>
									<td class="py-3 pr-4 text-xs text-muted-foreground" data-testid="documento-canal">{d.canal === 'API' ? 'API' : 'Carga manual'}</td>
									<td class="py-3 pr-4 text-xs text-muted-foreground" data-testid="documento-fecha">{fechaCorta(d.recibidoEn)}</td>
									<td class="py-3 pr-2" data-testid="documento-expediente">
										{#if d.expedientes.length === 0}
											<span class="text-xs text-muted-foreground">Sin expediente</span>
										{:else}
											<a
												href={`/expediente/${d.expedientes[0].id}`}
												class="text-primary underline-offset-2 hover:underline"
												data-testid="documento-expediente-enlace">{d.expedientes[0].nombre}</a
											>
											{#if d.expedientes.length > 1}
												<span class="ml-1 text-xs text-muted-foreground" title={d.expedientes.map((e) => e.nombre).join(', ')}>+{d.expedientes.length - 1}</span>
											{/if}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="mt-3 px-2 pb-1">
					<Paginacion total={documentosVisibles.length} porPagina={POR_PAGINA} bind:pagina testid="paginacion-archivos" />
				</div>
			{/if}
		</div>
	{:else}
		<div role="tabpanel" id="panel-expedientes" aria-labelledby="pestana-expedientes">
			{#if data.expedientes.length === 0}
				<p class="py-16 text-center text-sm text-muted-foreground" data-testid="expedientes-archivos-vacio">
					Aún no tienes expedientes registrados.
				</p>
			{:else if expedientesVisibles.length === 0}
				<p class="py-16 text-center text-sm text-muted-foreground" data-testid="expedientes-archivos-sin-resultados">
					No encontramos expedientes con «{busquedaExpedientes.trim()}». Revisa el nombre o el tipo e intenta de nuevo.
				</p>
			{:else}
				<TablaExpedientes expedientes={expedientesVisibles} orden={ordenExpedientes} alPicar={picarColumna} />
			{/if}
		</div>
	{/if}
</div>
