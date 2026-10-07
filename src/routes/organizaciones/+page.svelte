<script lang="ts">
	/**
	 * HU02 · "Tus organizaciones" (Figma `215:2729` vacío, `518:32675` lleno).
	 *
	 * Dos estados en la misma página, como el diseño:
	 *   · Sin ninguna: "¡Todo listo!" y la tarjeta "Crea tu primera organización".
	 *   · Con organizaciones: a la izquierda el árbol (Recientes, buscador,
	 *     todas, y "Nueva organización" al pie); a la derecha la tarjeta de la
	 *     seleccionada y su listado de usuarios.
	 *
	 * El listado de usuarios se queda en su estado vacío a propósito: crear
	 * usuarios dentro de una organización es HU06, todavía sin construir. El
	 * único usuario que existe hoy es el administrador que nace con el alta, y
	 * ese se ve en la tarjeta de arriba.
	 */
	import { invalidateAll } from '$app/navigation';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Network from '@lucide/svelte/icons/network';
	import Clock from '@lucide/svelte/icons/clock';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';
	import Users from '@lucide/svelte/icons/users';

	import NuevaOrganizacionSheet from '$lib/components/organizaciones/NuevaOrganizacionSheet.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data } = $props();

	let nuevaAbierta = $state(false);
	let busqueda = $state('');
	let seleccionadaGuid = $state<string | null>(null);

	const organizaciones = $derived(data.organizaciones);
	const filtradas = $derived(
		organizaciones.filter((o) =>
			`${o.nombre} ${o.slug} ${o.codigo}`.toLowerCase().includes(busqueda.trim().toLowerCase())
		)
	);
	/** La elegida, o la más reciente si todavía no se elige ninguna. */
	const seleccionada = $derived(
		organizaciones.find((o) => o.guid === seleccionadaGuid) ?? organizaciones[0] ?? null
	);

	function fecha(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
	}
</script>

<svelte:head><title>NexusDoc AI — Organizaciones</title></svelte:head>

<p class="text-xs text-muted-foreground">Organizaciones / Listado de registros</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Tus organizaciones</h1>
	<p class="mt-1.5 text-sm text-muted-foreground">
		Cada organización reúne la documentación, los usuarios y la configuración de un mismo espacio de trabajo.
	</p>
</div>

{#if organizaciones.length === 0}
	<div class="mt-8 flex flex-col items-center gap-6 rounded-2xl border-2 border-border bg-card py-24 text-center">
		<Sparkles class="size-10 text-primary" />
		<div>
			<p class="text-lg font-medium text-foreground">¡Todo listo!</p>
			<p class="mt-1 max-w-md text-sm text-muted-foreground">
				Comienza a construir un espacio donde tu documentación esté siempre organizada, accesible y respaldada
				por IA.
			</p>
		</div>
		<button
			type="button"
			class="flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted"
			data-testid="crear-primera-organizacion"
			onclick={() => (nuevaAbierta = true)}
		>
			<span class="mt-0.5 shrink-0 text-primary"><Network class="size-5" /></span>
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-medium text-foreground">Crea tu primera organización</span>
				<span class="block text-xs text-muted-foreground">
					Empieza con un espacio donde toda la documentación estará organizada y siempre disponible
				</span>
			</span>
		</button>
	</div>
{:else}
	<div class="mt-8 flex min-h-150 gap-4">
		<aside class="flex w-72 shrink-0 flex-col rounded-2xl border-2 border-border bg-card p-4">
			<div class="flex items-start gap-2">
				<span class="mt-0.5 text-muted-foreground"><Network class="size-4" /></span>
				<div class="min-w-0">
					<p class="text-sm font-medium text-foreground">Listado de organizaciones</p>
					<p class="text-xs text-muted-foreground">Explora y administra tus organizaciones</p>
				</div>
			</div>

			<p class="mt-5 text-xs font-medium text-muted-foreground">Recientes</p>
			<ul class="mt-2 flex flex-col gap-1">
				{#each organizaciones.slice(0, 1) as reciente (reciente.guid)}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
							onclick={() => (seleccionadaGuid = reciente.guid)}
						>
							<Clock class="size-3.5 shrink-0" />
							<span class="min-w-0 flex-1 truncate">{reciente.nombre}</span>
							<span class="shrink-0 text-[11px] text-muted-foreground"># {reciente.codigo}</span>
						</button>
					</li>
				{/each}
			</ul>

			<div class="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5">
				<SearchIcon />
				<input
					placeholder="Buscar organización"
					bind:value={busqueda}
					data-testid="buscar-organizacion"
					class="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
				/>
				<ArrowDownUp class="size-3.5 shrink-0 text-muted-foreground" />
				<ListFilter class="size-3.5 shrink-0 text-muted-foreground" />
			</div>

			<p class="mt-5 text-xs font-medium text-muted-foreground">Organizaciones</p>
			<ul class="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" data-testid="arbol-organizaciones">
				{#each filtradas as organizacion (organizacion.guid)}
					<li>
						<button
							type="button"
							data-testid="organizacion-item"
							class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors {seleccionada?.guid ===
							organizacion.guid
								? 'bg-muted font-medium text-foreground'
								: 'text-foreground hover:bg-muted'}"
							onclick={() => (seleccionadaGuid = organizacion.guid)}
						>
							<span class="min-w-0 flex-1 truncate">{organizacion.nombre}</span>
							<span class="shrink-0 text-[11px] text-muted-foreground"># {organizacion.codigo}</span>
						</button>
					</li>
				{:else}
					<li class="px-2 py-1.5 text-xs text-muted-foreground">Ninguna coincide con la búsqueda.</li>
				{/each}
			</ul>

			<Button class="mt-4 w-full" data-testid="nueva-organizacion" onclick={() => (nuevaAbierta = true)}>
				Nueva organización
			</Button>
		</aside>

		<section class="flex min-w-0 flex-1 flex-col rounded-2xl border-2 border-border bg-card p-6">
			{#if seleccionada}
				<div class="flex flex-wrap items-center gap-3">
					<Network class="size-5 shrink-0 text-primary" />
					<p class="text-lg font-medium text-foreground" data-testid="organizacion-seleccionada">
						{seleccionada.nombre}
					</p>
					<span
						class="flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
					>
						<span class="size-1.5 rounded-full bg-green-500"></span>
						{seleccionada.estado === 'ACTIVE' ? 'Activo' : seleccionada.estado}
					</span>
					<span class="ml-auto rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
						Agregado {fecha(seleccionada.creadaEn)}
					</span>
				</div>

				<dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-b border-border pb-5 lg:grid-cols-4">
					<div>
						<dt class="text-xs text-muted-foreground">Admr. de la Organización</dt>
						<dd class="mt-0.5 truncate text-sm text-foreground">{seleccionada.admin?.nombre ?? '—'}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Teléfono celular</dt>
						<dd class="mt-0.5 truncate text-sm text-foreground">{seleccionada.admin?.telefono ?? '—'}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Correo electrónico</dt>
						<dd class="mt-0.5 truncate text-sm text-foreground">{seleccionada.admin?.email ?? '—'}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Información de recuperación</dt>
						<dd class="mt-0.5 truncate text-sm text-foreground">
							{[seleccionada.recuperacion?.email, seleccionada.recuperacion?.telefono]
								.filter(Boolean)
								.join(' · ') || '—'}
						</dd>
					</div>
				</dl>

				<div class="mt-5 flex items-center gap-2">
					<Users class="size-4 text-muted-foreground" />
					<p class="text-sm font-medium text-foreground">Listado de usuarios</p>
					<span class="text-xs text-muted-foreground">Usuarios de organización</span>
				</div>

				<!-- HU06 (crear usuarios dentro de la organización) todavía no existe:
				     el listado se queda en su estado vacío, sin inventar filas. -->
				<div class="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
					<span class="flex size-12 items-center justify-center rounded-xl border-2 border-border bg-background">
						<Users class="size-5 text-muted-foreground" />
					</span>
					<p class="text-sm font-medium text-foreground">Aquí aparecerán los usuarios registrados</p>
					<p class="max-w-sm text-xs text-muted-foreground">
						Aquí podrás visualizar y supervisar los usuarios creados por los administradores de cada organización
						dentro de NexusDoc.
					</p>
				</div>
			{/if}
		</section>
	</div>
{/if}

<NuevaOrganizacionSheet
	bind:open={nuevaAbierta}
	recientes={organizaciones.map((o) => ({ nombre: o.nombre, slug: o.slug }))}
	alCrear={() => invalidateAll()}
/>
