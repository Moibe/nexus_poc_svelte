<script lang="ts">
	/**
	 * La PRECISIÓN de un tipo documental, medida con sus documentos de ejemplo etiquetados (2026-11-23, Moibe: «arranca con el punto 1, la
	 * medición»). Va arriba de «Ejemplo documental»: el porcentaje de la última medición, campo por campo cuántos acertó y, desplegable, cada
	 * diferencia («uno.png · CURP: esperaba …07, leyó …O7»). «Medir» vuelve a leer TODOS los documentos etiquetados con la definición actual del
	 * tipo (cuesta una lectura por página: lo dice antes). Es la precisión de verdad, contra lo que confirmó una persona; no la confianza que el
	 * modelo se pone a sí mismo.
	 */
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Gauge from '@lucide/svelte/icons/gauge';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	import { Button } from '$lib/components/ui/button/index.js';
	import type { EstadoEtiquetado } from '$lib/etiquetado/estado.svelte';
	import { costoDeMedir, diferencias, porcentaje, TEXTO_RESULTADO } from '$lib/etiquetado/etiquetado';
	import { fechaHoraDe } from '$lib/expedientes/datosExtraidos';

	let {
		estado,
		documentos
	}: {
		estado: EstadoEtiquetado;
		/** Los documentos de ejemplo del tipo (para saber cuántos están etiquetados y cuántas páginas cuesta medir). */
		documentos: { id: string; paginas?: number }[];
	} = $props();

	const etiquetados = $derived(documentos.filter((d) => estado.etiquetas[d.id]));
	const costo = $derived(costoDeMedir(etiquetados.map((d) => d.paginas ?? 1)));
	const ultima = $derived(estado.mediciones[0] ?? null);
	const anteriores = $derived(estado.mediciones.slice(1, 4));
	const lista = $derived(ultima ? diferencias(ultima) : []);
	const conProblemas = $derived((ultima?.detalle?.campos ?? []).filter((c) => c.total > 0));
	const fallidos = $derived((ultima?.detalle?.documentos ?? []).filter((d) => d.estado === 'error'));
	let verDiferencias = $state(false);

	/** El color de la barra de un campo: verde si acertó todo, ámbar si casi, rojo si falló seguido. */
	function tono(aciertos: number, total: number): string {
		const p = total ? aciertos / total : 0;
		return p >= 1 ? 'bg-green-600' : p >= 0.8 ? 'bg-amber-500' : 'bg-red-500';
	}
</script>

<section class="rounded-xl border border-border bg-background p-4" data-testid="medicion-tipo" aria-busy={estado.midiendo}>
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-0">
			<p class="text-sm font-semibold text-foreground">Precisión del tipo</p>
			{#if ultima}
				<p class="mt-1 flex flex-wrap items-baseline gap-x-2">
					<span class="text-2xl font-semibold text-foreground tabular-nums" data-testid="medicion-porcentaje">
						{porcentaje(ultima.aciertos, ultima.comparaciones)}
					</span>
					<span class="text-xs text-muted-foreground" data-testid="medicion-resumen">
						{ultima.aciertos} de {ultima.comparaciones} campos acertados · {ultima.documentosMedidos}
						{ultima.documentosMedidos === 1 ? 'documento' : 'documentos'} · {fechaHoraDe(ultima.terminadaEn)}
					</span>
				</p>
				{#if anteriores.length > 0}
					<p class="mt-0.5 text-xs text-muted-foreground" data-testid="medicion-anteriores">
						Antes: {anteriores.map((m) => `${porcentaje(m.aciertos, m.comparaciones)} (${fechaHoraDe(m.terminadaEn)})`).join(' · ')}
					</p>
				{/if}
			{:else}
				<p class="mt-1 max-w-xl text-xs text-muted-foreground">
					Etiqueta documentos de ejemplo y mide cuántos campos acierta Biblioratum con la definición actual del tipo. Es la precisión de verdad,
					contra lo que confirmó una persona, no la confianza que el modelo se pone a sí mismo.
				</p>
			{/if}
		</div>
		<div class="flex shrink-0 flex-col items-end gap-1">
			<Button size="sm" disabled={etiquetados.length === 0 || estado.midiendo} data-testid="medir-tipo" onclick={() => estado.medir()}>
				{#if estado.midiendo}
					<LoaderCircle class="size-4 animate-spin" />
					Midiendo…
				{:else}
					<Gauge class="size-4" />
					{etiquetados.length === 0 ? 'Medir' : `Medir con ${etiquetados.length} ${etiquetados.length === 1 ? 'documento' : 'documentos'}`}
				{/if}
			</Button>
			<span class="text-[11px] text-muted-foreground" data-testid="medir-costo">
				{etiquetados.length === 0 ? 'Etiqueta al menos un documento para medir.' : `Vuelve a leerlos: ${costo.paginas} ${costo.paginas === 1 ? 'página' : 'páginas'}, ${costo.texto}`}
			</span>
		</div>
	</div>

	{#if estado.errorMedir}
		<p class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert" data-testid="medir-error">
			{estado.errorMedir}
		</p>
	{/if}

	{#if ultima && fallidos.length > 0}
		<p class="mt-3 text-xs text-amber-800 dark:text-amber-300" data-testid="medicion-fallidos">
			{fallidos.length === 1 ? 'Un documento no se pudo leer' : `${fallidos.length} documentos no se pudieron leer`} y no cuentan:
			{fallidos.map((d) => `${d.nombre || d.ejemplo} (${d.mensaje ?? 'sin lectura'})`).join(', ')}.
		</p>
	{/if}

	{#if conProblemas.length > 0}
		<ul class="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2" data-testid="medicion-campos">
			{#each conProblemas as c (c.campo)}
				{@const fallas = c.total - c.aciertos}
				<li class="flex items-center gap-2 text-xs" data-testid="medicion-campo" data-campo={c.campo}>
					<span class="w-36 shrink-0 truncate text-foreground" title={c.etiqueta}>{c.etiqueta}</span>
					<span class="h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
						<span class="block h-full rounded-full {tono(c.aciertos, c.total)}" style="width:{(c.aciertos / c.total) * 100}%"></span>
					</span>
					<span class="w-14 shrink-0 text-right text-muted-foreground tabular-nums">{c.aciertos} de {c.total}</span>
					<span class="sr-only">{fallas === 0 ? 'sin fallas' : `${fallas} con diferencias`}</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if lista.length > 0}
		<button
			type="button"
			class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-blue-300"
			aria-expanded={verDiferencias}
			data-testid="ver-diferencias"
			onclick={() => (verDiferencias = !verDiferencias)}
		>
			{verDiferencias ? 'Ocultar' : 'Ver'} {lista.length === 1 ? 'la diferencia' : `las ${lista.length} diferencias`}
			{#if verDiferencias}<ChevronUp class="size-3.5" />{:else}<ChevronDown class="size-3.5" />{/if}
		</button>
		{#if verDiferencias}
			<ul class="mt-2 divide-y divide-border rounded-lg border border-border text-xs" data-testid="medicion-diferencias">
				{#each lista as d, i (i)}
					<li class="flex flex-wrap items-baseline gap-x-2 px-3 py-2" data-testid="medicion-diferencia">
						<span class="font-medium text-foreground">{d.etiqueta}</span>
						<span class="text-muted-foreground">· {d.documento}</span>
						<span class="w-full text-muted-foreground sm:w-auto sm:flex-1 sm:text-right">
							{TEXTO_RESULTADO[d.resultado]}:
							{#if d.resultado === 'sobro'}
								leyó <span class="font-mono text-foreground">«{d.leido}»</span> y no está en el documento
							{:else if d.resultado === 'falto'}
								esperaba <span class="font-mono text-foreground">«{d.esperado}»</span>
							{:else}
								esperaba <span class="font-mono text-foreground">«{d.esperado}»</span>, leyó <span class="font-mono text-foreground">«{d.leido}»</span>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>
