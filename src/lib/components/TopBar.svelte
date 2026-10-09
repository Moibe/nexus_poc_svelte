<script lang="ts">
	import { page } from '$app/state';
	import nexusLogo from '$lib/assets/nexus-logo.png';
	import DashboardCircleIcon from '$lib/components/icons/DashboardCircleIcon.svelte';
	import UserStatusIcon from '$lib/components/icons/UserStatusIcon.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import NotificationBellIcon from '$lib/components/icons/NotificationBellIcon.svelte';
	import SettingGearIcon from '$lib/components/icons/SettingGearIcon.svelte';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Network from '@lucide/svelte/icons/network';
	import UserCircle from '@lucide/svelte/icons/circle-user-round';
	import Moon from '@lucide/svelte/icons/moon';
	import Globe from '@lucide/svelte/icons/globe';
	import Check from '@lucide/svelte/icons/check';
	import { tema } from '$lib/tema.svelte';
	import { APP_NOMBRE, APP_VERSION } from '$lib/version';
	import PerfilSheet from '$lib/components/perfil/PerfilSheet.svelte';
	import type { Usuario } from '$lib/server/sesion';

	let { usuario = null }: { usuario?: Usuario | null } = $props();

	/** El panel "Perfil" (HU12 y HU13), que abre el menú de la cuenta. */
	let perfilAbierto = $state(false);
	/** El submenú de idioma. Hoy solo hay español; se deja porque está en el
	 *  diseño y porque el día que haya otro, el lugar ya existe. */
	let idiomaAbierto = $state(false);

	/** Lo que va bajo el nombre. Los códigos son los de `servicios/roles.py`;
	 *  si llegara uno nuevo que aquí no esté, se muestra "Usuario" en vez de un
	 *  código en mayúsculas. */
	const NOMBRE_DE_ROL: Record<string, string> = {
		ADMIN: 'Administrador',
		SUPERVISOR: 'Supervisor',
		ANALISTA: 'Analista',
		OPERADOR: 'Operador',
		COMPLIANCE_OFFICER: 'Compliance Officer',
		AUDITOR: 'Auditor',
		VIEWER: 'Viewer'
	};
	const etiquetaDeRol = $derived(
		usuario?.esAdminPlataforma
			? 'Administrador de plataforma'
			: (usuario?.rol && NOMBRE_DE_ROL[usuario.rol]) || 'Usuario'
	);

	/** Cerrar sesión: el BFF revoca en nexus_back y borra las cookies; luego al
	 *  login. `location` y no `goto`: así se vacía todo el estado en memoria
	 *  (bandejas, pipeline), que era del usuario que se fue. */
	async function cerrarSesion() {
		await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
		window.location.assign('/acceso/iniciar-sesion');
	}
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ConfigSheet from '$lib/components/config/ConfigSheet.svelte';
	import ApiKeySheet from '$lib/components/config/ApiKeySheet.svelte';
	import WebhookSheet from '$lib/components/config/WebhookSheet.svelte';
	import { pedidoDeConfiguracion } from '$lib/state/configuracion.svelte';
	import Cog from '@lucide/svelte/icons/cog';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Plug from '@lucide/svelte/icons/plug';
	import Waypoints from '@lucide/svelte/icons/waypoints';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Webhook from '@lucide/svelte/icons/webhook';

	// El sheet se monta aquí junto al menú que lo abre; se renderiza en un portal
	// sobre todo el documento, así que no importa que viva dentro del header.
	let configAbierto = $state(false);

	/** El modal de "Configuración de API Key", hermano del anterior. */
	let apiKeyAbierto = $state(false);

	/** El modal de "Configuración de webhook", hermano de los dos anteriores. */
	let webhooksAbierto = $state(false);

	// Algo fuera del header puede pedir que se abra (hoy: "Configurar" en una
	// fila del Pipeline documental). Aquí SOLO se abre; la bandera la apaga
	// ConfigSheet cuando ya navegó — ver `pedidoDeConfiguracion`.
	$effect(() => {
		if (pedidoDeConfiguracion.nuevoTipo) configAbierto = true;
	});

	// "Organizaciones" (HU02) solo para el administrador de plataforma: es quien
	// las crea. Un usuario de organización ni la ve ni puede entrar (la página
	// lo regresa al inicio).
	const navItems = $derived([
		{ href: '/', label: 'Inicio', icon: DashboardCircleIcon },
		...(usuario?.esAdminPlataforma
			? [{ href: '/organizaciones', label: 'Organizaciones', icon: Network }]
			: []),
		{ href: '/usuarios', label: 'Usuarios', icon: UserStatusIcon }
	]);

	// Menú del engrane. Todavía SIN navegación: son solo las opciones visibles.
	//
	// Los íconos son de lucide, elegidos por cercanía semántica. No salieron de
	// Figma: este dropdown no está en la página del flujo de carga (la única de
	// la que tengo el volcado), así que no pude sacar los SVG reales como sí se
	// hizo con los del header. Si aparece el link de Figma de este menú, vale la
	// pena reemplazarlos por los exportados.
	const opcionesConfiguracion = [
		{ etiqueta: 'Motor de reglas', icono: Cog, alSeleccionar: undefined },
		{
			etiqueta: 'Modulo de configuración',
			icono: SlidersHorizontal,
			alSeleccionar: () => (configAbierto = true)
		},
		{ etiqueta: 'Conectores', icono: Plug, alSeleccionar: undefined },
		{ etiqueta: 'Auditoria y trazabilidad', icono: Waypoints, alSeleccionar: undefined },
		// Agregada el 2026-09-23. Va al final del menú, que es donde la pone la
		// captura del diseño, y con la pieza de rompecabezas que ahí se ve —no una
		// llave, aunque semánticamente pegaría más.
		{ etiqueta: 'API Key', icono: Puzzle, alSeleccionar: () => (apiKeyAbierto = true) },
		// Agregada el 2026-09-30, junto a API Key: las dos son cosas que se
		// configuran para que un tercero use NexusDoc. El ícono es de lucide, sin
		// captura del menú que lo confirme.
		{ etiqueta: 'Webhooks', icono: Webhook, alSeleccionar: () => (webhooksAbierto = true) }
	];
</script>

<header class="sticky top-0 z-40 border-b border-border bg-card">
	<div class="mx-auto flex h-16 max-w-360 items-center justify-between gap-6 px-6">
		<div class="flex items-center gap-6">
			<a href="/" class="flex items-center">
				<img src={nexusLogo} alt="NexusDoc AI" class="h-9 w-auto" />
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
				aria-label="Buscar"
				class="flex size-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
			>
				<SearchIcon />
			</button>
			<button
				type="button"
				aria-label="Notificaciones"
				class="flex size-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
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
							class="flex size-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted data-[state=open]:bg-muted"
						>
							<SettingGearIcon />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-60">
					{#each opcionesConfiguracion as opcion (opcion.etiqueta)}
						<DropdownMenu.Item class="gap-3 py-2.5" onSelect={opcion.alSeleccionar}>
							<opcion.icono class="size-4 text-muted-foreground" />
							{opcion.etiqueta}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<div class="h-6 w-px bg-border"></div>
			<!-- El usuario de la sesión (Sprint 1, HU03). Hasta el 2026-10-07 era un
			     nombre fijo. El rol todavía no existe en la sesión (llega con HU07),
			     así que dice "Administrador de plataforma" o "Usuario". -->
			<div class="flex items-center gap-3">
				<div>
					<p class="text-sm font-medium text-foreground" data-testid="usuario-nombre">{usuario?.nombre ?? '—'}</p>
					<p class="text-xs text-muted-foreground" data-testid="usuario-rol">{etiquetaDeRol}</p>
				</div>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								aria-label="Más opciones"
								data-testid="menu-usuario"
								class="flex size-6 items-center justify-center rounded-lg bg-muted transition-colors hover:bg-border data-[state=open]:bg-border"
							>
								<MoreVerticalIcon />
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<!-- El menú del diseño (captura del 2026-10-09): perfil, línea
					     punteada, modo oscuro con interruptor e idioma, otra línea, y
					     al pie la versión. -->
					<DropdownMenu.Content align="end" class="w-60 p-2">
						<DropdownMenu.Item class="gap-3 py-2.5" data-testid="mi-perfil" onSelect={() => (perfilAbierto = true)}>
							<UserCircle class="size-4 text-muted-foreground" />
							Mi perfil
						</DropdownMenu.Item>

						<div role="separator" class="my-1.5 border-t border-dashed border-border"></div>

						<!-- No cierra el menú: se ve el cambio de tema al instante. -->
						<DropdownMenu.CheckboxItem
							class="gap-3 py-2.5 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden"
							data-testid="modo-oscuro"
							closeOnSelect={false}
							checked={tema.oscuro}
							onCheckedChange={() => tema.alternar()}
						>
							<Moon class="size-4 text-muted-foreground" />
							<span class="flex-1">Modo oscuro</span>
							<span
								aria-hidden="true"
								class="inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {tema.oscuro
									? 'bg-primary'
									: 'bg-muted-foreground/30'}"
							>
								<span
									class="size-4 rounded-full bg-card shadow transition-transform {tema.oscuro
										? 'translate-x-4.5'
										: 'translate-x-0.5'}"
								></span>
							</span>
						</DropdownMenu.CheckboxItem>

						<DropdownMenu.Sub bind:open={idiomaAbierto}>
							<DropdownMenu.SubTrigger class="gap-3 py-2.5" data-testid="idioma">
								<Globe class="size-4 text-muted-foreground" />
								<span class="flex-1">Idioma</span>
							</DropdownMenu.SubTrigger>
							<DropdownMenu.SubContent class="w-44 p-2">
								<!-- La app está solo en español: la opción se muestra elegida
								     y no hay otra. Cuando haya una segunda, va aquí. -->
								<DropdownMenu.Item class="gap-3 py-2.5" data-testid="idioma-es">
									<span class="flex-1">Español</span>
									<Check class="size-4 text-primary" />
								</DropdownMenu.Item>
							</DropdownMenu.SubContent>
						</DropdownMenu.Sub>

						<div role="separator" class="my-1.5 border-t border-dashed border-border"></div>

						<DropdownMenu.Item class="gap-3 py-2.5" data-testid="cerrar-sesion" onSelect={cerrarSesion}>
							<LogOut class="size-4 text-muted-foreground" />
							Cerrar sesión
						</DropdownMenu.Item>

						<p class="px-2 pt-2 text-xs text-muted-foreground" data-testid="version-app">
							v{APP_VERSION} · {APP_NOMBRE}
						</p>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	</div>
</header>

<PerfilSheet bind:open={perfilAbierto} rolVisible={etiquetaDeRol} />
<ConfigSheet bind:open={configAbierto} />
<ApiKeySheet bind:open={apiKeyAbierto} />
<WebhookSheet bind:open={webhooksAbierto} />
