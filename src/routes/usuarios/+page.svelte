<script lang="ts">
	/**
	 * HU06 · "Usuarios de la organización" (Figma `538:29434` vacío,
	 * `555:27038` lleno) y HU07 · editar su rol.
	 *
	 * Tres estados:
	 *   · Quien entra no administra ninguna organización (le pasa al
	 *     administrador de plataforma): se le dice, en vez de una tabla vacía
	 *     que parecería un error.
	 *   · Sin usuarios: "Tu organización está lista para crecer".
	 *   · Con usuarios: la tabla del diseño (ID, nombre con su correo debajo,
	 *     rol, fecha de registro y estatus), con buscador y selección.
	 *
	 * La barra flotante del diseño trae cuatro acciones; aquí van tres:
	 * **Editar** (HU07), **Desactivar/Reactivar** (HU08, HU09) y **Cerrar
	 * sesión** (HU05). Falta "Reenviar invitación", que necesita correo y en
	 * este sprint no hay.
	 *
	 * Una desviación: el diseño, antes de desactivar, muestra "Usuario con
	 * casos HITL asignados" para reasignar sus casos. La cola HITL todavía no
	 * existe —ningún caso está asignado a nadie—, así que esa pantalla se
	 * omite: no habría a quién reasignar ni qué. El texto de la confirmación sí
	 * menciona el proceso HITL, tal cual lo escribió el diseño.
	 */
	import { invalidateAll } from '$app/navigation';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Users from '@lucide/svelte/icons/users';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';
	import Pencil from '@lucide/svelte/icons/pencil';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import UserRoundX from '@lucide/svelte/icons/user-round-x';
	import UserRoundCheck from '@lucide/svelte/icons/user-round-check';
	import LogOut from '@lucide/svelte/icons/log-out';

	import MotivoSheet from '$lib/components/usuarios/MotivoSheet.svelte';
	import UsuarioSheet from '$lib/components/usuarios/UsuarioSheet.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { UsuarioDeOrganizacion } from '$lib/usuarios/tipos';

	let { data } = $props();

	let abierto = $state(false);
	let editando = $state<UsuarioDeOrganizacion | null>(null);
	let motivoAbierto = $state(false);
	let accionMotivo = $state<'desactivar' | 'cerrar-sesion'>('desactivar');
	let objetivo = $state<UsuarioDeOrganizacion | null>(null);
	let reactivando = $state(false);
	let errorAccion = $state('');
	let busqueda = $state('');
	let seleccionado = $state<string | null>(null);

	const usuarios = $derived(data.usuarios);
	const filtrados = $derived(
		usuarios.filter((u) =>
			`${u.nombre} ${u.email} ${u.rolNombre}`.toLowerCase().includes(busqueda.trim().toLowerCase())
		)
	);
	const elegido = $derived(usuarios.find((u) => u.guid === seleccionado) ?? null);

	function fechaHora(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		const dia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
		return `${dia} | ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function abrirAlta() {
		editando = null;
		abierto = true;
	}

	function abrirEdicion(usuario: UsuarioDeOrganizacion) {
		editando = usuario;
		abierto = true;
	}

	function pedirMotivo(usuario: UsuarioDeOrganizacion, accion: 'desactivar' | 'cerrar-sesion') {
		objetivo = usuario;
		accionMotivo = accion;
		errorAccion = '';
		motivoAbierto = true;
	}

	/** Reactivar no pide motivo en el diseño: devuelve el acceso y ya. */
	async function reactivar(usuario: UsuarioDeOrganizacion) {
		if (reactivando) return;
		reactivando = true;
		errorAccion = '';
		try {
			const r = await fetch(`/api/usuarios/${usuario.guid}/estado`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ activo: true, motivo: 'Reactivación de acceso.' })
			});
			if (!r.ok) {
				const datos = await r.json().catch(() => null);
				errorAccion = datos?.mensaje ?? 'No se pudo reactivar la cuenta.';
				return;
			}
			seleccionado = null;
			await invalidateAll();
		} finally {
			reactivando = false;
		}
	}
</script>

<svelte:head><title>NexusDoc AI — Usuarios</title></svelte:head>

<p class="text-xs text-muted-foreground">Usuarios / Listado de usuarios</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Usuarios de la organización</h1>
	<p class="mt-1.5 text-sm text-muted-foreground">
		Administra, consulta información, actualiza datos y gestiona permisos según sea necesario.
	</p>
</div>

{#if data.sinOrganizacion}
	<!-- Solo le toca al administrador de plataforma, que no pertenece a ninguna
	     organización: los usuarios de cada una los administra el administrador de
	     ESA. A quien no administra ninguna, el `load` lo manda al inicio antes de
	     llegar aquí, así que esta rama es suya y de nadie más. -->
	<div class="mt-8 flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-card py-20 text-center">
		<Users class="size-8 text-muted-foreground" />
		<p class="text-sm font-medium text-foreground">Esta pantalla es de una organización</p>
		<p class="max-w-md text-xs text-muted-foreground">
			Los usuarios los administra quien administra cada organización. En
			<a href="/organizaciones" class="font-medium text-primary hover:underline">Organizaciones</a> puedes crear
			una y dar de alta a su administrador.
		</p>
	</div>
{:else if usuarios.length === 0}
	<div class="mt-8 flex flex-col items-center gap-6 rounded-2xl border-2 border-border bg-card py-24 text-center">
		<Sparkles class="size-10 text-primary" />
		<div>
			<p class="text-lg font-medium text-foreground">Tu organización está lista para crecer</p>
			<p class="mt-1 max-w-lg text-sm text-muted-foreground">
				Comienza agregando el primer usuario de tu organización. Podrás asignarle el perfil que mejor se adapte
				a sus responsabilidades y administrar su acceso en cualquier momento.
			</p>
		</div>
		<button
			type="button"
			class="flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted"
			data-testid="crear-primer-usuario"
			onclick={abrirAlta}
		>
			<span class="mt-0.5 shrink-0 text-primary"><UserPlus class="size-5" /></span>
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-medium text-foreground">Empieza a formar tu equipo</span>
				<span class="block text-xs text-muted-foreground">
					Invita a los miembros de tu organización y asigna perfiles según sus funciones.
				</span>
			</span>
		</button>
	</div>
{:else}
	<div class="mt-8 rounded-2xl border-2 border-border bg-card p-5">
		<div class="flex flex-wrap items-center gap-3">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-foreground">Listado de usuarios</p>
				<p class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Users class="size-3.5" />
					{usuarios.length}
					{usuarios.length === 1 ? 'usuario total' : 'usuarios totales'}
				</p>
			</div>
			<div class="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5">
				<SearchIcon />
				<input
					placeholder="Buscar usuario"
					bind:value={busqueda}
					data-testid="buscar-usuario"
					class="h-9 w-52 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
				/>
			</div>
			<button type="button" class="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-foreground">
				<ArrowDownUp class="size-3.5" /> Ordenar
			</button>
			<button type="button" class="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-foreground">
				<ListFilter class="size-3.5" /> Filtrar
			</button>
			<Button size="icon" data-testid="nuevo-usuario" aria-label="Nuevo usuario" onclick={abrirAlta}>
				<UserPlus class="size-4" />
			</Button>
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-y border-border text-xs text-muted-foreground">
						<th class="w-10 py-2.5 pl-2"><span class="sr-only">Seleccionar</span></th>
						<th class="py-2.5 pr-4 font-normal">ID</th>
						<th class="py-2.5 pr-4 font-normal">Nombre del usuario</th>
						<th class="py-2.5 pr-4 font-normal">Rol asignado</th>
						<th class="py-2.5 pr-4 font-normal">Fecha de registro</th>
						<th class="py-2.5 pr-2 font-normal">Estatus</th>
					</tr>
				</thead>
				<tbody data-testid="tabla-usuarios">
					{#each filtrados as usuario (usuario.guid)}
						<tr class="border-b border-border last:border-0 {seleccionado === usuario.guid ? 'bg-muted/50' : ''}">
							<td class="py-3 pl-2">
								<Checkbox
									checked={seleccionado === usuario.guid}
									onCheckedChange={() => (seleccionado = seleccionado === usuario.guid ? null : usuario.guid)}
									aria-label={`Seleccionar ${usuario.nombre}`}
								/>
							</td>
							<td class="py-3 pr-4 text-xs text-muted-foreground">{usuario.numero}</td>
							<td class="min-w-0 py-3 pr-4">
								<p class="truncate font-medium text-foreground">{usuario.nombre}</p>
								<p class="truncate text-xs text-muted-foreground">{usuario.email}</p>
							</td>
							<td class="py-3 pr-4 text-foreground">{usuario.rolNombre}</td>
							<td class="py-3 pr-4 text-xs text-muted-foreground">{fechaHora(usuario.creadoEn)}</td>
							<td class="py-3 pr-2">
								<span
									class="rounded-md px-2 py-0.5 text-xs font-medium {usuario.activo
										? 'bg-green-50 text-green-700'
										: 'bg-muted text-muted-foreground'}"
								>
									{usuario.activo ? 'Activo' : 'Inactivo'}
								</span>
							</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="py-8 text-center text-xs text-muted-foreground">
							Ningún usuario coincide con la búsqueda.
						</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

{#if elegido}
	<!-- La píldora del diseño, con la única acción que ya existe. -->
	<div class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
		<div
			class="pointer-events-auto flex items-center gap-1 rounded-xl bg-[#111827] px-3 py-2 shadow-lg"
			data-testid="acciones-usuario"
		>
			<button
				type="button"
				class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-card/10"
				data-testid="editar-usuario"
				onclick={() => abrirEdicion(elegido)}
			>
				<Pencil class="size-3.5" />
				Editar
			</button>
			{#if elegido.activo}
				<button
					type="button"
					class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-card/10"
					data-testid="desactivar-usuario"
					onclick={() => pedirMotivo(elegido, 'desactivar')}
				>
					<UserRoundX class="size-3.5" />
					Desactivar
				</button>
				<button
					type="button"
					class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-card/10"
					data-testid="cerrar-sesion-usuario"
					onclick={() => pedirMotivo(elegido, 'cerrar-sesion')}
				>
					<LogOut class="size-3.5" />
					Cerrar sesión
				</button>
			{:else}
				<button
					type="button"
					class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-card/10 disabled:opacity-50"
					data-testid="reactivar-usuario"
					disabled={reactivando}
					onclick={() => reactivar(elegido)}
				>
					<UserRoundCheck class="size-3.5" />
					{reactivando ? 'Reactivando…' : 'Reactivar'}
				</button>
			{/if}
		</div>
	</div>
{/if}

{#if errorAccion}
	<p
		class="fixed inset-x-0 bottom-24 z-50 text-center text-xs text-destructive"
		role="alert"
		data-testid="error-accion-usuario"
	>
		{errorAccion}
	</p>
{/if}

<MotivoSheet
	bind:open={motivoAbierto}
	accion={accionMotivo}
	usuario={objetivo}
	alTerminar={async () => {
		seleccionado = null;
		await invalidateAll();
	}}
/>

<UsuarioSheet
	bind:open={abierto}
	roles={data.roles}
	{editando}
	alGuardar={async () => {
		seleccionado = null;
		await invalidateAll();
	}}
/>
