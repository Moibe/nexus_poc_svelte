<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import ArchivoPendienteRow from './ArchivoPendienteRow.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import ArrowDownIcon from '$lib/components/icons/ArrowDownIcon.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import Check from '@lucide/svelte/icons/check';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import {
		agregarArchivosPendientes,
		archivosPendientesDeCarga
	} from '$lib/state/bandeja.svelte';

	/**
	 * El origen de la carga (2026-10-02, a pedido). Hasta hoy el selector era
	 * un adorno fijo en "Manual". Ahora elige entre cuatro, pero solo dos hacen
	 * algo: Manual (el dropzone de siempre) y API, que en vez del dropzone
	 * explica cómo mandar documentos por la API y enlaza al Swagger público.
	 * SharePoint y SFTP se listan apagados: todavía no hay conector detrás, y
	 * ofrecerlos activos prometería algo que no existe. (Llevaban la leyenda
	 * "Próximamente" a la derecha; se quitó el 2026-10-06, a pedido.)
	 *
	 * La elección vive en el componente, no se persiste: es un modo de ver la
	 * bandeja, no una configuración.
	 */
	type Origen = 'manual' | 'api' | 'sharepoint' | 'sftp';
	const ORIGENES: { valor: Origen; texto: string; disponible: boolean }[] = [
		{ valor: 'manual', texto: 'Manual', disponible: true },
		{ valor: 'api', texto: 'API', disponible: true },
		{ valor: 'sharepoint', texto: 'SharePoint', disponible: false },
		{ valor: 'sftp', texto: 'SFTP', disponible: false }
	];
	let origen = $state<Origen>('manual');
	const textoOrigen = $derived(ORIGENES.find((o) => o.valor === origen)?.texto ?? 'Manual');

	/** El Swagger PÚBLICO de la API (`nexus_back/documentacion.py`, `/docs`):
	 *  solo "mandar un documento", que es lo que un cliente necesita. Es el
	 *  dominio de los clientes, no el del servidor interno. */
	const URL_DOCS_API = 'https://nexus-doc-api.buzzword.com.mx/docs';

	let fileInput = $state<HTMLInputElement>();
	let files = $state<FileList | null>(null);
	let arrastrando = $state(false);

	// Selección por clic: bind:files dispara esto; se reenvía a la bandeja y se
	// limpia el input para que el dropzone vuelva a su estado ocioso (el
	// "documento agregado" ya se ve reflejado allá, no hace falta dejar aquí un
	// contador de "N archivos seleccionados").
	$effect(() => {
		if (files && files.length > 0) {
			agregarArchivosPendientes(files);
			files = null;
			// Limpiar el estado NO limpia el <input>: su `value` sigue guardando la
			// ruta del archivo elegido, y el navegador solo dispara `change` cuando
			// ese value CAMBIA. Sin esta línea, volver a elegir EL MISMO archivo no
			// hacía absolutamente nada — ni una fila, ni un error, ni un aviso.
			//
			// Y ese caso es de lo más normal: procesas un documento, se va al
			// pipeline, y quieres volver a subirlo (para reprocesarlo, o porque no
			// te diste cuenta de que ya lo habías subido). Antes tenías que elegir
			// otro archivo primero para "destrabar" el input.
			if (fileInput) fileInput.value = '';
		}
	});

	function manejarDrop(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		const soltados = evento.dataTransfer?.files;
		if (soltados && soltados.length > 0) agregarArchivosPendientes(soltados);
	}
</script>

<div class="flex h-full flex-col gap-2.5 rounded-2xl border-2 border-border bg-card p-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-base font-medium text-foreground">Carga documental</p>
			<p class="text-xs text-muted-foreground">Iniciar la ingesta de documentos</p>
		</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						type="button"
						data-testid="selector-origen-carga"
						class="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 transition-colors hover:bg-muted data-[state=open]:bg-muted"
					>
						<span class="flex size-4 items-center justify-center rounded-full bg-[#ecfdf3]">
							<span class="size-2 rounded-full bg-[#29cc39]"></span>
						</span>
						<span class="text-sm font-medium text-secondary-foreground">{textoOrigen}</span>
						<ArrowDownIcon />
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-48 p-2">
				{#each ORIGENES as o (o.valor)}
					<DropdownMenu.Item
						data-testid="origen-{o.valor}"
						class="h-10 gap-3 px-2"
						disabled={!o.disponible}
						onSelect={() => (origen = o.valor)}
					>
						<span class="flex-1">{o.texto}</span>
						{#if origen === o.valor}
							<Check class="size-4 text-primary" />
						{/if}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	{#if origen === 'api'}
		<!-- Misma caja que el dropzone (alto, borde punteado, ícono y textos),
		     para que cambiar de origen no mueva el resto del panel. -->
		<div
			data-testid="carga-por-api"
			class="flex h-50 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-background p-4"
		>
			<span class="flex size-8 items-center justify-center rounded-lg border border-border bg-card">
				<FolderLibraryIcon />
			</span>
			<div class="flex flex-col items-center gap-0.5 text-center">
				<p class="text-sm font-medium text-foreground">Carga de documentos por API</p>
				<p class="max-w-sm text-xs text-muted-foreground">
					Envía documentos desde tus sistemas con una API Key. Cada envío llega a la Bandeja de
					preparación documental, igual que una carga manual.
				</p>
			</div>
			<a
				href={URL_DOCS_API}
				target="_blank"
				rel="noopener noreferrer"
				data-testid="enlace-docs-api"
				class="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted/70"
			>
				Ver documentación de la API
				<ExternalLink class="size-4" />
			</a>
		</div>
	{:else}

		<button
			type="button"
			class={[
				'flex h-50 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors',
				arrastrando ? 'border-primary bg-muted' : 'border-border bg-background'
			]}
			onclick={() => fileInput?.click()}
			ondragover={(evento) => {
				evento.preventDefault();
				arrastrando = true;
			}}
			ondragleave={() => (arrastrando = false)}
			ondrop={manejarDrop}
		>
			<span class="flex size-8 items-center justify-center rounded-lg border border-border bg-card">
				<FolderLibraryIcon />
			</span>
			<div class="flex flex-col items-center gap-0.5 text-center">
				<p class="text-sm font-medium text-foreground">
					Arrastra y suelta tus documentos aquí o selecciona archivos desde tu equipo
				</p>
				<!-- DOCX y XLSX se quitaron el 2026-09-06: Document AI no los procesa
				     (ver EXTENSIONES_PERMITIDAS en bandeja.svelte.ts), así que ya no
				     tiene caso ofrecerlos aquí para que fallen hasta "Iniciar pipeline". -->
				<p class="text-xs text-muted-foreground">PDF, JPG, JPEG, PNG, TIFF | Max 20 MB</p>
			</div>
			<input
				bind:this={fileInput}
				bind:files
				type="file"
				multiple
				class="hidden"
				accept=".pdf,.jpg,.jpeg,.png,.tiff"
			/>
			<span class="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-secondary-foreground">
				Buscar archivos
			</span>
		</button>
	{/if}

	{#if archivosPendientesDeCarga.length === 0}
		<div class="flex flex-1 items-center justify-center">
			<EmptyState
				icon={ClockBadgeIcon}
				title="Tu área de carga está lista"
				description="Agrega documentos para iniciar el procesamiento, lectura y validación inteligente dentro de NexusDoc."
			/>
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col gap-2.5">
			<div class="flex flex-col gap-2">
				<p class="text-xs text-muted-foreground">
					{archivosPendientesDeCarga.length} | Pendiente de carga
				</p>
				<div class="border-t border-border"></div>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
				{#each archivosPendientesDeCarga as archivo (archivo.id)}
					<ArchivoPendienteRow {archivo} />
				{/each}
			</div>
		</div>
	{/if}
</div>
