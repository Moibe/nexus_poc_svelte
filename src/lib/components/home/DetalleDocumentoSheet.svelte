<script lang="ts">
	/**
	 * Modal "Detalle de documento" (Figma HU032, frame 905:49554).
	 *
	 * Muestra el resultado de haber pasado un documento por el pipeline. La
	 * estructura —"Información" y luego "Procesamiento OCR"— es la de Figma.
	 *
	 * LO QUE SIGUE SIN ESTAR EN FIGMA (pendiente de que lo revise el UX):
	 *
	 *  1. La vista previa real de la imagen. Figma dibuja un ícono de archivo de
	 *     relleno; aquí, cuando el documento es una imagen, se muestra la imagen
	 *     misma. Para PDF sí se queda el ícono, porque renderizarlo exigiría un
	 *     visor y eso es otra historia.
	 *  2. El renglón "Versión del modelo" en Procesamiento OCR. Figma llega hasta
	 *     "Calidad de la lectura".
	 *  3. Los avisos de error y de quality_alert. Sin ellos, un documento que
	 *     falló se ve exactamente igual que uno que salió bien.
	 *
	 * La sección "Campos extraídos" SÍ estuvo y se retiró el 2026-08-25 por la
	 * misma razón: no está en el frame y el UX no la ha visto. Ver la nota en el
	 * cuerpo, donde dice cómo devolverla.
	 */
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import Download from '@lucide/svelte/icons/download';
	import Clock from '@lucide/svelte/icons/clock';
	import { formatearTamano } from '$lib/state/bandeja.svelte';
	import { ETIQUETA_ESTADO, type DocumentoEnPipeline } from '$lib/state/pipeline.svelte';
	import { calidadDe } from '$lib/types/ine';

	let {
		open = $bindable(false),
		documento
	}: { open?: boolean; documento: DocumentoEnPipeline | null } = $props();

	const etiqueta = $derived(documento ? ETIQUETA_ESTADO[documento.estado] : null);
	const esImagen = $derived(
		documento ? ['JPG', 'JPEG', 'PNG', 'TIFF'].includes(documento.extension) : false
	);
	const confianza = $derived(documento?.resultado?.confianza_minima ?? null);
	const calidad = $derived(calidadDe(confianza));

	// El navegador no muestra TIFF en un <img>, aunque sea una imagen válida:
	// ningún motor de los grandes lo soporta nativamente. Se detecta aquí para
	// caer al ícono en vez de dejar una imagen rota.
	const sePuedePrevisualizar = $derived(esImagen && documento?.extension !== 'TIFF');

	// Un object URL reserva memoria hasta que se revoca a mano — el navegador NO
	// la libera solo al cerrar el modal. Se crea al abrir y se revoca al cerrar
	// o al cambiar de documento; sin esto, abrir el detalle de veinte documentos
	// deja veinte archivos completos retenidos en RAM.
	let urlPrevia = $state<string | null>(null);

	// Atado a `documento` y NO a `open`: si dependiera de `open`, la vista previa
	// se borraría en cuanto empieza la animación de cierre y el usuario vería el
	// panel vaciarse mientras se desliza. Como `documento` solo cambia cuando se
	// abre otro detalle, la URL vive exactamente lo que tiene que vivir.
	$effect(() => {
		if (!documento || !sePuedePrevisualizar) {
			urlPrevia = null;
			return;
		}
		const url = URL.createObjectURL(documento.archivo);
		urlPrevia = url;
		return () => {
			URL.revokeObjectURL(url);
			urlPrevia = null;
		};
	});

	function descargar() {
		if (!documento) return;
		const url = URL.createObjectURL(documento.archivo);
		const enlace = document.createElement('a');
		enlace.href = url;
		enlace.download = documento.nombre;

		// Dos detalles que parecen de más y no lo son:
		//  - El <a> se INSERTA en el DOM. Firefox ignora el click() de un elemento
		//    que no está en el documento, así que sin esto la descarga no arranca.
		//  - La URL se revoca en el siguiente tick, no en este. revokeObjectURL()
		//    es inmediato: si se llama en el mismo tick del click, el navegador
		//    todavía no empezó a leer el blob y la descarga sale vacía o falla.
		document.body.appendChild(enlace);
		enlace.click();
		enlace.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	/** `procesado_en` viene en ISO-8601 UTC; se muestra en la hora local de quien
	 *  mira, que es lo que espera cualquiera leyendo una pantalla. */
	function fechaHoraIso(iso: string | undefined): string | null {
		if (!iso) return null;
		const fecha = new Date(iso);
		return Number.isNaN(fecha.getTime()) ? null : fechaHora(fecha);
	}

	function fechaHora(fecha: Date | null): string {
		if (!fecha) return '—';
		const dia = String(fecha.getDate()).padStart(2, '0');
		const mes = String(fecha.getMonth() + 1).padStart(2, '0');
		const hh = String(fecha.getHours()).padStart(2, '0');
		const mm = String(fecha.getMinutes()).padStart(2, '0');
		return `${dia}/${mes}/${fecha.getFullYear()} · ${hh}:${mm} h`;
	}
</script>

{#snippet dato(etiquetaTexto: string, contenido: import('svelte').Snippet)}
	<div class="flex items-start justify-between gap-4 border-b border-border py-3">
		<span class="shrink-0 text-sm text-muted-foreground">{etiquetaTexto}</span>
		<!-- El tope de ancho es lo que hace que el hash SHA-256 envuelva en varias
		     líneas como en Figma, en vez de estirarse en un solo renglón apretado
		     contra la etiqueta. -->
		<div class="min-w-0 max-w-[62%] text-right text-sm text-foreground">{@render contenido()}</div>
	</div>
{/snippet}

<Sheet.Root bind:open>
	<!-- showCloseButton={false}: Sheet.Content trae su propia X arriba a la
	     derecha por default, y se encimaba con la del header (se veían dos). El
	     header ya tiene su cierre, que es el que pide Figma. -->
	<Sheet.Content
		side="right"
		showCloseButton={false}
		class="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-147.5"
	>
		<div class="flex items-center gap-3 border-b border-border px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Detalle de documento
			</Sheet.Title>
			<Sheet.Close
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</Sheet.Close>
		</div>

		{#if documento}
			<div class="flex items-center gap-3 px-6 py-4">
				<span
					class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
				>
					<FileIcon />
				</span>
				<div class="min-w-0 flex-1">
					<h2 class="truncate text-lg font-medium text-foreground">{documento.nombre}</h2>
					<Sheet.Description class="text-sm">
						{documento.extension} • {formatearTamano(documento.tamanioBytes)} | {fechaHora(
							documento.agregadoEn
						)}
					</Sheet.Description>
				</div>
				<button
					type="button"
					onclick={descargar}
					aria-label="Descargar documento"
					class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<Download class="size-4" />
				</button>
				<!-- Historial de eventos: sin funcionalidad todavía, igual que en el
				     resto de la barra de acciones. Se necesita audit_event, que vive
				     en SQL Server y aún no existe. -->
				<button
					type="button"
					disabled
					aria-label="Historial de eventos (aún no disponible)"
					class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground opacity-40"
				>
					<Clock class="size-4" />
				</button>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
				<div
					class="flex h-52 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40"
				>
					{#if urlPrevia}
						<img src={urlPrevia} alt={documento.nombre} class="max-h-full max-w-full object-contain" />
					{:else}
						<span
							class="flex size-28 items-center justify-center rounded-2xl border border-border bg-card text-foreground"
						>
							<FileIcon />
						</span>
					{/if}
				</div>

				<h3 class="mt-6 mb-1 text-base font-medium text-foreground">Información</h3>

				{#snippet valorNombre()}{documento.nombre}{/snippet}
				{@render dato('Nombre de archivo', valorNombre)}

				{#snippet valorEstado()}
					<span class="flex items-center justify-end gap-1.5">
						<span
							class="size-1.5 shrink-0 rounded-full {etiqueta?.tono === 'ok'
								? 'bg-green-500'
								: etiqueta?.tono === 'error'
									? 'bg-red-500'
									: 'bg-primary'}"
						></span>
						{etiqueta?.texto}
					</span>
				{/snippet}
				{@render dato('Estado actual', valorEstado)}

				{#snippet valorIngesta()}{fechaHora(documento.agregadoEn)}{/snippet}
				{@render dato('Fecha y hora de ingesta', valorIngesta)}

				{#snippet valorFuente()}
					<span class="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
						{documento.origen}
					</span>
				{/snippet}
				{@render dato('Fuente de ingesta', valorFuente)}

				{#snippet valorTamano()}{formatearTamano(documento.tamanioBytes)}{/snippet}
				{@render dato('Tamaño del archivo', valorTamano)}

				{#snippet valorFormato()}{documento.extension}{/snippet}
				{@render dato('Formato', valorFormato)}

				{#snippet valorHash()}
					<span class="font-mono text-xs break-all">{documento.hashSha256 ?? '—'}</span>
				{/snippet}
				{@render dato('Hash SHA-256', valorHash)}

				{#snippet valorUsuario()}Benjamin Leon Galvez{/snippet}
				{@render dato('Usuario', valorUsuario)}

				<h3 class="mt-6 mb-1 text-base font-medium text-foreground">Procesamiento OCR</h3>

				<!-- procesado_en lo estampa el back al terminar la llamada a Document AI;
				     terminadoEn es el reloj del navegador cuando llegó la respuesta.
				     El primero es el que se va a guardar en extraction_run, así que es
				     el que hay que mostrar — si difieren, es la latencia de red y más
				     vale que la pantalla y la base digan lo mismo. -->
				{#snippet valorEjecucion()}{fechaHoraIso(
						documento.resultado?._metadata?.procesado_en
					) ?? fechaHora(documento.terminadoEn)}{/snippet}
				{@render dato('Fecha y hora de ejecución', valorEjecucion)}

				{#snippet valorConfianza()}
					<!-- toFixed(2), NO toFixed(1): con un decimal, 99.98 se imprime como
			     "100.0" — un cien que no existe. En una pantalla cuyo trabajo es
			     decir qué tan confiable fue la lectura, mostrar un 100 falso es
			     justo el error que no se puede permitir. Dos decimales es además
			     la precisión real: el back redondea a 2 al convertir de 0-1 a
			     0-100 (`_a_cien` en servicios/ia.py). -->
					{confianza === null ? '—' : `${confianza.toFixed(2)} %`}
				{/snippet}
				{@render dato('Nivel de confianza obtenida', valorConfianza)}

				{#snippet valorCalidad()}{calidad ?? '—'}{/snippet}
				{@render dato('Calidad de la lectura', valorCalidad)}

				{#snippet valorMotor()}
					<span class="font-mono text-xs break-all">
						{documento.resultado?._metadata?.engine_version ?? 'sin fijar'}
					</span>
				{/snippet}
				{@render dato('Versión del modelo', valorMotor)}

				{#if documento.error}
					<div class="mt-6 rounded-lg border border-red-200 bg-red-50 p-3">
						<p class="text-sm font-medium text-red-700">No se pudo procesar</p>
						<p class="mt-1 text-xs text-red-600">{documento.error}</p>
					</div>
				{/if}

				{#if documento.resultado?._metadata?.quality_alert}
					<div class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3">
						<p class="text-sm font-medium text-amber-800">No se reconoció como INE</p>
						<p class="mt-1 text-xs text-amber-700">
							{documento.resultado._metadata.motivo ??
								'Document AI respondió sin campos para este documento.'}
						</p>
					</div>
				{/if}

				<!-- LA SECCIÓN "CAMPOS EXTRAÍDOS" SE QUITÓ EL 2026-08-25, a propósito.
				     No es que estorbara: funcionaba y mostraba el valor de cada campo con
				     su confianza individual. Se retiró porque NO está en el frame de Figma
				     (905:49554) y el UX todavía no la ha revisado — esta pantalla se va a
				     someter a su revisión, y meterle secciones inventadas ensucia lo que
				     tiene que evaluar.

				     Para devolverla: el helper `camposDe()` de $lib/types/ine sigue ahí
				     intacto (aplana `domicilio.estado` y filtra el ruido de la respuesta),
				     así que basta con recuperar este bloque del historial y volver a
				     importarlo con su $derived.
				     Mostraba, por campo: nombre punteado, valor normalizado, el crudo
				     cuando difería, y la confianza coloreada por umbral. -->
			</div>

			<div class="flex justify-end border-t border-border px-6 py-4">
				<Button onclick={() => (open = false)}>Cerrar</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
