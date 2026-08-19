<script lang="ts">
	/**
	 * Barra flotante de acciones en lote. Aparece cuando hay al menos un
	 * documento seleccionado en la Bandeja de preparación.
	 *
	 * SIN FUNCIONALIDAD por ahora, a propósito: los 4 botones son visuales,
	 * ninguno tiene acción todavía.
	 *
	 * No encontré el frame exacto de esta barra en Figma (el frame poblado que
	 * sí revisé, HU001|105, no la incluye — vive en otro estado/frame sin
	 * mapear). Los colores sí están confirmados contra tokens reales del
	 * archivo: fondo = --Dark (#141B34), rojo de "Descartar" = --error/error-2
	 * (#ef4444, el mismo que ya usamos en "Duplicado"). Si aparece el link de
	 * Figma real de esta barra, ajustar íconos/spacing contra eso.
	 */
	import Eye from '@lucide/svelte/icons/eye';
	import Play from '@lucide/svelte/icons/play';
	import Clock from '@lucide/svelte/icons/clock';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import { documentosEnBandeja } from '$lib/state/bandeja.svelte';

	const haySeleccionados = $derived(documentosEnBandeja.some((doc) => doc.seleccionado));
</script>

{#if haySeleccionados}
	<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
		<div
			class="flex items-center gap-1 rounded-full bg-[#141b34] px-2 py-2 shadow-lg"
		>
			<button
				type="button"
				class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[#f9fafb] transition-colors hover:bg-white/10"
			>
				<Eye class="size-4" />
				Detalle
			</button>
			<button
				type="button"
				class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[#f9fafb] transition-colors hover:bg-white/10"
			>
				<Play class="size-4" />
				Iniciar pipeline
			</button>
			<button
				type="button"
				class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[#f9fafb] transition-colors hover:bg-white/10"
			>
				<Clock class="size-4" />
				Eventos
			</button>
			<button
				type="button"
				class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-white/10"
			>
				<CircleX class="size-4" />
				Descartar
			</button>
		</div>
	</div>
{/if}
