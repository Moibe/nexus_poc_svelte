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
	 * **Editar** (HU07) abre la fila elegida EN LA TABLA —una tarjeta debajo de ella con nombre, correo y rol— y la barra
	 * flotante cambia a "Cancelar edición | Guardar cambios", como el diseño. Dar de alta, en cambio, sí es un panel lateral.
	 *
	 * La barra flotante del diseño trae cuatro acciones: **Editar** (HU07),
	 * **Desactivar/Reactivar** (HU08, HU09), **Cerrar sesión** (HU05) y
	 * **Reenviar invitación** (HU06, CA-6), esta última solo para quien sigue
	 * sin hacer su primer acceso. El estatus agrega "Pendiente" y "Caducada"
	 * (ver `$lib/usuarios/estatus`) para que se vea a quién reenviarle.
	 *
	 * Una desviación: el diseño, antes de desactivar, muestra "Usuario con
	 * casos HITL asignados" para reasignar sus casos. La cola HITL todavía no
	 * existe —ningún caso está asignado a nadie—, así que esa pantalla se
	 * omite: no habría a quién reasignar ni qué. El texto de la confirmación sí
	 * menciona el proceso HITL, tal cual lo escribió el diseño.
	 */
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Users from '@lucide/svelte/icons/users';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';
	import Pencil from '@lucide/svelte/icons/pencil';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import UserRoundX from '@lucide/svelte/icons/user-round-x';
	import UserRoundCheck from '@lucide/svelte/icons/user-round-check';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MailPlus from '@lucide/svelte/icons/mail-plus';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import IndicadorSesion from '$lib/components/usuarios/IndicadorSesion.svelte';
	import MotivoModal from '$lib/components/usuarios/MotivoModal.svelte';
	import ReenviarInvitacionSheet from '$lib/components/usuarios/ReenviarInvitacionSheet.svelte';
	import EdicionUsuarioFila from '$lib/components/usuarios/EdicionUsuarioFila.svelte';
	import UsuarioSheet from '$lib/components/usuarios/UsuarioSheet.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { estatusDe, puedeReenviarInvitacion } from '$lib/usuarios/estatus';
	import type { UsuarioDeOrganizacion } from '$lib/usuarios/tipos';

	let { data } = $props();

	/** "Con sesión / Sin sesión" cambia sin que el administrador haga nada (alguien entra, alguien sale), así que la
	 *  lista se refresca sola: al volver a la pestaña y cada 10 s con la pestaña a la vista. */
	onMount(() => {
		const refrescar = () => {
			if (document.visibilityState === 'visible') invalidateAll().catch(() => undefined);
		};
		const temporizador = setInterval(refrescar, 10_000);
		document.addEventListener('visibilitychange', refrescar);
		return () => {
			clearInterval(temporizador);
			document.removeEventListener('visibilitychange', refrescar);
		};
	});

	let abierto = $state(false);
	/** A quién se le está editando la fila (HU07), y la tarjeta que lo edita. */
	let editando = $state<UsuarioDeOrganizacion | null>(null);
	let tarjeta = $state<ReturnType<typeof EdicionUsuarioFila> | null>(null);
	let estadoEdicion = $state({ completo: false, enviando: false });
	let motivoAbierto = $state(false);
	let accionMotivo = $state<'desactivar' | 'cerrar-sesion'>('desactivar');
	let objetivo = $state<UsuarioDeOrganizacion | null>(null);
	let reenvioAbierto = $state(false);
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

	// Si se quita o se cambia la selección, la edición de esa fila termina.
	$effect(() => {
		if (editando && seleccionado !== editando.guid) editando = null;
	});

	function fechaHora(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		const dia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
		return `${dia} | ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	/** El alta salió bien Y el correo con los accesos también: se dice con el aviso verde del diseño («Usuario creado
	 *  correctamente»). Vive AQUÍ y no en el panel del alta: el panel se cierra al salir el correo, y un aviso dentro se
	 *  iría con él. Se apaga al abrir otra alta: a partir de ahí hablaría de la anterior.
	 *
	 *  Solo cuando el correo SALIÓ, porque el texto del diseño lo afirma («las credenciales de acceso han sido enviadas al
	 *  correo»). Si no salió, el usuario sí se creó, pero decir eso sería falso: ese caso se queda en el panel, que muestra
	 *  la contraseña temporal. */
	let aviso = $state<'creado' | 'reenviado' | 'guardado' | null>(null);
	/*  Un solo estado para los tres avisos verdes de la página, porque nunca hay más de uno: se apaga al empezar cualquier
	 *  otra acción (`aviso = null`), y por eso no son tres banderas.
	 *   - 'creado'    el alta de arriba.
	 *   - 'reenviado' «Reenviar invitación» («Nuevo enlace enviado»): solo si el reenvío se hizo Y el correo salió; el panel
	 *                 se cierra y el aviso queda aquí.
	 *   - 'guardado'  la edición de un usuario en su fila (HU07: nombre y rol): «Cambios guardados correctamente». */

	function abrirAlta() {
		aviso = null;
		abierto = true;
	}

	function abrirEdicion(usuario: UsuarioDeOrganizacion) {
		aviso = null;
		editando = usuario;
	}

	async function guardarEdicion() {
		if (!tarjeta || !(await tarjeta.guardar())) return;
		// Antes de recargar: el cambio YA está guardado, y si recargar fallara el aviso sigue siendo verdad.
		aviso = 'guardado';
		editando = null;
		seleccionado = null;
		await invalidateAll();
	}

	function pedirMotivo(usuario: UsuarioDeOrganizacion, accion: 'desactivar' | 'cerrar-sesion') {
		objetivo = usuario;
		accionMotivo = accion;
		errorAccion = '';
		motivoAbierto = true;
	}

	function pedirReenvio(usuario: UsuarioDeOrganizacion) {
		objetivo = usuario;
		errorAccion = '';
		aviso = null;
		reenvioAbierto = true;
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

<!-- El contenedor con `aria-live` va SIEMPRE montado y la bandera controla el aviso de adentro: una región que se
     monta junto con su texto no se anuncia. Vacío no mide nada. El margen va dentro del `if` por lo mismo. -->
<div role="status" aria-live="polite">
	{#if aviso === 'creado'}
		<!-- El texto es el literal del «Alert Success» del Figma (HU006). Hasta el 2026-10-19 decía «Enviamos sus accesos
		     por correo / Los mandamos a <correo>…»: se cambió a pedido de QA, que echaba de menos el aviso de que el
		     usuario SE CREÓ. A cambio ya no sale la dirección a la que se mandó; si se quiere, se agrega. -->
		<div class="mt-6">
			<AvisoVerde
				testid="usuario-creado-aviso"
				titulo="Usuario creado correctamente"
				cuerpo="La cuenta fue creada exitosamente y las credenciales de acceso han sido enviadas al correo electrónico registrado."
			/>
		</div>
	{:else if aviso === 'guardado'}
		<!-- Literal del «Alert Success» del Figma (Gestionar rol de usuario). Sale al guardar la edición de un usuario. -->
		<div class="mt-6">
			<AvisoVerde
				testid="cambios-guardados-aviso"
				titulo="Cambios guardados correctamente."
				cuerpo="La configuración fue actualizada exitosamente."
			/>
		</div>
	{:else if aviso === 'reenviado'}
		<!-- Literal del «Alert Success» del Figma. Sale cuando el reenvío se hizo Y el correo salió: el panel se cerró solo. -->
		<div class="mt-6">
			<AvisoVerde
				testid="invitacion-reenviada-aviso"
				titulo="Nuevo enlace enviado"
				cuerpo="La invitación fue reenviada exitosamente. El usuario recibirá un correo con un nuevo enlace de activación válido para completar su registro."
			/>
		</div>
	{/if}
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
						{@const estatus = estatusDe(usuario)}
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
									class="rounded-md px-2 py-0.5 text-xs font-medium {estatus.clases}"
									data-testid="estatus-usuario"
								>
									{estatus.texto}
								</span>
								<IndicadorSesion activo={usuario.activo} sesionActiva={usuario.sesionActiva} testid="sesion-usuario" />
							</td>
						</tr>
						{#if editando?.guid === usuario.guid}
							<tr class="border-b border-border bg-muted/50"><td colspan="6">
								<EdicionUsuarioFila bind:this={tarjeta} {usuario} roles={data.roles} bind:estado={estadoEdicion} />
							</td></tr>
						{/if}
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

{#if editando}
	<!-- La barra del diseño mientras se edita una fila. -->
	<div class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
		<div class="pointer-events-auto flex items-center gap-3 rounded-xl bg-[#111827] px-3 py-2 shadow-lg" data-testid="barra-edicion-usuario">
			<button
				type="button"
				class="rounded-lg px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-card/10"
				data-testid="cancelar-edicion-usuario"
				onclick={() => (editando = null)}
			>
				Cancelar edición
			</button>
			<Button
				size="sm"
				data-testid="guardar-edicion-usuario"
				disabled={!estadoEdicion.completo || estadoEdicion.enviando}
				onclick={guardarEdicion}
			>
				{estadoEdicion.enviando ? 'Guardando…' : 'Guardar cambios'}
			</Button>
		</div>
	</div>
{:else if elegido}
	<!-- La píldora del diseño. -->
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
				<!-- Sin sesión abierta no hay nada que cerrar: el botón se apaga, en gris y no en un rojo opaco, que se
				     leería como "peligroso pero atenuado". Es el mismo dato que pinta «Sin sesión» en la lista. Se
				     enciende solo cuando la lista se refresca y la persona ya tiene una. -->
				<button
					type="button"
					class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-card/10 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent"
					data-testid="cerrar-sesion-usuario"
					disabled={!elegido.sesionActiva}
					title={elegido.sesionActiva ? undefined : 'Esta persona no tiene una sesión abierta.'}
					onclick={() => pedirMotivo(elegido, 'cerrar-sesion')}
				>
					<LogOut class="size-3.5" />
					Cerrar sesión
				</button>
				{#if puedeReenviarInvitacion(elegido)}
					<button
						type="button"
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-card/10"
						data-testid="reenviar-invitacion-usuario"
						onclick={() => pedirReenvio(elegido)}
					>
						<MailPlus class="size-3.5" />
						Reenviar invitación
					</button>
				{/if}
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

<MotivoModal
	bind:open={motivoAbierto}
	accion={accionMotivo}
	usuario={objetivo}
	alTerminar={async () => {
		seleccionado = null;
		await invalidateAll();
	}}
/>

<ReenviarInvitacionSheet
	bind:open={reenvioAbierto}
	usuario={objetivo}
	alTerminar={async () => {
		seleccionado = null;
		await invalidateAll();
	}}
	alReenviar={() => (aviso = 'reenviado')}
/>

<UsuarioSheet
	bind:open={abierto}
	roles={data.roles}
	alGuardar={async () => {
		seleccionado = null;
		await invalidateAll();
	}}
	alEnviarAccesos={() => (aviso = 'creado')}
/>
