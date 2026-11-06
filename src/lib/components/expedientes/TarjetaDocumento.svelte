<script lang="ts">
	/**
	 * La tarjeta de un documento dentro de un expediente (Figma, Sprint 5, HUN2, `.Folder_preview` del detalle): la hoja arriba y abajo,
	 * el nombre del archivo, «PDF | 0.5 MB» y la fecha en que entró. Mide 210 px de ancho.
	 *
	 * Lo que el diseño trae y aquí falta: las páginas («Páginas 4»), porque el documento todavía no guarda cuántas tiene. Tampoco hay menú
	 * de tres puntos ni estado de seleccionada.
	 *
	 * **Tipo documental (2026-11-02).** Desde que subir un archivo a un expediente lo clasifica, la tarjeta dice de qué tipo es (el de su
	 * última extracción o, si no se extrajo, el de su última clasificación) y, al pasar el cursor, con cuánta confianza lo reconoció el
	 * clasificador. Un documento sin tipo no lleva nada.
	 *
	 * **Duplicado (2026-11-03, Moibe; del expediente entero desde el 2026-11-05).** Si el expediente trae otro documento del MISMO tipo
	 * (`duplicado`), la tarjeta lo marca en ámbar: no se sabe cuál es «el INE», y un proceso que usa ese tipo no se ejecuta sobre el expediente
	 * hasta que quede uno. La marca se calcula al leer; al sacar uno desaparece de los dos.
	 *
	 * **«Quitar» (2026-11-04, Moibe: «que un archivo pueda ser borrado de un expediente»).** La tarjeta puede llevarlo (`alQuitar`): saca el
	 * documento del expediente, sin borrar el archivo. Sin `alQuitar` (quien no organiza) no hay nada que hacer con ella. Los expedientes
	 * virtuales, donde esta misma tarjeta sacaba el documento del «grupito» y no del expediente, se quitaron el 2026-11-05 (y con ellos la
	 * marca «Agregado por el clasificador», que solo existía dentro de uno).
	 */
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import ArchivoIlustracion from '$lib/components/icons/ArchivoIlustracion.svelte';
	import { fechaCorta, formatearTamano, formatoDe, type DocumentoDeExpediente } from '$lib/expedientes/expedientes';
	import { porcentaje } from '$lib/expedientes/clasificador';

	let {
		documento,
		alQuitar,
		quitando = false,
		ayudaQuitar = `Quitar «${documento.nombreOriginal}» de este expediente`,
		testidQuitar = 'quitar-del-expediente'
	}: {
		documento: DocumentoDeExpediente;
		/** Si viene, la tarjeta ofrece «Quitar» (del expediente). */
		alQuitar?: () => void;
		/** Se está quitando: el botón gira y no se puede volver a picar. */
		quitando?: boolean;
		/** Lo que el botón dice a un lector de pantalla: de DÓNDE se quita. */
		ayudaQuitar?: string;
		testidQuitar?: string;
	} = $props();

	const tipo = $derived(documento.tipoDocumental ?? null);
	/** ¿Está duplicado? Hay otro documento del mismo tipo en el expediente (lo calcula nexus_back al leerlo). */
	const duplicado = $derived(Boolean(documento.duplicado));
	const ayudaDelDuplicado = 'Hay otro documento de este tipo en este expediente: los procesos que usan este tipo no se ejecutan sobre el expediente hasta que quede uno.';
	/** Al pasar el cursor: cómo se supo el tipo y, si lo reconoció el clasificador, con cuánta confianza. */
	const ayudaDelTipo = $derived(
		!tipo ? undefined : tipo.origen === 'clasificacion' && tipo.confianza !== null ? `Clasificado como «${tipo.nombre}» con ${porcentaje(tipo.confianza)}` : `Tipo documental: ${tipo.nombre}`
	);
</script>

<div
	data-testid="tarjeta-documento"
	data-documento-id={documento.id}
	data-duplicado={duplicado}
	class="w-52.5 overflow-hidden rounded-xl border-2 bg-card {duplicado ? 'border-amber-300 dark:border-amber-700' : 'border-border'}"
>
	<div class="p-3">
		<div class="flex items-center justify-center rounded-md border border-border bg-background p-6">
			<span class="flex size-12 items-center justify-center"><ArchivoIlustracion /></span>
		</div>
	</div>
	<div class="flex flex-col gap-1.5 px-3 pb-4">
		<p class="truncate text-xs font-medium text-foreground" data-testid="documento-nombre" title={documento.nombreOriginal}>{documento.nombreOriginal}</p>
		<p class="text-xs font-medium text-muted-foreground" data-testid="documento-detalle">{formatoDe(documento)} | {formatearTamano(documento.tamanoBytes)}</p>
		{#if tipo}
			<p class="flex min-w-0" title={ayudaDelTipo}>
				<span class="max-w-full truncate rounded-sm border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary" data-testid="documento-tipo">{tipo.nombre}</span>
			</p>
		{/if}
		{#if duplicado}
			<p class="flex items-start gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400" data-testid="documento-duplicado" title={ayudaDelDuplicado}>
				<TriangleAlert class="mt-px size-3 shrink-0" />
				<span>{tipo ? `Duplicado de «${tipo.nombre}»` : 'Duplicado'}</span>
			</p>
		{/if}
		<div class="flex items-center justify-between gap-2">
			<p class="text-xs font-medium text-muted-foreground" data-testid="documento-fecha">{fechaCorta(documento.recibidoEn)}</p>
			{#if alQuitar}
				<button
					type="button"
					class="flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline disabled:opacity-50"
					disabled={quitando}
					onclick={alQuitar}
					aria-label={ayudaQuitar}
					data-testid={testidQuitar}
				>
					{#if quitando}<LoaderCircle class="size-3 animate-spin" />{/if}
					Quitar
				</button>
			{/if}
		</div>
	</div>
</div>
