<script lang="ts">
	/**
	 * Motor de reglas · la lista de procesos de la organización (2026-10-29). Es por donde se entra al motor, como lo indica el Figma Sprint 5
	 * (HUN5 «Crear proceso»): de aquí se llega al lienzo de un proceso (`/motor-de-reglas/[id]`) o a uno nuevo (`/motor-de-reglas/nuevo`).
	 * Hasta ese día esta dirección abría directo el lienzo, con el último proceso que se había tocado.
	 *
	 * La pantalla entera es `ListaDeProcesos.svelte`: trae su propio encabezado con la X, así que aquí no se repite ni título ni migaja.
	 * Quién puede entrar lo decide `+layout.server.ts` (Administrador y Supervisor).
	 */
	import ListaDeProcesos from '$lib/components/reglas/ListaDeProcesos.svelte';
</script>

<svelte:head><title>Biblioratum — Motor de reglas</title></svelte:head>

<ListaDeProcesos />
