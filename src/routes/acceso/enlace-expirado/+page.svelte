<script lang="ts">
	/**
	 * HU10 · "Enlace de recuperación expirado" (Figma `303:5686`). UNA sola
	 * pantalla para todo enlace que ya no sirve: no existe, ya se usó, venció o
	 * su cuenta ya no puede restablecer. Distinguirlos le diría a un tercero
	 * qué enlaces existieron alguna vez.
	 *
	 * Se abre con o sin sesión (ver `hooks.server.ts`): la ve quien pica el
	 * enlace de un correo viejo, esté o no dentro de su cuenta.
	 */
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Link2Off from '@lucide/svelte/icons/link-2-off';

	import { Button } from '$lib/components/ui/button/index.js';
</script>

<svelte:head><title>Biblioratum — Enlace expirado</title></svelte:head>

<div class="flex flex-col items-center text-center">
	<span class="flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary">
		<Link2Off class="size-12" />
	</span>
	<h1 class="mt-8 text-2xl leading-snug font-semibold text-foreground" data-testid="enlace-expirado-titulo">
		Enlace de recuperación expirado
	</h1>
	<p class="mt-4 text-sm text-muted-foreground">
		Por motivos de seguridad, este enlace de restablecimiento ya no se encuentra disponible. Solicita un nuevo
		correo para continuar con el proceso.
	</p>
	<Button href="/acceso/recuperar" class="mt-8 h-10 w-full" data-testid="solicitar-nuevo-enlace">
		Solicitar nuevo enlace
		<ArrowUpRight class="size-4" />
	</Button>
</div>
