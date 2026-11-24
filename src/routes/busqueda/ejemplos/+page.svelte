<script lang="ts">
	/**
	 * Búsqueda · Ejemplos de tu organización (NEX-609, 2026-11-23). Quien administra la organización revisa las respuestas que alguien marcó «Sí me
	 * sirvió» y las APRUEBA como ejemplo: desde la siguiente pregunta, la búsqueda de esta organización (y solo de esta) lo usa para responder preguntas
	 * parecidas, y si alguien hace exactamente la misma pregunta, se responde con su consulta sin volver a pensarla. Lo que no conviene se DESCARTA (vuelve
	 * si alguien más la marca útil). Un ejemplo aprobado se puede QUITAR, con la confirmación de la casa (`ConfirmarAccion`).
	 *
	 * Dos secciones: «Por revisar» (una por pregunta, la más reciente: cuántas veces se hizo, a cuántas personas les sirvió, quién la hizo la última vez,
	 * la frase de cómo se entendió y la consulta plegada) y «Ejemplos aprobados» (quién lo aprobó, cuándo y cuántas veces se reusó su consulta tal cual).
	 *
	 * Quien no administra ve que esto es de quien administra. Cada acción va a su BFF y después se vuelve a pedir todo (`invalidateAll`); el aviso verde o
	 * rojo queda arriba, en una región que se anuncia.
	 */
	import { invalidateAll } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import Lock from '@lucide/svelte/icons/lock';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	import AvisoRojo from '$lib/components/config/AvisoRojo.svelte';
	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { formatearCelda, nombreDe, resumenDeReusos, resumenDeUso, type EjemploAprobado } from '$lib/busqueda/busqueda';

	let { data } = $props();

	let ocupado = $state<string | null>(null);
	let aviso = $state<{ titulo: string; cuerpo: string } | null>(null);
	let fallo = $state('');
	let aQuitar = $state<EjemploAprobado | null>(null);

	/** Hace la acción, vuelve a pedir las dos listas y SOLO ENTONCES dice cómo salió: el aviso y la lista cambian juntos, y los botones siguen
	 *  apagados mientras tanto (un segundo clic no repite la acción). */
	async function pedir(
		id: string,
		metodo: 'POST' | 'DELETE',
		url: string,
		cuerpo: unknown,
		siSale: { titulo: string; cuerpo: string }
	): Promise<void> {
		ocupado = id;
		aviso = null;
		fallo = '';
		let mensaje = '';
		try {
			const r = await fetch(url, {
				method: metodo,
				headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
				body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) mensaje = typeof datos?.mensaje === 'string' && datos.mensaje ? datos.mensaje : 'No se pudo completar. Intenta de nuevo.';
		} catch {
			mensaje = 'No se pudo contactar al servidor. Intenta de nuevo.';
		}
		await invalidateAll().catch(() => undefined);
		ocupado = null;
		if (mensaje) fallo = mensaje;
		else aviso = siSale;
	}

	const aprobar = (id: string, pregunta: string) =>
		pedir(id, 'POST', '/api/busqueda/ejemplos', { preguntaId: id }, { titulo: 'Ejemplo aprobado', cuerpo: `«${pregunta}» ya ayuda a la búsqueda de tu organización.` });

	const descartar = (id: string, pregunta: string) =>
		pedir(id, 'POST', `/api/busqueda/preguntas/${encodeURIComponent(id)}/descartar`, undefined, {
			titulo: 'Descartada',
			cuerpo: `«${pregunta}» salió de la lista. Vuelve si alguien más la marca como útil.`
		});

	const quitar = (ejemplo: EjemploAprobado) =>
		pedir(ejemplo.id, 'DELETE', `/api/busqueda/ejemplos/${encodeURIComponent(ejemplo.id)}`, undefined, {
			titulo: 'Ejemplo quitado',
			cuerpo: `«${ejemplo.pregunta}» ya no se usa como ejemplo.`
		});
</script>

<svelte:head><title>Biblioratum — Ejemplos de la búsqueda</title></svelte:head>

<p class="text-xs text-muted-foreground">Uso / <a href="/busqueda" class="hover:text-foreground hover:underline">Búsqueda</a> / Ejemplos</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Ejemplos de tu organización</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Aprueba como ejemplo las respuestas que le sirvieron a tu equipo. Un ejemplo ayuda a la búsqueda a responder preguntas parecidas y, si alguien hace
		exactamente la misma pregunta, se responde con su consulta sin volver a pensarla. Solo los usa tu organización.
	</p>
	<a href="/busqueda" class="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline" data-testid="volver-a-busqueda">
		<ArrowLeft class="size-4" aria-hidden="true" />
		Volver a la búsqueda
	</a>
</div>

{#if !data.administra}
	<div class="mt-8 flex flex-col items-center gap-6 rounded-2xl border-2 border-border bg-card py-24 text-center" data-testid="ejemplos-sin-permiso">
		<Lock class="size-10 text-muted-foreground" />
		<div>
			<p class="text-lg font-medium text-foreground">Esta parte la revisa quien administra</p>
			<p class="mt-1 max-w-lg text-sm text-muted-foreground">
				Los ejemplos de la búsqueda los aprueba quien administra tu organización. Tú ayudas marcando «Sí» en «¿Te sirvió?» cuando una respuesta te sirve.
			</p>
		</div>
	</div>
{:else}
	<div class="mt-6" role="status" aria-live="polite">
		{#if aviso}
			<AvisoVerde testid="aviso-ejemplos" titulo={aviso.titulo} cuerpo={aviso.cuerpo} />
		{/if}
	</div>
	{#if fallo || data.error}
		<div class="mb-6 max-w-2xl">
			<AvisoRojo testid="error-ejemplos" titulo="No se pudo completar">{fallo || data.error}</AvisoRojo>
		</div>
	{/if}

	<section class="max-w-4xl" data-testid="seccion-por-revisar">
		<h2 class="text-lg font-semibold text-foreground">
			Por revisar <span class="text-sm font-normal text-muted-foreground tabular-nums">({data.porRevisar.length})</span>
		</h2>
		{#if data.porRevisar.length === 0}
			<p class="mt-2 rounded-2xl border-2 border-dashed border-border px-6 py-6 text-sm text-muted-foreground" data-testid="nada-por-revisar">
				No hay respuestas por revisar. Aparecen aquí cuando alguien marca «Sí» en «¿Te sirvió?» bajo una respuesta.
			</p>
		{:else}
			<ul class="mt-3 space-y-3">
				{#each data.porRevisar as p (p.id)}
					<li class="rounded-2xl border-2 border-border bg-card p-5" data-testid="por-revisar" data-id={p.id}>
						<p class="font-medium text-foreground" data-testid="por-revisar-pregunta">«{p.pregunta}»</p>
						<p class="mt-1 text-xs text-muted-foreground" data-testid="por-revisar-uso">
							{resumenDeUso(p.veces, p.personasUtil)} · Última vez: {nombreDe(p.autor)}{p.en ? `, ${formatearCelda(p.en)}` : ''}
						</p>
						{#if p.explicacion}
							<p class="mt-2 text-sm text-muted-foreground">{p.explicacion}</p>
						{/if}
						<details class="mt-2 text-sm">
							<summary class="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">Ver la consulta</summary>
							<pre class="mt-1.5 overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground select-all">{p.consulta}</pre>
						</details>
						<div class="mt-4 flex flex-wrap gap-2">
							<Button size="sm" class="gap-1.5" disabled={ocupado !== null} data-testid="aprobar" onclick={() => aprobar(p.id, p.pregunta)}>
								<BadgeCheck class="size-3.5" aria-hidden="true" />
								Aprobar como ejemplo
							</Button>
							<Button variant="outline" size="sm" disabled={ocupado !== null} data-testid="descartar" onclick={() => descartar(p.id, p.pregunta)}>
								Descartar
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="mt-10 max-w-4xl" data-testid="seccion-aprobados">
		<h2 class="text-lg font-semibold text-foreground">
			Ejemplos aprobados <span class="text-sm font-normal text-muted-foreground tabular-nums">({data.ejemplos.length})</span>
		</h2>
		{#if data.ejemplos.length === 0}
			<p class="mt-2 rounded-2xl border-2 border-dashed border-border px-6 py-6 text-sm text-muted-foreground" data-testid="sin-ejemplos">
				Todavía no hay ejemplos aprobados.
			</p>
		{:else}
			<ul class="mt-3 space-y-3">
				{#each data.ejemplos as e (e.id)}
					<li class="rounded-2xl border-2 border-border bg-card p-5" data-testid="ejemplo" data-id={e.id}>
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="flex items-center gap-1.5 font-medium text-foreground" data-testid="ejemplo-pregunta">
									<BadgeCheck class="size-4 shrink-0 text-primary" aria-hidden="true" />
									«{e.pregunta}»
								</p>
								<p class="mt-1 text-xs text-muted-foreground" data-testid="ejemplo-uso">
									Aprobado por {nombreDe(e.aprobadoPor)}{e.aprobadoEn ? `, ${formatearCelda(e.aprobadoEn)}` : ''} · {resumenDeReusos(e.reusos)}
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								class="gap-1.5"
								disabled={ocupado !== null}
								data-testid="quitar-ejemplo"
								aria-label="Quitar el ejemplo «{e.pregunta}»"
								onclick={() => (aQuitar = e)}
							>
								<Trash2 class="size-3.5" aria-hidden="true" />
								Quitar
							</Button>
						</div>
						{#if e.explicacion}
							<p class="mt-2 text-sm text-muted-foreground">{e.explicacion}</p>
						{/if}
						<details class="mt-2 text-sm">
							<summary class="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">Ver la consulta</summary>
							<pre class="mt-1.5 overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground select-all">{e.consulta}</pre>
						</details>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<ConfirmarAccion
	abierto={aQuitar !== null}
	titulo="Quitar el ejemplo"
	mensaje={aQuitar
		? `«${aQuitar.pregunta}» deja de usarse como ejemplo desde la siguiente pregunta. Si a alguien le vuelve a servir, puedes aprobarla de nuevo.`
		: ''}
	etiquetaConfirmar="Quitar"
	onConfirmar={() => {
		const ejemplo = aQuitar;
		if (ejemplo) void quitar(ejemplo);
	}}
	onCerrar={() => (aQuitar = null)}
/>
