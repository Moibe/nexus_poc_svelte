<script lang="ts">
	/**
	 * HU10 · "Recupera tu acceso" y "Revisa tu correo" (Figma, sección HU010).
	 * Son DOS pantallas en UNA ruta, con dos pasos: el correo tecleado se queda
	 * en el estado de la página y nunca viaja por la URL (nada de `?correo=`,
	 * que acabaría en el log de accesos y en el historial), el reenvío lo tiene
	 * a la mano, y recargar devuelve al formulario, que es lo correcto.
	 *
	 * ## Lo que esta pantalla decía de la cuenta (criterio CA-2) y ya no
	 *
	 * Hasta el 2026-10-20 NO revelaba si existía una cuenta con ese correo, y por eso se apartaba del Figma en tres
	 * cosas: no dibujaba el error «El correo electrónico no existe…», usaba «Si existe una cuenta…» en vez de «Te
	 * enviamos un enlace a: X…» y mostraba aparte «Correo indicado: X». QA lo marcó contra el diseño (HU10 CA4 y la
	 * pantalla «Revisa tu correo») y se volvió al Figma: el servidor contesta `correo_no_existe` cuando el correo no
	 * tiene cuenta (`RECUPERACION_DICE_SI_EXISTE`, en el back, que se apaga con `=0`) y esta pantalla dibuja el
	 * error en el campo; a quien sí tiene cuenta le dice «Te enviamos un enlace a: X…». Ese X sale siempre de lo que
	 * la persona TECLEÓ, nunca de la respuesta del servidor.
	 *
	 * Una desviación que sigue: el Figma no dibuja confirmación ni límite para "Reenviar correo". Aquí avisa y se
	 * apaga 60 segundos, que es lo mismo que exige el servidor entre dos solicitudes del mismo correo.
	 */
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import { validarCorreo } from '$lib/acceso/correo';
	import CandadoLlaveIlustracion from '$lib/components/icons/CandadoLlaveIlustracion.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	/** Debe coincidir con `RECUPERACION_ESPERA_SEG` del back. */
	const ESPERA_SEGUNDOS = 60;

	let correo = $state('');
	let paso = $state<'formulario' | 'enviado'>('formulario');
	/** Lo que se tecleó, ya normalizado: es lo que se enseña en «Te enviamos un enlace a:». */
	let correoIndicado = $state('');
	let errorCorreo = $state('');
	let errorGeneral = $state('');
	let avisoReenvio = $state('');
	let enviando = $state(false);
	let correoTocado = $state(false);
	let esperaHasta = $state(0);
	let ahora = $state(Date.now());

	onMount(() => {
		const t = setInterval(() => (ahora = Date.now()), 1000);
		return () => clearInterval(t);
	});

	const restante = $derived(Math.max(0, Math.ceil((esperaHasta - ahora) / 1000)));
	const resultado = $derived(validarCorreo(correo));
	/** El aviso de formato sale al SALIR del campo o al intentar enviar, no
	 *  mientras se teclea: pintar de rojo un "a@" a medio escribir es ruido. */
	const mensajeCorreo = $derived(
		errorCorreo !== '' ? errorCorreo : correoTocado && correo.trim() !== '' && !resultado.ok ? resultado.motivo : ''
	);

	/** Pide el enlace. Devuelve si se pudo, para que el reenvío sepa qué avisar. */
	async function pedir(): Promise<boolean> {
		errorGeneral = '';
		const r = await fetch('/api/auth/recuperacion', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ correo: correoIndicado })
		}).catch(() => null);
		if (!r) {
			errorGeneral = 'No se pudo contactar al servidor. Intenta de nuevo.';
			return false;
		}
		const cuerpo = await r.json().catch(() => null);
		if (r.ok) {
			esperaHasta = Date.now() + ESPERA_SEGUNDOS * 1000;
			ahora = Date.now();
			return true;
		}
		if (cuerpo?.codigo === 'correo_invalido' || cuerpo?.codigo === 'correo_no_existe') {
			errorCorreo = cuerpo.mensaje;
			paso = 'formulario';
		} else {
			// 429 (demasiados enlaces) y lo demás: el texto del servidor.
			errorGeneral = cuerpo?.mensaje ?? 'No se pudo enviar la solicitud. Intenta de nuevo.';
		}
		return false;
	}

	async function enviar(evento: SubmitEvent) {
		evento.preventDefault();
		if (enviando || correo.trim() === '') return;
		correoTocado = true;
		if (!resultado.ok) return;
		enviando = true;
		correoIndicado = resultado.correo;
		try {
			if (await pedir()) paso = 'enviado';
		} finally {
			enviando = false;
		}
	}

	async function reenviar() {
		if (enviando || restante > 0) return;
		enviando = true;
		avisoReenvio = '';
		try {
			if (await pedir()) avisoReenvio = 'Enviamos la solicitud de nuevo.';
		} finally {
			enviando = false;
		}
	}

	function usarOtroCorreo() {
		paso = 'formulario';
		errorGeneral = avisoReenvio = errorCorreo = '';
		correoTocado = false;
	}
</script>

<svelte:head><title>NexusDoc AI — Recupera tu acceso</title></svelte:head>

{#if paso === 'formulario'}
	<a
		href="/acceso/iniciar-sesion"
		class="mb-8 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
		data-testid="volver-a-login"
	>
		<ArrowLeft class="size-3.5" />
		Regresar a login
	</a>

	<h1 class="text-[28px] leading-tight font-semibold text-foreground">Recupera tu acceso</h1>
	<p class="mt-3 text-sm text-muted-foreground">
		No te preocupes si no recuerdas tu contraseña. Sigue el proceso y recupera el acceso a tu cuenta en unos
		simples pasos.
	</p>

	<form class="mt-10 flex flex-col gap-4" onsubmit={enviar} novalidate>
		<div class="flex flex-col gap-1.5">
			<label for="correo-recuperacion" class="text-xs font-medium text-foreground">Correo electrónico</label>
			<div class="relative">
				<input
					id="correo-recuperacion"
					type="email"
					autocomplete="username"
					placeholder="Ingresa tu correo electrónico"
					bind:value={correo}
					onblur={() => (correoTocado = true)}
					oninput={() => (errorCorreo = errorGeneral = '')}
					aria-invalid={mensajeCorreo ? 'true' : undefined}
					data-testid="correo-recuperacion"
					class="h-10 w-full rounded-lg border border-input bg-card pr-10 pl-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
				/>
				{#if mensajeCorreo}
					<!-- El triángulo rojo dentro del campo es del Figma («Recuperar contraseña 3»). -->
					<TriangleAlert class="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-destructive" aria-hidden="true" />
				{/if}
			</div>
			{#if mensajeCorreo}
				<p class="text-xs text-destructive" data-testid="error-correo">{mensajeCorreo}</p>
			{/if}
		</div>

		{#if errorGeneral}
			<p class="text-xs text-destructive" data-testid="error-general">{errorGeneral}</p>
		{/if}

		<Button type="submit" class="mt-4 h-10 w-full" disabled={correo.trim() === '' || enviando} data-testid="restablecer">
			{enviando ? 'Enviando…' : 'Restablecer acceso'}
		</Button>
	</form>
{:else}
	<div class="flex flex-col items-center text-center">
		<CandadoLlaveIlustracion class="size-40" />
		<h1 class="mt-8 text-[28px] leading-snug font-semibold text-foreground" data-testid="revisa-titulo">
			Revisa tu correo
		</h1>
		<!-- Literal del Figma. El correo es el que la persona tecleó, en negritas. -->
		<p class="mt-4 text-sm leading-relaxed text-muted-foreground" data-testid="mensaje-enviado">
			Te enviamos un enlace a: <strong class="font-semibold text-foreground" data-testid="correo-indicado">{correoIndicado}</strong>
			para restablecer tu contraseña. Revisa tu bandeja de entrada y sigue las instrucciones para continuar.
		</p>

		<p class="mt-6 text-sm text-foreground">
			¿No recibiste el correo?
			<button
				type="button"
				class="font-medium text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
				disabled={enviando || restante > 0}
				onclick={reenviar}
				data-testid="reenviar-correo"
			>
				{restante > 0 ? `Reenviar correo (${restante} s)` : 'Reenviar correo'}
			</button>
		</p>
		{#if avisoReenvio}
			<p class="mt-2 text-xs text-muted-foreground" role="status" data-testid="aviso-reenvio">{avisoReenvio}</p>
		{/if}
		{#if errorGeneral}
			<p class="mt-2 text-xs text-destructive" data-testid="error-general">{errorGeneral}</p>
		{/if}

		<div class="mt-6 flex items-center gap-4 text-xs">
			<button type="button" class="text-muted-foreground hover:text-foreground hover:underline" onclick={usarOtroCorreo} data-testid="usar-otro-correo">
				Usar otro correo
			</button>
			<a href="/acceso/iniciar-sesion" class="text-muted-foreground hover:text-foreground hover:underline" data-testid="volver-a-login">
				Regresar a login
			</a>
		</div>
	</div>
{/if}
