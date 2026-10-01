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
	import Eye from '@lucide/svelte/icons/eye';
	import FileBadge from '@lucide/svelte/icons/file-badge';
	import Workflow from '@lucide/svelte/icons/workflow';
	import { usarVistaPrevia } from '$lib/hooks/usarVistaPrevia.svelte';

	let {
		documento,
		alAbrirDetalle,
		alAbrirRegistroOt,
		alAbrirEstado
	}: {
		documento: DocEnExpediente;
		alAbrirDetalle: (id: string) => void;
		alAbrirRegistroOt: (id: string) => void;
		alAbrirEstado: (id: string) => void;
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
		<!-- El ⋮ del frame (2026-10-01, a pedido): las tres ventanas de UN
		     documento. Mismo menú que el de las tarjetas de API Keys.
		     "Detalle" y "Registro de OT" se apagan para lo que sigue en la
		     Bandeja de preparación: leen el resultado del OCR, que todavía no
		     existe. "Estado" sirve en las dos: la historia empieza al entrar. -->
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
			<DropdownMenu.Content align="end" class="w-52 p-2">
				<DropdownMenu.Item
					data-testid="expediente-detalle"
					class="h-10 gap-3 px-2"
					disabled={!documento.procesado}
					onSelect={() => alAbrirDetalle(documento.id)}
				>
					<Eye class="size-4 text-muted-foreground" />
					Detalle
				</DropdownMenu.Item>
				<DropdownMenu.Item
					data-testid="expediente-registro-ot"
					class="h-10 gap-3 px-2"
					disabled={!documento.procesado}
					onSelect={() => alAbrirRegistroOt(documento.id)}
				>
					<FileBadge class="size-4 text-muted-foreground" />
					Registro de OT
				</DropdownMenu.Item>
				<DropdownMenu.Item
					data-testid="expediente-estado"
					class="h-10 gap-3 px-2"
					onSelect={() => alAbrirEstado(documento.id)}
				>
					<Workflow class="size-4 text-muted-foreground" />
					Estado
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
	<p class="mt-1 text-xs text-muted-foreground">{meta}</p>
	<p class="mt-1 text-xs text-muted-foreground">{documento.bandeja}</p>
	<p class="mt-1 text-sm {documento.tipo ? 'text-primary' : 'text-muted-foreground'}">
		{documento.tipo ?? 'Sin clasificar'}
	</p>
</article>
