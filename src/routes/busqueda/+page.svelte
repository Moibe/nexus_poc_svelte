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
	 * NEX-609 (2026-11-23, bitácora, topes y ejemplos):
	 *   · «¿Te sirvió?» (Sí / No) bajo cada respuesta que salió bien; se puede cambiar. Lo marcado como útil le llega a quien administra la organización
	 *     para aprobarlo como ejemplo (`/busqueda/ejemplos`; el enlace de arriba dice cuántas esperan, y solo lo ve quien administra);
	 *   · si la consulta se reusó (un ejemplo aprobado o la misma pregunta que ya salió bien), una nota lo dice: no se le preguntó al modelo;
	 *   · «Tus preguntas recientes», para repetir una con un clic (se vuelven a pedir después de cada pregunta);
	 *   · el tope de uso (por persona por hora, por organización por día) sale en ámbar con la hora a la que se puede volver a preguntar.
	 *
	 * NEX-610 (2026-11-26, ver la respuesta como gráfica): cuando la respuesta es un resumen por categorías o por fechas (`planDeGrafica`), junto a
	 * «Exportar CSV» aparece «Tabla | Gráfica»: barras para categorías, línea para fechas, armadas aquí con las mismas filas (no se vuelve a llamar al
	 * modelo). La vista elegida se queda para las siguientes respuestas que se presten; las que no (un número suelto, una lista) se ven en tabla.
	 *
	 * Enter manda la pregunta; Shift+Enter hace un salto de línea. Mientras se piensa, la caja y el botón se apagan: una pregunta a la vez.
	 */
	import { invalidate } from '$app/navigation';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Clock from '@lucide/svelte/icons/clock';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Info from '@lucide/svelte/icons/info';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Search from '@lucide/svelte/icons/search';
	import Table2 from '@lucide/svelte/icons/table-2';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';

	import GraficaRespuesta from '$lib/components/busqueda/GraficaRespuesta.svelte';
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
		notaDeOrigen,
		ordenAlPicar,
		ordenarFilas,
		preguntasSugeridas,
		resultadoDe,
		textoDeRenglones,
		type Orden,
		type Resultado
	} from '$lib/busqueda/busqueda';
	import { planDeGrafica } from '$lib/busqueda/grafica';

	let { data } = $props();

	/** NEX-609: «¿Te sirvió?», por pregunta de la bitácora (lo último que se contestó). */
	let valoraciones = $state<Record<string, boolean>>({});
	let valorando = $state(false);
	let errorValoracion = $state('');
	const recientes = $derived(data.recientes ?? []);

	let pregunta = $state('');
	let pensando = $state(false);
	/** La pregunta que se mandó, tal como se mandó: se enseña encima de la respuesta aunque la caja ya diga otra cosa. */
	let preguntaHecha = $state('');
	let resultado = $state<Resultado | null>(null);
	let orden = $state<Orden>(null);
	/** NEX-610: tabla o gráfica. Se queda entre preguntas; solo se usa cuando la respuesta se presta para gráfica. */
	let vista = $state<'tabla' | 'grafica'>('tabla');
	/** Qué graficar, o `null` si la respuesta no se presta (un número suelto, una lista de nombres o de documentos). */
	const plan = $derived(resultado?.tipo === 'tabla' ? planDeGrafica(resultado.respuesta.columnas, resultado.respuesta.filas) : null);
	const enGrafica = $derived(plan !== null && vista === 'grafica');
	/** Qué columna de números se grafica (si hay varias): se queda al ir a la tabla y volver; con otra respuesta, otra vez la primera. */
	let medidaElegida = $state<number | null>(null);

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
		medidaElegida = null;
		try {
			const r = await fetch('/api/busqueda/preguntar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pregunta: texto })
			});
			const cuerpo = await r.json().catch(() => null);
			resultado = resultadoDe(r.status, cuerpo);
			errorValoracion = '';
		} catch {
			resultado = { tipo: 'error', mensaje: 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.' };
		} finally {
			pensando = false;
		}
		// La pregunta ya quedó en la bitácora: «Tus preguntas recientes» (y lo que espera revisión) se vuelven a pedir. Si falla, no pasa nada.
		void invalidate('busqueda:recientes').catch(() => undefined);
	}

	async function valorar(id: string, util: boolean) {
		if (valorando) return;
		valorando = true;
		errorValoracion = '';
		try {
			const r = await fetch(`/api/busqueda/preguntas/${encodeURIComponent(id)}/valoracion`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ util })
			});
			if (r.ok) {
				valoraciones[id] = util;
			} else {
				const cuerpo = await r.json().catch(() => null);
				errorValoracion = typeof cuerpo?.mensaje === 'string' && cuerpo.mensaje ? cuerpo.mensaje : 'No se pudo guardar tu respuesta. Intenta de nuevo.';
			}
		} catch {
			errorValoracion = 'No se pudo contactar al servidor. Intenta de nuevo.';
		} finally {
			valorando = false;
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
<div class="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
	<div>
		<h1 class="text-2xl font-semibold text-foreground">Búsqueda</h1>
		<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
			Pregunta con tus palabras sobre los datos extraídos de los documentos de tu organización. La respuesta llega como tabla y, cuando se presta, también
			como gráfica.
		</p>
	</div>
	{#if data.administra}
		<!-- Solo quien administra la organización aprueba ejemplos: el enlace dice cuántas respuestas útiles esperan revisión. -->
		<a
			href="/busqueda/ejemplos"
			data-testid="ir-a-ejemplos"
			class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<BadgeCheck class="size-4 text-primary" aria-hidden="true" />
			Ejemplos de tu organización
			{#if data.porRevisar > 0}
				<span class="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground tabular-nums" data-testid="cuantas-por-revisar">
					{data.porRevisar} por revisar
				</span>
			{/if}
			<ArrowRight class="size-3.5 text-muted-foreground" aria-hidden="true" />
		</a>
	{/if}
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

<!-- NEX-609: las últimas preguntas distintas de quien mira, para repetir una con un clic. -->
{#if recientes.length > 0}
	<div class="mt-2 flex max-w-3xl flex-wrap items-center gap-1.5" data-testid="recientes">
		<span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
			<Clock class="size-3.5" aria-hidden="true" />
			Tus preguntas recientes:
		</span>
		{#each recientes as reciente (reciente.id)}
			<button
				type="button"
				data-testid="reciente"
				disabled={pensando}
				title={reciente.pregunta}
				onclick={() => sugerida(reciente.pregunta)}
				class="max-w-72 truncate rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
			>
				{reciente.pregunta}
			</button>
		{/each}
	</div>
{/if}

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
		{@const nota = notaDeOrigen(r.origen)}
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
				<GraficaRespuesta columnas={r.columnas} filas={r.filas} {plan} pregunta={preguntaHecha} bind:elegida={medidaElegida} />
			{/key}
		{:else if r.filas.length > 0}
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
		{#if r.preguntaId}
			{@const id = r.preguntaId}
			{@const valor = valoraciones[id]}
			<!-- NEX-609: «¿Te sirvió?». Lo útil le llega a quien administra la organización para aprobarlo como ejemplo. -->
			<div class="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="te-sirvio">
				<span class="text-muted-foreground">¿Te sirvió?</span>
				<Button
					variant="outline"
					size="sm"
					class="gap-1.5 {valor === true ? 'border-primary bg-primary/10 text-primary' : ''}"
					aria-pressed={valor === true}
					disabled={valorando}
					data-testid="sirvio-si"
					onclick={() => valorar(id, true)}
				>
					<ThumbsUp class="size-3.5" aria-hidden="true" />
					Sí
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="gap-1.5 {valor === false ? 'border-foreground/40 bg-muted' : ''}"
					aria-pressed={valor === false}
					disabled={valorando}
					data-testid="sirvio-no"
					onclick={() => valorar(id, false)}
				>
					<ThumbsDown class="size-3.5" aria-hidden="true" />
					No
				</Button>
				{#if valor === true}
					<span class="text-xs text-muted-foreground" data-testid="gracias">Gracias. Quien administra tu organización podrá aprobarla como ejemplo.</span>
				{:else if valor === false}
					<span class="text-xs text-muted-foreground" data-testid="gracias">Gracias. La próxima vez que alguien lo pregunte, se buscará otra forma de responder.</span>
				{/if}
				{#if errorValoracion}
					<span class="text-xs text-red-700 dark:text-red-400" role="alert" data-testid="error-valoracion">{errorValoracion}</span>
				{/if}
			</div>
		{/if}
		{/if}
	{:else if resultado.tipo === 'tope'}
		<p class="text-sm text-muted-foreground" data-testid="pregunta-hecha">Pregunta: <span class="text-foreground">«{preguntaHecha}»</span></p>
		<div
			class="mt-3 flex max-w-2xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
			data-testid="tope"
		>
			<Clock class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<div>
				<p class="font-medium">Por ahora no se puede preguntar más.</p>
				<p class="mt-0.5">{resultado.mensaje}</p>
			</div>
		</div>
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
