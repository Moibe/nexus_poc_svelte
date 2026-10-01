<script lang="ts">
	/**
	 * Módulo "Expedientes virtuales" (2026-10-01, a pedido explícito con dos
	 * capturas de Figma), que abre "Ver expediente" en la píldora del Pipeline.
	 *
	 * ## QUÉ MUESTRA HOY, Y POR QUÉ ESO
	 *
	 * **Todos los documentos que hay en las bandejas, y nada más.** Es lo que se
	 * pidió, con esas palabras: *"por ahora no voy a lidiar con Expedientes así
	 * es que lo único que mostrará es todos los documentos que tengamos en las
	 * bandejas, that simple"*.
	 *
	 * Así que el expediente **no existe todavía** como concepto: no hay tabla,
	 * no hay agrupación, y ningún documento pertenece a ninguno. Esta pantalla
	 * es la envoltura del diseño con el contenido que sí hay. De ahí las tres
	 * desviaciones del frame, todas por lo mismo —no fabricar lo que no existe—:
	 *
	 *   · El frame dibuja en el árbol un expediente llamado `Expediente.vir_1`.
	 *     Aquí la rama dice **"Todos los documentos"**, que es lo que de verdad
	 *     se está listando. Inventar un nombre de expediente haría creer que hay
	 *     uno.
	 *   · El frame pone **"Páginas 4"** en las seis tarjetas. El número de
	 *     páginas solo lo sabe el OCR de un documento ya procesado, así que se
	 *     muestra únicamente cuando se sabe.
	 *   · (El **menú ⋮** de cada tarjeta se dejó fuera al principio por no
	 *     tener acciones que ofrecer. Desde el 2026-10-01 sí las tiene, a
	 *     pedido: Detalle, Registro de OT y Estado de ese documento.)
	 *
	 * Lo que sí se agrega y el frame no tiene: **de qué bandeja viene** cada
	 * documento, porque la rejilla las mezcla y sin eso no se sabría.
	 *
	 * ## La cáscara
	 *
	 * Copiada de `ApiKeySheet.svelte`, que a su vez la copió del módulo de
	 * configuración: cabecera con nombre y X, banda de título con ícono
	 * redondo, sidebar de 330px y panel. Es la misma que dibuja el frame.
	 *
	 * Abre desde la píldora del Pipeline y **no depende de qué documento esté
	 * seleccionado**: muestra todo. Por eso su acción no exige un documento
	 * único, a diferencia de "Detalle", "Registro de OT" y "Estado".
	 */
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ArrowRightIcon from '$lib/components/icons/ArrowRightIcon.svelte';
	import EmptyState from './EmptyState.svelte';
	import PanelIconCluster from './PanelIconCluster.svelte';
	import TarjetaExpediente, { type DocEnExpediente } from './TarjetaExpediente.svelte';
	import { documentosEnBandeja } from '$lib/state/bandeja.svelte';
	import { documentosEnPipeline } from '$lib/state/pipeline.svelte';

	let {
		open = $bindable(false),
		alAbrirDetalle,
		alAbrirRegistroOt,
		alAbrirEstado
	}: {
		open?: boolean;
		alAbrirDetalle: (id: string) => void;
		alAbrirRegistroOt: (id: string) => void;
		alAbrirEstado: (id: string) => void;
	} = $props();

	const BANDEJA = 'Bandeja de preparación';
	const PIPELINE = 'Pipeline documental';

	/**
	 * Las dos bandejas, en una sola lista: primero lo del pipeline —que es lo
	 * más avanzado del flujo y lo que más información trae— y después lo que
	 * sigue esperando en la bandeja de preparación.
	 *
	 * No se deduplica por huella a propósito: un documento está en UNA bandeja a
	 * la vez (al mandarlo al pipeline sale de la otra), así que no hay repetidos
	 * que juntar.
	 */
	const documentos = $derived<DocEnExpediente[]>([
		...documentosEnPipeline.map((d) => ({
			id: d.id,
			nombre: d.nombre,
			extension: d.extension,
			archivo: d.archivo,
			fecha: d.agregadoEn,
			paginas: d.resultado?.ocr?.page_count ?? null,
			tipo: d.tipoDetectado,
			bandeja: PIPELINE,
			procesado: true
		})),
		...documentosEnBandeja.map((d) => ({
			id: d.id,
			nombre: d.nombre,
			extension: d.extension,
			archivo: d.archivo,
			fecha: d.agregadoEn,
			paginas: null,
			tipo: null,
			bandeja: BANDEJA,
			procesado: false
		}))
	]);
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-expedientes"
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Expedientes virtuales
			</Sheet.Title>
			<Sheet.Close
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</Sheet.Close>
		</div>

		<div class="flex items-center gap-3 px-6 py-4">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
			>
				<FolderLibraryIcon />
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="text-lg font-medium text-foreground">Gestión de expedientes</h2>
				<Sheet.Description class="text-sm">
					Consulta los documentos asociados a los expedientes y revisa su información, estado y
					relación con el proceso documental.
				</Sheet.Description>
			</div>
		</div>

		<div class="flex min-h-0 flex-1">
			<aside
				class="flex w-82.5 shrink-0 flex-col overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
			>
				<p class="text-xs text-foreground">Expedientes</p>
				<!-- Va como <div> y no como <button>, igual que en el módulo de API
				     Keys: hoy no navega a ningún lado, y un botón que no hace nada
				     promete algo que no cumple. -->
				<div class="mt-6 flex w-full items-center gap-3" data-testid="seccion-expedientes">
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
					>
						<FolderLibraryIcon />
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-foreground">Biblioteca</p>
						<p class="mt-2 text-xs text-muted-foreground">
							Localiza tu listado de expedientes generados.
						</p>
					</div>
					<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />
				</div>

				<!-- Una sola rama, con la misma geometría que el árbol de los módulos
				     hermanos. Dice lo que de verdad hay: todos los documentos, no un
				     expediente — ver el docstring. No es un botón porque no hay nada
				     que filtrar: es la única rama. -->
				<ul class="mt-4">
					<li class="relative flex h-9.5 items-center pl-11">
						<span class="absolute top-1/2 left-11 h-5.5 w-px -translate-y-1/2 bg-border"></span>
						<span class="absolute top-1/2 left-11 h-px w-[11.5px] bg-border"></span>
						<span
							class="ml-[19.5px] min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
							data-testid="rama-expediente"
						>
							Todos los documentos
						</span>
					</li>
				</ul>
			</aside>

			<div class="flex min-h-0 min-w-0 flex-1 flex-col">
				<div class="flex-1 overflow-y-auto p-8">
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0">
							<h3 class="text-base font-medium text-foreground">Información del expediente</h3>
							<p class="mt-1 text-sm text-muted-foreground">
								Consulta y revisa la documentación que integra el expediente, junto con la
								información extraída y validada durante su procesamiento.
							</p>
						</div>
						<PanelIconCluster />
					</div>

					{#if documentos.length === 0}
						<div class="py-10" data-testid="expedientes-vacio">
							<EmptyState
								icon={FolderLibraryIcon}
								title="No hay documentos en las bandejas"
								description="Lo que subas o lo que llegue por la API aparecerá aquí mientras esté en alguna bandeja."
							/>
						</div>
					{:else}
						<div
							class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
							data-testid="rejilla-expedientes"
						>
							{#each documentos as documento (documento.id)}
								<TarjetaExpediente {documento} {alAbrirDetalle} {alAbrirRegistroOt} {alAbrirEstado} />
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex justify-end gap-2 border-t border-border px-6 py-4">
					<Button onclick={() => (open = false)} data-testid="cerrar-expedientes">Cerrar</Button>
				</div>
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>
