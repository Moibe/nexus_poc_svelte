<script lang="ts">
	import { page } from '$app/state';
	import LogoMark from '$lib/components/icons/LogoMark.svelte';
	import DashboardCircleIcon from '$lib/components/icons/DashboardCircleIcon.svelte';
	import UserStatusIcon from '$lib/components/icons/UserStatusIcon.svelte';
	import NotificationBellIcon from '$lib/components/icons/NotificationBellIcon.svelte';
	import SettingGearIcon from '$lib/components/icons/SettingGearIcon.svelte';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import Cog from '@lucide/svelte/icons/cog';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Plug from '@lucide/svelte/icons/plug';
	import Waypoints from '@lucide/svelte/icons/waypoints';

	const navItems = [
		{ href: '/', label: 'Inicio', icon: DashboardCircleIcon },
		{ href: '/usuarios', label: 'Usuarios', icon: UserStatusIcon }
	];

	// Menú del engrane. Todavía SIN navegación: son solo las opciones visibles.
	//
	// Los íconos son de lucide, elegidos por cercanía semántica. No salieron de
	// Figma: este dropdown no está en la página del flujo de carga (la única de
	// la que tengo el volcado), así que no pude sacar los SVG reales como sí se
	// hizo con los del header. Si aparece el link de Figma de este menú, vale la
	// pena reemplazarlos por los exportados.
	const opcionesConfiguracion = [
		{ etiqueta: 'Motor de reglas', icono: Cog },
		{ etiqueta: 'Modulo de configuración', icono: SlidersHorizontal },
		{ etiqueta: 'Conectores', icono: Plug },
		{ etiqueta: 'Auditoria y trazabilidad', icono: Waypoints }
	];
</script>

<header class="sticky top-0 z-40 border-b border-border bg-white">
	<div class="mx-auto flex h-16 max-w-360 items-center justify-between gap-6 px-6">
		<div class="flex items-center gap-6">
			<a href="/" class="flex items-center gap-1">
				<span class="flex size-6 items-center justify-center rounded-md bg-primary p-1.5">
					<LogoMark />
				</span>
				<span class="text-xs font-semibold text-foreground">NexusDoc AI</span>
			</a>

			<nav class="flex items-center gap-2">
				{#each navItems as item (item.href)}
					{@const active = item.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(item.href)}
					<a
						href={item.href}
						class={[
							'flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors',
							active
								? 'bg-primary text-primary-foreground'
								: 'text-foreground hover:bg-muted'
						]}
					>
						<item.icon />
						{item.label}
					</a>
				{/each}
			</nav>
		</div>

		<div class="flex items-center gap-3">
			<button
				type="button"
				aria-label="Notificaciones"
				class="flex size-8 items-center justify-center rounded-lg border border-border bg-white transition-colors hover:bg-muted"
			>
				<NotificationBellIcon />
			</button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							aria-label="Configuración"
							class="flex size-8 items-center justify-center rounded-lg border border-border bg-white transition-colors hover:bg-muted data-[state=open]:bg-muted"
						>
							<SettingGearIcon />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-60">
					{#each opcionesConfiguracion as opcion (opcion.etiqueta)}
						<DropdownMenu.Item class="gap-3 py-2.5">
							<opcion.icono class="size-4 text-muted-foreground" />
							{opcion.etiqueta}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<div class="h-6 w-px bg-border"></div>
			<div class="flex items-center gap-3">
				<div>
					<p class="text-sm font-medium text-foreground">Benjamin Leon Galvez</p>
					<p class="text-xs text-muted-foreground">Administrador</p>
				</div>
				<button
					type="button"
					aria-label="Más opciones"
					class="flex size-6 items-center justify-center rounded-lg bg-muted transition-colors hover:bg-border"
				>
					<MoreVerticalIcon />
				</button>
			</div>
		</div>
	</div>
</header>
