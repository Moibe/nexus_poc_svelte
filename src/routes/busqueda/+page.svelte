<script lang="ts">
	/**
	 * Búsqueda · preguntar en lenguaje natural y ver la respuesta en una tabla (NEX-607, 2026-11-23). Se llega desde el cuadro «Búsqueda» del Módulo de
	 * uso; la ven todos los roles que usan el producto, porque solo lee (como los expedientes): nexus_back decide, aquí no se filtra nada.
	 *
	 * Una caja para escribir la pregunta y, debajo, la respuesta como tabla con cuántos renglones son. Lo que pasa en medio (el modelo escribe la
	 * consulta, el servidor la revisa y la corre con la conexión de solo lectura que solo ve esta organización) es del back: la pantalla manda la
	 * pregunta al BFF (`/api/busqueda/preguntar`) y pinta lo que vuelve. Los datos de los documentos no salen del servidor hacia ningún modelo.
	 *
	 * Estados: sin preguntar (con las preguntas sugeridas), pensando, la tabla (o «no hay información»), «no se puede responder con los
	 * datos extraídos» (ámbar: no es un error), tardó demasiado y error. La pantalla no nombra al proveedor del modelo.
	 *
	 * NEX-608 (2026-11-23, «entender la respuesta y llevársela»):
	 *   · debajo de la cuenta de renglones, la frase de cómo se entendió la pregunta y, plegada, la consulta que se usó (seleccionable: en el servidor de
	 *     CSI, por HTTP plano, no hay portapapeles programático; es la regla de la casa, salvo el secret de una API Key);
	 *   · cada encabezado ordena por su columna (otra vez, invierte); lo vacío siempre al final;
	 *   · «Exportar CSV» baja lo mismo que se ve, con BOM para que Excel lea los acentes bien;
	 *   · preguntas sugeridas con los tipos documentales de la organización (los trae `+page.server.ts`), que se preguntan al picarlas;
	 *   · las columnas `documento` y `pagina` no se enseñan: con ellas cada renglón que viene de un documento lleva «Abrir», que abre el archivo en la
	 *     página de donde salió el dato (`/api/documentos/{id}/abrir`). Los renglones de una ejecución de proceso llegarán con las vistas de NEX-612.
	 *
	 * Enter manda la pregunta; Shift+Enter hace un salto de línea. Mientras se piensa, la caja y el botón se apagan: una pregunta a la vez.
	 */
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Info from '@lucide/svelte/icons/info';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Search from '@lucide/svelte/icons/search';

	import AvisoRojo from '$lib/components/config/AvisoRojo.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { descargarBlob } from '$lib/documentos/descargar';
	import {
		MAX_PREGUNTA,
		aCsv,
		enlaceDeFila,
		esColumnaNumerica,
		formatearCelda,
		hrefDeDocumento,
		indicesOcultos,
		limpiarPregunta,
		nombreCsv,
		ordenAlPicar,
		ordenarFilas,
		preguntasSugeridas,
		resultadoDe,
		textoDeRenglones,
		type Orden,
		type Resultado
	} from '$lib/busqueda/busqueda';

	let { data } = $props();

	let pregunta = $state('');
	let pensando = $state(false);
	/** La pregunta que se mandó, tal como se mandó: se enseña encima de la respuesta aunque la caja ya diga otra cosa. */
	let preguntaHecha = $state('');
	let resultado = $state<Resultado | null>(null);
	let orden = $state<Orden>(null);

	const lista = $derived(limpiarPregunta(pregunta));
	const puedePreguntar = $derived(!pensando && lista.length > 0);
	const sugeridas = $derived(preguntasSugeridas(data.tipos ?? []));
	const tabla = $derived.by(() => {
		const r = resultado;
		if (r?.tipo !== 'tabla') return null;
		const { columnas, filas } = r.respuesta;
		const ocultas = indicesOcultos(columnas);
		const visibles = columnas.map((_, i) => i).filter((i) => !ocultas.has(i));
		const conEnlace = filas.some((f) => enlaceDeFila(columnas, f) !== null);
		return {
			columnas,
			visibles,
			numericas: columnas.map((_, i) => esColumnaNumerica(filas, i)),
			filas: ordenarFilas(filas, orden),
			conEnlace
		};
	});

	async function preguntar(texto = lista) {
		if (pensando || !texto) return;
		pensando = true;
		preguntaHecha = texto;
		resultado = null;
		orden = null;
		try {
			const r = await fetch('/api/busqueda/preguntar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pregunta: texto })
			});
			const cuerpo = await r.json().catch(() => null);
			resultado = resultadoDe(r.status, cuerpo);
		} catch {
			resultado = { tipo: 'error', mensaje: 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.' };
		} finally {
			pensando = false;
		}
	}

	function sugerida(texto: string) {
		pregunta = texto;
		void preguntar(limpiarPregunta(texto));
	}

	function alTeclear(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void preguntar();
		}
	}

	function exportar() {
		if (!tabla) return;
		descargarBlob(new Blob([aCsv(tabla.columnas, tabla.filas)], { type: 'text/csv;charset=utf-8' }), nombreCsv(preguntaHecha));
	}
</script>

<svelte:head><title>Biblioratum — Búsqueda</title></svelte:head>

<p class="text-xs text-muted-foreground">Uso / Búsqueda</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Búsqueda</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Pregunta con tus palabras sobre los datos extraídos de los documentos de tu organización. La respuesta llega como tabla.
	</p>
</div>

<form
	class="mt-6 max-w-3xl"
	data-testid="formulario-busqueda"
	onsubmit={(e) => {
		e.preventDefault();
		void preguntar();
	}}
>
	<label for="pregunta" class="sr-only">Tu pregunta</label>
	<div class="flex items-end gap-2">
		<Textarea
			id="pregunta"
			name="pregunta"
			data-testid="pregunta"
			bind:value={pregunta}
			onkeydown={alTeclear}
			disabled={pensando}
			maxlength={MAX_PREGUNTA}
			rows={1}
			placeholder="Por ejemplo: ¿cuántos documentos hay por tipo documental?"
			class="min-h-10 flex-1 bg-card"
		/>
		<Button type="submit" data-testid="preguntar" disabled={!puedePreguntar} class="h-10 gap-2">
			{#if pensando}
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
				Pensando…
			{:else}
				<Search class="size-4" aria-hidden="true" />
				Preguntar
			{/if}
		</Button>
	</div>
	{#if pregunta.length >= MAX_PREGUNTA - 20}
		<p class="mt-1.5 text-xs text-muted-foreground" data-testid="largo-pregunta">{pregunta.length} de {MAX_PREGUNTA} caracteres</p>
	{/if}
</form>

<!-- Las preguntas sugeridas, con los tipos documentales de la organización: picar una la pregunta. -->
<div class="mt-3 flex max-w-3xl flex-wrap items-center gap-1.5" data-testid="sugeridas">
	<span class="text-xs text-muted-foreground">Prueba con:</span>
	{#each sugeridas as s (s)}
		<button
			type="button"
			data-testid="sugerida"
			disabled={pensando}
			onclick={() => sugerida(s)}
			class="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
		>
			{s}
		</button>
	{/each}
</div>

<div class="mt-6 max-w-5xl" role="status" aria-live="polite" data-testid="respuesta">
	{#if pensando}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" data-testid="pensando">
			<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			Pensando la respuesta a «{preguntaHecha}»…
		</p>
	{:else if resultado === null}
		<div class="rounded-2xl border-2 border-dashed border-border px-6 py-8" data-testid="sin-pregunta">
			<p class="text-sm font-medium text-foreground">Escribe una pregunta o elige una de las sugeridas.</p>
			<p class="mt-2 text-xs text-muted-foreground">
				Biblioratum busca solo en los datos ya extraídos de los documentos de tu organización. Lo que no está extraído no se puede responder.
			</p>
		</div>
	{:else if resultado.tipo === 'tabla'}
		{@const r = resultado.respuesta}
		{#if tabla}
		<p class="text-sm text-muted-foreground" data-testid="pregunta-hecha">Pregunta: <span class="text-foreground">«{preguntaHecha}»</span></p>
		<div class="mt-1 flex flex-wrap items-center justify-between gap-2">
			<p class="text-sm font-medium text-foreground" data-testid="renglones">{textoDeRenglones(r)}</p>
			{#if r.filas.length > 0}
				<Button variant="outline" size="sm" class="gap-1.5" data-testid="exportar-csv" onclick={exportar}>
					<Download class="size-3.5" aria-hidden="true" />
					Exportar CSV
				</Button>
			{/if}
		</div>
		{#if r.explicacion}
			<p class="mt-1 text-sm text-muted-foreground" data-testid="explicacion">{r.explicacion}</p>
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
		{#if r.filas.length > 0}
			<div class="mt-3 overflow-x-auto rounded-2xl border-2 border-border bg-card">
				<table class="w-full text-left text-sm" data-testid="tabla-respuesta">
					<caption class="sr-only">Respuesta a «{preguntaHecha}», ordenada por la columna marcada</caption>
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
									<td class="max-w-md px-4 py-2 align-top wrap-break-word text-foreground {tabla.numericas[i] ? 'text-right tabular-nums' : ''} {fila[i] === null || fila[i] === undefined ? 'text-muted-foreground' : ''}">
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
		{/if}
	{:else if resultado.tipo === 'no_se_puede'}
		<p class="text-sm text-muted-foreground" data-testid="pregunta-hecha">Pregunta: <span class="text-foreground">«{preguntaHecha}»</span></p>
		<div
			class="mt-3 flex max-w-2xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
			data-testid="no-se-puede"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<div>
				<p class="font-medium">No se puede responder con los datos extraídos.</p>
				<p class="mt-0.5">{resultado.mensaje}</p>
			</div>
		</div>
	{:else if resultado.tipo === 'tardo'}
		<p class="text-sm text-muted-foreground" data-testid="pregunta-hecha">Pregunta: <span class="text-foreground">«{preguntaHecha}»</span></p>
		<div
			class="mt-3 flex max-w-2xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
			data-testid="tardo"
		>
			<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<div>
				<p class="font-medium">Tardó demasiado.</p>
				<p class="mt-0.5">{resultado.mensaje}</p>
			</div>
		</div>
	{:else}
		<p class="text-sm text-muted-foreground" data-testid="pregunta-hecha">Pregunta: <span class="text-foreground">«{preguntaHecha}»</span></p>
		<div class="mt-3 max-w-2xl">
			<AvisoRojo testid="error-busqueda" titulo="No se pudo responder">
				{resultado.mensaje}
			</AvisoRojo>
		</div>
	{/if}
</div>
