<script lang="ts">
	/**
	 * La tarjeta "Seguridad de la contraseña" del diseño: candado, nivel a la
	 * derecha (Débil … Muy segura), barra de progreso y los cinco chips de las
	 * reglas, que se ponen verdes conforme se cumplen.
	 */
	import Lock from '@lucide/svelte/icons/lock';

	import { REGLAS, nivelDe } from '$lib/acceso/reglasContrasena';

	let { contrasena }: { contrasena: string } = $props();

	const nivel = $derived(nivelDe(contrasena));
	const COLOR = {
		debil: 'bg-destructive',
		media: 'bg-amber-500',
		segura: 'bg-green-500',
		muy_segura: 'bg-green-600'
	} as const;
	const TEXTO = {
		debil: 'text-foreground',
		media: 'text-amber-700',
		segura: 'text-green-700',
		muy_segura: 'text-green-700'
	} as const;
</script>

<div class="rounded-lg border border-border bg-card p-3" data-testid="medidor-contrasena">
	<div class="flex items-center justify-between gap-3">
		<p class="flex items-center gap-2 text-xs text-muted-foreground">
			<Lock class="size-3.5 text-primary" />
			Seguridad de la contraseña
		</p>
		<p class="text-xs font-semibold {TEXTO[nivel.tono]}" data-testid="nivel-contrasena">{nivel.texto}</p>
	</div>
	<div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
		<div class="h-full rounded-full transition-all {COLOR[nivel.tono]}" style="width: {nivel.valor * 100}%"></div>
	</div>
	<ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Reglas de la contraseña">
		{#each REGLAS as regla (regla.clave)}
			{@const ok = regla.cumple(contrasena)}
			<li
				data-testid="regla-{regla.clave}"
				data-cumple={ok}
				class="rounded-md border px-2 py-1 text-[11px] leading-none font-medium transition-colors {ok
					? 'border-green-200 bg-green-50 text-green-700'
					: 'border-border bg-muted text-muted-foreground'}"
			>
				{regla.texto}
			</li>
		{/each}
	</ul>
</div>
