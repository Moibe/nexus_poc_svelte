<script lang="ts">
	/**
	 * Expediente · un expediente abierto (2026-10-24, Figma Sprint 5 HUN2, detalle `5397:104132`): «Atrás», el nombre del expediente con
	 * el total de archivos, buscador y «Ordenar», y una tarjeta por documento. Cuelga del listado de `/expediente`.
	 *
	 * Un expediente vacío se dice como tal. El diseño no trae ese estado; se hizo con el mismo lenguaje del estado vacío del listado y
	 * con el botón «Subir archivos» para quien organiza (hasta el 2026-10-30 no prometía una forma de agregar documentos, porque no existía).
	 *
	 * Lo que se aparta del diseño: el encabezado lleva el NOMBRE del expediente y no un folio. Los documentos no traen páginas; el tipo
	 * documental sí lo traen desde la migración 0007 (ver `TarjetaDocumento`).
	 *
	 * **Sin expedientes virtuales (2026-11-05, decisión de Moibe).** El expediente es el receptáculo de sus documentos (no tiene tipo desde el
	 * 2026-10-29) y hasta ayer debajo de ellos iba una sección con sus «expedientes virtuales»: grupitos de esos documentos con un tipo, para
	 * el motor de reglas, con su pantalla `/expediente/[id]/virtual/[vid]`. Moibe los quitó («ahora podremos meter el expediente completo a la
	 * ejecución de un proceso»): la página vuelve a ser solo el encabezado y los documentos, y el proceso corre sobre el expediente entero.
	 *
	 * **Duplicados (2026-11-03, Moibe; del expediente entero desde el 2026-11-05).** Si el expediente trae DOS O MÁS documentos de un mismo tipo
	 * documental no se sabe cuál es «el INE»: un proceso que use ese tipo no se ejecuta sobre el expediente mientras haya más de uno. Se dice en
	 * tres lugares, todos calculados por nexus_back al leer (sacar uno los apaga): la insignia ámbar «Duplicados» del encabezado, un aviso que lista
	 * cada tipo repetido con sus documentos y la marca «Duplicado de «tipo»» en la tarjeta de cada uno (`TarjetaDocumento`). Es solo una marca:
	 * no impide nada, y los duplicados de un tipo que el proceso no usa no estorban a su corrida.
	 *
	 * **Subir archivos (2026-10-30, pedido de Moibe: «al picar un expediente, poderle subir archivos»).** El botón «Subir archivos» del
	 * encabezado (solo para quien organiza: Administrador, Supervisor, Analista y Operador) abre `SubirArchivosModal`: se arrastran o se eligen
	 * archivos y se suben a ESTE expediente como documentos de la organización (carga manual, salen también en «Archivos procesados»). Al cerrar
	 * la ventana, la página se pone al día y dice cuántos entraron. Los DUPLICADOS de lo que se sube (mismo contenido que algo que ya está en el
	 * expediente o que otro archivo de la misma tanda) se avisan en la ventana y no se suben salvo que la persona lo decida (2026-11-02).
	 *
	 * **El clasificador (2026-11-02, Moibe: «los dos clasifican»; sin confianza mínima: basta con ser de ese tipo).** Cada archivo se CLASIFICA al
	 * subirlo (ya no queda sin tipo): la tarjeta dice su tipo, y por ese tipo lo encuentran los procesos del motor de reglas. La ventana de
	 * subir dice la regla y cómo le fue a cada archivo.
	 *
	 * **Sin grupos (2026-11-06, decisión de Moibe).** Del 2026-11-03 al 2026-11-06 el encabezado decía en qué GRUPO vivía el expediente («Sin
	 * grupo» si era de antes) y quien organiza lo asignaba o lo cambiaba con un botón. Moibe quitó los grupos «en aras de la simplicidad»: el
	 * encabezado vuelve a decir solo el nombre y el total de archivos.
	 *
	 * **Quitar un documento (2026-11-04, Moibe: «que un archivo pueda ser borrado de un expediente»).** Quien organiza tiene «Quitar» en cada
	 * tarjeta. Pregunta antes con la confirmación de la casa (`ConfirmarAccion`). Sacarlo NO borra el archivo: sigue siendo de la organización
	 * (en Archivos procesados) y en otros expedientes donde esté; si era el único, vuelve al void. El historial de Ejecuciones no cambia.
	 */
	import { invalidateAll } from '$app/navigation';
	import Folder from '@lucide/svelte/icons/folder';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Upload from '@lucide/svelte/icons/upload';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import DatosExtraidosModal from '$lib/components/expedientes/DatosExtraidosModal.svelte';
	import OrdenarMenu from '$lib/components/expedientes/OrdenarMenu.svelte';
	import SubirArchivosModal from '$lib/components/expedientes/SubirArchivosModal.svelte';
	import TarjetaDocumento from '$lib/components/expedientes/TarjetaDocumento.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';
	import {
		normalizar,
		OPCIONES_ORDEN_DOCUMENTOS,
		ordenarDocumentos,
		type DocumentoDeExpediente,
		type OrdenDocumentos
	} from '$lib/expedientes/expedientes';
	import { avisoDeSubida } from '$lib/expedientes/subida';

	let { data } = $props();

	const expediente = $derived(data.expediente);
	/** Los tipos documentales de los que el expediente trae DOS O MÁS documentos (los marca nexus_back al leer). */
	const duplicados = $derived(expediente.duplicados);

	let busqueda = $state('');
	let orden = $state<OrdenDocumentos>('recientes');
	let subida = $state(false);
	/** El documento cuyos datos (JSON) se están viendo (2026-11-06). */
	let datosDe = $state<{ id: string; nombre: string; vista?: 'campos' | 'json'; contexto?: string } | null>(null);
	let aviso = $state<{ testid: string; titulo: string; cuerpo: string } | null>(null);
	let error = $state('');
	/** El documento que se va a quitar, mientras la confirmación está abierta. */
	let aQuitar = $state<DocumentoDeExpediente | null>(null);
	/** El que se está quitando (su botón gira). */
	let quitando = $state<string | null>(null);

	async function quitar(documento: DocumentoDeExpediente) {
		if (quitando) return;
		quitando = documento.id;
		aviso = null;
		error = '';
		try {
			const r = await fetch(
				`/api/expedientes/${encodeURIComponent(expediente.id)}/documentos/${encodeURIComponent(documento.id)}`,
				{ method: 'DELETE' }
			);
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = `No se pudo quitar «${documento.nombreOriginal}»: ${mensajeDeFallo(datos, r.status, 'al quitar')}`;
				// Si ya no estaba (otra persona lo quitó), la página se pone al día para que deje de mostrarlo.
				if (r.status === 404) await invalidateAll();
				return;
			}
			// El documento YA salió: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
			aviso = {
				testid: 'documento-quitado-del-expediente',
				titulo: 'Documento quitado',
				cuerpo: `«${documento.nombreOriginal}» ya no está en «${expediente.nombre}». El archivo no se borró: sigue en Archivos procesados.`
			};
			await invalidateAll();
		} catch {
			error = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		} finally {
			quitando = null;
		}
	}

	const visibles = $derived.by(() => {
		const q = normalizar(busqueda);
		const coinciden = q ? expediente.documentos.filter((d) => normalizar(d.nombreOriginal).includes(q)) : expediente.documentos;
		return ordenarDocumentos(coinciden, orden);
	});
</script>

<svelte:head><title>Biblioratum — {expediente.nombre}</title></svelte:head>

<div role="status" aria-live="polite">
	{#if aviso}
		<div class="mb-4"><AvisoVerde testid={aviso.testid} titulo={aviso.titulo} cuerpo={aviso.cuerpo} /></div>
	{/if}
</div>

<div class="rounded-2xl border-2 border-border bg-card p-3">
	<div class="flex min-h-12.5 flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<a
				href="/expediente"
				data-testid="volver-a-expedientes"
				class="flex shrink-0 items-center gap-2 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				<Undo2 class="size-6 text-primary" />
				Atrás
			</a>
			<span class="h-4 w-px shrink-0 bg-border" aria-hidden="true"></span>
			<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
				<Folder class="size-4" />
			</span>
			<div class="min-w-0">
				<h2 class="truncate text-sm font-medium text-foreground" data-testid="expediente-detalle-nombre" title={expediente.nombre}>
					{expediente.nombre}
				</h2>
				<div class="flex items-center gap-1 text-xs text-muted-foreground">
					<span
						class="flex size-4.25 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-medium text-primary"
						data-testid="total-documentos">{expediente.documentos.length}</span
					>
					<span class="shrink-0">Total de archivos</span>
					<!-- Duplicados (2026-11-03; del expediente entero desde el 2026-11-05): documentos de un mismo tipo. El aviso de abajo dice cuáles. -->
					{#if duplicados.length > 0}
						<span class="mx-1 h-3 w-px shrink-0 bg-border" aria-hidden="true"></span>
						<span
							class="inline-flex shrink-0 items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-400"
							data-testid="expediente-con-duplicados"
							title="Trae documentos duplicados de: {duplicados.map((d) => d.tipoNombre ?? 'un tipo eliminado').join(', ')}"
						>
							<TriangleAlert class="size-3" />
							Duplicados
						</span>
					{/if}
				</div>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if expediente.documentos.length > 0}
				<div class="flex h-9 w-58.5 items-center gap-3 rounded-lg border border-border bg-background px-3">
					<SearchIcon />
					<input
						type="search"
						placeholder="Buscar documento"
						aria-label="Buscar documento"
						bind:value={busqueda}
						data-testid="buscar-documento"
						class="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
					/>
				</div>
				<span class="h-9 w-px bg-border" aria-hidden="true"></span>
				<OrdenarMenu valor={orden} opciones={OPCIONES_ORDEN_DOCUMENTOS} alCambiar={(valor) => (orden = valor)} testid="ordenar-documentos" />
			{/if}
			<!-- Subir archivos a ESTE expediente (2026-10-30): solo quien organiza. Va aquí y no dentro del bloque de arriba porque un expediente
			     vacío es justo donde más hace falta. -->
			{#if data.puedeOrganizar}
				{#if expediente.documentos.length > 0}
					<span class="h-9.5 w-px bg-border" aria-hidden="true"></span>
				{/if}
				<Button
					data-testid="subir-archivos-expediente"
					onclick={() => {
						aviso = null;
						subida = true;
					}}
				>
					<Upload class="size-4" />
					Subir archivos
				</Button>
			{/if}
		</div>
	</div>

	<!-- Duplicados (Moibe, 2026-11-03; del expediente entero desde el 2026-11-05): dos o más documentos del mismo tipo. No se sabe cuál es «el INE»,
	     así que un proceso que use ese tipo NO se ejecuta sobre el expediente mientras haya más de uno; las tarjetas de esos documentos llevan
	     «Duplicado». Se calcula al leer: al quitar uno desaparece el aviso. -->
	{#if duplicados.length > 0}
		<div
			class="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
			role="status"
			data-testid="duplicados-del-expediente"
		>
			<TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
			<div>
				<p class="font-medium">Este expediente trae documentos duplicados</p>
				<ul class="mt-0.5 list-disc pl-4">
					{#each duplicados as d (d.tipoId)}
						<li data-testid="duplicado-del-expediente" data-tipo={d.tipoId}>
							<span class="font-medium">{d.tipoNombre ?? 'Tipo documental eliminado'}</span>: {d.documentos.map((x) => x.nombre ?? 'sin nombre').join(', ')}
						</li>
					{/each}
				</ul>
				<p class="mt-1">
					No se sabe cuál usar, así que un proceso que use alguno de esos tipos no se ejecuta sobre este expediente mientras haya más de un documento de ese tipo.
					{#if data.puedeOrganizar}
						Quita los que sobren y deja uno de cada tipo.
					{:else}
						Quien organiza el expediente puede quitar los que sobren.
					{/if}
				</p>
			</div>
		</div>
	{/if}

	{#if error}
		<p class="mt-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert" data-testid="error-expediente">{error}</p>
	{/if}

	{#if expediente.documentos.length === 0}
		<div class="flex flex-col items-center gap-2 py-24 text-center" data-testid="expediente-sin-documentos">
			<h3 class="text-2xl font-semibold text-foreground">Este expediente todavía no tiene documentos</h3>
			{#if data.puedeOrganizar}
				<p class="max-w-xl text-base text-muted-foreground">Sube archivos a «{expediente.nombre}» con el botón «Subir archivos»; aparecerán aquí.</p>
			{:else}
				<p class="max-w-xl text-base text-muted-foreground">Cuando se agreguen documentos a «{expediente.nombre}», aparecerán aquí.</p>
			{/if}
		</div>
	{:else if visibles.length === 0}
		<p class="py-16 text-center text-sm text-muted-foreground" data-testid="documentos-sin-resultados">
			No encontramos documentos con «{busqueda.trim()}». Revisa el nombre e intenta de nuevo.
		</p>
	{:else}
		<ul class="mt-3 flex flex-wrap gap-3" data-testid="lista-documentos">
			{#each visibles as documento (documento.id)}
				<li>
					<TarjetaDocumento
						{documento}
						alVerDatos={() => (datosDe = { id: documento.id, nombre: documento.nombreOriginal, vista: 'json', contexto: expediente.nombre })}
						alQuitar={data.puedeOrganizar
							? () => {
									aviso = null;
									error = '';
									aQuitar = documento;
								}
							: undefined}
						quitando={quitando === documento.id}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<DatosExtraidosModal bind:documento={datosDe} />

<!-- Antes de sacar un documento del expediente: dice que el archivo NO se borra. -->
<ConfirmarAccion
	abierto={aQuitar !== null}
	titulo="Quitar el documento del expediente"
	mensaje={aQuitar ? `«${aQuitar.nombreOriginal}» saldrá de «${expediente.nombre}». El archivo no se borra: sigue en Archivos procesados.` : ''}
	etiquetaConfirmar="Quitar"
	onConfirmar={() => {
		const documento = aQuitar;
		if (documento) void quitar(documento);
	}}
	onCerrar={() => (aQuitar = null)}
/>

<SubirArchivosModal
	bind:open={subida}
	expediente={{ id: expediente.id, nombre: expediente.nombre }}
	existentes={expediente.documentos.map((d) => ({ nombre: d.nombreOriginal, sha256: d.sha256 }))}
	alTerminar={async ({ subidos, fallidos, omitidos }) => {
		// Los archivos YA entraron: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		const dicho = avisoDeSubida(expediente.nombre, subidos, fallidos, omitidos);
		if (dicho) aviso = { testid: 'archivos-subidos-aviso', ...dicho };
		await invalidateAll();
	}}
/>
