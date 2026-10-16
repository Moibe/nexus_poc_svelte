<script lang="ts">
	/**
	 * «Ver el documento completo con sus recortes» de Calibración, ahora con páginas (2026-10-16).
	 *
	 * Antes era una sola imagen —la página 1— con todos los recortes dibujados encima, y servía para una INE. Con un PDF de varias
	 * páginas muestra UNA página a la vez, con un navegador para pasar de una a otra, y dibuja encima solo los recortes que están
	 * en ESA página (un recorte de la página 9 sobre la imagen de la página 1 marcaría un lugar donde no hay nada). Para no ir
	 * adivinando en un documento de 20 páginas, debajo del navegador van las páginas que SÍ tienen recortes, a un clic.
	 *
	 * Con una sola página se ve exactamente como antes: sin navegador y sin lista de páginas.
	 */
	import { untrack } from 'svelte';

	import NavegadorDePaginas from './NavegadorDePaginas.svelte';
	import { usarPaginaDeEjemplo } from '$lib/hooks/usarPaginaDeEjemplo.svelte';
	import {
		colorParaCampo,
		paginaDeRecorte,
		type DocumentoEjemploInstancia,
		type EjemploGuardado
	} from '$lib/state/configuracion.svelte';

	let {
		doc,
		campos,
		recortes
	}: {
		doc: DocumentoEjemploInstancia;
		/** Los campos del tipo, en su orden. Solo importan el id (para la lista) y el nombre (llave del recorte y su color). */
		campos: { id: string; nombre: string }[];
		/** Los recortes de ESTE documento, por nombre de campo. */
		recortes: Record<string, EjemploGuardado>;
	} = $props();

	let pagina = $state(1);
	const vista = usarPaginaDeEjemplo(() => ({ doc, pagina, contar: true }));
	const total = $derived(vista.numPaginas ?? 1);

	// Otro documento (el chip de arriba) empieza otra vez en su primera página.
	$effect(() => {
		void doc.id;
		untrack(() => {
			pagina = 1;
		});
	});

	/** Cuántos recortes tiene cada página, de la primera a la última: es la lista de «a dónde ir». */
	const paginasConRecortes = $derived.by(() => {
		const cuenta = new Map<number, number>();
		for (const campo of campos) {
			const r = recortes[campo.nombre]?.recorte;
			if (!r) continue;
			const p = paginaDeRecorte(r);
			cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
		}
		return [...cuenta.entries()].sort((a, b) => a[0] - b[0]);
	});
</script>

<div class="mt-3" data-testid="documento-completo">
	{#if total > 1}
		<div class="mb-2 flex flex-wrap items-center gap-x-5 gap-y-2">
			<NavegadorDePaginas variante="claro" {pagina} {total} onCambio={(n) => (pagina = n)} />
			{#if paginasConRecortes.length > 0}
				<div class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
					<span>Páginas con recortes:</span>
					{#each paginasConRecortes as [p, cuantos] (p)}
						<button
							type="button"
							data-testid="pagina-con-recortes"
							aria-pressed={p === pagina}
							aria-label={`Ir a la página ${p}, con ${cuantos} ${cuantos === 1 ? 'recorte' : 'recortes'}`}
							class="rounded-full border px-2 py-0.5 tabular-nums transition-colors {p === pagina
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border hover:bg-muted hover:text-foreground'}"
							onclick={() => (pagina = p)}
						>
							{p} <span class="opacity-70">({cuantos})</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Cada campo con recorte GUARDADO en ESTA página se dibuja encima, en las mismas coordenadas porcentuales con las que se
	     guardó (idéntico a como `RecortarEjemploCampo` dibuja el rectángulo mientras se edita). De solo lectura, con una
	     etiqueta del campo para saber cuál es cuál. -->
	<div class="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-4">
		{#if vista.estado === 'fallo'}
			<p data-testid="documento-completo-sin-pagina" class="text-sm text-muted-foreground">
				No se pudo cargar la página {pagina} de este documento. Los recortes siguen guardados; intenta de nuevo en unos
				minutos.
			</p>
		{:else if vista.url}
			<div class="relative inline-block border border-border bg-card shadow-sm">
				<img
					src={vista.url}
					alt={`Página ${pagina} de ${doc.nombre}, con los recortes marcados`}
					class="block max-w-full"
				/>
				{#each campos as campo (campo.id)}
					{@const r = recortes[campo.nombre]?.recorte}
					{#if r && paginaDeRecorte(r) === pagina}
						{@const color = colorParaCampo(campo.nombre)}
						<div
							data-testid="recorte-en-pagina"
							data-campo={campo.nombre}
							class="absolute border-2 {color.borde} {color.relleno}"
							style="left:{r.x}%; top:{r.y}%; width:{r.w}%; height:{r.h}%;"
						>
							<span
								class="absolute -top-5 left-0 truncate rounded {color.etiqueta} px-1 py-0.5 text-[10px] leading-none whitespace-nowrap text-white"
							>
								{campo.nombre}
							</span>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">Cargando la página {pagina}…</p>
		{/if}
	</div>
</div>
