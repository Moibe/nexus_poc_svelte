<script lang="ts">
	/** HU04 · El interstitial del primer acceso: "Bienvenido, [Nombre]" →
	 *  "Comenzar" lleva a configurar la contraseña nueva. Solo se llega con
	 *  sesión y `debeCambiarContrasena` (lo cuida `hooks.server.ts`). */
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import MonitorCheck from '@lucide/svelte/icons/monitor-check';

	import { Button } from '$lib/components/ui/button/index.js';

	let { data } = $props();
	const nombre = $derived(data.usuario?.nombre?.split(' ')[0] || 'bienvenido');
</script>

<svelte:head><title>NexusDoc AI — Bienvenido</title></svelte:head>

<div class="flex flex-col items-center text-center">
	<span class="flex size-28 items-center justify-center rounded-2xl bg-primary/10 text-primary">
		<MonitorCheck class="size-12" />
	</span>
	<h1 class="mt-8 text-2xl leading-snug font-semibold text-foreground" data-testid="bienvenido-titulo">
		Bienvenido, {nombre}
	</h1>
	<p class="mt-4 text-sm text-muted-foreground">
		Tu cuenta ha sido creada correctamente. Para proteger tu información y completar el proceso de acceso,
		deberás actualizar tu contraseña antes de ingresar al sistema.
	</p>
	<Button href="/acceso/nueva-contrasena" class="mt-8 h-10 w-full" data-testid="comenzar">
		Comenzar
		<ArrowUpRight class="size-4" />
	</Button>
</div>
