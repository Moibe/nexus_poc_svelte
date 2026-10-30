<script lang="ts">
	/**
	 * «Agregar a expediente» de Archivos procesados (2026-10-29, Figma Sprint 5, HUN2: frames `5387:100666`, `5397:102082` y el
	 * buscador `5330:97167`). Se abre desde la barra flotante cuando hay documentos elegidos: arriba el buscador, luego los documentos
	 * que se van a agregar (con el expediente en que ya están, o «Sin expediente») y abajo todos los expedientes de la organización,
	 * cada uno con su botón.
	 *
	 * Lo que se aparta del diseño, a propósito (el Figma es solo el look and feel):
	 *   · El diseño dice «Mover». En Biblioratum un documento puede estar en VARIOS expedientes, así que esto AGREGA: no lo saca de los
	 *     que ya tenía. Por eso el botón dice «Agregar».
	 *   · Los expedientes se identifican por su nombre (no hay folio) y el buscador busca también por tipo.
	 *   · Solo se ofrecen expedientes que existen (los que el servidor listó); si uno se borró mientras tanto, el servidor responde 404 y
	 *     se dice aquí.
	 */
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import X from '@lucide/svelte/icons/x';

	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { formatearTamano, formatoDe, normalizar, type DocumentoDeExpediente, type Expediente } from '$lib/expedientes/expedientes';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';

	type Documento = DocumentoDeExpediente & { expedientes: { id: string; nombre: string }[] };
	export type ResultadoAgregar = { expediente: Expediente; agregados: number; yaEstaban: number };

	let {
		documentos,
		expedientes,
		onCerrar,
		onAgregado
	}: {
		documentos: Documento[];
		expedientes: Expediente[];
		onCerrar: () => void;
		onAgregado: (r: ResultadoAgregar) => void;
	} = $props();

	let busqueda = $state('');
	let enviandoA = $state<string | null>(null);
	let error = $state('');

	const visibles = $derived.by(() => {
		const q = normalizar(busqueda);
		return q ? expedientes.filter((e) => normalizar(`${e.nombre} ${e.tipo?.nombre ?? ''}`).includes(q)) : expedientes;
	});
	/** ¿Todos los documentos elegidos ya están en este expediente? Entonces no hay nada que agregar. */
	const yaTieneTodos = (e: Expediente) => documentos.every((d) => d.expedientes.some((x) => x.id === e.id));
	const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

	async function agregarA(e: Expediente) {
		if (enviandoA) return;
		enviandoA = e.id;
		error = '';
		let agregados = 0;
		let yaEstaban = 0;
		try {
			for (const d of documentos) {
				const r = await fetch(`/api/expedientes/${encodeURIComponent(e.id)}/documentos/${encodeURIComponent(d.id)}`, { method: 'PUT' });
				const datos = await r.json().catch(() => null);
				if (!r.ok) {
					// Lo que ya entró, entró: se dice cuántos y qué falló, y la pantalla se refresca igual.
					const hechos = agregados + yaEstaban;
					error = `${hechos ? `Se agregaron ${hechos} de ${documentos.length}. ` : ''}No se pudo agregar «${d.nombreOriginal}»: ${mensajeDeFallo(datos, r.status, 'al agregar')}`;
					if (hechos) onAgregado({ expediente: e, agregados, yaEstaban });
					return;
				}
				if (datos?.agregado) agregados += 1;
				else yaEstaban += 1;
			}
			onAgregado({ expediente: e, agregados, yaEstaban });
		} catch {
			error = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		} finally {
			enviandoA = null;
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !enviandoA && onCerrar()} />

<div
	class="pointer-events-auto w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
	role="dialog"
	aria-label="Agregar a expediente"
	data-testid="agregar-a-expediente"
>
	<div class="flex items-center gap-3 border-b border-border px-4 py-3">
		<SearchIcon />
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="search"
			autofocus
			placeholder="Busca por nombre de expediente"
			aria-label="Busca por nombre de expediente"
			bind:value={busqueda}
			data-testid="buscar-expediente-destino"
			class="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
		/>
		<button type="button" aria-label="Cerrar" class="text-muted-foreground hover:text-foreground" onclick={onCerrar}>
			<X class="size-4" />
		</button>
	</div>

	<div class="max-h-[min(28rem,60vh)] overflow-y-auto">
		<p class="px-4 pt-3 text-xs text-muted-foreground">{documentos.length === 1 ? 'Documento a agregar' : `Documentos a agregar (${documentos.length})`}</p>
		<ul class="px-2 pb-2">
			{#each documentos as d (d.id)}
				<li class="flex items-center gap-3 rounded-lg px-2 py-2" data-testid="documento-a-agregar">
					<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><FileIcon /></span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-foreground" title={d.nombreOriginal}>{d.nombreOriginal}</p>
						<p class="text-xs text-muted-foreground">{formatoDe(d)} | {formatearTamano(d.tamanoBytes)}</p>
					</div>
					<span
						class="max-w-40 shrink-0 truncate rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
						title={d.expedientes.map((x) => x.nombre).join(', ') || 'Sin expediente'}
						>{d.expedientes.length === 0 ? 'Sin expediente' : d.expedientes.length === 1 ? d.expedientes[0].nombre : `${d.expedientes[0].nombre} +${d.expedientes.length - 1}`}</span
					>
				</li>
			{/each}
		</ul>

		<p class="border-t border-border px-4 pt-3 text-xs text-muted-foreground">
			Todos los expedientes <span class="mx-1 text-border">|</span> Expedientes ({visibles.length})
		</p>
		{#if expedientes.length === 0}
			<p class="px-4 py-6 text-center text-sm text-muted-foreground" data-testid="sin-expedientes-destino">
				Todavía no hay expedientes. Crea uno en <a href="/expediente" class="text-primary underline-offset-2 hover:underline">Expedientes</a> y vuelve a
				intentarlo.
			</p>
		{:else if visibles.length === 0}
			<p class="px-4 py-6 text-center text-sm text-muted-foreground" data-testid="expedientes-destino-sin-resultados">
				No encontramos expedientes con la información ingresada, verifica los datos o intenta nuevamente.
			</p>
		{:else}
			<ul class="px-2 pb-2">
				{#each visibles as e (e.id)}
					{@const completo = yaTieneTodos(e)}
					<li class="flex items-center gap-3 rounded-lg px-2 py-2" data-testid="expediente-destino">
						<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><FolderOpen class="size-4" /></span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-foreground" title={e.nombre} data-testid="expediente-destino-nombre">{e.nombre}</p>
							<p class="truncate text-xs text-muted-foreground">
								{e.totalDocumentos === 1 ? '1 Archivo' : `${e.totalDocumentos} Archivos`} · {formatearTamano(e.tamanoBytes ?? 0)} | Creado: {fecha(e.creadoEn)}
							</p>
						</div>
						{#if completo}
							<span class="shrink-0 text-xs text-muted-foreground" data-testid="expediente-destino-ya-esta">Ya está</span>
						{:else}
							<button
								type="button"
								class="flex shrink-0 items-center gap-1 text-sm text-primary underline underline-offset-2 hover:text-primary/80 disabled:opacity-50"
								disabled={enviandoA !== null}
								onclick={() => agregarA(e)}
								data-testid="agregar-a-este"
							>
								{#if enviandoA === e.id}<LoaderCircle class="size-3.5 animate-spin" />{/if}
								Agregar
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if error}
		<p class="border-t border-border bg-destructive/5 px-4 py-2.5 text-xs text-destructive" role="alert" data-testid="agregar-error">{error}</p>
	{/if}
</div>
