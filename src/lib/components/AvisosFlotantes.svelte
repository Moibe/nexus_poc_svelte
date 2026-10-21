<script lang="ts">
	/**
	 * Los avisos de éxito de `$lib/state/avisos.svelte`, abajo a la izquierda de la ventana, como en el Figma de la bandeja
	 * («Documento enviado a descartados.», «Documento conservado correctamente.»): borde y degradado verdes, el sello de
	 * verificación y el texto en `green-700` (el 600 sobre `green-50` no llega a 4.5:1). Se quitan solos.
	 *
	 * La región SIEMPRE está montada, con `role="status"`: una región que se monta junto con su texto no se anuncia.
	 */
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import { avisos } from '$lib/state/avisos.svelte';
</script>

<div
	class="pointer-events-none fixed bottom-6 left-6 z-60 flex w-[calc(100vw-3rem)] max-w-sm flex-col gap-2"
	role="status"
	aria-live="polite"
	data-testid="avisos"
>
	{#each avisos as aviso (aviso.id)}
		<div
			data-testid="aviso-exito"
			class="pointer-events-auto flex items-start gap-3 rounded-lg border border-green-200 bg-linear-to-r from-green-50 to-emerald-100/70 px-5 py-4 shadow-lg"
		>
			<BadgeCheck class="size-5 shrink-0 fill-green-500 text-white" />
			<div class="min-w-0">
				<p class="text-sm font-semibold text-green-700">{aviso.titulo}</p>
				<p class="mt-1 text-xs text-green-700">{aviso.cuerpo}</p>
			</div>
		</div>
	{/each}
</div>
