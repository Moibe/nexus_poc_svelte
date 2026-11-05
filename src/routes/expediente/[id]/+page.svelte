<script lang="ts">
	/**
	 * Expediente · un expediente abierto (2026-10-24, Figma Sprint 5 HUN2, detalle `5397:104132`): «Atrás», el nombre del expediente con
	 * el total de archivos, buscador y «Ordenar», y una tarjeta por documento. Cuelga de la pestaña «Expedientes» de `/expediente`.
	 *
	 * Un expediente vacío se dice como tal. El diseño no trae ese estado; se hizo con el mismo lenguaje del estado vacío del listado y
	 * con el botón «Subir archivos» para quien organiza (hasta el 2026-10-30 no prometía una forma de agregar documentos, porque no existía).
	 *
	 * Lo que se aparta del diseño: el encabezado lleva el NOMBRE del expediente y no un folio. Los documentos no traen páginas; el tipo
	 * documental sí lo traen desde la migración 0007 (ver `TarjetaDocumento`).
	 *
	 * **Expedientes virtuales (2026-10-29, decisión de Moibe).** El expediente dejó de tener tipo: es el receptáculo. Debajo de sus
	 * documentos van sus expedientes virtuales, grupitos de esos documentos que son instancia de un tipo («la solicitud de crédito de
	 * Juan Pérez»), cada uno con su tipo y cuántos de los documentos del expediente tiene; se abren en `/expediente/[id]/virtual/[vid]`.
	 * Quien organiza crea uno con «Nuevo expediente virtual» (`ExpedienteVirtualModal`). No hay diseño para esto en el Figma: se hizo con
	 * el lenguaje de esta misma pantalla.
	 *
	 * **Subir archivos (2026-10-30, pedido de Moibe: «al picar un expediente, poderle subir archivos»).** El botón «Subir archivos» del
	 * encabezado (solo para quien organiza: Administrador, Supervisor, Analista y Operador) abre `SubirArchivosModal`: se arrastran o se eligen
	 * archivos y se suben a ESTE expediente como documentos de la organización (carga manual, salen también en «Archivos procesados»). Al cerrar
	 * la ventana, la página se pone al día y dice cuántos entraron. Los DUPLICADOS (mismo contenido que algo que ya está en el expediente o que
	 * otro archivo de la misma tanda) se avisan en la ventana y no se suben salvo que la persona lo decida (2026-11-02).
	 *
	 * **El clasificador (2026-11-02, Moibe: «los dos clasifican»; sin confianza mínima: basta con ser de ese tipo).** Cada archivo se CLASIFICA al
	 * subirlo (ya no queda sin tipo): la tarjeta dice su tipo y, si el clasificador lo reconoce como de un tipo, entra solo a los expedientes
	 * virtuales de este expediente que esperan ese tipo, a todos los que haya. La ventana de subir dice la regla, y el aviso de la página cuenta
	 * cuántos archivos metió el clasificador.
	 *
	 * **Grupo (2026-11-03, decisión de Moibe).** El expediente vive en un grupo (áreas, departamentos, trimestres… como lo llame cada
	 * organización): el encabezado lo dice, o dice «Sin grupo» si es de antes de los grupos. Quien organiza lo asigna o lo cambia con el botón de
	 * al lado (`AsignarGrupoModal`): un expediente se puede pasar de un grupo a otro, pero no dejar sin grupo.
	 *
	 * **Quitar un documento (2026-11-04, Moibe: «que un archivo pueda ser borrado de un expediente»).** Quien organiza tiene «Quitar» en cada
	 * tarjeta. Pregunta antes con la confirmación de la casa (`ConfirmarAccion`), que nombra los expedientes virtuales de los que también saldría.
	 * Sacarlo NO borra el archivo: sigue siendo de la organización (en Archivos procesados) y en otros expedientes donde esté; si era el único,
	 * vuelve al void. Lo saca también de los virtuales de este expediente (lo hace nexus_back). El historial de Ejecuciones no cambia.
	 */
	import { invalidateAll } from '$app/navigation';
	import Folder from '@lucide/svelte/icons/folder';
	import FolderTree from '@lucide/svelte/icons/folder-tree';
	import Layers from '@lucide/svelte/icons/layers';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Upload from '@lucide/svelte/icons/upload';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import AsignarGrupoModal from '$lib/components/expedientes/AsignarGrupoModal.svelte';
	import ExpedienteVirtualModal from '$lib/components/expedientes/ExpedienteVirtualModal.svelte';
	import OrdenarMenu from '$lib/components/expedientes/OrdenarMenu.svelte';
	import SubirArchivosModal from '$lib/components/expedientes/SubirArchivosModal.svelte';
	import TarjetaDocumento from '$lib/components/expedientes/TarjetaDocumento.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';
	import {
		documentosDelVirtual,
		normalizar,
		OPCIONES_ORDEN_DOCUMENTOS,
		ordenarDocumentos,
		type DocumentoDeExpediente,
		type OrdenDocumentos
	} from '$lib/expedientes/expedientes';
	import { avisoDeSubida } from '$lib/expedientes/subida';

	let { data } = $props();

	const expediente = $derived(data.expediente);
	const virtuales = $derived(expediente.expedientesVirtuales ?? []);

	let busqueda = $state('');
	let orden = $state<OrdenDocumentos>('recientes');
	let altaVirtual = $state(false);
	let subida = $state(false);
	let asignandoGrupo = $state(false);
	let aviso = $state<{ testid: string; titulo: string; cuerpo: string } | null>(null);
	let error = $state('');
	/** El documento que se va a quitar, mientras la confirmación está abierta. */
	let aQuitar = $state<DocumentoDeExpediente | null>(null);
	/** El que se está quitando (su botón gira). */
	let quitando = $state<string | null>(null);

	/** Los expedientes virtuales de ESTE expediente que tienen ese documento: al sacarlo del expediente, sale también de ellos. */
	const virtualesCon = (documentoId: string) => virtuales.filter((v) => v.documentos.includes(documentoId));

	/** «A», «A» y «B», «A», «B» y «C». */
	const enLista = (nombres: string[]) => {
		const citados = nombres.map((n) => `«${n}»`);
		return citados.length < 2 ? (citados[0] ?? '') : `${citados.slice(0, -1).join(', ')} y ${citados.at(-1)}`;
	};

	/** Lo que se dice de los virtuales: «del expediente virtual «A»», «de los expedientes virtuales «A» y «B»». */
	const deLosVirtuales = (nombres: string[]) =>
		nombres.length === 1 ? `del expediente virtual ${enLista(nombres)}` : `de los expedientes virtuales ${enLista(nombres)}`;

	async function quitar(documento: DocumentoDeExpediente) {
		if (quitando) return;
		quitando = documento.id;
		aviso = null;
		error = '';
		// Se leen ANTES de quitarlo: después de recargar ya no estará en ninguno.
		const enVirtuales = virtualesCon(documento.id).map((v) => v.nombre);
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
			const tambien = enVirtuales.length > 0 ? ` También salió ${deLosVirtuales(enVirtuales)}.` : '';
			aviso = {
				testid: 'documento-quitado-del-expediente',
				titulo: 'Documento quitado',
				cuerpo: `«${documento.nombreOriginal}» ya no está en «${expediente.nombre}».${tambien} El archivo no se borró: sigue en Archivos procesados.`
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
					<span class="mx-1 h-3 w-px shrink-0 bg-border" aria-hidden="true"></span>
					<!-- El grupo en que vive. Los de antes de los grupos no tienen: se dice, y quien organiza puede asignárselo desde aquí. -->
					<span class="flex min-w-0 items-center gap-1" data-testid="expediente-detalle-grupo" data-con-grupo={expediente.grupo ? 'si' : 'no'}>
						<Layers class="size-3 shrink-0" aria-hidden="true" />
						<span class="truncate" title={expediente.grupo?.nombre ?? 'Sin grupo'}>{expediente.grupo?.nombre ?? 'Sin grupo'}</span>
						{#if data.puedeOrganizar}
							<button
								type="button"
								class="-my-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-primary transition-colors outline-none hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50"
								data-testid="cambiar-grupo-expediente"
								aria-label={expediente.grupo ? `Cambiar el grupo de «${expediente.nombre}»` : `Asignar un grupo a «${expediente.nombre}»`}
								onclick={() => {
									aviso = null;
									asignandoGrupo = true;
								}}
							>
								<Pencil class="size-3" aria-hidden="true" />
								{expediente.grupo ? 'Cambiar' : 'Asignar grupo'}
							</button>
						{/if}
					</span>
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
						alQuitar={data.puedeOrganizar
							? () => {
									aviso = null;
									error = '';
									aQuitar = documento;
								}
							: undefined}
						quitando={quitando === documento.id}
						ayudaQuitar={`Quitar «${documento.nombreOriginal}» de este expediente`}
						testidQuitar="quitar-del-expediente"
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<section class="mt-6 rounded-2xl border-2 border-border bg-card p-3" data-testid="seccion-expedientes-virtuales" aria-labelledby="titulo-virtuales">
	<div class="flex min-h-12.5 flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
				<FolderTree class="size-4" />
			</span>
			<div>
				<h3 id="titulo-virtuales" class="text-sm font-medium text-foreground">Expedientes virtuales</h3>
				<p class="flex items-center gap-1 text-xs text-muted-foreground">
					<span class="flex size-4.25 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-medium text-primary" data-testid="total-virtuales"
						>{virtuales.length}</span
					>
					Grupos de documentos de este expediente, cada uno de un tipo
				</p>
			</div>
		</div>
		{#if data.puedeOrganizar}
			<Button
				data-testid="nuevo-expediente-virtual"
				onclick={() => {
					aviso = null;
					altaVirtual = true;
				}}
			>
				<Plus class="size-4" />
				Nuevo expediente virtual
			</Button>
		{/if}
	</div>

	{#if virtuales.length === 0}
		<p class="px-2 py-8 text-center text-sm text-muted-foreground" data-testid="sin-expedientes-virtuales">
			Este expediente todavía no tiene expedientes virtuales. Un expediente virtual toma algunos de sus documentos —por ejemplo, los de una
			solicitud de crédito— para usarlos juntos en el motor de reglas.
		</p>
	{:else}
		<div class="mt-2 overflow-x-auto">
			<table class="w-full min-w-xl text-left text-sm" data-testid="tabla-expedientes-virtuales">
				<thead>
					<tr class="border-y border-border text-xs text-muted-foreground">
						<th class="py-2 pr-4 pl-2 font-normal">Expediente virtual</th>
						<th class="py-2 pr-4 font-normal">Tipo</th>
						<th class="py-2 pr-2 font-normal">Documentos</th>
					</tr>
				</thead>
				<tbody>
					{#each virtuales as v (v.id)}
						<tr class="relative border-b border-border transition-colors last:border-0 hover:bg-muted/50" data-testid="fila-expediente-virtual" data-virtual-id={v.id}>
							<td class="py-3 pr-4 pl-2">
								<a
									href={`/expediente/${expediente.id}/virtual/${v.id}`}
									class="block truncate font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
									data-testid="virtual-nombre"
									title={v.nombre}>{v.nombre}</a
								>
							</td>
							<td class="py-3 pr-4">
								<span
									class="inline-block max-w-full truncate rounded-sm border border-primary/20 bg-primary/10 px-2 py-0.5 align-middle text-xs font-medium text-primary"
									data-testid="virtual-tipo"
									title={v.tipo.nombre}>{v.tipo.nombre}</span
								>
							</td>
							<td class="py-3 pr-2 text-foreground tabular-nums" data-testid="virtual-documentos">
								{documentosDelVirtual(v.totalDocumentos, expediente.documentos.length)}
								<!-- Duplicados (2026-11-03): documentos de un mismo tipo dentro de este virtual; los procesos que usan ese tipo no se ejecutan sobre él. -->
								{#if (v.duplicados ?? []).length > 0}
									<span
										class="ml-2 inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-400"
										data-testid="virtual-con-duplicados"
										title="Trae documentos duplicados de: {(v.duplicados ?? []).map((d) => d.tipoNombre ?? 'un tipo eliminado').join(', ')}"
									>
										<TriangleAlert class="size-3" />
										Duplicados
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<ExpedienteVirtualModal
	bind:open={altaVirtual}
	expediente={{ id: expediente.id, nombre: expediente.nombre }}
	documentos={expediente.documentos}
	tipos={data.tiposVirtuales}
	puedeCrearTipo={data.puedeAdministrar}
	alCrear={async (v) => {
		// El virtual YA está guardado: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		const n = v.totalDocumentos;
		// Los que nacieron adentro porque el clasificador ya los había reconocido (no los marcó la persona).
		const solos = (v.documentos ?? []).filter((d) => d.agregadoPorClasificador).length;
		const delClasificador = solos > 0 ? ` ${solos} ${solos === 1 ? 'documento fue agregado' : 'documentos fueron agregados'} por el clasificador.` : '';
		aviso = {
			testid: 'expediente-virtual-creado-aviso',
			titulo: 'Expediente virtual creado',
			cuerpo: `«${v.nombre}» (${v.tipo.nombre}) quedó en «${expediente.nombre}» con ${n} ${n === 1 ? 'documento' : 'documentos'}.${delClasificador}`
		};
		await invalidateAll();
	}}
/>

<AsignarGrupoModal
	bind:open={asignandoGrupo}
	expediente={{ id: expediente.id, nombre: expediente.nombre, grupo: expediente.grupo }}
	grupos={data.grupos}
	gruposFallo={data.gruposFallo}
	puedeCrearGrupo={data.puedeAdministrar}
	alAsignar={async (grupo, cambiado) => {
		// El expediente YA está en ese grupo: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad. Si ya estaba ahí no hay
		// de qué avisar.
		if (cambiado) aviso = { testid: 'grupo-asignado-aviso', titulo: 'Grupo asignado', cuerpo: `«${expediente.nombre}» ahora está en el grupo «${grupo}».` };
		await invalidateAll();
	}}
/>

<!-- Antes de sacar un documento del expediente: dice de cuáles virtuales sale también y que el archivo NO se borra. -->
<ConfirmarAccion
	abierto={aQuitar !== null}
	titulo="Quitar el documento del expediente"
	mensaje={aQuitar
		? `«${aQuitar.nombreOriginal}» saldrá de «${expediente.nombre}»${virtualesCon(aQuitar.id).length > 0 ? ` y ${deLosVirtuales(virtualesCon(aQuitar.id).map((v) => v.nombre))}` : ''}. El archivo no se borra: sigue en Archivos procesados.`
		: ''}
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
	alTerminar={async ({ subidos, fallidos, omitidos, colocados }) => {
		// Los archivos YA entraron: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		const dicho = avisoDeSubida(expediente.nombre, subidos, fallidos, omitidos, colocados);
		if (dicho) aviso = { testid: 'archivos-subidos-aviso', ...dicho };
		await invalidateAll();
	}}
/>
