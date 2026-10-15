<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import TopBar from '$lib/components/TopBar.svelte';
	import AvisosFlotantes from '$lib/components/AvisosFlotantes.svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { tema } from '$lib/tema.svelte';
	import { prepararBiblioteca } from '$lib/state/configuracion.svelte';

	let { children, data } = $props();
	// Las pantallas de acceso (login, primer acceso) traen su propia cáscara:
	// sin barra superior ni pie, con la ilustración a la derecha.
	const enAcceso = $derived(page.url.pathname.startsWith('/acceso'));

	// El tema se aplica en cuanto hay navegador: antes de esto el documento
	// está en claro, que es el default del CSS.
	$effect(() => {
		tema.iniciar();
	});

	// La biblioteca de tipos documentales vive en el servidor, por organización. Se lee en cuanto hay sesión (para que el
	// pipeline la tenga antes de clasificar) y se suelta cuando no la hay o cambia la persona: sin esto, quien cierra sesión
	// y deja entrar a otra persona en la MISMA pestaña le dejaría ver y guardar los tipos de la organización anterior.
	$effect(() => {
		const guid = enAcceso ? null : (data.usuario?.guid ?? null);
		prepararBiblioteca(guid);
	});

	// Una sesión cerrada desde otro lado (HU05: la cierra un administrador, o se restableció la contraseña o se
	// desactivó la cuenta) no cambia nada en una pestaña que ya está abierta: hasta ahora la pantalla se quedaba
	// como estaba y la persona se enteraba al pulsar algo. Con la sesión puesta, la pestaña a la vista vuelve a
	// pedir sus datos cada 20 s y al volver a ella: la puerta del servidor decide y, si la sesión ya no vive, la
	// manda al inicio de sesión (o a «cuenta desactivada») sola.
	const REVISION_SESION_MS = 20_000;
	$effect(() => {
		if (enAcceso || !data.usuario) return;
		const revisar = () => {
			if (document.visibilityState === 'visible') invalidateAll().catch(() => undefined);
		};
		const temporizador = setInterval(revisar, REVISION_SESION_MS);
		document.addEventListener('visibilitychange', revisar);
		return () => {
			clearInterval(temporizador);
			document.removeEventListener('visibilitychange', revisar);
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Atrás/Adelante pueden restaurar la página ENTERA tal como estaba (la caché de
     ida y vuelta del navegador, bfcache): su memoria, sus datos, el usuario de
     antes, sin pedirle nada al servidor. `no-store` (hooks.server.ts) suele
     impedirlo, pero no todos los navegadores lo respetan igual, y una sesión
     cerrada desde otro lado (HU05) no cambia ninguna cookie de esta pestaña.
     `persisted` dice que se restauró; volver a cargar los datos hace que la
     puerta decida con lo de ahora (¿sigue la sesión?) y no con lo de entonces. -->
<svelte:window
	onpageshow={(e) => {
		if (e.persisted) invalidateAll();
	}}
/>

{#if enAcceso}
	{@render children()}
{:else}
	<div class="flex min-h-screen flex-col bg-background">
		<TopBar usuario={data.usuario} />

		<main class="mx-auto w-full max-w-360 flex-1 px-6 py-8">
			{@render children()}
		</main>

		<footer class="border-t border-border py-6">
			<p class="text-center text-xs text-muted-foreground">
				© 2026 Grupo CSI. Todos los derechos reservados.
			</p>
		</footer>
	</div>
{/if}

<AvisosFlotantes />
