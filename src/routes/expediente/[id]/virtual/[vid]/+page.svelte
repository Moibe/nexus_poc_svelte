<script lang="ts">
	/**
	 * Expediente · un expediente VIRTUAL abierto (2026-10-29, decisión de Moibe): un grupito de documentos de un expediente, instancia de un
	 * tipo («la solicitud de crédito de Juan Pérez»). Con el mismo lenguaje del expediente abierto: «Atrás» (a su expediente), el nombre con
	 * su tipo, el ESQUEMA del tipo (qué tipos documentales lleva: describe, no restringe) y una tarjeta por documento.
	 *
	 * Quien organiza puede:
	 *   · «Agregar documentos»: elegir con casillas entre los documentos DEL EXPEDIENTE que todavía no están (no hay otros: un virtual es
	 *     subconjunto de su expediente, y la base no deja meter otros);
	 *   · «Quitar» uno: sale del grupito, NO del expediente;
	 *   · «Borrar expediente virtual»: con la confirmación de la casa (`ConfirmarAccion`); no borra documentos, y regresa al expediente.
	 * Los documentos se eligen a mano porque todavía no guardan su tipo documental. No hay diseño para esta pantalla en el Figma.
	 */
	import { goto, invalidateAll } from '$app/navigation';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import FolderTree from '@lucide/svelte/icons/folder-tree';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import ElegirDocumentos from '$lib/components/expedientes/ElegirDocumentos.svelte';
	import TarjetaDocumento from '$lib/components/expedientes/TarjetaDocumento.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { documentosDelVirtual } from '$lib/expedientes/expedientes';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';

	let { data } = $props();

	const v = $derived(data.virtual);
	const base = $derived(`/api/expedientes/${encodeURIComponent(v.expediente.id)}/virtuales/${encodeURIComponent(v.id)}`);
	/** Los documentos del expediente que todavía no están en el virtual: lo único que se le puede agregar. */
	const disponibles = $derived(data.documentosDelExpediente.filter((d) => !v.documentos.some((x) => x.id === d.id)));

	let aviso = $state<{ testid: string; titulo: string; cuerpo: string } | null>(null);
	let error = $state('');
	let quitando = $state<string | null>(null);
	let agregarAbierto = $state(false);
	let elegidos = $state<string[]>([]);
	let agregando = $state(false);
	let errorAgregar = $state('');
	let confirmarBorrado = $state(false);

	async function quitar(documentoId: string, nombre: string) {
		if (quitando) return;
		quitando = documentoId;
		aviso = null;
		error = '';
		try {
			const r = await fetch(`${base}/documentos/${encodeURIComponent(documentoId)}`, { method: 'DELETE' });
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = `No se pudo quitar «${nombre}»: ${mensajeDeFallo(datos, r.status, 'al quitar')}`;
				return;
			}
			aviso = { testid: 'documento-quitado-del-virtual', titulo: 'Documento quitado', cuerpo: `«${nombre}» ya no está en «${v.nombre}». Sigue en el expediente.` };
			await invalidateAll();
		} catch {
			error = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		} finally {
			quitando = null;
		}
	}

	async function agregar() {
		if (agregando || elegidos.length === 0) return;
		agregando = true;
		errorAgregar = '';
		let hechos = 0;
		try {
			// En el orden del expediente, no en el que se fueron marcando.
			for (const d of disponibles.filter((x) => elegidos.includes(x.id))) {
				const r = await fetch(`${base}/documentos/${encodeURIComponent(d.id)}`, { method: 'PUT' });
				const datos = await r.json().catch(() => null);
				if (!r.ok) {
					// Lo que ya entró, entró: se dice cuántos y qué falló, y la pantalla se refresca igual.
					errorAgregar = `${hechos ? `Se agregaron ${hechos}. ` : ''}No se pudo agregar «${d.nombreOriginal}»: ${mensajeDeFallo(datos, r.status, 'al agregar')}`;
					if (hechos) await invalidateAll();
					return;
				}
				hechos += 1;
			}
			agregarAbierto = false;
			aviso = {
				testid: 'documentos-agregados-al-virtual',
				titulo: 'Documentos agregados',
				cuerpo: `${hechos === 1 ? 'Se agregó 1 documento' : `Se agregaron ${hechos} documentos`} a «${v.nombre}».`
			};
			await invalidateAll();
		} catch {
			errorAgregar = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		} finally {
			agregando = false;
		}
	}

	async function borrar() {
		error = '';
		try {
			const r = await fetch(base, { method: 'DELETE' });
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = `No se pudo borrar el expediente virtual: ${mensajeDeFallo(datos, r.status, 'al borrar')}`;
				return;
			}
			await goto(`/expediente/${encodeURIComponent(v.expediente.id)}`);
		} catch {
			error = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		}
	}
</script>

<svelte:head><title>Biblioratum — {v.nombre}</title></svelte:head>

<div role="status" aria-live="polite">
	{#if aviso}
		<div class="mb-4"><AvisoVerde testid={aviso.testid} titulo={aviso.titulo} cuerpo={aviso.cuerpo} /></div>
	{/if}
</div>

<div class="rounded-2xl border-2 border-border bg-card p-3" data-testid="expediente-virtual">
	<div class="flex min-h-12.5 flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<a
				href={`/expediente/${v.expediente.id}`}
				data-testid="volver-al-expediente"
				class="flex shrink-0 items-center gap-2 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				<Undo2 class="size-6 text-primary" />
				<span class="max-w-48 truncate" title={v.expediente.nombre}>{v.expediente.nombre}</span>
			</a>
			<span class="h-4 w-px shrink-0 bg-border" aria-hidden="true"></span>
			<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
				<FolderTree class="size-4" />
			</span>
			<div class="min-w-0">
				<h2 class="truncate text-sm font-medium text-foreground" data-testid="virtual-detalle-nombre" title={v.nombre}>{v.nombre}</h2>
				<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span class="rounded-sm border border-primary/20 bg-primary/10 px-2 py-0.5 font-medium text-primary" data-testid="virtual-detalle-tipo">{v.tipo.nombre}</span>
					<span data-testid="virtual-detalle-total">
						{data.puedeOrganizar ? documentosDelVirtual(v.documentos.length, data.documentosDelExpediente.length) : `${v.documentos.length} ${v.documentos.length === 1 ? 'documento' : 'documentos'}`}
					</span>
				</div>
			</div>
		</div>

		{#if data.puedeOrganizar}
			<div class="flex flex-wrap items-center gap-2">
				<Button
					data-testid="agregar-documentos-al-virtual"
					disabled={disponibles.length === 0}
					title={disponibles.length === 0 ? 'Ya están todos los documentos del expediente' : undefined}
					onclick={() => {
						aviso = null;
						elegidos = [];
						errorAgregar = '';
						agregarAbierto = true;
					}}
				>
					<FilePlus class="size-4" />
					Agregar documentos
				</Button>
				<Button variant="ghost" class="text-destructive hover:bg-destructive/10 hover:text-destructive" data-testid="borrar-expediente-virtual" onclick={() => (confirmarBorrado = true)}>
					<Trash2 class="size-4" />
					Borrar
				</Button>
			</div>
		{/if}
	</div>

	<p class="mt-2 px-1 text-xs text-muted-foreground" data-testid="virtual-esquema">
		{#if v.tipo.tiposDocumentales.length === 0}
			Su tipo no tiene esquema.
		{:else}
			El tipo «{v.tipo.nombre}» lleva: {v.tipo.tiposDocumentales.map((t) => t.nombre).join(', ')}.
		{/if}
	</p>

	{#if error}
		<p class="mt-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert" data-testid="error-virtual">{error}</p>
	{/if}

	{#if v.documentos.length === 0}
		<div class="flex flex-col items-center gap-2 py-20 text-center" data-testid="virtual-sin-documentos">
			<h3 class="text-xl font-semibold text-foreground">Este expediente virtual todavía no tiene documentos</h3>
			<p class="max-w-xl text-sm text-muted-foreground">
				{#if data.puedeOrganizar}
					Usa «Agregar documentos» para elegir cuáles de «{v.expediente.nombre}» forman parte de él.
				{:else}
					Cuando se le agreguen documentos de «{v.expediente.nombre}», aparecerán aquí.
				{/if}
			</p>
		</div>
	{:else}
		<ul class="mt-3 flex flex-wrap gap-3" data-testid="documentos-del-virtual">
			{#each v.documentos as documento (documento.id)}
				<li>
					<TarjetaDocumento
						{documento}
						alQuitar={data.puedeOrganizar ? () => quitar(documento.id, documento.nombreOriginal) : undefined}
						quitando={quitando === documento.id}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<DialogPrimitive.Root bind:open={agregarAbierto}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-agregar-al-virtual"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">{v.expediente.nombre} / {v.nombre}</p>
				<button type="button" class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground" onclick={() => (agregarAbierto = false)}>
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</button>
			</div>
			<div class="flex h-16 shrink-0 items-center gap-3">
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"><FilePlus class="size-4" /></span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">Agregar documentos</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
						Los documentos de «{v.expediente.nombre}» que todavía no están en «{v.nombre}».
					</DialogPrimitive.Description>
				</div>
			</div>
			<div class="flex flex-col gap-3 px-4 py-4">
				<span id="etiqueta-agregar-al-virtual" class="sr-only">Documentos del expediente</span>
				<ElegirDocumentos documentos={disponibles} bind:elegidos etiquetaId="etiqueta-agregar-al-virtual" />
				{#if errorAgregar}
					<p class="text-xs text-destructive" role="alert" data-testid="error-agregar-al-virtual">{errorAgregar}</p>
				{/if}
			</div>
			<div class="flex items-center justify-end gap-4 border-t border-border p-2.5">
				<Button type="button" variant="link" class="h-9.5 px-4 text-destructive" onclick={() => (agregarAbierto = false)}>Cancelar</Button>
				<Button type="button" class="h-9.5 px-4" data-testid="confirmar-agregar-al-virtual" disabled={elegidos.length === 0 || agregando} onclick={agregar}>
					{agregando ? 'Agregando…' : elegidos.length > 1 ? `Agregar ${elegidos.length} documentos` : 'Agregar documento'}
				</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>

<ConfirmarAccion
	abierto={confirmarBorrado}
	titulo="Borrar el expediente virtual"
	mensaje={`«${v.nombre}» se borrará. Sus documentos NO se borran: siguen en «${v.expediente.nombre}».`}
	etiquetaConfirmar="Borrar"
	onConfirmar={() => void borrar()}
	onCerrar={() => (confirmarBorrado = false)}
/>
