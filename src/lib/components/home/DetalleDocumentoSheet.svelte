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
	import FileText from '@lucide/svelte/icons/file-text';
	import Clock from '@lucide/svelte/icons/clock';
	import Braces from '@lucide/svelte/icons/braces';
	import Download from '@lucide/svelte/icons/download';
	import VistaJson from './VistaJson.svelte';
	import FiltrosAvanzados from './FiltrosAvanzados.svelte';
	import { formatearTamano } from '$lib/state/bandeja.svelte';
	import { etiquetaDe, type DocumentoEnPipeline } from '$lib/state/pipeline.svelte';
	import { calidadDe } from '$lib/types/ine';
	import { construirInforme, fechaHora, fechaHoraIso } from '$lib/documentos/informeDocumento';
	import { usarVistaPrevia } from '$lib/hooks/usarVistaPrevia.svelte';
	import {
		descargarJson,
		descargarPdf,
		sinExtension,
		type Informe
	} from '$lib/documentos/descargar';

	let {
		open = $bindable(false),
		documento
	}: { open?: boolean; documento: DocumentoEnPipeline | null } = $props();

	const etiqueta = $derived(documento ? etiquetaDe(documento) : null);
	// El PROMEDIO de todos los campos, no el mínimo (cambio pedido el
	// 2026-09-10). El mínimo sigue llegando en la respuesta como
	// `confianza_minima` por si algún día se quiere señalar el peor campo.
	const confianza = $derived(documento?.resultado?.confianza_promedio ?? null);
	const calidad = $derived(calidadDe(confianza));

	// La vista previa vivía aquí como un `$effect` de doce líneas hasta el
	// 2026-09-10. Se movió a `$lib/hooks/usarVistaPrevia.svelte` cuando
	// "Registro de OT" necesitó exactamente lo mismo: las dos decisiones que
	// hacen que funcione (revocar a mano, y depender del documento y no de
	// `open`) están documentadas allá, y copiarlas garantizaba que divergieran.
	const previa = usarVistaPrevia(() => documento);
	/** Cuál de las dos vistas está puesta: false = detalle, true = JSON. Vive
	 *  por panel y NO se reinicia al cambiar de documento: quien se pasó a JSON
	 *  está inspeccionando, y regresarlo al detalle en cada documento nuevo
	 *  sería pelear contra lo que está haciendo. */
	let modoJson = $state(false);

	/** El modal de "Filtros avanzados", que abre el reloj de la banda. */
	let filtrosAbiertos = $state(false);

	/** Placeholder mientras no hay autenticación (ver la nota en el cuerpo,
	 *  donde se pinta). Vive en una constante porque desde el 2026-09-11 se
	 *  usa en dos lados —la pantalla y el PDF—, y escribirlo dos veces era
	 *  garantizar que un día dijeran nombres distintos. */
	const USUARIO = 'Moisés Briseño Estrello';

	/** Lo que este panel muestra, serializable. `resultado` va VERBATIM: es la
	 *  respuesta del extractor tal como llegó, que es la parte que sirve para
	 *  pegar en un reporte. El `File` NO va: stringify de un File da `{}`. */
	const datosJson = $derived(
		documento === null
			? null
			: {
					archivo: {
						nombre: documento.nombre,
						formato: documento.extension,
						tamanioBytes: documento.tamanioBytes,
						hashSha256: documento.hashSha256,
						origen: documento.origen,
						ingestadoEn: documento.agregadoEn
					},
					documentoDetectado: documento.tipoDetectado,
					estado: { clave: documento.estado, texto: etiqueta?.texto ?? null },
					terminadoEn: documento.terminadoEn,
					error: documento.error ?? null,
					resultado: documento.resultado ?? null
				}
	);

	/** El informe que se convierte en PDF. Se arma en `informeDocumento.ts` y
	 *  no aquí desde el 2026-09-11: "Registro de OT" descarga LO MISMO, y con el
	 *  armado duplicado en dos archivos eso duraba hasta el primer cambio que
	 *  alguien hiciera en uno solo. */
	const informe = $derived<Informe | null>(
		documento === null ? null : construirInforme(documento, 'Detalle de documento')
	);

	/** Hay una descarga en curso. El PDF trae consigo cargar jsPDF, que la
	 *  primera vez tarda lo suficiente para alcanzar a dar dos clics — y serían
	 *  dos archivos. */
	let descargando = $state(false);

	/** Baja LO QUE SE ESTÁ VIENDO, no el archivo original: PDF en modo documento,
	 *  JSON en modo JSON. El archivo original el usuario ya lo tiene; el
	 *  resultado del procesamiento no existe en ninguna otra parte hasta aquí. */
	async function descargar() {
		if (documento === null || informe === null || descargando) return;
		descargando = true;
		const base = sinExtension(documento.nombre);
		try {
			if (modoJson) {
				descargarJson(datosJson, `${base}-detalle.json`);
			} else {
				await descargarPdf(informe, `${base}-detalle.pdf`);
			}
		} catch (error) {
			// Esta pantalla no tiene dónde avisar todavía —no hay toasts en el
			// proyecto—, así que la falla va a la consola en vez de perderse. El
			// botón se vuelve a habilitar en el `finally`, que es lo que permite
			// reintentar.
			console.error('No se pudo generar la descarga del detalle', error);
		} finally {
			descargando = false;
		}
	}

	/** `procesado_en` viene en ISO-8601 UTC; se muestra en la hora local de quien
	 *  mira, que es lo que espera cualquiera leyendo una pantalla. */
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
		data-testid="modal-detalle-documento"
		class="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-147.5"
	>
		<div class="flex items-center gap-3 border-b border-border px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Detalle de documento
			</Sheet.Title>
			<!-- Los dos accesos de vista viven en la CABECERA, junto al tache
			     (2026-09-11, a pedido explícito: "que se vean más generales, que se
			     vea que pertenecen a ambos"). Estaban en la banda del archivo, y ahí
			     se leían como acciones sobre ESE archivo; arriba, en el mismo
			     renglón que el título y el cierre, se leen como lo que son: en qué
			     vista está el panel.
			     Son dos botones y no un interruptor: cada uno LLEVA a su vista y el
			     activo se queda pintado, así que la cabecera dice en cuál estás sin
			     tener que leer el contenido. -->
			<button
				type="button"
				onclick={() => (modoJson = false)}
				aria-pressed={!modoJson}
				aria-label="Ver detalle"
				title="Ver detalle"
				data-testid="ver-detalle"
				class="flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors {modoJson
					? 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
					: 'border-primary bg-primary text-primary-foreground'}"
			>
				<FileText class="size-4" />
			</button>
			<button
				type="button"
				onclick={() => (modoJson = true)}
				aria-pressed={modoJson}
				aria-label="Ver como JSON"
				title="Ver como JSON"
				data-testid="ver-json"
				class="flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors {modoJson
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
			>
				<Braces class="size-4" />
			</button>
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
				<!-- El reloj de "Filtros avanzados" se OCULTA momentáneamente
				     (2026-09-11, a pedido explícito: "quiero volver a quitar el
				     reloj"). NO es el mismo caso que el retiro del 2026-09-10: aquel
				     era un botón que nunca había funcionado; este SÍ funciona —abre
				     `FiltrosAvanzados.svelte` de verdad— y se apaga solo por ahora.
				     Todo el cableado se queda intacto a propósito (el estado
				     `filtrosAbiertos`, el import, el modal montado al final del
				     archivo): reactivar esto es descomentar el bloque de abajo, no
				     reconstruir nada.
				     <button
				     	type="button"
				     	onclick={() => (filtrosAbiertos = true)}
				     	aria-label="Filtros avanzados"
				     	title="Filtros avanzados"
				     	data-testid="historial-eventos"
				     	class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				     >
				     	<Clock class="size-4" />
				     </button>
				     -->
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
				{#if modoJson}
					<VistaJson datos={datosJson} testid="json-detalle" />
				{:else}
					<div
						class="flex h-52 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40"
					>
						{#if previa.url}
							<img src={previa.url} alt={documento.nombre} class="max-h-full max-w-full object-contain" />
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

					<!-- Justo debajo del nombre, igual que en el renglón del pipeline
					     (2026-09-08, a pedido explícito en los dos lugares). Solo cuando
					     SÍ se identificó un tipo: con `otro` no hay documento detectado
					     que nombrar, y "Estado actual" —el renglón de abajo— ya dice
					     "Tipo documental no configurado". -->
					{#if documento.tipoDetectado}
						{#snippet valorDetectado()}{documento.tipoDetectado}{/snippet}
						{@render dato('Documento detectado', valorDetectado)}
					{/if}

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

					<!-- Sigue siendo un placeholder, igual que el del TopBar: no hay
					     autenticación todavía, así que no existe "el usuario que procesó
					     este documento" como dato real. El nombre del volcado de Figma
					     (Benjamin Leon Galvez) se reemplazó por el del usuario real a
					     pedido explícito, para no ver un nombre ajeno en las demos. -->
					{#snippet valorUsuario()}{USUARIO}{/snippet}
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
							<!-- Decía "No se reconoció como INE" hasta el 2026-09-07: desde que
							     cada tipo documental se extrae con SU procesador, este aviso
							     puede venir de cualquiera de ellos y nombrar a INE sería
							     mentira en todos los demás. Mismo cambio que en
							     `ETIQUETA_ESTADO.no_reconocido`. -->
							<p class="text-sm font-medium text-amber-800">No se reconocieron sus campos</p>
							<p class="mt-1 text-xs text-amber-700">
								{documento.resultado._metadata.motivo ??
									'Document AI respondió sin campos para este documento.'}
							</p>
						</div>
					{/if}

					{#if documento.estado === 'no_configurado'}
						<div class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3">
							<p class="text-sm font-medium text-amber-800">Tipo documental no configurado</p>
							<p class="mt-1 text-xs text-amber-700">
								El clasificador no encontró ningún tipo documental activo que corresponda a
								este documento.
							</p>
						</div>
					{/if}

					{#if documento.estado === 'pendiente_revision'}
						<div class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3">
							<p class="text-sm font-medium text-amber-800">Pendiente de revisión humana</p>
							<p class="mt-1 text-xs text-amber-700">
								Su tipo documental no está configurado y se eligió continuar sin
								configurarlo, así que no se le extrajo ningún dato.
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
				{/if}
			</div>

			<!-- "Descargar" baja lo que se está viendo: PDF en modo documento, JSON
			     en modo JSON (2026-09-11, a pedido explícito). Va en el pie junto a
			     "Cerrar" —ahí se pidió— y no en la banda de íconos de arriba: la
			     banda ELIGE vista, y este botón obedece a la que esté puesta. Por
			     eso la leyenda dice sólo "Descargar" y el formato se anuncia en el
			     title, que es donde no compite con los dos botones que sí deciden.
			     -->
			<div class="flex justify-end gap-2 border-t border-border px-6 py-4">
				<Button
					variant="outline"
					onclick={descargar}
					disabled={descargando}
					title={modoJson ? 'Descargar JSON' : 'Descargar PDF'}
					data-testid="descargar-detalle"
				>
					<Download />
					Descargar
				</Button>
				<Button onclick={() => (open = false)}>Cerrar</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>

<FiltrosAvanzados abierto={filtrosAbiertos} onCerrar={() => (filtrosAbiertos = false)} />
