<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import TopBar from '$lib/components/TopBar.svelte';
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
