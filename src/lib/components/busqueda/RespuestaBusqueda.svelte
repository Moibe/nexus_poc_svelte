<script lang="ts">
	/**
	 * Búsqueda · una respuesta en tabla, con todo lo que la acompaña (NEX-607 a 611): cuántos renglones, «Tabla | Gráfica» (NEX-610) y «Exportar CSV»,
	 * la frase de cómo se entendió la pregunta (con NEX-611 dice además qué se tomó de la pregunta anterior), de dónde salió la consulta (NEX-609), la
	 * consulta plegada, la tabla ordenable con «Abrir» o la gráfica, «¿Te sirvió?» y, en la última pregunta de la conversación, hasta tres preguntas
	 * para seguir, que al picarlas se preguntan dentro de la misma conversación.
	 *
	 * Salió del +page.svelte de /busqueda con NEX-611: la página la usa para la última pregunta y para una anterior que se despliega. El orden de la
	 * tabla y la columna que se grafica son de cada respuesta (`orden`, `medida`); la vista (tabla o gráfica), de toda la página (`vista`).
	 */
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Table2 from '@lucide/svelte/icons/table-2';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';

	import GraficaRespuesta from '$lib/components/busqueda/GraficaRespuesta.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { descargarBlob } from '$lib/documentos/descargar';
	import {
		aCsv,
		enlaceDeFila,
		esColumnaNumerica,
		formatearCelda,
		hrefDeDocumento,
		indicesOcultos,
		nombreCsv,
		notaDeOrigen,
		ordenAlPicar,
		ordenarFilas,
		textoDeGracias,
		textoDeRenglones,
		type Orden,
		type Respuesta
	} from '$lib/busqueda/busqueda';
	import { planDeGrafica } from '$lib/busqueda/grafica';

	let {
		respuesta,
		pregunta,
		vista = $bindable('tabla'),
		orden = $bindable(null),
		medida = $bindable(null),
		valoracion,
		valorando = false,
		errorValoracion = '',
		onValorar,
		sugerencias = [],
		onSeguir,
		deshabilitado = false
	}: {
		respuesta: Respuesta;
		/** La pregunta tal como se hizo: nombra el CSV y la imagen, y va en el título de la tabla para quien usa lector de pantalla. */
		pregunta: string;
		vista?: 'tabla' | 'grafica';
		orden?: Orden;
		medida?: number | null;
		/** «¿Te sirvió?»: lo que contestó quien mira (sin contestar: undefined). */
		valoracion?: boolean;
		valorando?: boolean;
		errorValoracion?: string;
		onValorar?: (id: string, util: boolean) => void;
		/** NEX-611: las preguntas para seguir (solo en la última pregunta de la conversación). */
		sugerencias?: string[];
		onSeguir?: (texto: string) => void;
		/** Mientras se piensa otra pregunta: no se puede seguir. */
		deshabilitado?: boolean;
	} = $props();

	const r = $derived(respuesta);
	/** Qué graficar, o `null` si la respuesta no se presta (un número suelto, una lista de nombres o de documentos). */
	const plan = $derived(planDeGrafica(r.columnas, r.filas));
	const enGrafica = $derived(plan !== null && vista === 'grafica');
	const nota = $derived(notaDeOrigen(r.origen));
	const tabla = $derived.by(() => {
		const { columnas, filas } = r;
		const ocultas = indicesOcultos(columnas);
		return {
			columnas,
			visibles: columnas.map((_, i) => i).filter((i) => !ocultas.has(i)),
			numericas: columnas.map((_, i) => esColumnaNumerica(filas, i)),
			filas: ordenarFilas(filas, orden),
			conEnlace: filas.some((f) => enlaceDeFila(columnas, f) !== null)
		};
	});

	function exportar() {
		descargarBlob(new Blob([aCsv(tabla.columnas, tabla.filas)], { type: 'text/csv;charset=utf-8' }), nombreCsv(pregunta));
	}
</script>

<div class="mt-1 flex flex-wrap items-center justify-between gap-2">
	<p class="text-sm font-medium text-foreground" data-testid="renglones">{textoDeRenglones(r)}</p>
	{#if r.filas.length > 0}
		<div class="flex flex-wrap items-center gap-2">
			{#if plan}
				<!-- NEX-610: el lenguaje de «Ver como lista / mosaico» de los expedientes, pero con nombre: es la primera vez que aparece. -->
				<div
					role="group"
					aria-label="Ver la respuesta como"
					class="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5"
					data-testid="alternar-tabla-grafica"
				>
					<button
						type="button"
						aria-pressed={!enGrafica}
						data-testid="vista-tabla"
						class="flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 {!enGrafica
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
						onclick={() => (vista = 'tabla')}
					>
						<Table2 class="size-4" aria-hidden="true" />
						Tabla
					</button>
					<button
						type="button"
						aria-pressed={enGrafica}
						data-testid="vista-grafica"
						class="flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 {enGrafica
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
						onclick={() => (vista = 'grafica')}
					>
						{#if plan.forma === 'linea'}
							<ChartLine class="size-4" aria-hidden="true" />
						{:else}
							<ChartBar class="size-4" aria-hidden="true" />
						{/if}
						Gráfica
					</button>
				</div>
			{/if}
			<Button variant="outline" size="sm" class="gap-1.5" data-testid="exportar-csv" onclick={exportar}>
				<Download class="size-3.5" aria-hidden="true" />
				Exportar CSV
			</Button>
		</div>
	{/if}
</div>
{#if r.explicacion}
	<p class="mt-1 text-sm text-muted-foreground" data-testid="explicacion">{r.explicacion}</p>
{/if}
{#if nota}
	<p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="nota-origen" data-origen={r.origen}>
		{#if r.origen === 'ejemplo'}
			<BadgeCheck class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
		{:else}
			<Repeat class="size-3.5 shrink-0" aria-hidden="true" />
		{/if}
		{nota}
	</p>
{/if}
{#if r.consulta}
	<details class="mt-2 max-w-3xl text-sm" data-testid="consulta-usada">
		<summary class="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">Ver la consulta que se usó</summary>
		<pre
			class="mt-1.5 overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground select-all"
			data-testid="consulta-sql">{r.consulta}</pre>
		<p class="mt-1 text-xs text-muted-foreground">Selecciónala para copiarla.</p>
	</details>
{/if}
{#if r.filas.length > 0 && plan && enGrafica}
	<!-- Una gráfica por respuesta: con otra respuesta se arma de nuevo (y vuelve a la primera columna de números). -->
	{#key r}
		<GraficaRespuesta columnas={r.columnas} filas={r.filas} {plan} {pregunta} bind:elegida={medida} />
	{/key}
{:else if r.filas.length > 0}
	<div class="mt-3 overflow-x-auto rounded-2xl border-2 border-border bg-card">
		<table class="w-full text-left text-sm" data-testid="tabla-respuesta">
			<caption class="sr-only">Respuesta a «{pregunta}», ordenada por la columna marcada</caption>
			<thead>
				<tr class="border-b border-border text-xs text-muted-foreground">
					{#each tabla.visibles as i (i)}
						{@const esta = orden?.indice === i}
						<th
							scope="col"
							class="px-2 py-1 font-normal whitespace-nowrap {tabla.numericas[i] ? 'text-right' : ''}"
							aria-sort={esta ? (orden?.direccion === 'asc' ? 'ascending' : 'descending') : undefined}
						>
							<button
								type="button"
								title="Ordenar por {(tabla.columnas[i] || `columna ${i + 1}`).toLowerCase()}"
								data-testid="ordenar-columna-{i}"
								class="flex w-full items-center gap-1 rounded-md px-2 py-1 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 {tabla.numericas[i]
									? 'justify-end'
									: ''} {esta ? 'font-medium text-foreground' : ''}"
								onclick={() => (orden = ordenAlPicar(orden, i))}
							>
								{tabla.columnas[i] || `Columna ${i + 1}`}
								{#if !esta}
									<ChevronsUpDown class="size-3.5 shrink-0 opacity-40" aria-hidden="true" />
								{:else if orden?.direccion === 'asc'}
									<ArrowUp class="size-3.5 shrink-0" aria-hidden="true" />
								{:else}
									<ArrowDown class="size-3.5 shrink-0" aria-hidden="true" />
								{/if}
							</button>
						</th>
					{/each}
					{#if tabla.conEnlace}
						<th scope="col" class="w-24 px-4 py-2 font-normal whitespace-nowrap">Documento</th>
					{/if}
				</tr>
			</thead>
			<tbody data-testid="filas-respuesta">
				{#each tabla.filas as fila, f (f)}
					{@const enlace = enlaceDeFila(tabla.columnas, fila)}
					<tr class="border-b border-border last:border-0" data-testid="fila-respuesta">
						{#each tabla.visibles as i (i)}
							<td
								class="max-w-md px-4 py-2 align-top wrap-break-word text-foreground {tabla.numericas[i] ? 'text-right tabular-nums' : ''} {fila[i] === null ||
								fila[i] === undefined
									? 'text-muted-foreground'
									: ''}"
							>
								{formatearCelda(fila[i])}
							</td>
						{/each}
						{#if tabla.conEnlace}
							<td class="px-4 py-2 align-top whitespace-nowrap">
								{#if enlace}
									<a
										href={hrefDeDocumento(enlace)}
										target="_blank"
										rel="noopener"
										data-testid="abrir-documento"
										title={enlace.pagina ? `Abrir el documento en la página ${enlace.pagina}` : 'Abrir el documento'}
										class="inline-flex items-center gap-1 text-sm text-primary outline-none hover:underline focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50"
									>
										Abrir
										<ExternalLink class="size-3.5" aria-hidden="true" />
									</a>
								{/if}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
{#if r.preguntaId && onValorar}
	{@const id = r.preguntaId}
	<!-- NEX-609: «¿Te sirvió?». Lo útil le llega a quien administra la organización para aprobarlo como ejemplo (salvo lo que sigue de una pregunta anterior). -->
	<div class="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="te-sirvio">
		<span class="text-muted-foreground">¿Te sirvió?</span>
		<Button
			variant="outline"
			size="sm"
			class="gap-1.5 {valoracion === true ? 'border-primary bg-primary/10 text-primary' : ''}"
			aria-pressed={valoracion === true}
			disabled={valorando}
			data-testid="sirvio-si"
			onclick={() => onValorar(id, true)}
		>
			<ThumbsUp class="size-3.5" aria-hidden="true" />
			Sí
		</Button>
		<Button
			variant="outline"
			size="sm"
			class="gap-1.5 {valoracion === false ? 'border-foreground/40 bg-muted' : ''}"
			aria-pressed={valoracion === false}
			disabled={valorando}
			data-testid="sirvio-no"
			onclick={() => onValorar(id, false)}
		>
			<ThumbsDown class="size-3.5" aria-hidden="true" />
			No
		</Button>
		{#if valoracion !== undefined}
			<span class="text-xs text-muted-foreground" data-testid="gracias">{textoDeGracias(valoracion, r.usaAnteriores)}</span>
		{/if}
		{#if errorValoracion}
			<span class="text-xs text-red-700 dark:text-red-400" role="alert" data-testid="error-valoracion">{errorValoracion}</span>
		{/if}
	</div>
{/if}
{#if sugerencias.length > 0 && onSeguir}
	<!-- NEX-611: hasta tres preguntas para seguir sobre ESTA respuesta, que el modelo escribió sin ver los datos. -->
	<div class="mt-3 flex flex-wrap items-center gap-1.5" data-testid="seguir">
		<span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
			<CornerDownRight class="size-3.5" aria-hidden="true" />
			Para seguir:
		</span>
		{#each sugerencias as s (s)}
			<button
				type="button"
				data-testid="sugerencia-seguir"
				disabled={deshabilitado}
				onclick={() => onSeguir(s)}
				class="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-foreground transition-colors outline-none hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:border-primary/45 dark:bg-primary/15 dark:hover:bg-primary/25"
			>
				{s}
			</button>
		{/each}
	</div>
{/if}
