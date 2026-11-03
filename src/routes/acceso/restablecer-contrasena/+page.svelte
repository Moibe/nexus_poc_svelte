<script lang="ts">
	/**
	 * HU10 · "Configura tu nueva contraseña", al abrir el enlace del correo
	 * (Figma, sección HU010). Gemela de `nueva-contrasena` (HU04, el primer
	 * acceso), con tres diferencias que son del diseño: la bajada, el medidor
	 * con el párrafo de ayuda en vez de los chips, y que en vez de ir con sesión
	 * manda el token del enlace.
	 *
	 * Al guardar, el back cierra TODAS las sesiones (criterio CA-7) y el BFF
	 * borra las cookies: se sigue en "Contraseña actualizada".
	 */
	import { goto } from '$app/navigation';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import { MENSAJE_FORMATO, cumpleTodas } from '$lib/acceso/reglasContrasena';
	import MedidorContrasena from '$lib/components/acceso/MedidorContrasena.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data } = $props();

	let nueva = $state('');
	let confirmacion = $state('');
	let verNueva = $state(false);
	let verConfirmacion = $state(false);
	let confirmacionTocada = $state(false);
	let enviando = $state(false);
	let errorGeneral = $state('');

	const coincide = $derived(nueva.length > 0 && nueva === confirmacion);
	const mostrarNoCoincide = $derived(confirmacionTocada && confirmacion.length > 0 && !coincide);
	const listo = $derived(cumpleTodas(nueva) && coincide);
	/** El campo se pinta de rojo y lo dice EN CUANTO hay algo escrito que no
	 *  cumple las reglas — no al salir del campo (QA, NEX-333, segunda vuelta:
	 *  la primera versión esperaba al `blur` y el probador escribía sin salir,
	 *  así que nunca lo veía). El costo es que teclear una contraseña válida
	 *  pasa por el rojo hasta cumplir el último requisito; se aceptó a cambio
	 *  de que el aviso aparezca cuando el diseño dice. El medidor de abajo ya
	 *  daba retroalimentación en vivo, así que el rojo no llega solo. */
	const formatoMal = $derived(nueva.length > 0 && !cumpleTodas(nueva));
	const mensajeContrasena = $derived(formatoMal ? MENSAJE_FORMATO : '');

	async function cambiar(evento: SubmitEvent) {
		evento.preventDefault();
		if (!listo || enviando) return;
		enviando = true;
		errorGeneral = '';
		try {
			const r = await fetch('/api/auth/recuperacion/confirmar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: data.token, nueva, confirmacion })
			});
			const cuerpo = await r.json().catch(() => null);
			if (r.ok) {
				// SIN `invalidateAll()`, que en HU04 sí está: aquí la página tiene su
				// propio `load`, que revisa el enlace, y re-correrlo con el enlace que
				// ACABA de gastarse mandaría a "Enlace expirado" justo tras un éxito.
				// El BFF ya borró las cookies; la pantalla siguiente no necesita nada
				// de la sesión.
				await goto('/acceso/contrasena-actualizada');
				return;
			}
			if (['enlace_invalido', 'enlace_usado', 'enlace_vencido'].includes(cuerpo?.codigo)) {
				await goto('/acceso/enlace-expirado');
				return;
			}
			// `reglas`: casi imposible (el botón solo enciende si cumple todo, y
			// la regla del front es la misma que la del servidor), pero si pasa,
			// se dice QUÉ falta: aquí no hay chips que lo enseñen.
			const faltan: string[] = Array.isArray(cuerpo?.faltan) ? cuerpo.faltan : [];
			errorGeneral =
				(cuerpo?.mensaje ?? 'No se pudo cambiar la contraseña. Intenta de nuevo.') +
				(faltan.length ? ` Falta: ${faltan.join(', ')}.` : '');
		} finally {
			enviando = false;
		}
	}
</script>

<svelte:head><title>Biblioratum — Restablecer contraseña</title></svelte:head>

<h1 class="text-[28px] leading-tight font-semibold text-foreground">Configura tu nueva contraseña</h1>
<p class="mt-3 text-sm text-muted-foreground">
	Estás a un paso de recuperar tu acceso. Crea una contraseña segura y fácil de recordar para continuar.
</p>

<form class="mt-10 flex flex-col gap-4" onsubmit={cambiar} novalidate>
	<div class="flex flex-col gap-1.5">
		<label for="nueva" class="text-xs font-medium text-foreground">Contraseña</label>
		<div class="relative">
			<input
				id="nueva"
				type={verNueva ? 'text' : 'password'}
				autocomplete="new-password"
				placeholder="Ingresa tu nueva contraseña"
				bind:value={nueva}
				aria-invalid={mensajeContrasena ? 'true' : undefined}
				data-testid="campo-contrasena"
				class="h-10 w-full rounded-lg border border-input bg-card pr-16 pl-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
			/>
			<span class="absolute inset-y-0 right-2 flex items-center gap-1.5">
				{#if mensajeContrasena}
					<TriangleAlert class="size-4 text-destructive" aria-hidden="true" />
				{/if}
				<button
					type="button"
					class="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
					aria-label={verNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
					onclick={() => (verNueva = !verNueva)}
				>
					{#if verNueva}<Eye class="size-4" />{:else}<EyeOff class="size-4" />{/if}
				</button>
			</span>
		</div>
		{#if mensajeContrasena}
			<p class="text-xs text-destructive" role="alert" data-testid="error-formato-contrasena">{mensajeContrasena}</p>
		{/if}
	</div>

	<div class="flex flex-col gap-1.5">
		<label for="confirmacion" class="text-xs font-medium text-foreground">Confirma tu contraseña</label>
		<div class="relative">
			<input
				id="confirmacion"
				type={verConfirmacion ? 'text' : 'password'}
				autocomplete="new-password"
				placeholder="Confirma tu nueva contraseña configurada"
				bind:value={confirmacion}
				onblur={() => (confirmacionTocada = true)}
				aria-invalid={mostrarNoCoincide ? 'true' : undefined}
				class="h-10 w-full rounded-lg border border-input bg-card pr-16 pl-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
			/>
			<span class="absolute inset-y-0 right-2 flex items-center gap-1.5">
				{#if mostrarNoCoincide}
					<TriangleAlert class="size-4 text-destructive" aria-hidden="true" />
				{/if}
				<button
					type="button"
					class="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
					aria-label={verConfirmacion ? 'Ocultar contraseña' : 'Mostrar contraseña'}
					onclick={() => (verConfirmacion = !verConfirmacion)}
				>
					{#if verConfirmacion}<Eye class="size-4" />{:else}<EyeOff class="size-4" />{/if}
				</button>
			</span>
		</div>
		{#if mostrarNoCoincide}
			<p class="text-xs text-destructive" data-testid="error-no-coincide">
				La contraseña no coincide; por favor intenta de nuevo.
			</p>
		{/if}
	</div>

	<MedidorContrasena contrasena={nueva} variante="ayuda" />

	{#if errorGeneral}
		<p class="text-xs text-destructive" data-testid="error-general">{errorGeneral}</p>
	{/if}

	<Button type="submit" class="mt-4 h-10 w-full" disabled={!listo || enviando} data-testid="cambiar-contrasena">
		{enviando ? 'Guardando…' : 'Cambiar contraseña'}
	</Button>
</form>
