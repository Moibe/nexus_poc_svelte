<script lang="ts">
	/**
	 * «Ver como lista / ver como mosaico» del listado de expedientes (2026-10-25, pedido de Moibe): dos botones JUNTOS, el de la vista
	 * vigente pintado, con el lenguaje de los dos accesos de vista del panel de registro (ícono solo, el nombre en `aria-label` y en
	 * `title`, `aria-pressed` para quien no ve el color). Son dos botones y no un interruptor porque cada uno LLEVA a su vista.
	 */
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import LayoutList from '@lucide/svelte/icons/layout-list';

	import type { VistaExpedientes } from '$lib/expedientes/expedientes';

	let { valor, alCambiar }: { valor: VistaExpedientes; alCambiar: (vista: VistaExpedientes) => void } = $props();

	const opciones = [
		{ valor: 'lista', etiqueta: 'Ver como lista', icono: LayoutList },
		{ valor: 'mosaico', etiqueta: 'Ver como mosaico', icono: LayoutGrid }
	] as const;
</script>

<div role="group" aria-label="Vista del listado" class="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5" data-testid="alternar-vista">
	{#each opciones as opcion (opcion.valor)}
		{@const activa = valor === opcion.valor}
		<button
			type="button"
			aria-pressed={activa}
			aria-label={opcion.etiqueta}
			title={opcion.etiqueta}
			data-testid="vista-{opcion.valor}"
			class="flex size-7.5 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 {activa
				? 'bg-primary text-primary-foreground'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
			onclick={() => alCambiar(opcion.valor)}
		>
			<opcion.icono class="size-4" />
		</button>
	{/each}
</div>
