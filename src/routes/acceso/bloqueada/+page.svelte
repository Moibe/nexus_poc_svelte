<script lang="ts">
	/**
	 * HU03 · "Has alcanzado el número máximo de intentos permitidos." El botón
	 * es un contador ("Espera 10:05") hasta que el bloqueo (15 min) se levanta;
	 * entonces se vuelve "Volver a intentar". `hasta` llega del BFF (ISO).
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import UserLock from '@lucide/svelte/icons/user-lock';

	import { Button } from '$lib/components/ui/button/index.js';

	const hasta = $derived(new Date(page.url.searchParams.get('hasta') ?? ''));
	let ahora = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (ahora = Date.now()), 1000);
		return () => clearInterval(t);
	});
	const restante = $derived(Math.max(0, Math.floor((hasta.getTime() - ahora) / 1000)));
	const mmss = $derived(
		`${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`
	);
	const sigueBloqueada = $derived(Number.isFinite(hasta.getTime()) && restante > 0);
</script>

<svelte:head><title>NexusDoc AI — Cuenta bloqueada</title></svelte:head>

<div class="flex flex-col items-center text-center">
	<span class="flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary">
		<UserLock class="size-12" />
	</span>
	<h1 class="mt-8 text-2xl leading-snug font-semibold text-foreground">
		Has alcanzado el número máximo de intentos permitidos.
	</h1>
	<p class="mt-4 text-sm text-muted-foreground">
		Tu cuenta ha sido bloqueada temporalmente por exceder el número máximo de intentos permitidos. Podrás
		intentar nuevamente en 15 minutos.
	</p>
	{#if sigueBloqueada}
		<Button class="mt-8 h-10 w-full" disabled data-testid="espera">Espera {mmss}</Button>
	{:else}
		<Button href="/acceso/iniciar-sesion" class="mt-8 h-10 w-full" data-testid="volver-a-intentar">
			Volver a intentar
		</Button>
	{/if}
</div>
