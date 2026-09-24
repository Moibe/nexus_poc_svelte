<script lang="ts">
	import type { Component } from 'svelte';

	// `iconClass` es opcional y nace vacía: los tres paneles del Home la omiten y
	// se ven igual que siempre. La agregó el módulo de API Key, cuyo ícono va en
	// azul para igualar al del estado vacío del Modulo de configuración.
	let {
		icon: Icon,
		title,
		description,
		iconClass = ''
	}: { icon: Component; title: string; description: string; iconClass?: string } = $props();
</script>

<div class="flex w-[400px] flex-col items-center gap-6">
	<span
		class="flex size-[50px] items-center justify-center rounded-xl border-2 border-border bg-card {iconClass}"
	>
		<Icon />
	</span>
	<div class="flex flex-col items-center gap-0.5 text-center">
		<p class="text-sm font-medium text-foreground">{title}</p>
		<p class="text-xs text-muted-foreground">{description}</p>
	</div>
</div>
