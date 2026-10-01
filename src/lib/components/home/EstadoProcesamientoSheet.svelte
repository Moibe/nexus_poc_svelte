<script lang="ts">
	/**
	 * Ventana "Estado" (2026-10-01, a pedido explícito con dos capturas de
	 * Figma): la línea de tiempo con TODOS los cambios de estado por los que ha
	 * pasado un documento, desde que entró hasta donde va.
	 *
	 * El usuario lo describió así: *"básicamente contendrá todos los cambios de
	 * estado que ha tenido ese documento, o sea desde que fue subido, procesado,
	 * etc"*. Por eso la historia arranca en la BANDEJA y no en el pipeline: el
	 * documento es el mismo y su vida empieza cuando se sube o cuando la API lo
	 * recibe. La historia se registra al momento de cada cambio; de dónde sale y
	 * qué alcance tiene está en `historialEstados.ts`.
	 *
	 * ## En qué se parece al frame y en qué no
	 *
	 * Igual: panel derecho, la vista previa del archivo arriba, el título
	 * "Estado del procesamiento", y la línea vertical con un punto por evento,
	 * **del más reciente al más viejo**, cada uno con su fecha y hora.
	 *
	 * Distinto, y a propósito:
	 *
	 *   · **Los nombres de los estados son los de verdad.** El frame dibuja
	 *     PENDING, VALIDATING, REJECTED, HASHING, DUPLICATE y READY, que es el
	 *     vocabulario de la BASE del DBA: ni esas tablas existen todavía ni el
	 *     front pasa por esos estados. Inventar la equivalencia sería enseñar un
	 *     recorrido que no ocurrió. Aquí se nombran los estados reales, con las
	 *     mismas palabras que ya usa el renglón del documento ("Calculando
	 *     huella y verificando", "Procesando INE", "Listo"…). El día que exista
	 *     `audit_event`, los nombres vendrán de ahí.
	 *   · **Los puntos se colorean por resultado**, no todos en verde: verde si
	 *     salió bien, rojo si falló, gris mientras va en camino. El frame los
	 *     pinta todos verdes porque solo dibuja un recorrido feliz, y pintar un
	 *     fallo en verde sería mentira.
	 *   · Se dice en qué bandeja estaba el documento en cada tramo, que es
	 *     información que el frame no tiene porque dibuja un solo bloque.
	 *
	 * La cáscara —cabecera, banda de identidad, vista previa, pie— está copiada
	 * de `RegistroOtSheet.svelte`, con la misma razón que allá: esas piezas se
	 * unifican cuando el UX apruebe el panel de detalle, que está en cola de
	 * revisión.
	 */
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import { formatearTamano } from '$lib/state/bandeja.svelte';
	import { type DocumentoEnPipeline } from '$lib/state/pipeline.svelte';
	import type { EventoDeEstado } from '$lib/state/historialEstados';
	import type { DocumentoEnBandeja } from '$lib/state/bandeja.svelte';
	import { usarVistaPrevia } from '$lib/hooks/usarVistaPrevia.svelte';

	let {
		open = $bindable(false),
		documento
	}: { open?: boolean; documento: DocumentoEnPipeline | DocumentoEnBandeja | null } = $props();

	// Lo que llegó por la API puede no tener bytes todavía (siguen en el
	// almacén): sin archivo no hay vista previa.
	const previa = usarVistaPrevia(() =>
		documento?.archivo ? { archivo: documento.archivo, extension: documento.extension } : null
	);

	/** Del más reciente al más viejo, como en el frame. `toReversed` no muta:
	 *  el historial del documento se queda en su orden natural. */
	const eventos = $derived<EventoDeEstado[]>(documento ? [...documento.historial].reverse() : []);

	const PUNTO: Record<EventoDeEstado['tono'], string> = {
		ok: 'bg-green-500',
		error: 'bg-red-500',
		proceso: 'bg-muted-foreground/40'
	};

	function fechaHora(fecha: Date | null): string {
		if (!fecha) return '—';
		const dia = String(fecha.getDate()).padStart(2, '0');
		const mes = String(fecha.getMonth() + 1).padStart(2, '0');
		const hh = String(fecha.getHours()).padStart(2, '0');
		const mm = String(fecha.getMinutes()).padStart(2, '0');
		return `${dia}/${mes}/${fecha.getFullYear()} | ${hh}:${mm}`;
	}

	const BANDEJA: Record<EventoDeEstado['fase'], string> = {
		bandeja: 'Bandeja de preparación',
		pipeline: 'Pipeline documental'
	};
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="right"
		showCloseButton={false}
		data-testid="modal-estado"
		class="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-147.5"
	>
		<div class="flex items-center gap-3 border-b border-border px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">Estado</Sheet.Title>
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
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
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

				<h3 class="mt-6 mb-3 text-base font-medium text-foreground">Estado del procesamiento</h3>

				{#if eventos.length === 0}
					<!-- No debería verse: todo documento del pipeline trae al menos su
					     entrada a la bandeja. Se dice así, y no con una línea vacía, por
					     si llegara uno de antes de que esto existiera. -->
					<p class="text-sm text-muted-foreground" data-testid="estado-sin-historia">
						De este documento no se registraron cambios de estado.
					</p>
				{:else}
					<!-- La línea se dibuja POR TRAMOS y no como un borde de la lista: un
					     borde corrido se pasa de largo por debajo del último punto y
					     queda colgando. Cada renglón pone el tramo de arriba si tiene
					     antecesor y el de abajo si tiene sucesor, así que la línea
					     empieza exactamente en el primer punto y termina en el último. -->
					<ol data-testid="linea-de-estados">
						{#each eventos as evento, indice (indice)}
							<li class="relative flex gap-4 py-3 pl-6">
								{#if indice > 0}
									<span class="absolute top-0 left-[4px] h-5 w-px bg-border" aria-hidden="true"
									></span>
								{/if}
								{#if indice < eventos.length - 1}
									<span
										class="absolute top-[30px] bottom-0 left-[4px] w-px bg-border"
										aria-hidden="true"
									></span>
								{/if}
								<span
									class="absolute top-5 left-0 size-2.5 rounded-full {PUNTO[evento.tono]}"
									aria-hidden="true"
								></span>
								<div
									class="min-w-0 flex-1 {indice < eventos.length - 1
										? 'border-b border-border pb-3'
										: ''}"
								>
									<p class="text-sm font-medium text-foreground">{evento.etiqueta}</p>
									<p class="mt-0.5 text-xs text-muted-foreground">
										{fechaHora(evento.en)} · {BANDEJA[evento.fase]}
									</p>
								</div>
							</li>
						{/each}
					</ol>
				{/if}
			</div>

			<div class="flex justify-end gap-2 border-t border-border px-6 py-4">
				<Button onclick={() => (open = false)} data-testid="cerrar-estado">Cerrar</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
