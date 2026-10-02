<script lang="ts">
	/**
	 * El aviso rojo de los módulos de configuración: el hermano de `AvisoVerde`
	 * para lo que salió mal (captura del 2026-10-01, "Entrega del webhook
	 * fallida"). Misma forma —borde, ícono, título y cuerpo— con los tonos del
	 * error: `red-700` para el texto, que sobre `red-50` da ~5.9:1 (AA pide
	 * 4.5:1); el `red-600` del diseño quedaba justo en el límite.
	 *
	 * A diferencia del verde, el cuerpo es un `children`: aquí van varias líneas
	 * (qué pasó, el motivo, cuándo y con qué código), no una frase.
	 *
	 * Lleva `role="alert"`: aparece por algo que acabas de hacer y que no salió,
	 * y el lector de pantalla tiene que decirlo en el momento.
	 */
	import type { Snippet } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	let { testid, titulo, children }: { testid: string; titulo: string; children: Snippet } = $props();
</script>

<div
	role="alert"
	data-testid={testid}
	class="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50/60 px-5 py-4"
>
	<CircleAlert class="mt-px size-5 shrink-0 text-red-600" />
	<div class="min-w-0 text-red-700">
		<p class="text-sm font-semibold">{titulo}</p>
		<div class="mt-1 max-w-2xl text-xs">{@render children()}</div>
	</div>
</div>
