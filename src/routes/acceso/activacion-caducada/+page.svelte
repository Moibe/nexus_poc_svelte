<script lang="ts">
	/**
	 * HU06 · "Tu enlace de activación ha caducado" (Figma `255:4654`, CA-5). La contraseña temporal del
	 * primer acceso sirve 48 horas a partir de su envío (`TOKEN_ACTIVACION_HORAS` en el back); pasado
	 * ese tiempo, entrar con ella —aunque sea la correcta— lleva aquí.
	 *
	 * El botón "Contactar al administrador" abre el correo, como en la pantalla de cuenta desactivada: no
	 * hay otro canal todavía. Lo que sigue lo hace quien administra, con el script de reemisión del back
	 * (`reenviar_invitacion.py`); el botón "Reenviar invitación" de la pantalla de usuarios (CA-6) falta.
	 *
	 * Desviación consciente: el diseño trae la ilustración del globo; aquí va el ícono en su círculo, como
	 * las demás pantallas de este flujo.
	 */
	import TimerOff from '@lucide/svelte/icons/timer-off';

	import { Button } from '$lib/components/ui/button/index.js';
</script>

<svelte:head><title>Biblioratum — Enlace de activación caducado</title></svelte:head>

<div class="flex flex-col items-center text-center">
	<span class="flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary">
		<TimerOff class="size-12" />
	</span>
	<h1 class="mt-8 text-2xl leading-snug font-semibold text-foreground" data-testid="activacion-caducada-titulo">
		Tu enlace de activación ha caducado
	</h1>
	<p class="mt-4 text-sm text-muted-foreground">
		El enlace utilizado para acceder a la plataforma ha vencido. Los enlaces de primer acceso son válidos
		únicamente durante 48 horas a partir de su envío.
	</p>
	<p class="mt-4 text-sm text-muted-foreground">
		Contacta al administrador de tu organización para generar un nuevo acceso.
	</p>
	<Button href="mailto:soporte@Biblioratum.com" class="mt-8 h-10 w-full" data-testid="contactar-administrador">
		Contactar al administrador
	</Button>
	<a href="/acceso/iniciar-sesion" class="mt-4 text-xs font-medium text-primary hover:underline">Regresar a login</a>
</div>
