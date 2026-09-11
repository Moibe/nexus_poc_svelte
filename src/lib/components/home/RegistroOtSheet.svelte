<script lang="ts">
	/**
	 * Ventana "Registro de OT" (2026-09-10, a pedido explícito).
	 *
	 * El usuario la describió así: *"una ventana como ésta [el modal Detalle de
	 * documento] pero que mostrará los resultados de la extracción de cada
	 * campo"*. Eso es literalmente lo que hace: misma envoltura que
	 * `DetalleDocumentoSheet.svelte`, y en el cuerpo, campo por campo, lo que
	 * el extractor sacó del documento.
	 *
	 * ES DE SOLO LECTURA. "Registrar la OT" —asentar un folio, aprobar algo— NO
	 * existe todavía: no hay orden de trabajo como concepto en el back ni tabla
	 * donde asentarla. Si algún día se pide, esta ventana es donde vive, pero
	 * hoy no escribe nada en ningún lado.
	 *
	 * NO HAY FRAME DE FIGMA. El diseño está DERIVADO del modal de detalle
	 * (HU032, `905:49554`) más el bloque "Campos extraídos" que vivió en esa
	 * misma pantalla hasta el 2026-08-25. El UX no lo ha revisado. Está anotado
	 * en `docs/pendientes-ux.md` con sus desviaciones.
	 *
	 * POR QUÉ LOS CAMPOS VUELVEN AQUÍ Y NO AL DETALLE: en el detalle estuvieron
	 * y se quitaron justamente por no estar en su frame, que está en cola de
	 * revisión de UX. Devolverlos allá reabriría esa discusión; aquí son el
	 * contenido de una ventana que de todos modos nace sin frame.
	 *
	 * DUPLICACIONES A PROPÓSITO, las dos con la misma razón —no tocar una
	 * pantalla que está en cola de revisión de UX solo para compartir código—:
	 *   - El snippet `dato()`, nueve líneas, copiado del detalle.
	 *   - La cabecera, la banda de identidad y el pie.
	 * Cuando el UX apruebe el detalle, las dos se unifican.
	 *
	 * SIRVE PARA CUALQUIER TIPO DOCUMENTAL, no solo INE: `camposDe()` decide
	 * por FORMA (un objeto con `value_normalized` y `metodo_confianza`) y no por
	 * nombre, y desde el 2026-09-07 todos los tipos se extraen por el mismo
	 * `/ia/extraer`. Por eso aquí no hay una sola lista de campos escrita a
	 * mano: se pinta lo que venga.
	 */
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import Download from '@lucide/svelte/icons/download';
	import Clock from '@lucide/svelte/icons/clock';
	import Braces from '@lucide/svelte/icons/braces';
	import VistaJson from './VistaJson.svelte';
	import { formatearTamano } from '$lib/state/bandeja.svelte';
	import { type DocumentoEnPipeline } from '$lib/state/pipeline.svelte';
	import { calidadDe, camposDe, type CampoExtraido } from '$lib/types/ine';
	import { usarVistaPrevia } from '$lib/hooks/usarVistaPrevia.svelte';

	let {
		open = $bindable(false),
		documento
	}: { open?: boolean; documento: DocumentoEnPipeline | null } = $props();

	const previa = usarVistaPrevia(() => documento);
	/** El interruptor del modo JSON. Vive por panel y NO se reinicia al cambiar
	 *  de documento: quien lo prendió está inspeccionando, y apagárselo en cada
	 *  documento nuevo sería pelear contra lo que está haciendo. */
	let modoJson = $state(false);

	/** Lo que este panel muestra, serializable. `resultado` va VERBATIM: es la
	 *  respuesta del extractor tal como llegó, con sus campos y su capa `ocr`,
	 *  que es la parte que sirve para pegar en un reporte o comparar dos
	 *  corridas. El `File` NO va: stringify de un File da `{}`. */
	const datosJson = $derived(
		documento === null
			? null
			: {
					archivo: {
						nombre: documento.nombre,
						formato: documento.extension,
						tamanioBytes: documento.tamanioBytes,
						hashSha256: documento.hashSha256
					},
					documentoDetectado: documento.tipoDetectado,
					estado: documento.estado,
					error: documento.error ?? null,
					resultado: documento.resultado ?? null
				}
	);

	const campos = $derived(documento?.resultado ? camposDe(documento.resultado) : []);
	// El PROMEDIO de todos los campos, no el mínimo (cambio pedido el
	// 2026-09-10). El mínimo sigue llegando en la respuesta como
	// `confianza_minima` por si algún día se quiere señalar el peor campo.
	const confianza = $derived(documento?.resultado?.confianza_promedio ?? null);
	const calidad = $derived(calidadDe(confianza));

	// El número de página solo se muestra si el documento tiene más de una: en
	// uno de una sola página, "Página 1" en cada campo es ruido puro.
	const variasPaginas = $derived((documento?.resultado?.ocr?.page_count ?? 1) > 1);

	// Estados en los que todavía no hay nada que mostrar porque el pipeline no
	// ha terminado. Se listan explícitamente en vez de preguntar por
	// `resultado === null`, porque un documento fallido también lo tiene en null
	// y ese sí tiene algo que decir.
	const enProceso = $derived(
		documento !== null &&
			['en_cola', 'clasificando', 'clasificado', 'procesando'].includes(documento.estado)
	);

	/**
	 * El valor que se pinta. `??` NO alcanza: el back deja pasar la cadena
	 * vacía —su guardia es `is not None`, no `if not`— y `value_normalized ?? '—'`
	 * la dejaría como un renglón en blanco. Es la misma regla que ya usa
	 * `RevisionPrompt.svelte`.
	 */
	function valorExtraido(campo: CampoExtraido): string {
		return campo.value_normalized ?? campo.value_raw ?? '';
	}

	/**
	 * El crudo solo se muestra cuando de verdad aporta algo, o sea cuando la
	 * normalización lo cambió. Hoy eso pasa esencialmente en fechas completas,
	 * que el back convierte a ISO; en todo lo demás el normalizado ES el crudo y
	 * repetirlo sería ruido.
	 */
	function difiereDelCrudo(campo: CampoExtraido): boolean {
		return (
			campo.value_raw !== null &&
			campo.value_raw !== '' &&
			campo.value_raw !== campo.value_normalized
		);
	}

	/**
	 * El color se deriva de `calidadDe()` y no de umbrales escritos aquí: esos
	 * cortes ya viven en un solo lugar (`$lib/types/ine`) y van a morir el día
	 * que existan los umbrales por campo de `field_definition`. Una tercera
	 * copia de 85/60 garantizaba que se desincronizaran.
	 */
	function claseConfianza(valor: number | null): string {
		switch (calidadDe(valor)) {
			case 'Buena':
				return 'text-green-600';
			case 'Media':
				return 'text-amber-600';
			case 'Baja':
				return 'text-red-600';
			default:
				return 'text-muted-foreground';
		}
	}

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

	function descargar() {
		if (!documento) return;
		const url = URL.createObjectURL(documento.archivo);
		const enlace = document.createElement('a');
		enlace.href = url;
		enlace.download = documento.nombre;
		// El <a> se INSERTA en el DOM porque Firefox ignora el click() de un
		// elemento que no está en el documento, y la URL se revoca en el
		// siguiente tick porque revokeObjectURL() es inmediato y en el mismo
		// tick la descarga saldría vacía. Igual que en el detalle.
		document.body.appendChild(enlace);
		enlace.click();
		enlace.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}
</script>

{#snippet dato(etiquetaTexto: string, contenido: import('svelte').Snippet)}
	<div class="flex items-start justify-between gap-4 border-b border-border py-3">
		<span class="shrink-0 text-sm text-muted-foreground">{etiquetaTexto}</span>
		<div class="min-w-0 max-w-[62%] text-right text-sm text-foreground">{@render contenido()}</div>
	</div>
{/snippet}

{#snippet aviso(tono: 'ambar' | 'rojo', titulo: string, cuerpo: string)}
	<div
		class="mb-4 rounded-lg border p-3 {tono === 'rojo'
			? 'border-red-200 bg-red-50'
			: 'border-amber-200 bg-amber-50'}"
	>
		<p class="text-sm font-medium {tono === 'rojo' ? 'text-red-700' : 'text-amber-800'}">
			{titulo}
		</p>
		<p class="mt-1 text-xs {tono === 'rojo' ? 'text-red-600' : 'text-amber-700'}">{cuerpo}</p>
	</div>
{/snippet}

<Sheet.Root bind:open>
	<Sheet.Content
		side="right"
		showCloseButton={false}
		data-testid="modal-registro-ot"
		class="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-147.5"
	>
		<div class="flex items-center gap-3 border-b border-border px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Registro de OT
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
					data-testid="descargar-ot"
					class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<Download class="size-4" />
				</button>
				<!-- Historial de eventos. Sin funcionalidad TODAVÍA: sigue
				     necesitando `audit_event`, que vive en SQL Server y aún no
				     existe.
				     Historia corta, para que no parezca un vaivén sin sentido: este
				     ícono estuvo aquí, se quitó el 2026-09-10 porque llevaba meses
				     apagado y era ruido, y VOLVIÓ el 2026-09-11 a pedido explícito
				     ("agrega de nuevo el relojito, ahorita te digo para qué nos va a
				     servir"). Ahora está en los DOS paneles, no solo en éste.
				     Nace deshabilitado y sin `onclick` a propósito, igual que el
				     resto de lo que falta por cablear: en cuanto se sepa qué hace,
				     aquí es donde se engancha. -->
				<button
					type="button"
					disabled
					aria-label="Historial de eventos (aún no disponible)"
					data-testid="historial-eventos"
					class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground opacity-40"
				>
					<Clock class="size-4" />
				</button>
				<!-- Modo JSON. Al extremo derecho de la banda, igual que en
				     "Detalle" (2026-09-10, a pedido explícito). Es un INTERRUPTOR:
				     por eso `aria-pressed` y un `title` que dice a dónde lleva. -->
				<button
					type="button"
					onclick={() => (modoJson = !modoJson)}
					aria-pressed={modoJson}
					aria-label="Ver como JSON"
					title={modoJson ? 'Ver en forma normal' : 'Ver como JSON'}
					data-testid="alternar-json"
					class="flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors {modoJson
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<Braces class="size-4" />
				</button>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
				{#if modoJson}
					<VistaJson datos={datosJson} testid="json-registro-ot" />
				{:else}
					<div
						class="flex h-52 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40"
					>
						{#if previa.url}
							<img
								src={previa.url}
								alt={documento.nombre}
								class="max-h-full max-w-full object-contain"
							/>
						{:else}
							<span
								class="flex size-28 items-center justify-center rounded-2xl border border-border bg-card text-foreground"
							>
								<FileIcon />
							</span>
						{/if}
					</div>

					<!-- Resumen corto, no el "Información" completo del detalle: esa
					     ventana ya existe y repetir sus nueve renglones aquí solo
					     alejaría los campos, que son el contenido de ésta. Se conserva
					     únicamente lo que da contexto para LEER los campos. -->
					<h3 class="mt-6 mb-1 text-base font-medium text-foreground">Extracción</h3>

					{#snippet valorTipo()}{documento.tipoDetectado ?? '—'}{/snippet}
					{@render dato('Documento detectado', valorTipo)}

					{#snippet valorEjecucion()}{fechaHoraIso(
							documento.resultado?._metadata?.procesado_en
						) ?? fechaHora(documento.terminadoEn)}{/snippet}
					{@render dato('Fecha y hora de ejecución', valorEjecucion)}

					{#snippet valorConfianza()}
						<!-- toFixed(2) y no toFixed(1): con un decimal, 99.98 se imprime
						     "100.0", un cien que no existe. Es además la precisión real,
						     porque el back ya redondea a dos al pasar de 0-1 a 0-100. -->
						{confianza === null ? '—' : `${confianza.toFixed(2)} %`}{calidad
							? ` · ${calidad}`
							: ''}
					{/snippet}
					{@render dato('Nivel de confianza obtenida', valorConfianza)}

					<h3 class="mt-6 mb-2 text-base font-medium text-foreground">
						Campos extraídos
						{#if campos.length > 0}
							<span class="ml-1 text-xs font-normal text-muted-foreground">({campos.length})</span>
						{/if}
					</h3>

					<!-- Los avisos van ARRIBA de la lista y no abajo como en el detalle:
					     aquí, cuando hay aviso, normalmente no hay campos, así que el
					     aviso ES el contenido de la ventana. -->
					{#if documento.error}
						{@render aviso('rojo', 'No se pudo procesar', documento.error)}
					{/if}

					{#if documento.resultado?._metadata?.quality_alert}
						{@render aviso(
							'ambar',
							'No se reconocieron sus campos',
							documento.resultado._metadata.motivo ??
								'Document AI respondió sin campos para este documento.'
						)}
					{/if}

					{#if documento.estado === 'no_configurado'}
						{@render aviso(
							'ambar',
							'Tipo documental no configurado',
							'El clasificador no encontró ningún tipo documental activo que corresponda a este documento, así que no se le extrajo ningún dato.'
						)}
					{/if}

					{#if documento.estado === 'pendiente_revision'}
						{@render aviso(
							'ambar',
							'Pendiente de revisión humana',
							'Su tipo documental no está configurado y se eligió continuar sin configurarlo, así que no se le extrajo ningún dato.'
						)}
					{/if}

					{#if campos.length > 0}
						<div class="flex flex-col gap-2">
							{#each campos as [nombre, campo] (nombre)}
								<div
									class="rounded-lg border border-border bg-background px-3 py-2"
									data-testid="ficha-campo-ot"
									data-campo={nombre}
								>
									<div class="flex items-baseline justify-between gap-3">
										<!-- El nombre se pinta CRUDO, en monoespaciada: llega en
										     snake_case sin acentos porque el back lo normaliza al
										     crear el esquema (`fecha_de_nacimiento`). Convertirlo a
										     una etiqueta bonita no se puede con una función pura —la
										     normalización trunca y desambigua con sufijos—, así que
										     mostrar la llave real es más honesto que adivinar. -->
										<span class="min-w-0 font-mono text-xs break-all text-muted-foreground">
											{nombre}
										</span>
										<!-- Sin confianza NO se pinta nada, en vez de un "0 %": el
										     back manda null cuando Document AI omite el dato, y
										     confundir "no lo sé" con "cero" ya causó un incidente. -->
										{#if campo.confianza !== null}
											<span
												class="shrink-0 text-xs tabular-nums {claseConfianza(campo.confianza)}"
											>
												{campo.confianza.toFixed(2)} % · {calidadDe(campo.confianza)}
											</span>
										{/if}
									</div>
									<p class="mt-0.5 text-sm break-words text-foreground">
										{valorExtraido(campo) || '—'}
									</p>
									{#if difiereDelCrudo(campo)}
										<p class="mt-0.5 text-xs text-muted-foreground">
											Crudo: <span class="font-mono">{campo.value_raw}</span>
										</p>
									{/if}
									{#if variasPaginas && campo.page_number !== null}
										<p class="mt-0.5 text-xs text-muted-foreground">Página {campo.page_number}</p>
									{/if}
								</div>
							{/each}
						</div>
					{:else if enProceso}
						<p class="text-sm text-muted-foreground" data-testid="ot-en-proceso">
							Este documento todavía se está procesando. Sus campos aparecerán aquí al terminar.
						</p>
					{:else if !documento.error && documento.estado !== 'no_configurado' && documento.estado !== 'pendiente_revision' && !documento.resultado?._metadata?.quality_alert}
						<!-- Caso real y fácil de pasar por alto: el documento salió "Listo",
						     en verde, sin alerta de calidad, y aun así no hay un solo campo.
						     Pasa cuando el extractor responde con la lista de entidades
						     vacía, o cuando todas vienen sin valor. Se dice en gris neutro y
						     no en ámbar a propósito: el sistema funcionó, simplemente no
						     encontró nada. -->
						<p class="text-sm text-muted-foreground" data-testid="ot-sin-campos">
							El extractor no reconoció ningún campo en este documento.
						</p>
					{/if}
				{/if}
			</div>

			<div class="flex justify-end border-t border-border px-6 py-4">
				<Button onclick={() => (open = false)}>Cerrar</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
