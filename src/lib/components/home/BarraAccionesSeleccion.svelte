<script lang="ts">
	/**
	 * Barra flotante de acciones en lote. Aparece cuando hay al menos un
	 * documento seleccionado, sin importar en cuál de los dos paneles esté.
	 *
	 * Las opciones CAMBIAN según dónde viva la selección, como en Figma: en
	 * HU001|106, con un documento ya procesado seleccionado, la barra muestra
	 * solo Detalle / Eventos / Descartar — "Iniciar pipeline" desaparece porque
	 * ese documento ya pasó por ahí.
	 *
	 * Estado de cada botón:
	 *   - Iniciar pipeline → FUNCIONA.
	 *   - Detalle          → FUNCIONA (abre el modal de resultados).
	 *   - Eventos          → sin funcionalidad: necesita `audit_event`, que vive
	 *                        en SQL Server y todavía no existe.
	 *   - Descartar        → sin funcionalidad: es destructivo y merece un modal
	 *                        de confirmación propio, no un confirm() del
	 *                        navegador. Queda pendiente a propósito.
	 *
	 * No encontré el frame exacto de esta barra en Figma. Los colores sí están
	 * confirmados contra tokens reales del archivo: fondo = --Dark (#141B34),
	 * rojo de "Descartar" = --error/error-2 (#ef4444).
	 */
	import Eye from '@lucide/svelte/icons/eye';
	import Play from '@lucide/svelte/icons/play';
	import Clock from '@lucide/svelte/icons/clock';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import { documentosEnBandeja } from '$lib/state/bandeja.svelte';
	import { documentosEnPipeline, iniciarPipeline, sePuedeProcesar } from '$lib/state/pipeline.svelte';

	let { alAbrirDetalle }: { alAbrirDetalle: (id: string) => void } = $props();

	const seleccionBandeja = $derived(documentosEnBandeja.filter((d) => d.seleccionado));
	const seleccionPipeline = $derived(documentosEnPipeline.filter((d) => d.seleccionado));
	const haySeleccionados = $derived(seleccionBandeja.length + seleccionPipeline.length > 0);

	// "Iniciar pipeline" solo aparece si hay algo en la bandeja que de verdad se
	// pueda mandar. Un archivo protegido o corrupto está seleccionable pero no es
	// procesable, y ofrecer el botón para que luego no pase nada es peor que no
	// ofrecerlo.
	const procesables = $derived(seleccionBandeja.filter(sePuedeProcesar));

	// El detalle es de UN documento: con varios seleccionados no se sabe cuál
	// abrir. Se toma el único seleccionado, venga del panel que venga.
	const unicoSeleccionado = $derived(
		seleccionBandeja.length + seleccionPipeline.length === 1
			? (seleccionPipeline[0]?.id ?? seleccionBandeja[0]?.id ?? null)
			: null
	);
	// Solo los del pipeline tienen resultado que mostrar; el detalle de uno que
	// sigue en la bandeja no tendría sección de OCR.
	const detalleDisponible = $derived(
		unicoSeleccionado !== null && seleccionPipeline.length === 1
	);

	let enviando = $state(false);

	async function alIniciar() {
		if (enviando) return;
		enviando = true;
		try {
			await iniciarPipeline();
		} finally {
			enviando = false;
		}
	}

	const claseBoton =
		'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
</script>

{#if haySeleccionados}
	<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
		<div class="flex items-center gap-1 rounded-full bg-[#141b34] px-2 py-2 shadow-lg">
			<button
				type="button"
				class="{claseBoton} text-[#f9fafb] enabled:hover:bg-white/10"
				disabled={!detalleDisponible}
				onclick={() => unicoSeleccionado && alAbrirDetalle(unicoSeleccionado)}
			>
				<Eye class="size-4" />
				Detalle
			</button>

			{#if procesables.length > 0}
				<button
					type="button"
					class="{claseBoton} text-[#f9fafb] enabled:hover:bg-white/10"
					disabled={enviando}
					onclick={alIniciar}
				>
					<Play class="size-4" />
					{enviando ? 'Procesando…' : `Iniciar pipeline (${procesables.length})`}
				</button>
			{/if}

			<button type="button" disabled class="{claseBoton} text-[#f9fafb]">
				<Clock class="size-4" />
				Eventos
			</button>

			<button type="button" disabled class="{claseBoton} text-red-500">
				<CircleX class="size-4" />
				Descartar
			</button>
		</div>
	</div>
{/if}
