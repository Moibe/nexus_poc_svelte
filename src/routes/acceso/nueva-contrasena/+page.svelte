<script lang="ts">
	/**
	 * HU04 · "Configura tu nueva contraseña" (Figma `107:846`). Contraseña y
	 * confirmación con ojo, la tarjeta del medidor con los chips de las reglas, y
	 * "Cambiar contraseña" apagado hasta que todo cumple y coincide. Al guardar,
	 * el back cierra todas las sesiones (es el primer acceso) y el BFF borra las
	 * cookies: se sigue en "Contraseña actualizada", de donde se vuelve a entrar.
	 */
	import { goto, invalidateAll } from '$app/navigation';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import { cumpleTodas } from '$lib/acceso/reglasContrasena';
	import MedidorContrasena from '$lib/components/acceso/MedidorContrasena.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

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

	async function cambiar(evento: SubmitEvent) {
		evento.preventDefault();
		if (!listo || enviando) return;
		enviando = true;
		errorGeneral = '';
		try {
			const r = await fetch('/api/auth/contrasena', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nueva, confirmacion })
			});
			const cuerpo = await r.json().catch(() => null);
			if (r.ok) {
				await invalidateAll(); // la sesión se cerró: que el layout lo sepa
				await goto('/acceso/contrasena-actualizada');
				return;
			}
			errorGeneral = cuerpo?.mensaje ?? 'No se pudo cambiar la contraseña. Intenta de nuevo.';
		} finally {
			enviando = false;
		}
	}
</script>

<svelte:head><title>NexusDoc AI — Nueva contraseña</title></svelte:head>

<h1 class="text-[28px] leading-tight font-semibold text-foreground">Configura tu nueva contraseña</h1>
<p class="mt-3 text-sm text-muted-foreground">
	Para proteger tu cuenta, es necesario establecer una nueva contraseña en este primer acceso.
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
				class="h-10 w-full rounded-lg border border-input bg-card pr-10 pl-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
			/>
			<button
				type="button"
				class="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
				aria-label={verNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
				onclick={() => (verNueva = !verNueva)}
			>
				{#if verNueva}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
			</button>
		</div>
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
					{#if verConfirmacion}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
				</button>
			</span>
		</div>
		{#if mostrarNoCoincide}
			<p class="text-xs text-destructive" data-testid="error-no-coincide">
				La contraseña no coincide; por favor intenta de nuevo.
			</p>
		{/if}
	</div>

	<MedidorContrasena contrasena={nueva} />

	{#if errorGeneral}
		<p class="text-xs text-destructive" data-testid="error-general">{errorGeneral}</p>
	{/if}

	<Button type="submit" class="mt-4 h-10 w-full" disabled={!listo || enviando} data-testid="cambiar-contrasena">
		{enviando ? 'Guardando…' : 'Cambiar contraseña'}
	</Button>
</form>
