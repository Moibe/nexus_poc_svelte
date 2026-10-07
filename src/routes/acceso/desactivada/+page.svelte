<script lang="ts">
	/** HU03 · "Tu cuenta se encuentra actualmente desactivada". El botón
	 *  "Contactar al administrador" abre el correo; no hay otro canal todavía. */
	import UserX from '@lucide/svelte/icons/user-x';

	import { Button } from '$lib/components/ui/button/index.js';
</script>

<svelte:head><title>NexusDoc AI — Cuenta desactivada</title></svelte:head>

<div class="flex flex-col items-center text-center">
	<span class="flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary">
		<UserX class="size-12" />
	</span>
	<h1 class="mt-8 text-2xl leading-snug font-semibold text-foreground">
		Tu cuenta se encuentra actualmente desactivada
	</h1>
	<p class="mt-4 text-sm text-muted-foreground">
		La cuenta con la que intentas ingresar ha sido desactivada. Para obtener más información o solicitar
		nuevamente el acceso a la plataforma, comunícate con el administrador responsable de tu organización.
	</p>
	<Button href="mailto:soporte@nexusdoc.com" class="mt-8 h-10 w-full" data-testid="contactar-administrador">
		Contactar al administrador
	</Button>
	<a href="/acceso/iniciar-sesion" class="mt-4 text-xs font-medium text-primary hover:underline">Regresar a login</a>
</div>
