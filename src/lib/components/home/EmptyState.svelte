<script lang="ts">
	import type { Component } from 'svelte';

	let {
		icon: Icon,
		title,
		description
	}: { icon: Component; title: string; description: string } = $props();
</script>

<div class="flex w-[400px] flex-col items-center gap-6">
	<span
		class="flex size-[50px] items-center justify-center rounded-xl border-2 border-border bg-card"
	>
		<Icon />
	</span>
	<div class="flex flex-col items-center gap-0.5 text-center">
		<p class="text-sm font-medium text-foreground">{title}</p>
		<p class="text-xs text-muted-foreground">{description}</p>
	</div>
</div>
