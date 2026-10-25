<script lang="ts">
	/**
	 * Módulo de configuración · el mosaico de secciones (2026-10-25, pedido de Moibe).
	 *
	 * Hasta hoy el engrane abría directo la biblioteca de tipos documentales, en un panel lateral. Ahora en el módulo se configura
	 * más de una cosa, así que el engrane trae aquí: una página con un cuadro por sección, y cada cuadro lleva a su pantalla.
	 * Por ahora son dos —tipos documentales y tipos de expediente—; el mosaico está hecho para que agregar la siguiente sea
	 * agregar un renglón a `SECCIONES`.
	 *
	 * Los expedientes NO viven aquí: siguen en su propia entrada del engrane (`/expediente`). Aquí se configura de qué están
	 * hechos; allá se trabaja con ellos.
	 *
	 * Quien no administra no ve el engrane (`TopBar.svelte`), pero la dirección se puede escribir a mano: en ese caso se dice que
	 * esta parte es de quien administra, en vez de enseñar cuadros que llevan a pantallas que no va a poder usar.
	 */
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Lock from '@lucide/svelte/icons/lock';

	import SetupIcon from '$lib/components/icons/SetupIcon.svelte';

	let { data } = $props();

	const SECCIONES = [
		{
			id: 'tipos-documentales',
			nombre: 'Tipos documentales',
			href: '/configuracion/tipos-documentales',
			icono: SetupIcon,
			descripcion:
				'La biblioteca de tu organización: qué documentos reconoce NexusDoc, qué campos extrae de cada uno y cómo se calibran con ejemplos.'
		},
		{
			id: 'tipos-expediente',
			nombre: 'Tipos de expediente',
			href: '/configuracion/tipos-expediente',
			icono: FolderOpen,
			descripcion:
				'Las clases de las que salen tus expedientes, por ejemplo «Expediente médico», y los tipos documentales que forman el esquema de cada una.'
		}
	];
</script>

<svelte:head><title>NexusDoc AI — Módulo de configuración</title></svelte:head>

<p class="text-xs text-muted-foreground">Configuración</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Módulo de configuración</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Configura la forma en que NexusDoc comprende tus documentos y cómo se organizan tus expedientes. Elige la sección que quieres
		trabajar.
	</p>
</div>

{#if data.puedeAdministrar}
	<div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="mosaico-configuracion">
		{#each SECCIONES as seccion (seccion.id)}
			<a
				href={seccion.href}
				data-testid="seccion-configuracion"
				data-seccion={seccion.id}
				class="group flex min-h-50 flex-col rounded-2xl border-2 border-border bg-card p-6 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
					<seccion.icono class="size-4" />
				</span>
				<span class="mt-4 block text-lg font-medium text-foreground">{seccion.nombre}</span>
				<span class="mt-1.5 block flex-1 text-sm text-muted-foreground">{seccion.descripcion}</span>
				<span class="mt-4 flex items-center gap-1.5 text-sm text-primary">
					Configurar
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" />
				</span>
			</a>
		{/each}
	</div>
{:else}
	<div
		class="mt-8 flex flex-col items-center gap-6 rounded-2xl border-2 border-border bg-card py-24 text-center"
		data-testid="configuracion-sin-permiso"
	>
		<Lock class="size-10 text-muted-foreground" />
		<div>
			<p class="text-lg font-medium text-foreground">Esta parte la configura quien administra</p>
			<p class="mt-1 max-w-lg text-sm text-muted-foreground">
				Los tipos documentales y los tipos de expediente los define quien administra tu organización. Si necesitas un cambio aquí,
				pídeselo.
			</p>
		</div>
	</div>
{/if}
