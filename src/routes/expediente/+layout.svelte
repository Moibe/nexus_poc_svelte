<script lang="ts">
	/**
	 * Expediente · la cáscara de las tres pantallas (2026-10-24): el listado de expedientes (`/expediente`), el expediente abierto
	 * (`/expediente/<id>`) y los tipos de expediente (`/expediente/tipos`).
	 *
	 * Sale del encabezado del Figma del Sprint 5 (HUN2): migaja, título «Gestión de…», una línea que dice para qué sirve la pantalla y,
	 * debajo, las pestañas con la vigente subrayada. Las pestañas del diseño son «Documentos procesados» y «Expedientes»; aquí son
	 * «Tipos de expediente» y «Expedientes», porque la biblioteca de documentos no es de esta pantalla y el tipo es parte de cómo se
	 * organizan los expedientes. Las pestañas son enlaces (cada una su ruta) y no un estado: se puede volver con «Atrás», recargar y
	 * compartir la dirección. El expediente abierto cuelga de «Expedientes», que sigue subrayada, como en el diseño.
	 *
	 * El ORDEN de las pestañas es el del trabajo (Moibe, 2026-10-24): primero «Tipos de expediente», porque sin un tipo no se puede crear un
	 * expediente, y después «Expedientes». Es solo el orden en que se pintan: `/expediente`, a donde lleva el engrane, sigue siendo el listado
	 * de expedientes (la segunda pestaña), que es lo que se consulta a diario; los tipos se arman una vez.
	 */
	import { page } from '$app/state';

	let { children } = $props();

	const enTipos = $derived(page.route.id === '/expediente/tipos');

	const pestanas = $derived([
		{ nombre: 'Tipos de expediente', href: '/expediente/tipos', activa: enTipos, testid: 'pestana-tipos-expediente' },
		{ nombre: 'Expedientes', href: '/expediente', activa: !enTipos, testid: 'pestana-expedientes' }
	]);
</script>

<p class="text-xs text-muted-foreground">Expediente / {enTipos ? 'Tipos de expediente' : 'Expedientes'}</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Gestión de expedientes</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Da seguimiento a los expedientes de tu organización y consulta los documentos que reúne cada uno.
	</p>
</div>

<nav aria-label="Secciones de expediente" class="mt-6 flex items-center gap-2.25">
	{#each pestanas as pestana (pestana.href)}
		<a
			href={pestana.href}
			aria-current={pestana.activa ? 'page' : undefined}
			data-testid={pestana.testid}
			class="border-b-2 px-2 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 {pestana.activa
				? 'border-primary text-foreground'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			{pestana.nombre}
		</a>
	{/each}
</nav>

<div class="mt-4">
	{@render children()}
</div>
