<script lang="ts">
	/**
	 * Módulo de uso · el mosaico de lo que se usa a diario (2026-10-30, pedido de Moibe).
	 *
	 * Sustituye a la opción «Expediente» del engrane. Es el hermano del módulo de configuración (`/configuracion`): una página con un
	 * cuadro por cosa y cada cuadro lleva a su pantalla. Aquí no se configura nada, se trabaja:
	 *   · Centro operativo documental: el inicio, con sus tres bandejas (carga documental, bandeja de preparación y pipeline).
	 *   · Expedientes: la carpeta de cada cliente o caso y los documentos que reúne. Desde ahí, dentro de cada expediente, se ejecuta un proceso del motor de
	 *     reglas y se ve su historial de ejecuciones.
	 *   · Búsqueda (NEX-607, 2026-11-23): preguntar con palabras propias sobre los datos extraídos y ver la respuesta como tabla.
	 *   · Buscar en documentos (épica 14, 2026-11-28): encontrar el fragmento y la página donde aparece algo, por sentido, en el texto de los documentos.
	 *
	 * Ejecuciones tuvo aquí su propio cuadro y su pantalla (2026-10-30 al 2026-11-07); Moibe las quitó («quita ejecuciones de la sección aparte»): ahora viven
	 * dentro del expediente. Recuperar la pantalla: `git show <commit anterior al 2026-11-07>:src/routes/ejecuciones/+page.svelte`.
	 *
	 * No pide datos ni decide permisos: cada pantalla a la que lleva decide por su cuenta quién entra. Agregar la siguiente cosa es agregar
	 * un renglón a `SECCIONES`.
	 */
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import MessageCircleQuestion from '@lucide/svelte/icons/message-circle-question-mark';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import FileSearch from '@lucide/svelte/icons/file-search';

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
				'Los expedientes de tu organización: la carpeta de cada cliente o caso y los documentos que reúne.'
		},
		{
			id: 'busqueda',
			nombre: 'Búsqueda',
			href: '/busqueda',
			icono: MessageCircleQuestion,
			descripcion:
				'Pregunta con tus palabras sobre los datos extraídos de los documentos de tu organización y recibe la respuesta como tabla.'
		},
		{
			id: 'buscar-en-documentos',
			nombre: 'Buscar en documentos',
			href: '/busqueda/documentos',
			icono: FileSearch,
			descripcion:
				'Encuentra en qué documento y en qué página aparece algo: busca por sentido en el texto de los documentos y te enseña el fragmento.'
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
