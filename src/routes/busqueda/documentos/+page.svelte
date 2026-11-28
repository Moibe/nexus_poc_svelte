<script lang="ts">
	/**
	 * Buscar en documentos (épica 14, HU-097 y HU-098): encontrar en qué documento y en qué página aparece algo, por SIGNIFICADO, en el texto de los
	 * documentos ya procesados y en sus datos extraídos. No es un chat ni redacta respuestas: enseña el fragmento fuente.
	 *
	 * Cada resultado dice el tipo y el nombre del documento, el pasaje con las palabras de la consulta resaltadas, la página, el parecido (2 decimales),
	 * la fecha de procesamiento, el expediente si pertenece a uno y, cuando la página tiene datos extraídos, cada campo con su valor y su confianza. Abrir
	 * un resultado abre el documento en esa página.
	 *
	 * Los filtros (tipo documental y fecha de procesamiento) y el orden (relevancia o fecha) están siempre a la vista; cambiarlos vuelve a pedir la lista
	 * sin recargar la página. El servidor recuerda el vector de la consulta: cambiar un filtro, ordenar o «Cargar más resultados» no lo vuelve a pedir.
	 * Mientras se busca, el botón se apaga (una búsqueda a la vez) y la lista dice que está buscando.
	 */
	import { untrack } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import FileText from '@lucide/svelte/icons/file-text';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Search from '@lucide/svelte/icons/search';
	import SearchX from '@lucide/svelte/icons/search-x';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';

	import AvisoRojo from '$lib/components/config/AvisoRojo.svelte';
	import OrdenarMenu from '$lib/components/expedientes/OrdenarMenu.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import DesplegableMultiple from '$lib/components/ui/DesplegableMultiple.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import SelectorRangoFechas from '$lib/components/ui/SelectorRangoFechas.svelte';
	import {
		MAX_CONSULTA,
		POR_BLOQUE,
		confianzaComoTexto,
		cuerpoDeBusqueda,
		fechaCorta,
		filtrosVacios,
		hayFiltros,
		limpiarConsulta,
		parecido,
		partesDelPasaje,
		textoDeTotal,
		textoDelIndice,
		type Orden,
		type ResultadoDocumento,
		type RespuestaDocumentos
	} from '$lib/busqueda/documentos';

	let { data } = $props();

	const ORDENES_MENU: { valor: Orden; etiqueta: string }[] = [
		{ valor: 'relevancia', etiqueta: 'Relevancia' },
		{ valor: 'fecha', etiqueta: 'Fecha de procesamiento (recientes primero)' }
	];

	let consulta = $state('');
	/** La consulta de la lista que se ve: los filtros y el orden se aplican sobre ella, no sobre lo que se esté escribiendo. */
	let buscada = $state('');
	let filtros = $state(filtrosVacios());
	let orden = $state<Orden>('relevancia');
	let resultados = $state<ResultadoDocumento[]>([]);
	let total = $state(0);
	let hayMas = $state(false);
	let mensaje = $state<string | null>(null);
	let error = $state('');
	let buscando = $state(false);
	let cargandoMas = $state(false);
	let numero = 0;

	const conFiltros = $derived(hayFiltros(filtros));
	const puedeBuscar = $derived(Boolean(limpiarConsulta(consulta)) && !buscando);
	const clave = $derived(JSON.stringify({ t: filtros.tipos, d: filtros.desde?.getTime() ?? null, h: filtros.hasta?.getTime() ?? null, o: orden }));
	let claveBuscada = '';

	async function pedir(texto: string, inicio: number): Promise<RespuestaDocumentos> {
		const r = await fetch('/api/busqueda/documentos', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(cuerpoDeBusqueda(texto, filtros, orden, inicio, POR_BLOQUE))
		});
		const cuerpo = await r.json().catch(() => null);
		if (!r.ok) throw new Error(typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : 'No se pudo buscar. Intenta de nuevo.');
		return cuerpo as RespuestaDocumentos;
	}

	async function buscar(texto: string) {
		texto = limpiarConsulta(texto);
		if (!texto) return;
		const este = ++numero;
		buscando = true;
		error = '';
		buscada = texto;
		claveBuscada = clave;
		try {
			const r = await pedir(texto, 0);
			if (este !== numero) return;
			resultados = r.resultados;
			total = r.total;
			hayMas = r.hayMas;
			mensaje = r.mensaje;
		} catch (e) {
			if (este !== numero) return;
			resultados = [];
			total = 0;
			hayMas = false;
			mensaje = null;
			error = e instanceof Error ? e.message : 'No se pudo buscar.';
		} finally {
			if (este === numero) buscando = false;
		}
	}

	async function cargarMas() {
		if (!buscada || cargandoMas || buscando) return;
		const este = numero;
		cargandoMas = true;
		try {
			const r = await pedir(buscada, resultados.length);
			if (este !== numero) return;
			const vistos = new Set(resultados.map((x) => x.fragmento));
			resultados = [...resultados, ...r.resultados.filter((x) => !vistos.has(x.fragmento))];
			total = r.total;
			hayMas = r.hayMas;
		} catch (e) {
			if (este === numero) error = e instanceof Error ? e.message : 'No se pudieron cargar más resultados.';
		} finally {
			cargandoMas = false;
		}
	}

	// Cambiar un filtro o el orden con una lista a la vista la vuelve a pedir (sin recargar la página).
	$effect(() => {
		const actual = clave;
		untrack(() => {
			if (buscada && actual !== claveBuscada) void buscar(buscada);
		});
	});

	function limpiarFiltros() {
		filtros = filtrosVacios();
	}

	function alEnviar(e: SubmitEvent) {
		e.preventDefault();
		if (puedeBuscar) void buscar(consulta);
	}

	const enlaceAbrir = (r: ResultadoDocumento) => `/api/documentos/${encodeURIComponent(r.documento)}/abrir${r.pagina ? `?pagina=${r.pagina}` : ''}`;
</script>

<svelte:head><title>Biblioratum — Buscar en documentos</title></svelte:head>

<p class="text-xs text-muted-foreground">Uso / Buscar en documentos</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Buscar en documentos</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Encuentra en qué documento y en qué página aparece algo. La búsqueda entiende el sentido de lo que escribes, no solo las palabras exactas, y te enseña
		el fragmento donde está.
	</p>
	{#if data.estado}
		<p class="mt-2 text-xs text-muted-foreground" data-testid="estado-indice">{textoDelIndice(data.estado)}</p>
	{/if}
</div>

<form class="mt-6 max-w-3xl" onsubmit={alEnviar} role="search">
	<label for="consulta-documentos" class="sr-only">Qué buscas</label>
	<div class="flex items-center gap-2">
		<Input
			id="consulta-documentos"
			name="consulta"
			data-testid="consulta-documentos"
			bind:value={consulta}
			maxlength={MAX_CONSULTA}
			autocomplete="off"
			placeholder="Por ejemplo: quién es el administrador único de la sociedad"
			class="h-10 flex-1 bg-card"
		/>
		<Button type="submit" data-testid="buscar-documentos" disabled={!puedeBuscar} class="h-10 gap-2">
			{#if buscando}
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
				Buscando…
			{:else}
				<Search class="size-4" aria-hidden="true" />
				Buscar
			{/if}
		</Button>
	</div>
</form>

<div role="group" aria-label="Filtros de la búsqueda" class="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3" data-testid="filtros-documentos">
	<span class="flex items-center gap-1.5 pr-1 text-xs font-medium text-muted-foreground">
		<SlidersHorizontal class="size-3.5" aria-hidden="true" />
		Filtrar por
	</span>
	<div class="w-56">
		<DesplegableMultiple compacto id="filtro-tipo-documentos-campo" testid="filtro-tipo-documentos" marcador="Tipo documental" opciones={data.tipos ?? []} bind:valor={filtros.tipos} />
	</div>
	<div class="w-60">
		<SelectorRangoFechas
			compacto
			id="filtro-fecha-documentos-campo"
			testid="filtro-fecha-documentos"
			marcador="Fecha de procesamiento"
			bind:desde={filtros.desde}
			bind:hasta={filtros.hasta}
		/>
	</div>
	{#if conFiltros}
		<Button variant="link" class="h-auto p-0 text-xs text-destructive" data-testid="limpiar-filtros-documentos" onclick={limpiarFiltros}>Limpiar filtros</Button>
	{/if}
	<div class="ml-auto">
		<OrdenarMenu valor={orden} opciones={ORDENES_MENU} alCambiar={(v) => (orden = v)} testid="ordenar-documentos" />
	</div>
</div>

<section class="mt-4" aria-label="Resultados" aria-busy={buscando}>
	<!-- Siempre montado: una región `aria-live` que se monta junto con su texto no se anuncia. -->
	<p class="text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="total-documentos">
		{#if buscando}
			Buscando…
		{:else if total}
			{textoDeTotal(resultados.length, total)} · ordenados por {orden === 'fecha' ? 'fecha de procesamiento' : 'relevancia'}
		{/if}
	</p>

	{#if error}
		<div class="mt-3 max-w-3xl">
			<AvisoRojo testid="error-documentos" titulo="No se pudo buscar">{error}</AvisoRojo>
		</div>
	{/if}

	{#if buscando && !resultados.length}
		<div class="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground" data-testid="buscando-documentos">
			<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			Buscando en tus documentos…
		</div>
	{:else if buscada && !error && !total}
		<div class="mt-3 rounded-2xl border border-border bg-card p-6" data-testid="sin-resultados-documentos">
			<div class="flex items-start gap-3">
				<SearchX class="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<div>
					<p class="text-sm font-medium text-foreground">{mensaje ?? 'Sin resultados relevantes para tu consulta'}</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{#if conFiltros}
							Puede que los filtros estén dejando fuera lo que buscas.
						{:else}
							Prueba a decirlo con otras palabras o con más detalle: por ejemplo, el nombre de una persona, una fecha o el tipo de documento.
						{/if}
					</p>
					{#if conFiltros}
						<Button variant="outline" size="sm" class="mt-3" data-testid="limpiar-filtros-vacio" onclick={limpiarFiltros}>Limpiar filtros</Button>
					{/if}
				</div>
			</div>
		</div>
	{:else if resultados.length}
		<ol class="mt-3 space-y-3 transition-opacity {buscando ? 'opacity-50' : ''}" data-testid="resultados-documentos">
			{#each resultados as r (r.fragmento)}
				<li class="rounded-2xl border border-border bg-card p-5" data-testid="resultado-documento" data-documento={r.documento} data-pagina={r.pagina} data-fragmento={r.fragmento} data-clase={r.clase}>
					<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
						<div class="flex min-w-0 items-start gap-2">
							<FileText class="mt-0.5 size-4 shrink-0 text-primary dark:text-blue-300" aria-hidden="true" />
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-foreground" data-testid="resultado-archivo" title={r.archivo}>{r.archivo}</p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									<span data-testid="resultado-tipo">{r.tipoDocumental ?? 'Sin tipo'}</span>
									{#if r.pagina}· <span data-testid="resultado-pagina">Página {r.pagina}</span>{/if}
									{#if r.procesadoEn}· Procesado el {fechaCorta(r.procesadoEn)}{/if}
								</p>
							</div>
						</div>
						<span class="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground tabular-nums" data-testid="resultado-parecido" title="Qué tanto se parece al sentido de tu búsqueda (de 0 a 1)">
							Parecido {parecido(r.score)}
						</span>
					</div>

					{#if r.clase === 'campos'}
						<p class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground" data-testid="resultado-de-campos">
							<ListChecks class="size-3.5" aria-hidden="true" />
							Encontrado en los datos extraídos
						</p>
					{/if}
					<p class="mt-2 text-sm leading-relaxed whitespace-pre-line text-foreground" data-testid="resultado-pasaje">
						{#if !r.pasajeAlInicio}…{/if}{#each partesDelPasaje(r.pasaje, r.resaltado) as parte, i (i)}{#if parte.marcado}<mark
									class="rounded-sm bg-primary/15 px-0.5 text-foreground dark:bg-primary/30">{parte.texto}</mark
								>{:else}{parte.texto}{/if}{/each}{#if !r.pasajeAlFinal}…{/if}
					</p>

					{#if r.clase === 'texto' && r.campos.length}
						<div class="mt-3 rounded-lg bg-muted/60 px-3 py-2" data-testid="resultado-campos">
							<p class="text-xs font-medium text-muted-foreground">Datos extraídos de esta página</p>
							<dl class="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
								{#each r.campos as c (c.campo)}
									<div class="flex min-w-0 gap-1.5">
										<dt class="shrink-0 text-muted-foreground">{c.nombre}:</dt>
										<dd class="min-w-0 truncate text-foreground" title={c.valor}>
											{c.valor}
											{#if confianzaComoTexto(c.confianza)}<span class="text-muted-foreground"> · {confianzaComoTexto(c.confianza)}</span>{/if}
										</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/if}

					<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
						<a
							href={enlaceAbrir(r)}
							target="_blank"
							rel="noopener"
							data-testid="resultado-abrir"
							class="inline-flex items-center gap-1 rounded-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-blue-300"
						>
							{r.pagina ? `Abrir en la página ${r.pagina}` : 'Abrir el documento'}
							<ArrowRight class="size-3.5" aria-hidden="true" />
						</a>
						{#each r.expedientes as exp (exp.id)}
							<a
								href={`/expediente/${encodeURIComponent(exp.id)}`}
								data-testid="resultado-expediente"
								class="inline-flex min-w-0 items-center gap-1 rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								<FolderOpen class="size-3.5 shrink-0" aria-hidden="true" />
								<span class="truncate">{exp.nombre}</span>
							</a>
						{/each}
					</div>
				</li>
			{/each}
		</ol>
		{#if hayMas}
			<div class="mt-4 flex justify-center">
				<Button variant="outline" data-testid="cargar-mas-documentos" disabled={cargandoMas || buscando} onclick={cargarMas} class="gap-2">
					{#if cargandoMas}<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />{/if}
					Cargar más resultados
				</Button>
			</div>
		{/if}
	{/if}
</section>
