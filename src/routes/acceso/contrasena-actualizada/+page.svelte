<script lang="ts">
	/** HU04 · "Contraseña actualizada". Se llega sin sesión (el cambio en el
	 *  primer acceso cierra todas); "Iniciar sesión" vuelve al login. */
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import KeyRound from '@lucide/svelte/icons/key-round';

	import { Button } from '$lib/components/ui/button/index.js';
</script>

<svelte:head><title>NexusDoc AI — Contraseña actualizada</title></svelte:head>

<div class="flex flex-col items-center text-center">
	<span class="flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary">
		<KeyRound class="size-12" />
	</span>
	<h1 class="mt-8 text-2xl leading-snug font-semibold text-foreground" data-testid="actualizada-titulo">
		Contraseña actualizada
	</h1>
	<p class="mt-4 text-sm text-muted-foreground">
		Tu nueva contraseña fue creada correctamente. Ahora puedes acceder al portal utilizando tus nuevas
		credenciales de inicio de sesión.
	</p>
	<Button href="/acceso/iniciar-sesion" class="mt-8 h-10 w-full" data-testid="ir-a-login">
		Iniciar sesión
		<ArrowUpRight class="size-4" />
	</Button>
</div>
