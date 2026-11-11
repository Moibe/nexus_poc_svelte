<script lang="ts" module>
	import type { Ubicacion } from '$lib/documentos/ubicaciones';

	/** Cómo va la ubicación de los campos en UN documento. */
	export type EstadoUbicacion =
		| { fase: 'cargando' }
		| { fase: 'listo'; ubicaciones: Ubicacion[] }
		| { fase: 'error'; mensaje: string }
		| { fase: 'no-soportado' };
</script>

<script lang="ts">
	/**
	 * Un documento de ejemplo con los campos ELEGIDOS marcados encima (2026-11-11, Moibe: «cuando hacemos la creación de los campos de extracción
	 * con un documento, que a un lado mostremos el documento y marcados etiquetados los campos seleccionados»). Va a un lado de la lista de
	 * `GenerarCamposDesdeDocumento.svelte`: cada campo marcado en la lista es un recuadro con su nombre sobre el documento; al pasar el puntero por un
	 * renglón (o por un recuadro) ese campo se resalta y, si está en otra página, la vista salta a ella.
	 *
	 * Las ubicaciones las da Gemini (`/api/procesadores/ubicar-campos`): son una AYUDA para ver qué es cada campo, no lo que extraerá el procesador.
	 * Un PDF se pinta página por página con pdf.js (`abrirPdf`); una imagen, tal cual. El TIFF no se puede pintar en el navegador.
	 * Nada sale de la pestaña: los documentos se pintan desde la memoria.
	 */
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	import { abrirPdf, type PdfAbierto } from '$lib/documentos/paginasPdf';
	import { cajaEnPorcentaje, esPdf } from '$lib/documentos/ubicaciones';

	let {
		documentos,
		estados,
		visibles,
		resaltado = null,
		onResaltar
	}: {
		documentos: File[];
		/** Uno por documento, en el mismo orden. */
		estados: EstadoUbicacion[];
		/** Los nombres de los campos elegidos: solo esos se marcan. */
		visibles: string[];
		resaltado?: string | null;
		onResaltar?: (campo: string | null) => void;
	} = $props();

	let indice = $state(0);
	let pagina = $state(1);
	let numPaginas = $state(1);
	let urlPagina = $state<string | null>(null);
	let cargandoPagina = $state(false);
	let errorPagina = $state('');
	let pdf: PdfAbierto | null = null;

	const actual = $derived(documentos[Math.min(indice, documentos.length - 1)]);
	const estado = $derived(estados[Math.min(indice, documentos.length - 1)] ?? { fase: 'cargando' });
	const ubicaciones = $derived(estado.fase === 'listo' ? estado.ubicaciones : []);
	const marcables = $derived(ubicaciones.filter((u) => visibles.includes(u.campo)));
	const enEstaPagina = $derived(marcables.filter((u) => u.pagina === pagina));
	const sinUbicar = $derived(visibles.filter((n) => !ubicaciones.some((u) => u.campo === n)));

	// Abrir el documento elegido: una imagen se enseña tal cual; un PDF se abre con pdf.js y se pinta la página que toque.
	$effect(() => {
		const archivo = actual;
		if (!archivo) return;
		let vivo = true;
		let url: string | null = null;
		pagina = 1;
		numPaginas = 1;
		errorPagina = '';
		urlPagina = null;
		if (!esPdf(archivo)) {
			url = URL.createObjectURL(archivo);
			urlPagina = url;
		} else {
			cargandoPagina = true;
			void archivo
				.arrayBuffer()
				.then((bytes) => abrirPdf(bytes))
				.then((abierto) => {
					if (!vivo) return void abierto.cerrar();
					pdf = abierto;
					numPaginas = abierto.numPaginas;
					pintar(1);
				})
				.catch(() => {
					if (vivo) {
						errorPagina = 'No se pudo abrir este PDF para enseñarlo.';
						cargandoPagina = false;
					}
				});
		}
		return () => {
			vivo = false;
			if (url) URL.revokeObjectURL(url);
			if (pdf) void pdf.cerrar().catch(() => undefined);
			pdf = null;
		};
	});

	// La imagen de la página que se está enseñando de un PDF; se revoca al cambiar.
	let urlPdf: string | null = null;
	let turno = 0;
	function pintar(n: number) {
		if (!pdf) return;
		const mio = ++turno;
		cargandoPagina = true;
		pdf.renderizar(n)
			.then((blob) => {
				if (mio !== turno) return;
				if (urlPdf) URL.revokeObjectURL(urlPdf);
				urlPdf = URL.createObjectURL(blob);
				urlPagina = urlPdf;
				pagina = n;
			})
			.catch(() => {
				if (mio === turno) errorPagina = 'No se pudo pintar esta página.';
			})
			.finally(() => {
				if (mio === turno) cargandoPagina = false;
			});
	}
	$effect(() => () => {
		if (urlPdf) URL.revokeObjectURL(urlPdf);
	});

	// Al resaltar un campo (desde la lista) que está en otra página, se salta a esa página.
	$effect(() => {
		const u = resaltado ? marcables.find((x) => x.campo === resaltado) : undefined;
		if (u && u.pagina !== pagina && pdf && u.pagina <= numPaginas) pintar(u.pagina);
	});
</script>

<div class="flex min-h-0 flex-col gap-3" data-testid="documento-con-campos">
	{#if documentos.length > 1}
		<div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Documentos de ejemplo">
			{#each documentos as d, i (i)}
				<button
					type="button"
					role="tab"
					aria-selected={i === indice}
					data-testid="documento-con-campos-pestana"
					class={[
						'max-w-48 truncate rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
						i === indice ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
					]}
					onclick={() => (indice = i)}
				>
					{d.name}
				</button>
			{/each}
		</div>
	{/if}

	<div class="relative min-h-64 overflow-auto rounded-lg border border-border bg-muted/40 lg:max-h-[62vh]">
		{#if estado.fase === 'no-soportado'}
			<p class="p-6 text-center text-sm text-muted-foreground" data-testid="documento-con-campos-tiff">
				Este formato (TIFF) no se puede enseñar en el navegador. Los campos se proponen igual.
			</p>
		{:else if errorPagina}
			<p class="p-6 text-center text-sm text-muted-foreground">{errorPagina}</p>
		{:else if urlPagina}
			<div class="relative">
				<img src={urlPagina} alt="Página {pagina} de «{actual.name}»" class="block h-auto w-full select-none" draggable="false" data-testid="documento-con-campos-imagen" />
				{#each enEstaPagina as u (u.campo)}
					{@const c = cajaEnPorcentaje(u.caja)}
					{@const activo = resaltado === u.campo}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class={[
							'absolute rounded-[3px] border-2 transition-opacity',
							activo ? 'z-20 border-amber-500 bg-amber-400/25' : 'z-10 border-primary bg-primary/10',
							resaltado && !activo && 'opacity-35'
						]}
						style="top:{c.top}%;left:{c.left}%;width:{c.width}%;height:{c.height}%"
						title={u.valor ? `${u.campo}: ${u.valor}` : u.campo}
						data-testid="marca-campo"
						data-campo={u.campo}
						onpointerenter={() => onResaltar?.(u.campo)}
						onpointerleave={() => onResaltar?.(null)}
					>
						<span
							class={[
								'pointer-events-none absolute left-[-2px] rounded-sm px-1 py-px text-[10px] leading-tight font-medium whitespace-nowrap',
								c.top < 4 ? 'top-full mt-px' : 'bottom-full mb-px',
								activo ? 'bg-amber-500 text-black' : 'bg-primary text-primary-foreground'
							]}
						>
							{u.campo}
						</span>
					</div>
				{/each}
			</div>
		{/if}
		{#if cargandoPagina || (estado.fase === 'cargando' && urlPagina)}
			<div class="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
				<span class="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs text-foreground shadow-sm" data-testid="documento-con-campos-ubicando">
					<LoaderCircle class="size-3.5 animate-spin text-primary" />
					{cargandoPagina ? 'Abriendo…' : 'Marcando los campos en el documento…'}
				</span>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
		<p data-testid="documento-con-campos-resumen" aria-live="polite">
			{#if estado.fase === 'listo'}
				{marcables.length === 1 ? '1 campo marcado' : `${marcables.length} campos marcados`}{sinUbicar.length > 0
					? ` · ${sinUbicar.length === 1 ? '1 no se encontró' : `${sinUbicar.length} no se encontraron`} en este documento`
					: ''}. Las marcas son una guía, no la extracción.
			{:else if estado.fase === 'error'}
				{estado.mensaje} El documento se enseña sin marcas.
			{/if}
		</p>
		{#if numPaginas > 1}
			<div class="flex items-center gap-1" data-testid="documento-con-campos-paginas">
				<button type="button" class="rounded-md p-1 hover:bg-muted disabled:opacity-40" aria-label="Página anterior" disabled={pagina <= 1 || cargandoPagina} onclick={() => pintar(pagina - 1)}>
					<ChevronLeft class="size-4" />
				</button>
				<span>Página {pagina} de {numPaginas}</span>
				<button type="button" class="rounded-md p-1 hover:bg-muted disabled:opacity-40" aria-label="Página siguiente" disabled={pagina >= numPaginas || cargandoPagina} onclick={() => pintar(pagina + 1)}>
					<ChevronRight class="size-4" />
				</button>
			</div>
		{/if}
	</div>
</div>
