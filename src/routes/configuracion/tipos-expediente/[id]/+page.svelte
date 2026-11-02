<script lang="ts">
	/**
	 * Configuración · los expedientes virtuales de UN tipo (2026-10-30, pedido de Moibe): lo que hay detrás de la cuenta de la columna
	 * «Expedientes virtuales» de la tabla de tipos. Son las INSTANCIAS del tipo: cada una es un grupito de documentos de algún expediente
	 * («la solicitud de crédito de Juan Pérez»), y esta pantalla las junta todas en un mosaico, vengan del expediente que vengan.
	 *
	 * Cada tarjeta lleva a la pantalla del virtual (`/expediente/<id>/virtual/<id>`). Aquí no se crea nada (los virtuales se arman dentro de cada
	 * expediente), pero quien organiza puede BORRAR uno con el botón de bote de basura de su tarjeta (2026-11-03, Moibe), con la confirmación de la casa:
	 * se borra el grupito, NO sus documentos, que siguen en su expediente. Sin diseño en el Figma (el tipo de expediente virtual tampoco lo tiene): se
	 * tomó el lenguaje del listado de expedientes, con su tarjeta y su mosaico.
	 *
	 * La ve cualquier rol (como la tabla de tipos). A esta pantalla solo se llega picando una cuenta mayor que cero; si alguien entra por la
	 * dirección a un tipo sin virtuales, lo dice.
	 */
	import { invalidateAll } from '$app/navigation';
	import FolderOpen from '@lucide/svelte/icons/folder-open';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import TarjetaExpedienteVirtual from '$lib/components/expedientes/TarjetaExpedienteVirtual.svelte';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import type { ExpedienteVirtualDeTipo } from '$lib/expedientes/expedientes';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';

	let { data } = $props();

	const virtuales = $derived(data.virtuales);

	/** El que se va a borrar (la confirmación está abierta), el que se está borrando, el aviso verde y el error. */
	let porBorrar = $state<ExpedienteVirtualDeTipo | null>(null);
	let borrando = $state<string | null>(null);
	let aviso = $state<{ titulo: string; cuerpo: string } | null>(null);
	let error = $state('');

	async function borrar(v: ExpedienteVirtualDeTipo) {
		if (borrando) return;
		borrando = v.id;
		aviso = null;
		error = '';
		try {
			const r = await fetch(`/api/expedientes/${encodeURIComponent(v.expediente.id)}/virtuales/${encodeURIComponent(v.id)}`, { method: 'DELETE' });
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = `No se pudo borrar «${v.nombre}»: ${mensajeDeFallo(datos, r.status, 'al borrar')}`;
				return;
			}
			// El virtual YA se borró: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
			aviso = { titulo: 'Expediente virtual borrado', cuerpo: `«${v.nombre}» se borró. Sus documentos siguen en «${v.expediente.nombre}».` };
			await invalidateAll();
		} catch {
			error = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		} finally {
			borrando = null;
		}
	}
</script>

<svelte:head><title>Biblioratum — Expedientes virtuales de {data.tipo.nombre}</title></svelte:head>

<div role="status" aria-live="polite">
	{#if aviso}
		<div class="mb-4"><AvisoVerde testid="virtual-borrado-aviso" titulo={aviso.titulo} cuerpo={aviso.cuerpo} /></div>
	{/if}
</div>

<p class="text-xs text-muted-foreground">
	<a href="/configuracion" class="transition-colors hover:text-foreground">Configuración</a> /
	<a href="/configuracion/tipos-expediente" class="transition-colors hover:text-foreground" data-testid="volver-a-tipos-expediente"
		>Tipos de expediente virtual</a
	>
	/ {data.tipo.nombre}
</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground" data-testid="titulo-expedientes-del-tipo">Expedientes virtuales de «{data.tipo.nombre}»</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Los expedientes virtuales de este tipo que hay en tu organización, de todos sus expedientes. Pica uno para abrirlo.
	</p>
</div>

<div class="mt-6 rounded-2xl border-2 border-border bg-card p-3">
	<div class="flex min-h-12.5 items-center gap-3">
		<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
			<FolderOpen class="size-4" />
		</span>
		<div>
			<p class="text-sm font-medium text-foreground">Listado de expedientes virtuales</p>
			<p class="flex items-center gap-1 text-xs text-muted-foreground">
				<span
					class="flex size-4.25 min-w-4.25 items-center justify-center rounded-sm bg-primary/10 px-1 text-[10px] font-medium text-primary"
					data-testid="total-expedientes-virtuales-del-tipo">{virtuales.length}</span
				>
				{virtuales.length === 1 ? 'Expediente virtual en total' : 'Expedientes virtuales en total'}
			</p>
		</div>
	</div>

	{#if error}
		<p class="mt-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert" data-testid="error-borrar-virtual">{error}</p>
	{/if}

	{#if virtuales.length === 0}
		<p class="py-16 text-center text-sm text-muted-foreground" data-testid="sin-expedientes-virtuales-del-tipo">
			Este tipo todavía no tiene expedientes virtuales. Se arman dentro de cada <a href="/expediente" class="text-primary underline-offset-2 hover:underline">expediente</a>.
		</p>
	{:else}
		<ul class="mt-3 flex flex-wrap gap-3" data-testid="mosaico-expedientes-virtuales">
			{#each virtuales as virtual (virtual.id)}
				<li><TarjetaExpedienteVirtual {virtual} alBorrar={data.puedeOrganizar ? () => (porBorrar = virtual) : undefined} borrando={borrando === virtual.id} /></li>
			{/each}
		</ul>
	{/if}
</div>

<ConfirmarAccion
	abierto={porBorrar !== null}
	titulo="Borrar el expediente virtual"
	mensaje={porBorrar ? `«${porBorrar.nombre}» se borrará. Sus documentos NO se borran: siguen en «${porBorrar.expediente.nombre}».` : ''}
	etiquetaConfirmar="Borrar"
	onConfirmar={() => {
		const v = porBorrar;
		porBorrar = null;
		if (v) void borrar(v);
	}}
	onCerrar={() => (porBorrar = null)}
/>
