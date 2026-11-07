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
	 * **Dos marcas distintas, y pueden salir las dos (2026-11-06, Moibe: «el duplicado es cuando está duplicado por ser archivo idéntico por hash,
	 * debe de poder marcar las dos cosas»):**
	 *   · «Tipo documental repetido» (`tipoRepetido`; antes, desde el 2026-11-03, se llamaba «Duplicado»): el expediente trae otro documento del MISMO
	 *     tipo (`duplicado` en el cable, lo calcula nexus_back). No se sabe cuál es «el INE», y un proceso que usa ese tipo no se ejecuta sobre el
	 *     expediente hasta que quede uno.
	 *   · «Duplicado» (`archivoRepetido`): el expediente trae otro archivo IDÉNTICO (misma huella SHA-256), aunque se llame distinto. Lo calcula la
	 *     página con `archivosRepetidos`. No frena ningún proceso; solo sobra una copia.
	 * Las dos se calculan al leer; al sacar un documento desaparecen de los demás.
	 *
	 * **«Detalle» (2026-11-06).** Un solo botón gris y discreto (`alVerDetalle`) que abre los datos extraídos del documento, con sus pestañas PDF y JSON y su botón
	 * «Descargar» (`DatosExtraidosModal`). Moibe: «es más cambio de opinión, quítalos y que solo sea un botón gris discreto que diga: Detalle». Hasta ese día la tarjeta
	 * traía dos enlaces, «PDF de resultados» (que bajaba el informe de la extracción, como en las bandejas) y «Ver JSON»; antes, un «Ver PDF/JPG» que abría el archivo
	 * mismo (Moibe: «no es que quiera ver el archivo, quiero ver los resultados de extracción»).
	 *
	 * **«Quitar» (2026-11-04, Moibe: «que un archivo pueda ser borrado de un expediente»).** La tarjeta puede llevarlo (`alQuitar`): saca el
	 * documento del expediente, sin borrar el archivo. Sin `alQuitar` (quien no organiza) no hay nada que hacer con ella. Los expedientes
	 * virtuales, donde esta misma tarjeta sacaba el documento del «grupito» y no del expediente, se quitaron el 2026-11-05 (y con ellos la
	 * marca «Agregado por el clasificador», que solo existía dentro de uno).
	 */
		import Copy from '@lucide/svelte/icons/copy';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import ArchivoIlustracion from '$lib/components/icons/ArchivoIlustracion.svelte';
	import { fechaCorta, formatearTamano, formatoDe, type DocumentoDeExpediente } from '$lib/expedientes/expedientes';
	import { porcentaje } from '$lib/expedientes/clasificador';

	let {
		documento,
		alQuitar,
		alVerDetalle,
		archivoRepetido = false,
		quitando = false,
		ayudaQuitar = `Quitar «${documento.nombreOriginal}» de este expediente`,
		testidQuitar = 'quitar-del-expediente'
	}: {
		documento: DocumentoDeExpediente;
		/** Si viene, la tarjeta ofrece «Quitar» (del expediente). */
		alQuitar?: () => void;
		/** Si viene, la tarjeta ofrece «Detalle»: abre los datos extraídos del documento (pestañas PDF y JSON, con «Descargar»). */
		alVerDetalle?: () => void;
		/** El expediente trae otro archivo IDÉNTICO a este (misma huella): es un «Duplicado». Lo calcula la página (`archivosRepetidos`). */
		archivoRepetido?: boolean;
		/** Se está quitando: el botón gira y no se puede volver a picar. */
		quitando?: boolean;
		/** Lo que el botón dice a un lector de pantalla: de DÓNDE se quita. */
		ayudaQuitar?: string;
		testidQuitar?: string;
	} = $props();

	const tipo = $derived(documento.tipoDocumental ?? null);
	/** ¿Su tipo documental está repetido? Hay otro documento del mismo tipo en el expediente (lo calcula nexus_back al leerlo; en el cable se llama `duplicado`). */
	const tipoRepetido = $derived(Boolean(documento.duplicado));
	const ayudaDelTipoRepetido = 'Hay otro documento de este tipo en este expediente: los procesos que usan este tipo no se ejecutan sobre el expediente hasta que quede uno.';
	const ayudaDelDuplicado = 'Hay otro archivo idéntico a este en este expediente (mismo contenido, aunque se llame distinto). Quita la copia que sobre.';
	/** Cualquiera de las dos marcas pone la tarjeta en ámbar. */
	const conMarca = $derived(tipoRepetido || archivoRepetido);
	/** Al pasar el cursor: cómo se supo el tipo y, si lo reconoció el clasificador, con cuánta confianza. */
	const ayudaDelTipo = $derived(
		!tipo ? undefined : tipo.origen === 'clasificacion' && tipo.confianza !== null ? `Clasificado como «${tipo.nombre}» con ${porcentaje(tipo.confianza)}` : `Tipo documental: ${tipo.nombre}`
	);
</script>

<div
	data-testid="tarjeta-documento"
	data-documento-id={documento.id}
	data-tipo-repetido={tipoRepetido}
	data-duplicado={archivoRepetido}
	class="w-52.5 overflow-hidden rounded-xl border-2 bg-card dark:bg-background {conMarca ? 'border-amber-300 dark:border-amber-700' : 'border-border'}"
>
	<div class="p-3">
		<div class="flex items-center justify-center rounded-md border border-border bg-background p-6 dark:bg-card">
			<span class="flex size-12 items-center justify-center"><ArchivoIlustracion /></span>
		</div>
	</div>
	<div class="flex flex-col gap-1.5 px-3 pb-4">
		<p class="truncate text-xs font-medium text-foreground" data-testid="documento-nombre" title={documento.nombreOriginal}>{documento.nombreOriginal}</p>
		<p class="text-xs font-medium text-muted-foreground" data-testid="documento-detalle">{formatoDe(documento)} | {formatearTamano(documento.tamanoBytes)}</p>
		{#if tipo}
			<p class="flex min-w-0" title={ayudaDelTipo}>
				<span class="max-w-full truncate rounded-sm border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary dark:text-blue-300" data-testid="documento-tipo">{tipo.nombre}</span>
			</p>
		{/if}
		<!-- Las dos marcas, juntas si hacen falta (2026-11-06): el tipo repetido frena procesos; el duplicado es solo una copia que sobra. -->
		{#if tipoRepetido}
			<p class="flex items-start gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400" data-testid="documento-tipo-repetido" title={ayudaDelTipoRepetido}>
				<TriangleAlert class="mt-px size-3 shrink-0" />
				<span>Tipo documental repetido</span>
			</p>
		{/if}
		{#if archivoRepetido}
			<p class="flex items-start gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400" data-testid="documento-duplicado" title={ayudaDelDuplicado}>
				<Copy class="mt-px size-3 shrink-0" />
				<span>Duplicado</span>
			</p>
		{/if}
		<!-- «Detalle» (2026-11-06, Moibe): un solo botón gris y discreto que abre los datos extraídos (PDF y JSON, con «Descargar»). Lo ve quien vea el expediente. -->
		{#if alVerDetalle}
			<div class="flex">
				<button
					type="button"
					class="rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
					onclick={alVerDetalle}
					aria-label="Ver el detalle de «{documento.nombreOriginal}»: sus datos extraídos en PDF y en JSON"
					data-testid="detalle-documento"
				>
					Detalle
				</button>
			</div>
		{/if}
		<div class="flex items-center justify-between gap-2">
			<p class="text-xs font-medium text-muted-foreground" data-testid="documento-fecha">{fechaCorta(documento.recibidoEn)}</p>
			{#if alQuitar}
				<button
					type="button"
					class="flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-300"
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
