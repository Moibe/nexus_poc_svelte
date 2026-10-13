<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import TopBar from '$lib/components/TopBar.svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { tema } from '$lib/tema.svelte';

	let { children, data } = $props();
	// Las pantallas de acceso (login, primer acceso) traen su propia cáscara:
	// sin barra superior ni pie, con la ilustración a la derecha.
	const enAcceso = $derived(page.url.pathname.startsWith('/acceso'));

	// El tema se aplica en cuanto hay navegador: antes de esto el documento
	// está en claro, que es el default del CSS.
	$effect(() => {
		tema.iniciar();
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
