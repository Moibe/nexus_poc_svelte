<script lang="ts">
	/**
	 * Búsqueda · preguntar en lenguaje natural y ver la respuesta en una tabla (NEX-607, 2026-11-23). Se llega desde el cuadro «Búsqueda» del Módulo de
	 * uso; la ven todos los roles que usan el producto, porque solo lee (como los expedientes): nexus_back decide, aquí no se filtra nada.
	 *
	 * Una caja para escribir la pregunta y, debajo, la respuesta como tabla con cuántos renglones son. Lo que pasa en medio (el modelo escribe la
	 * consulta, el servidor la revisa y la corre con la conexión de solo lectura que solo ve esta organización) es del back: la pantalla manda la
	 * pregunta al BFF (`/api/busqueda/preguntar`) y pinta lo que vuelve. Los datos de los documentos no salen del servidor hacia ningún modelo.
	 *
	 * Estados: sin preguntar (con tres preguntas de pista, que son texto), pensando, la tabla (o «no hay información»), «no se puede responder con los
	 * datos extraídos» (ámbar: no es un error), tardó demasiado y error. La pantalla no nombra al proveedor del modelo. La consulta que se usó y la frase
	 * de cómo se entendió ya viajan en la respuesta, pero se enseñan desde NEX-608.
	 *
	 * Enter manda la pregunta; Shift+Enter hace un salto de línea. Mientras se piensa, la caja y el botón se apagan: una pregunta a la vez.
	 */
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Search from '@lucide/svelte/icons/search';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Info from '@lucide/svelte/icons/info';

	import AvisoRojo from '$lib/components/config/AvisoRojo.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		MAX_PREGUNTA,
		PISTAS,
		esColumnaNumerica,
		formatearCelda,
		limpiarPregunta,
		resultadoDe,
		textoDeRenglones,
		type Resultado
	} from '$lib/busqueda/busqueda';

	let pregunta = $state('');
	let pensando = $state(false);
	/** La pregunta que se mandó, tal como se mandó: se enseña encima de la respuesta aunque la caja ya diga otra cosa. */
	let preguntaHecha = $state('');
	let resultado = $state<Resultado | null>(null);

	const lista = $derived(limpiarPregunta(pregunta));
	const puedePreguntar = $derived(!pensando && lista.length > 0);
	const numericas = $derived.by(() => {
		const r = resultado;
		if (r?.tipo !== 'tabla') return [] as boolean[];
		return r.respuesta.columnas.map((_, i) => esColumnaNumerica(r.respuesta.filas, i));
	});

	async function preguntar() {
		if (!puedePreguntar) return;
		const texto = lista;
		pensando = true;
		preguntaHecha = texto;
		resultado = null;
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

	function alTeclear(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void preguntar();
		}
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

<div class="mt-6 max-w-5xl" role="status" aria-live="polite" data-testid="respuesta">
	{#if pensando}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" data-testid="pensando">
			<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			Pensando la respuesta a «{preguntaHecha}»…
		</p>
	{:else if resultado === null}
		<div class="rounded-2xl border-2 border-dashed border-border px-6 py-8" data-testid="sin-pregunta">
			<p class="text-sm font-medium text-foreground">Puedes preguntar cosas como:</p>
			<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
				{#each PISTAS as pista (pista)}
					<li>· {pista}</li>
				{/each}
			</ul>
			<p class="mt-4 text-xs text-muted-foreground">
				Biblioratum busca solo en los datos ya extraídos de los documentos de tu organización. Lo que no está extraído no se puede responder.
			</p>
		</div>
	{:else if resultado.tipo === 'tabla'}
		{@const r = resultado.respuesta}
		<p class="text-sm text-muted-foreground" data-testid="pregunta-hecha">Pregunta: <span class="text-foreground">«{preguntaHecha}»</span></p>
		<p class="mt-1 text-sm font-medium text-foreground" data-testid="renglones">{textoDeRenglones(r)}</p>
		{#if r.filas.length > 0}
			<div class="mt-3 overflow-x-auto rounded-2xl border-2 border-border bg-card">
				<table class="w-full text-left text-sm" data-testid="tabla-respuesta">
					<caption class="sr-only">Respuesta a «{preguntaHecha}»</caption>
					<thead>
						<tr class="border-b border-border text-xs text-muted-foreground">
							{#each r.columnas as columna, i (i)}
								<th scope="col" class="px-4 py-2 font-normal whitespace-nowrap {numericas[i] ? 'text-right' : ''}">{columna || `Columna ${i + 1}`}</th>
							{/each}
						</tr>
					</thead>
					<tbody data-testid="filas-respuesta">
						{#each r.filas as fila, f (f)}
							<tr class="border-b border-border last:border-0" data-testid="fila-respuesta">
								{#each r.columnas as _, i (i)}
									<td class="max-w-md px-4 py-2 align-top wrap-break-word text-foreground {numericas[i] ? 'text-right tabular-nums' : ''} {fila[i] === null || fila[i] === undefined ? 'text-muted-foreground' : ''}">
										{formatearCelda(fila[i])}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
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
