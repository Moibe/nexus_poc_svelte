<script lang="ts" module>
	/** Un documento como lo muestra la rejilla de expedientes, venga de la
	 *  bandeja que venga. */
	export type DocEnExpediente = {
		id: string;
		nombre: string;
		extension: string;
		/** `null` mientras lo que llegó por la API todavía no se baja del almacén:
		 *  sin bytes no hay vista previa. */
		archivo: File | null;
		fecha: Date;
		/** Solo se sabe de un documento ya procesado, y viene del OCR. */
		paginas: number | null;
		/** El tipo documental detectado, cuando el clasificador lo identificó. */
		tipo: string | null;
		bandeja: string;
		/** Si ya pasó por el pipeline. "Detalle" y "Registro de OT" leen el
		 *  resultado del OCR, que antes de eso no existe. */
		procesado: boolean;
	};
</script>

<script lang="ts">
	/**
	 * Una tarjeta de la rejilla de "Expedientes virtuales".
	 *
	 * Es un componente aparte y no un bloque del `{#each}` por una razón
	 * concreta: la vista previa es una runa (`usarVistaPrevia`) y las runas no
	 * se pueden llamar dentro de un ciclo. Cada tarjeta necesita la suya, con su
	 * propio object URL que se revoca al desmontarse.
	 */
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import CodeXml from '@lucide/svelte/icons/code-xml';
	import TableProperties from '@lucide/svelte/icons/table-properties';
	import Download from '@lucide/svelte/icons/download';
	import { usarVistaPrevia } from '$lib/hooks/usarVistaPrevia.svelte';

	let {
		documento,
		alVerJson,
		alVerCampos,
		alDescargarPlantilla,
		descargando = false
	}: {
		documento: DocEnExpediente;
		alVerJson: (id: string) => void;
		alVerCampos: (id: string) => void;
		alDescargarPlantilla: (id: string) => void;
		/** Su plantilla se está descargando: la opción se apaga mientras. */
		descargando?: boolean;
	} = $props();

	const previa = usarVistaPrevia(() =>
		documento.archivo ? { archivo: documento.archivo, extension: documento.extension } : null
	);

	function fecha(d: Date): string {
		const dia = String(d.getDate()).padStart(2, '0');
		const mes = String(d.getMonth() + 1).padStart(2, '0');
		return `${dia}/${mes}/${d.getFullYear()}`;
	}

	/** "4 páginas · 12/05/2026". Las páginas solo salen si de verdad se saben:
	 *  el frame dibuja "Páginas 4" en todas, pero eso solo lo sabe el OCR de un
	 *  documento ya procesado, y ponerle un número a los demás sería inventarlo. */
	const meta = $derived(
		[documento.paginas === null ? null : `${documento.paginas} ${documento.paginas === 1 ? 'página' : 'páginas'}`, fecha(documento.fecha)]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<article
	class="flex flex-col rounded-xl border border-border bg-card p-3"
	data-testid="tarjeta-expediente"
>
	<div
		class="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40"
	>
		{#if previa.url}
			<img src={previa.url} alt={documento.nombre} class="max-h-full max-w-full object-contain" />
		{:else}
			<span class="flex size-12 items-center justify-center text-foreground">
				<FileIcon />
			</span>
		{/if}
	</div>

	<div class="mt-3 flex items-start gap-2">
		<span class="mt-0.5 shrink-0 text-muted-foreground"><FileIcon /></span>
		<p class="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={documento.nombre}>
			{documento.nombre}
		</p>
		<!-- El ⋮ con las opciones del diseño (2026-10-01, captura): "Ver documento
		     .JSON" abre el Detalle ya en su vista JSON, "Ver campos extraídos" abre
		     la ventana de los campos que sacó el extractor (Registro de OT) y
		     "Descargar plantilla documental" baja el PDF con esos datos. Las tres
		     leen el resultado del procesamiento, así que se apagan para lo que
		     sigue en la Bandeja de preparación: ahí todavía no existe. Apagadas y
		     sin más, parecían rotas ("les doy click y no pasa nada", 2026-10-02),
		     y una opción apagada no muestra `title` (no recibe el puntero): por
		     eso el menú lo dice en una nota al pie, que el diseño no trae. -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						type="button"
						aria-label="Más opciones de {documento.nombre}"
						data-testid="menu-tarjeta-expediente"
						class="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted data-[state=open]:bg-muted"
					>
						<MoreVerticalIcon />
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-72 p-2">
				<DropdownMenu.Item
					data-testid="expediente-json"
					class="h-10 gap-3 px-2 whitespace-nowrap"
					disabled={!documento.procesado}
					onSelect={() => alVerJson(documento.id)}
				>
					<CodeXml class="size-4 text-muted-foreground" />
					Ver documento .JSON
				</DropdownMenu.Item>
				<DropdownMenu.Item
					data-testid="expediente-campos"
					class="h-10 gap-3 px-2 whitespace-nowrap"
					disabled={!documento.procesado}
					onSelect={() => alVerCampos(documento.id)}
				>
					<TableProperties class="size-4 text-muted-foreground" />
					Ver campos extraídos
				</DropdownMenu.Item>
				<DropdownMenu.Item
					data-testid="expediente-plantilla"
					class="h-10 gap-3 px-2 whitespace-nowrap"
					disabled={!documento.procesado || descargando}
					onSelect={() => alDescargarPlantilla(documento.id)}
				>
					<Download class="size-4 text-muted-foreground" />
					Descargar plantilla documental
				</DropdownMenu.Item>
				{#if !documento.procesado}
					<p
						class="mt-1 border-t border-border px-2 pt-2 pb-1 text-xs text-muted-foreground"
						data-testid="expediente-sin-resultado"
					>
						Se habilitan cuando el documento pase por el pipeline: sigue en la Bandeja de
						preparación y todavía no tiene resultado. Selecciónalo ahí y usa “Iniciar pipeline”.
					</p>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
	<p class="mt-1 text-xs text-muted-foreground">{meta}</p>
	<p class="mt-1 text-xs text-muted-foreground">{documento.bandeja}</p>
	<p class="mt-1 text-sm {documento.tipo ? 'text-primary' : 'text-muted-foreground'}">
		{documento.tipo ?? 'Sin clasificar'}
	</p>
</article>
