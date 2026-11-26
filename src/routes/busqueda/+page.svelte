<script lang="ts">
	/**
	 * Búsqueda · preguntar en lenguaje natural y ver la respuesta en una tabla (NEX-607, 2026-11-23). Se llega desde el cuadro «Búsqueda» del Módulo de
	 * uso; la ven todos los roles que usan el producto, porque solo lee (como los expedientes): nexus_back decide, aquí no se filtra nada.
	 *
	 * Una caja para escribir la pregunta y la respuesta como tabla con cuántos renglones son. Lo que pasa en medio (el modelo escribe la consulta, el
	 * servidor la revisa y la corre con la conexión de solo lectura que solo ve esta organización) es del back: la pantalla manda la pregunta al BFF
	 * (`/api/busqueda/preguntar`) y pinta lo que vuelve. Los datos de los documentos no salen del servidor hacia ningún modelo.
	 *
	 * Estados: sin preguntar (con las preguntas sugeridas), pensando, la tabla (o «no hay información»), «no se puede responder con los datos
	 * extraídos» (ámbar: no es un error), tardó demasiado y error. La pantalla no nombra al proveedor del modelo.
	 *
	 * NEX-608 (entender la respuesta y llevársela), NEX-609 (bitácora, «¿Te sirvió?», recientes, tope) y NEX-610 (la gráfica): todo lo de UNA respuesta
	 * vive en `RespuestaBusqueda.svelte` desde NEX-611.
	 *
	 * NEX-611 (2026-11-26, seguir preguntando sobre la respuesta): la página es una CONVERSACIÓN. Cada pregunta nueva se entiende con las anteriores de esa
	 * conversación («¿y cuántas de esas tienen campos corregidos?»): la pantalla manda el id que devolvió la anterior y el back le cuenta al modelo las
	 * preguntas y sus consultas, nunca los datos. Las preguntas van en orden, de arriba abajo, y la caja queda debajo de la última; las anteriores se
	 * pliegan a una línea (el dato si la respuesta es uno, o cuántos renglones, y cómo se entendió) y se pueden desplegar. Bajo la última respuesta, hasta
	 * tres preguntas para seguir. «Nueva conversación» empieza de cero (vuelven las sugeridas y las recientes, que siempre empiezan una). Si la sesión
	 * cambia de organización con la página abierta, también: nunca se mezclan (el back tampoco lo permite).
	 *
	 * Enter manda la pregunta; Shift+Enter hace un salto de línea. Mientras se piensa, la caja y el botón se apagan: una pregunta a la vez.
	 */
	import { invalidate } from '$app/navigation';
	import { tick, untrack } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Clock from '@lucide/svelte/icons/clock';
	import Info from '@lucide/svelte/icons/info';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus';
	import Search from '@lucide/svelte/icons/search';

	import RespuestaBusqueda from '$lib/components/busqueda/RespuestaBusqueda.svelte';
	import AvisoRojo from '$lib/components/config/AvisoRojo.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		MAX_PREGUNTA,
		conversacionDe,
		limpiarPregunta,
		preguntasSugeridas,
		resultadoDe,
		resumenDeTurno,
		sugerenciasDe,
		type Resultado,
		type Turno
	} from '$lib/busqueda/busqueda';

	let { data } = $props();

	/** NEX-609: «¿Te sirvió?», por pregunta de la bitácora. */
	let valoraciones = $state<Record<string, boolean>>({});
	let valorando = $state(false);
	let errorValoracion = $state('');
	const recientes = $derived(data.recientes ?? []);

	let pregunta = $state('');
	let caja = $state<HTMLTextAreaElement | null>(null);
	/** NEX-611: las preguntas de la conversación, en orden, y el id que devolvió el servidor (null: la siguiente empieza una conversación). */
	let turnos = $state<Turno[]>([]);
	let conversacion = $state<string | null>(null);
	let siguienteId = 0;
	/** NEX-610: tabla o gráfica. Se queda entre preguntas; solo se usa en las respuestas que se prestan para gráfica. */
	let vista = $state<'tabla' | 'grafica'>('tabla');

	const enConversacion = $derived(turnos.length > 0);
	const pensando = $derived(turnos.length > 0 && turnos[turnos.length - 1].resultado === null);
	const lista = $derived(limpiarPregunta(pregunta));
	const puedePreguntar = $derived(!pensando && lista.length > 0);
	const sugeridas = $derived(preguntasSugeridas(data.tipos ?? []));

	// Si la sesión cambia de organización con la página abierta, la conversación empieza de cero: nunca mezcla organizaciones.
	let organizacionVista: string | null = null;
	$effect.pre(() => {
		const organizacion = data.organizacion ?? null;
		if (organizacionVista !== null && organizacion !== organizacionVista) untrack(() => nuevaConversacion(false));
		organizacionVista = organizacion;
	});

	function nuevaConversacion(enfocar = true) {
		turnos = [];
		conversacion = null;
		errorValoracion = '';
		if (enfocar) caja?.focus();
	}

	/** Que la pregunta se vea: si quedó fuera de la pantalla (o bajo la barra de arriba), se desplaza hasta su inicio. */
	function mostrar(id: number) {
		const el = document.querySelector<HTMLElement>(`[data-turno-id="${id}"]`);
		if (!el) return;
		const { top } = el.getBoundingClientRect();
		if (top >= 72 && top <= window.innerHeight - 200) return;
		const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: Math.max(0, window.scrollY + top - 88), behavior: quieto ? 'auto' : 'smooth' });
	}

	/**
	 * Pregunta dentro de la conversación (o empieza una). `desdeLaCaja`: se escribió en la caja, que entonces se vacía (la pregunta ya se ve arriba) y,
	 * con la respuesta, recupera el foco sin mover la página (en teléfono no: abriría el teclado encima de la respuesta).
	 */
	async function preguntar(texto = lista, desdeLaCaja = false) {
		if (pensando || !texto) return;
		const id = ++siguienteId;
		const enviada = conversacion;
		turnos.push({ id, pregunta: texto, resultado: null, orden: null, medida: null, abierto: false, reinicio: false });
		if (desdeLaCaja) pregunta = '';
		errorValoracion = '';
		await tick();
		mostrar(id);
		let resultado: Resultado;
		let enLaConversacion: string | null = null;
		try {
			const r = await fetch('/api/busqueda/preguntar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pregunta: texto, conversacion: enviada })
			});
			const cuerpo = await r.json().catch(() => null);
			resultado = resultadoDe(r.status, cuerpo);
			enLaConversacion = conversacionDe(cuerpo);
		} catch {
			resultado = { tipo: 'error', mensaje: 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.' };
		}
		const turno = turnos.find((t) => t.id === id);
		if (!turno) return; // la conversación empezó de cero mientras se pensaba: esta respuesta ya no va
		turno.resultado = resultado;
		if (enLaConversacion) {
			// El servidor no encontró las preguntas anteriores (no se pudieron anotar): esta empezó otra conversación, y se dice.
			turno.reinicio = enviada !== null && enLaConversacion !== enviada;
			conversacion = enLaConversacion;
		}
		await tick();
		mostrar(id);
		if (desdeLaCaja && !matchMedia('(pointer: coarse)').matches) caja?.focus({ preventScroll: true });
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

	function alTeclear(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void preguntar(lista, true);
		}
	}
</script>

<svelte:head><title>Biblioratum — Búsqueda</title></svelte:head>

<p class="text-xs text-muted-foreground">Uso / Búsqueda</p>
<div class="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
	<div>
		<h1 class="text-2xl font-semibold text-foreground">Búsqueda</h1>
		<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
			Pregunta con tus palabras sobre los datos extraídos de los documentos de tu organización, y sigue preguntando sobre la respuesta. Llega como tabla
			y, cuando se presta, también como gráfica.
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

{#if enConversacion}
	<!-- NEX-611: la conversación, de la primera pregunta a la última. Las anteriores, plegadas; la última, completa. -->
	<ol class="mt-6 max-w-5xl" data-testid="conversacion" aria-label="Conversación">
		{#each turnos as turno, i (turno.id)}
			{@const esUltimo = i === turnos.length - 1}
			<li
				class={i > 0 ? 'mt-6 border-t border-border pt-6' : ''}
				data-testid="turno"
				data-turno-id={turno.id}
				data-ultimo={esUltimo ? 'si' : 'no'}
			>
				{#if esUltimo}
					<p class="text-sm text-muted-foreground" data-testid="pregunta-hecha">Pregunta: <span class="text-foreground">«{turno.pregunta}»</span></p>
					{#if turno.reinicio}
						<p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="conversacion-nueva">
							<Info class="size-3.5 shrink-0" aria-hidden="true" />
							No encontré tus preguntas anteriores, así que esta empezó una conversación nueva.
						</p>
					{/if}
					<div role="status" aria-live="polite" data-testid="respuesta">
						{#if turno.resultado === null}
							<p class="mt-2 flex items-center gap-2 text-sm text-muted-foreground" data-testid="pensando">
								<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
								Pensando la respuesta…
							</p>
						{:else if turno.resultado.tipo === 'tabla'}
							{@const r = turno.resultado.respuesta}
							<RespuestaBusqueda
								respuesta={r}
								pregunta={turno.pregunta}
								bind:vista
								bind:orden={turno.orden}
								bind:medida={turno.medida}
								valoracion={r.preguntaId ? valoraciones[r.preguntaId] : undefined}
								{valorando}
								{errorValoracion}
								onValorar={valorar}
								sugerencias={sugerenciasDe(r.sugerencias, turno.pregunta)}
								onSeguir={(s) => preguntar(s)}
								deshabilitado={pensando}
							/>
						{:else if turno.resultado.tipo === 'tope'}
							<div
								class="mt-3 flex max-w-2xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
								data-testid="tope"
							>
								<Clock class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								<div>
									<p class="font-medium">Por ahora no se puede preguntar más.</p>
									<p class="mt-0.5">{turno.resultado.mensaje}</p>
								</div>
							</div>
						{:else if turno.resultado.tipo === 'no_se_puede'}
							<div
								class="mt-3 flex max-w-2xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
								data-testid="no-se-puede"
							>
								<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								<div>
									<p class="font-medium">No se puede responder con los datos extraídos.</p>
									<p class="mt-0.5">{turno.resultado.mensaje}</p>
								</div>
							</div>
						{:else if turno.resultado.tipo === 'tardo'}
							<div
								class="mt-3 flex max-w-2xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
								data-testid="tardo"
							>
								<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								<div>
									<p class="font-medium">Tardó demasiado.</p>
									<p class="mt-0.5">{turno.resultado.mensaje}</p>
								</div>
							</div>
						{:else}
							<div class="mt-3 max-w-2xl">
								<AvisoRojo testid="error-busqueda" titulo="No se pudo responder">
									{turno.resultado.mensaje}
								</AvisoRojo>
							</div>
						{/if}
					</div>
				{:else}
					{@const resumen = resumenDeTurno(turno.resultado)}
					{@const desplegable = turno.resultado?.tipo === 'tabla' && turno.resultado.respuesta.filas.length > 0}
					<p class="text-sm text-muted-foreground" data-testid="pregunta-turno">Pregunta: <span class="text-foreground">«{turno.pregunta}»</span></p>
					<div class="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
						<p class="flex min-w-0 items-start gap-1.5 text-sm" data-testid="resumen-turno">
							{#if resumen.tono === 'aviso'}
								<Info class="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
							{:else if resumen.tono === 'error'}
								<CircleAlert class="mt-0.5 size-3.5 shrink-0 text-red-700 dark:text-red-400" aria-hidden="true" />
							{/if}
							<span>
								<span class="font-medium text-foreground tabular-nums">{resumen.destacado}</span>
								{#if resumen.texto}<span class="text-muted-foreground"> · {resumen.texto}</span>{/if}
							</span>
						</p>
						{#if desplegable}
							<button
								type="button"
								aria-expanded={turno.abierto}
								data-testid="ver-respuesta-turno"
								onclick={() => (turno.abierto = !turno.abierto)}
								class="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								{turno.abierto ? 'Ocultar la respuesta' : 'Ver la respuesta'}
								<ChevronDown class="size-3.5 transition-transform {turno.abierto ? 'rotate-180' : ''}" aria-hidden="true" />
							</button>
						{/if}
					</div>
					{#if turno.abierto && turno.resultado?.tipo === 'tabla'}
						{@const r = turno.resultado.respuesta}
						<div class="mt-2" data-testid="respuesta-anterior">
							<RespuestaBusqueda
								respuesta={r}
								pregunta={turno.pregunta}
								bind:vista
								bind:orden={turno.orden}
								bind:medida={turno.medida}
								valoracion={r.preguntaId ? valoraciones[r.preguntaId] : undefined}
								{valorando}
								onValorar={valorar}
							/>
						</div>
					{/if}
				{/if}
			</li>
		{/each}
	</ol>
{/if}

<form
	class="mt-6 max-w-5xl {enConversacion ? 'border-t border-border pt-6' : ''}"
	data-testid="formulario-busqueda"
	onsubmit={(e) => {
		e.preventDefault();
		void preguntar(lista, true);
	}}
>
	<div class="max-w-3xl">
		<label for="pregunta" class="sr-only">{enConversacion ? 'Tu siguiente pregunta' : 'Tu pregunta'}</label>
		<div class="flex items-end gap-2">
			<Textarea
				id="pregunta"
				name="pregunta"
				data-testid="pregunta"
				bind:ref={caja}
				bind:value={pregunta}
				onkeydown={alTeclear}
				disabled={pensando}
				maxlength={MAX_PREGUNTA}
				rows={1}
				placeholder={enConversacion ? 'Sigue preguntando…' : 'Por ejemplo: ¿cuántos documentos hay por tipo documental?'}
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
		{#if enConversacion}
			<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
				<p class="text-xs text-muted-foreground" data-testid="pista-conversacion">
					Se entiende con tus preguntas anteriores: puedes decir «¿y de esas?» o «ahora por mes».
				</p>
				<Button variant="outline" size="sm" class="gap-1.5" data-testid="nueva-conversacion" disabled={pensando} onclick={() => nuevaConversacion()}>
					<MessageSquarePlus class="size-3.5" aria-hidden="true" />
					Nueva conversación
				</Button>
			</div>
		{/if}
	</div>
</form>

{#if !enConversacion}
	<!-- Las preguntas sugeridas, con los tipos documentales de la organización: picar una la pregunta (y empieza la conversación). -->
	<div class="mt-3 flex max-w-3xl flex-wrap items-center gap-1.5" data-testid="sugeridas">
		<span class="text-xs text-muted-foreground">Prueba con:</span>
		{#each sugeridas as s (s)}
			<button
				type="button"
				data-testid="sugerida"
				onclick={() => preguntar(limpiarPregunta(s))}
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
					title={reciente.pregunta}
					onclick={() => preguntar(limpiarPregunta(reciente.pregunta))}
					class="max-w-72 truncate rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
				>
					{reciente.pregunta}
				</button>
			{/each}
		</div>
	{/if}

	<div class="mt-6 max-w-5xl rounded-2xl border-2 border-dashed border-border px-6 py-8" data-testid="sin-pregunta">
		<p class="text-sm font-medium text-foreground">Escribe una pregunta o elige una de las sugeridas.</p>
		<p class="mt-2 text-xs text-muted-foreground">
			Biblioratum busca solo en los datos ya extraídos de los documentos de tu organización. Lo que no está extraído no se puede responder. Puedes
			seguir preguntando sobre cada respuesta.
		</p>
	</div>
{/if}
