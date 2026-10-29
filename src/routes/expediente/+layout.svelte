<script lang="ts">
	/**
	 * Expediente · la cáscara de las dos pantallas (2026-10-24): el listado de expedientes (`/expediente`) y el expediente abierto
	 * (`/expediente/<id>`).
	 *
	 * Sale del encabezado del Figma del Sprint 5 (HUN2): migaja, título «Gestión de…» y una línea que dice para qué sirve la pantalla.
	 *
	 * **Sin pestañas desde el 2026-10-25.** Eran dos, «Tipos de expediente» y «Expedientes»; los tipos se mudaron al módulo de
	 * configuración (`/configuracion/tipos-expediente`), que es donde se configura de qué están hechos los expedientes, y aquí quedó
	 * solo el trabajo del día a día. Con una sola sección, una pestaña subrayada sola no dice nada: se quitó la barra entera.
	 */
	let { children } = $props();
</script>

<p class="text-xs text-muted-foreground">Expediente / Expedientes</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Gestión de expedientes</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Da seguimiento a los expedientes de tu organización y consulta los documentos que reúne cada uno.
	</p>
</div>

<div class="mt-6">
	{@render children()}
</div>
