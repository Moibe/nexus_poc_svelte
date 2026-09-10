<script lang="ts">
	/**
	 * Fila del panel "Pipeline documental".
	 *
	 * Se parece a DocumentoRow (el de la bandeja) pero no lo reutiliza: ahí la
	 * acción es quitar de la lista y el subtexto habla de problemas de archivo;
	 * aquí la acción es abrir el detalle y el subtexto habla del resultado de la
	 * extracción. Forzar un solo componente con banderas para las dos cosas
	 * saldría más enredado que tener dos.
	 *
	 * El formato del subtexto (`PDF • 2.8 MB | 12/05/2026 | 12:45`) sale de
	 * Figma HU001|106 y NO coincide con el que usa hoy la fila de la bandeja
	 * (separadores `·` y con el origen incluido). Se dejó como está en Figma
	 * para este panel; la de la bandeja quedó pendiente de alinear.
	 */
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import { formatearTamano } from '$lib/state/bandeja.svelte';
	import { pedirConfigurarNuevoTipo } from '$lib/state/configuracion.svelte';
	import {
		alternarSeleccionPipeline,
		continuarSinConfiguracion,
		etiquetaDe,
		type DocumentoEnPipeline
	} from '$lib/state/pipeline.svelte';

	let {
		documento,
		alAbrirDetalle
	}: { documento: DocumentoEnPipeline; alAbrirDetalle: (id: string) => void } = $props();

	const esImagen = $derived(['JPG', 'JPEG', 'PNG', 'TIFF'].includes(documento.extension));
	// `etiquetaDe` y no `ETIQUETA_ESTADO[estado]`: los textos de 'clasificado'
	// y 'procesando' nombran el tipo documental identificado, así que dependen
	// del documento y no solo de su estado.
	const etiqueta = $derived(etiquetaDe(documento));
	const enProceso = $derived(
		documento.estado === 'en_cola' ||
			documento.estado === 'clasificando' ||
			documento.estado === 'procesando'
	);

	// Figma muestra en las filas duplicadas SOLO el renglón rojo, sin el "Listo"
	// verde: la nota de que se procesó a propósito pesa más que el resultado.
	const esDuplicadoProcesado = $derived(documento.eraDuplicado && documento.estado === 'procesado');

	function fechaCorta(fecha: Date): string {
		const dia = String(fecha.getDate()).padStart(2, '0');
		const mes = String(fecha.getMonth() + 1).padStart(2, '0');
		return `${dia}/${mes}/${fecha.getFullYear()}`;
	}

	function horaCorta(fecha: Date): string {
		return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
	}
</script>

<div class="rounded-lg border border-border bg-background">
	<div class="flex items-center gap-3 px-3 py-2.5">
	<Checkbox
		checked={documento.seleccionado}
		onCheckedChange={() => alternarSeleccionPipeline(documento.id)}
		aria-label={`Seleccionar ${documento.nombre}`}
	/>

	<span
		class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
	>
		{#if esImagen}
			<ImageIcon />
		{:else}
			<FileIcon />
		{/if}
	</span>

	<button
		type="button"
		class="min-w-0 flex-1 text-left"
		onclick={() => alAbrirDetalle(documento.id)}
	>
		<p class="truncate text-sm font-medium text-foreground">{documento.nombre}</p>
		<!-- "Documento detectado: INE", justo debajo del nombre (2026-09-08, a
		     pedido explícito). Es la versión PERSISTENTE de lo que la etiqueta
		     de estado dice de paso mientras corre ("Clasificado: INE",
		     "Procesando INE"): en cuanto termina, la etiqueta pasa a "Listo" y el
		     tipo dejaba de verse. Solo aparece cuando SÍ se identificó un tipo —
		     con `otro` no hay documento detectado que nombrar, y la etiqueta de
		     estado ("Tipo documental no configurado") ya dice lo que pasó. -->
		{#if documento.tipoDetectado}
			<p class="truncate text-xs text-muted-foreground" data-testid="documento-detectado">
				Documento detectado:
				<span class="font-medium text-foreground">{documento.tipoDetectado}</span>
			</p>
		{/if}
		<p class="text-xs text-muted-foreground">
			{documento.extension} • {formatearTamano(documento.tamanioBytes)} | {fechaCorta(
				documento.agregadoEn
			)} | {horaCorta(documento.agregadoEn)}
		</p>

		{#if esDuplicadoProcesado}
			<p class="mt-0.5 text-xs text-red-500">Duplicado procesado de forma explícita</p>
		{:else if etiqueta.tono === 'ok'}
			<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
				<span class="size-1.5 rounded-full bg-green-500"></span>
				{etiqueta.texto}
			</p>
		{:else if etiqueta.tono === 'error'}
			<!-- El mensaje concreto le gana a la etiqueta del estado cuando existe:
			     "Falló el procesamiento" no dice nada accionable, y la causa real
			     (documento muy largo, archivo protegido, cuota agotada) ya viene
			     redactada desde el back — ver `_POR_MOTIVO` en routers/ia.py. Se
			     limita a 2 renglones para que una fila no crezca sin control. -->
			<p class="mt-0.5 line-clamp-2 text-xs text-red-500">
				{documento.error ?? etiqueta.texto}
			</p>
		{:else}
			<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
				<span class="size-1.5 animate-pulse rounded-full bg-primary"></span>
				{etiqueta.texto}
			</p>
		{/if}
	</button>

	{#if enProceso}
		<span class="shrink-0 text-xs text-muted-foreground" aria-hidden="true">…</span>
	{:else if documento.resultado?.confianza_promedio != null}
		<!-- El PROMEDIO de la confianza de todos los campos (cambio pedido el
		     2026-09-10; antes era el mínimo). Tiene que ser el MISMO número que
		     muestran "Detalle" y "Registro de OT" bajo el rótulo "Nivel de
		     confianza obtenida": que el renglón y el panel del mismo documento
		     dijeran porcentajes distintos sería un error, no un matiz. -->
		<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
			<!-- toFixed(2), NO toFixed(1): con un decimal, 99.98 se imprime como
			     "100.0" — un cien que no existe. En una pantalla cuyo trabajo es
			     decir qué tan confiable fue la lectura, mostrar un 100 falso es
			     justo el error que no se puede permitir. Dos decimales es además
			     la precisión real: el back redondea a 2 al convertir de 0-1 a
			     0-100 (`_a_cien` en servicios/ia.py). -->
			{documento.resultado.confianza_promedio.toFixed(2)}%
		</span>
	{/if}
	</div>

	<!-- Las dos salidas de un documento cuyo tipo no está configurado. Van FUERA
	     del <button> de arriba (el que abre el detalle) y no dentro: un botón
	     anidado en otro es HTML inválido, el navegador deshace el anidamiento y
	     los clics dejan de llegar a quien deben — ya mordió dos veces en este
	     proyecto, está documentado en docs/pendientes-ux.md. -->
	{#if documento.estado === 'no_configurado'}
		<div class="flex items-center justify-end gap-3 border-t border-border px-3 py-2">
			<button
				type="button"
				class="text-xs text-muted-foreground transition-colors hover:text-foreground"
				onclick={() => continuarSinConfiguracion(documento.id)}
			>
				Continuar sin configuración
			</button>
			<span class="text-border" aria-hidden="true">|</span>
			<button
				type="button"
				class="text-xs font-medium text-primary transition-colors hover:text-primary/80"
				onclick={pedirConfigurarNuevoTipo}
			>
				Configurar
			</button>
		</div>
	{/if}
</div>
