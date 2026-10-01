<script lang="ts">
	/**
	 * El aviso verde de éxito de los módulos de configuración (capturas del
	 * 2026-09-24): borde y degradado verdes, `BadgeCheck` relleno, y `green-700`
	 * para el texto porque el 600 sobre `green-50` da ~3.1:1 y AA pide 4.5:1.
	 *
	 * Es el mismo bloque con otro texto en las API Keys y en los Webhooks, por
	 * eso es un componente. Quien lo monte lo pone dentro de un contenedor con
	 * `role="status" aria-live="polite"` SIEMPRE montado: una región que se monta
	 * junto con su texto no se anuncia.
	 */
	import BadgeCheck from '@lucide/svelte/icons/badge-check';

	let { testid, titulo, cuerpo }: { testid: string; titulo: string; cuerpo: string } = $props();
</script>

<div
	data-testid={testid}
	class="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-linear-to-r from-green-50 to-emerald-100/70 px-5 py-4"
>
	<BadgeCheck class="size-5 shrink-0 fill-green-500 text-white" />
	<div class="min-w-0">
		<p class="text-sm font-semibold text-green-700">{titulo}</p>
		<p class="mt-1 max-w-2xl text-xs text-green-700">{cuerpo}</p>
	</div>
</div>
