<script lang="ts">
	/**
	 * Módulo de uso · el mosaico de lo que se usa a diario (2026-10-30, pedido de Moibe).
	 *
	 * Sustituye a la opción «Expediente» del engrane. Es el hermano del módulo de configuración (`/configuracion`): una página con un
	 * cuadro por cosa y cada cuadro lleva a su pantalla. Aquí no se configura nada, se trabaja:
	 *   · Centro operativo documental: el inicio, con sus tres bandejas (carga documental, bandeja de preparación y pipeline).
	 *   · Expedientes: la carpeta de cada cliente o caso y los documentos que reúne.
	 *
	 * No pide datos ni decide permisos: cada pantalla a la que lleva decide por su cuenta quién entra. Agregar la siguiente cosa es agregar
	 * un renglón a `SECCIONES`.
	 */
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	const SECCIONES = [
		{
			id: 'centro-operativo',
			nombre: 'Centro operativo documental',
			href: '/',
			icono: LayoutDashboard,
			descripcion:
				'Donde se trabaja el día a día: la carga documental, la bandeja de preparación y el pipeline documental, las tres bandejas del inicio.'
		},
		{
			id: 'expedientes',
			nombre: 'Expedientes',
			href: '/expediente',
			icono: FolderOpen,
			descripcion:
				'Los expedientes de tu organización: la carpeta de cada cliente o caso, los documentos que reúne y los expedientes virtuales que se arman con ellos.'
		}
	];
</script>

<svelte:head><title>Biblioratum — Módulo de uso</title></svelte:head>

<p class="text-xs text-muted-foreground">Uso</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Módulo de uso</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Trabaja con tus documentos y tus expedientes. Elige a dónde quieres ir.
	</p>
</div>

<div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="mosaico-uso">
	{#each SECCIONES as seccion (seccion.id)}
		<a
			href={seccion.href}
			data-testid="seccion-uso"
			data-seccion={seccion.id}
			class="group flex min-h-50 flex-col rounded-2xl border-2 border-border bg-card p-6 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
				<seccion.icono class="size-4" />
			</span>
			<span class="mt-4 block text-lg font-medium text-foreground">{seccion.nombre}</span>
			<span class="mt-1.5 block flex-1 text-sm text-muted-foreground">{seccion.descripcion}</span>
			<span class="mt-4 flex items-center gap-1.5 text-sm text-primary">
				Abrir
				<ArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" />
			</span>
		</a>
	{/each}
</div>
