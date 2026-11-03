<script lang="ts">
	/**
	 * Configuración · Tipos documentales (2026-10-25): la biblioteca de la organización, que hasta hoy se abría como panel lateral
	 * desde el engrane y ahora tiene su propia dirección, a la que lleva el mosaico de `/configuracion`.
	 *
	 * La pantalla entera es `ModuloConfiguracion.svelte` (que hasta hoy se llamaba `ConfigSheet`): trae su propio encabezado con la X, así que
	 * aquí no se repite ni migaja ni título. La X sube un nivel dentro del módulo y, desde la Biblioteca, apaga `open`: eso es
	 * «salir», y es lo que esta página mira para regresar al mosaico. Se usa `replaceState` para que «Atrás» no vuelva a meter a la
	 * biblioteca de la que se acaba de salir.
	 *
	 * Quién puede entrar lo decide el servidor en cada petición que hace el módulo (la biblioteca vive en nexus_back, por
	 * organización); el engrane, además, solo se le enseña a quien administra.
	 */
	import { goto } from '$app/navigation';

	import ModuloConfiguracion from '$lib/components/config/ModuloConfiguracion.svelte';

	let abierto = $state(true);

	$effect(() => {
		if (!abierto) goto('/configuracion', { replaceState: true });
	});
</script>

<svelte:head><title>Biblioratum — Tipos documentales</title></svelte:head>

<ModuloConfiguracion bind:open={abierto} />
