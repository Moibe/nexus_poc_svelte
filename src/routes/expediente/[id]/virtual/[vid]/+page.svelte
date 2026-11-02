<script lang="ts">
	/**
	 * Expediente · un expediente VIRTUAL abierto (2026-10-29, decisión de Moibe): un grupito de documentos de un expediente, instancia de un
	 * tipo («la solicitud de crédito de Juan Pérez»). Con el mismo lenguaje del expediente abierto: «Atrás» (a su expediente), el nombre con
	 * su tipo, el ESQUEMA del tipo (qué tipos documentales lleva: describe, no restringe) y una tarjeta por documento.
	 *
	 * **Los documentos entran SOLOS (2026-11-02, Moibe: «el botón de agregar documentos no debería existir, los documentos se agregan
	 * automáticamente al expediente virtual si son del tipo que pide»).** Aquí no se agrega nada a mano: el clasificador mete a todos los
	 * expedientes virtuales que lo esperan el documento que reconoce como de alguno de los tipos del esquema, de cualquier confianza (primero se
	 * pidió un mínimo de 75% y se quitó: «pasa simplemente por ser de ese tipo»). La tarjeta lo dice («Agregado por el clasificador») y la nota
	 * bajo el esquema cuenta la regla. Un virtual no recibe archivos propios: si el expediente no tiene documentos, la pantalla manda a subirlos
	 * al expediente.
	 *
	 * Quien organiza puede:
	 *   · «Quitar» uno: sale del grupito, NO del expediente (y no vuelve a entrar solo);
	 *   · «Borrar expediente virtual»: con la confirmación de la casa (`ConfirmarAccion`); no borra documentos, y regresa al expediente.
	 * No hay diseño para esta pantalla en el Figma.
	 */
	import { goto, invalidateAll } from '$app/navigation';
	import FolderTree from '@lucide/svelte/icons/folder-tree';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import TarjetaDocumento from '$lib/components/expedientes/TarjetaDocumento.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { notaDeVirtual } from '$lib/expedientes/clasificador';
	import { documentosDelVirtual } from '$lib/expedientes/expedientes';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';

	let { data } = $props();

	const v = $derived(data.virtual);
	const base = $derived(`/api/expedientes/${encodeURIComponent(v.expediente.id)}/virtuales/${encodeURIComponent(v.id)}`);
	/**
	 * El expediente no tiene NINGÚN documento: un virtual no recibe archivos propios, se llena con los del expediente, así que lo que hace falta
	 * es subirlos al expediente primero (la pantalla lo dice y manda allá).
	 */
	const expedienteVacio = $derived(data.documentosDelExpediente.length === 0);

	let aviso = $state<{ testid: string; titulo: string; cuerpo: string } | null>(null);
	let error = $state('');
	let quitando = $state<string | null>(null);
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
			El tipo «{v.tipo.nombre}» lleva:
			<!-- Desde la migración 0007 los documentos guardan su tipo documental: cada tipo del esquema dice si algún documento lo cubre. -->
			{#each v.tipo.tiposDocumentales as t, i (t.id)}
				<span class={t.documentos === undefined ? '' : t.documentos.length ? 'text-green-700' : 'text-red-700'} data-testid="esquema-tipo"
					>{t.nombre}{#if t.documentos !== undefined}&nbsp;{t.documentos.length ? '✓' : '(falta)'}{/if}</span
				>{i < v.tipo.tiposDocumentales.length - 1 ? ', ' : '.'}
			{/each}
		{/if}
	</p>

	<!-- Lo que el clasificador hace solo con este virtual, dicho con su mínimo (2026-11-02): el número llega de la API, no se copia aquí. -->
	{#if v.tipo.tiposDocumentales.length > 0}
		<p class="mt-1 flex items-start gap-1.5 px-1 text-xs text-muted-foreground" data-testid="virtual-nota-clasificador">
			<Sparkles class="mt-0.5 size-3.5 shrink-0 text-primary" />
			<span>{notaDeVirtual()}</span>
		</p>
	{/if}

	<!-- Los procesos del motor de reglas ligados a su tipo (2026-10-29): los que le aplican. Los documentos ya guardan su tipo documental y
	     sus datos extraídos (migración 0007), que es lo que las reglas comparan; falta el motor que los corra sobre él. -->
	<div class="mt-1 flex flex-wrap items-center gap-1.5 px-1 text-xs text-muted-foreground" data-testid="virtual-procesos">
		{#if (v.procesos ?? []).length === 0}
			Ningún proceso del motor de reglas corre todavía sobre el tipo «{v.tipo.nombre}».
		{:else}
			<span>Procesos que le aplican:</span>
			{#each v.procesos ?? [] as pr (pr.id)}
				{#if data.puedeAdministrar}
					<a
						href={`/motor-de-reglas/${pr.id}`}
						class="rounded-sm border border-border bg-secondary px-2 py-0.5 text-foreground hover:border-primary/40"
						data-testid="virtual-proceso">{pr.nombre}{pr.activo ? '' : ' (inactivo)'}</a
					>
				{:else}
					<span class="rounded-sm border border-border bg-secondary px-2 py-0.5 text-foreground" data-testid="virtual-proceso">{pr.nombre}{pr.activo ? '' : ' (inactivo)'}</span>
				{/if}
			{/each}
			<span>· todavía no se corren sobre sus documentos.</span>
		{/if}
	</div>

	{#if error}
		<p class="mt-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert" data-testid="error-virtual">{error}</p>
	{/if}

	{#if v.documentos.length === 0}
		<div class="flex flex-col items-center gap-2 py-20 text-center" data-testid="virtual-sin-documentos">
			<h3 class="text-xl font-semibold text-foreground">Este expediente virtual todavía no tiene documentos</h3>
			<p class="max-w-xl text-sm text-muted-foreground">
				<!-- Nada se agrega a mano: los documentos entran solos cuando el clasificador los reconoce. Solo quien organiza recibe `documentosDelExpediente`, así que
				     «el expediente está vacío» solo se afirma para esa persona. -->
				{#if data.puedeOrganizar && expedienteVacio}
					«{v.expediente.nombre}» todavía no tiene documentos. Primero
					<a
						href={`/expediente/${encodeURIComponent(v.expediente.id)}`}
						class="text-primary underline-offset-2 hover:underline"
						data-testid="ir-al-expediente-para-subir">súbele archivos desde el expediente</a
					>: los que el clasificador reconozca como de alguno de los tipos de este expediente virtual entrarán solos.
				{:else}
					Los documentos de «{v.expediente.nombre}» que el clasificador reconozca como de alguno de los tipos de este expediente virtual entrarán solos.
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

<ConfirmarAccion
	abierto={confirmarBorrado}
	titulo="Borrar el expediente virtual"
	mensaje={`«${v.nombre}» se borrará. Sus documentos NO se borran: siguen en «${v.expediente.nombre}».`}
	etiquetaConfirmar="Borrar"
	onConfirmar={() => void borrar()}
	onCerrar={() => (confirmarBorrado = false)}
/>
