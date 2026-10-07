<script lang="ts">
	/**
	 * HU03 · Iniciar sesión (Sprint 1, Figma `184:7335`).
	 *
	 * Los textos de error son los literales del diseño, elegidos por el `codigo`
	 * que devuelve el BFF (`/api/auth/login`):
	 *   · correo_invalido   → bajo el correo
	 *   · correo_no_existe  → bajo el correo
	 *   · credenciales      → bajo la contraseña + la alerta azul con los intentos
	 *                         que quedan ("después de N intentos más…")
	 *   · bloqueada         → pantalla "Has alcanzado el número máximo…" (423)
	 *   · desactivada       → pantalla "Tu cuenta se encuentra desactivada" (403)
	 * Si entra y debe cambiar la contraseña (primer acceso), va a "Bienvenido".
	 */
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Info from '@lucide/svelte/icons/info';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import { Button } from '$lib/components/ui/button/index.js';

	let email = $state('');
	let password = $state('');
	let verContrasena = $state(false);
	let enviando = $state(false);
	let errorCorreo = $state('');
	let errorContrasena = $state('');
	let errorGeneral = $state('');
	let intentosRestantes = $state<number | null>(null);

	const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
	const completo = $derived(email.trim().length > 0 && password.length > 0);

	async function entrar(evento: SubmitEvent) {
		evento.preventDefault();
		if (!completo || enviando) return;
		errorCorreo = errorContrasena = errorGeneral = '';
		if (!RE_CORREO.test(email.trim())) {
			errorCorreo = 'Formato incorrecto; por favor ingresa un correo electrónico válido.';
			return;
		}
		enviando = true;
		try {
			const r = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim(), password })
			});
			const cuerpo = await r.json().catch(() => null);
			if (r.ok) {
				// El layout raíz publica el usuario de la sesión; tras entrar hay
				// que recargar esos datos, si no la barra y "Bienvenido" se quedan
				// con el usuario nulo de antes.
				await invalidateAll();
				const volver = page.url.searchParams.get('volver');
				if (cuerpo?.usuario?.debeCambiarContrasena) await goto('/acceso/bienvenido');
				else await goto(volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/');
				return;
			}
			const codigo = cuerpo?.codigo;
			if (codigo === 'bloqueada') {
				await goto(`/acceso/bloqueada?hasta=${encodeURIComponent(cuerpo.hastaEn ?? '')}`);
				return;
			}
			if (codigo === 'desactivada') {
				await goto('/acceso/desactivada');
				return;
			}
			if (codigo === 'correo_invalido' || codigo === 'correo_no_existe') {
				errorCorreo = cuerpo.mensaje;
			} else if (codigo === 'credenciales') {
				errorContrasena = cuerpo.mensaje;
				intentosRestantes = typeof cuerpo.intentosRestantes === 'number' ? cuerpo.intentosRestantes : null;
			} else {
				errorGeneral = cuerpo?.mensaje ?? 'No se pudo iniciar sesión. Intenta de nuevo.';
			}
		} finally {
			enviando = false;
		}
	}
</script>

<svelte:head><title>NexusDoc AI — Iniciar sesión</title></svelte:head>

<h1 class="text-[28px] leading-tight font-semibold text-foreground">Documentación y operaciones más ágiles</h1>
<p class="mt-3 text-sm text-muted-foreground">
	Inicia sesión y centraliza la gestión, optimiza tus procesos con lectura más inteligente.
</p>

<form class="mt-10 flex flex-col gap-4" onsubmit={entrar} novalidate>
	{#if intentosRestantes !== null && intentosRestantes > 0}
		<div
			class="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800"
			role="status"
			data-testid="alerta-intentos"
		>
			<Info class="mt-0.5 size-3.5 shrink-0" />
			<p>
				<span class="font-semibold">Verifica tus datos de acceso</span><br />
				Recuerda que después de {intentosRestantes}
				{intentosRestantes === 1 ? 'intento' : 'intentos'} más, tu cuenta se bloqueará durante 15 minutos.
			</p>
		</div>
	{/if}

	<div class="flex flex-col gap-1.5">
		<label for="correo" class="text-xs font-medium text-foreground">Correo electrónico</label>
		<input
			id="correo"
			type="email"
			autocomplete="username"
			placeholder="Ingresa tu correo electrónico"
			bind:value={email}
			aria-invalid={errorCorreo ? 'true' : undefined}
			oninput={() => (errorCorreo = '')}
			class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
		/>
		{#if errorCorreo}
			<p class="text-xs text-destructive" data-testid="error-correo">{errorCorreo}</p>
		{/if}
	</div>

	<div class="flex flex-col gap-1.5">
		<label for="contrasena" class="text-xs font-medium text-foreground">Contraseña</label>
		<div class="relative">
			<input
				id="contrasena"
				type={verContrasena ? 'text' : 'password'}
				autocomplete="current-password"
				placeholder="Ingresa tu contraseña"
				bind:value={password}
				aria-invalid={errorContrasena ? 'true' : undefined}
				oninput={() => (errorContrasena = '')}
				class="h-10 w-full rounded-lg border border-input bg-card pr-16 pl-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
			/>
			<span class="absolute inset-y-0 right-2 flex items-center gap-1.5">
				{#if errorContrasena}
					<TriangleAlert class="size-4 text-destructive" aria-hidden="true" />
				{/if}
				<button
					type="button"
					class="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
					aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
					onclick={() => (verContrasena = !verContrasena)}
				>
					{#if verContrasena}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
				</button>
			</span>
		</div>
		{#if errorContrasena}
			<p class="text-xs text-destructive" data-testid="error-contrasena">{errorContrasena}</p>
		{/if}
	</div>

	{#if errorGeneral}
		<p class="text-xs text-destructive" data-testid="error-general">{errorGeneral}</p>
	{/if}

	<Button type="submit" class="mt-2 h-10 w-full" disabled={!completo || enviando} data-testid="entrar">
		{enviando ? 'Entrando…' : 'Ir a mi cuenta'}
	</Button>

	<div class="mt-2 flex items-center gap-3" aria-hidden="true">
		<span class="h-px flex-1 bg-border"></span>
		<span class="text-[11px] text-muted-foreground">¿Olvidaste tu cuenta?</span>
		<span class="h-px flex-1 bg-border"></span>
	</div>
	<!-- HU10 (restablecer contraseña) todavía no existe: el enlace lleva a la
	     misma pantalla, para no prometer una ruta vacía. -->
	<a
		href="/acceso/iniciar-sesion"
		class="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline"
		data-testid="restablecer-acceso"
	>
		Restablecer acceso a tu cuenta
		<ArrowUpRight class="size-3.5" />
	</a>
</form>
