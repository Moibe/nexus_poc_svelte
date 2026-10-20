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
	 * El listado de usuarios es de solo lectura —crearlos y editarlos es del
	 * administrador de cada organización, en Usuarios— y trae dos acciones:
	 * "Cerrar sesión" (HU05 CA-4), que el criterio da también al administrador de
	 * plataforma, y "Reenviar invitación" (HU06 CA-6) para quien sigue sin hacer
	 * su primer acceso: la necesita sobre todo el administrador de una
	 * organización, que no tiene a nadie por encima en la suya. Esa tabla NO sale del diseño (el Figma de esta pantalla solo
	 * trae el estado vacío): se armó con el mismo lenguaje que la de Usuarios.
	 */
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Network from '@lucide/svelte/icons/network';
	import Clock from '@lucide/svelte/icons/clock';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';
	import Users from '@lucide/svelte/icons/users';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MailPlus from '@lucide/svelte/icons/mail-plus';

	import NuevaOrganizacionSheet from '$lib/components/organizaciones/NuevaOrganizacionSheet.svelte';
	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import IndicadorSesion from '$lib/components/usuarios/IndicadorSesion.svelte';
	import MotivoModal from '$lib/components/usuarios/MotivoModal.svelte';
	import ReenviarInvitacionSheet from '$lib/components/usuarios/ReenviarInvitacionSheet.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { estatusDe, puedeReenviarInvitacion } from '$lib/usuarios/estatus';
	import type { UsuarioDeOrganizacion } from '$lib/usuarios/tipos';

	let { data } = $props();

	let nuevaAbierta = $state(false);

	/** "Registro cancelado correctamente", tras confirmar la salida del alta.
	 *  Vive AQUÍ y no en el panel porque el panel es lo que se cierra. Se apaga
	 *  al abrir un registro nuevo: a partir de ahí el aviso habla del pasado. */
	let avisoCancelado = $state(false);
	/** «Nuevo enlace enviado», tras reenviar la invitación de alguien Y salir el correo (el panel se cerró solo). Se apaga
	 *  al empezar cualquier otra acción. */
	let invitacionReenviada = $state(false);

	function abrirNueva() {
		avisoCancelado = false;
		invitacionReenviada = false;
		nuevaAbierta = true;
	}
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

	function fechaHora(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return `${fecha(iso)} | ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	// ── Usuarios de la organización seleccionada ────────────────────────────

	/** Los de la organización que se está viendo; `null` mientras se piden. */
	let usuarios = $state<UsuarioDeOrganizacion[] | null>(null);
	let errorUsuarios = $state('');
	let motivoAbierto = $state(false);
	let objetivo = $state<UsuarioDeOrganizacion | null>(null);
	let reenvioAbierto = $state(false);
	let objetivoReenvio = $state<UsuarioDeOrganizacion | null>(null);

	/** Solo el guid, para que el efecto de abajo no se repita cuando
	 *  `invalidateAll()` trae objetos nuevos de la MISMA organización. */
	const verGuid = $derived(seleccionada?.guid ?? null);

	/** Número de la última petición: una respuesta que llega con otro número es de
	 *  una organización que ya no se está viendo, y se ignora. */
	let peticion = 0;

	/** `silencioso`: refrescar la lista que ya se ve (el estatus de quien acaba de
	 *  recibir otra invitación) sin volver al "Cargando usuarios…". */
	async function cargarUsuarios(guid: string, silencioso = false) {
		const mia = ++peticion;
		if (!silencioso) {
			usuarios = null;
			errorUsuarios = '';
		}
		try {
			const r = await fetch(`/api/organizaciones/${guid}/usuarios`);
			const cuerpo = await r.json().catch(() => null);
			if (mia !== peticion) return;
			if (r.status === 401 && cuerpo?.codigo === 'sesion_cerrada') {
				// Se cerró la sesión de quien mira (HU05): el `load` de esta página lo
				// manda al login.
				await invalidateAll();
				return;
			}
			if (!r.ok) {
				// Un refresco silencioso que falla no tumba la lista que ya se ve: el siguiente lo corrige.
				if (!silencioso) errorUsuarios = cuerpo?.mensaje ?? 'No se pudieron cargar los usuarios.';
				return;
			}
			usuarios = cuerpo?.usuarios ?? [];
			errorUsuarios = '';
		} catch {
			if (mia === peticion && !silencioso) errorUsuarios = 'No se pudo contactar al servidor. Intenta de nuevo.';
		}
	}

	$effect(() => {
		const guid = verGuid;
		if (guid) cargarUsuarios(guid);
	});

	/** "Con sesión / Sin sesión" cambia sin que nadie toque la pantalla: se refresca la lista que ya se ve al volver a
	 *  la pestaña y cada 10 s con la pestaña a la vista. */
	onMount(() => {
		const refrescar = () => {
			if (document.visibilityState === 'visible' && verGuid) cargarUsuarios(verGuid, true);
		};
		const temporizador = setInterval(refrescar, 10_000);
		document.addEventListener('visibilitychange', refrescar);
		return () => {
			clearInterval(temporizador);
			document.removeEventListener('visibilitychange', refrescar);
		};
	});

	function pedirCierre(usuario: UsuarioDeOrganizacion) {
		objetivo = usuario;
		motivoAbierto = true;
	}

	function pedirReenvio(usuario: UsuarioDeOrganizacion) {
		objetivoReenvio = usuario;
		avisoCancelado = false;
		invitacionReenviada = false;
		reenvioAbierto = true;
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

<!-- El contenedor con `aria-live` va SIEMPRE montado y la bandera controla el
     aviso de adentro: una región que se monta junto con su texto no se anuncia,
     el lector tiene que estar observándola de antes. Vacío no mide nada. -->
<div role="status" aria-live="polite">
	{#if avisoCancelado}
		<!-- El margen va ADENTRO del if: en el contenedor dejaba 24px de aire
		     arriba del listado aunque no hubiera aviso. -->
		<div class="mt-6">
			<AvisoVerde
				testid="organizacion-registro-cancelado"
				titulo="Registro cancelado correctamente"
				cuerpo="No se registró ninguna organización. Puedes volver a empezar el registro cuando quieras."
			/>
		</div>
	{:else if invitacionReenviada}
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
			onclick={abrirNueva}
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

			<Button class="mt-4 w-full" data-testid="nueva-organizacion" onclick={abrirNueva}>
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
					{#if usuarios}
						<span class="ml-auto text-xs text-muted-foreground" data-testid="total-usuarios-organizacion">
							{usuarios.length}
							{usuarios.length === 1 ? 'usuario total' : 'usuarios totales'}
						</span>
					{/if}
				</div>

				{#if errorUsuarios}
					<div
						class="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center"
						data-testid="usuarios-organizacion-error"
					>
						<p class="text-sm text-destructive">{errorUsuarios}</p>
						<Button variant="outline" size="sm" onclick={() => verGuid && cargarUsuarios(verGuid)}>
							Reintentar
						</Button>
					</div>
				{:else if usuarios === null}
					<p
						class="flex-1 py-16 text-center text-xs text-muted-foreground"
						data-testid="usuarios-organizacion-cargando"
					>
						Cargando usuarios…
					</p>
				{:else if usuarios.length === 0}
					<!-- Una organización nace con su administrador, así que este estado casi
					     no se ve; se deja el del diseño por si el administrador no está. -->
					<div class="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
						<span class="flex size-12 items-center justify-center rounded-xl border-2 border-border bg-background">
							<Users class="size-5 text-muted-foreground" />
						</span>
						<p class="text-sm font-medium text-foreground">Aquí aparecerán los usuarios registrados</p>
						<p class="max-w-sm text-xs text-muted-foreground">
							Aquí podrás visualizar y supervisar los usuarios creados por los administradores de cada
							organización dentro de NexusDoc.
						</p>
					</div>
				{:else}
					<div class="mt-4 overflow-x-auto">
						<table class="w-full text-left text-sm">
							<thead>
								<tr class="border-y border-border text-xs text-muted-foreground">
									<th class="py-2.5 pr-4 pl-2 font-normal">ID</th>
									<th class="py-2.5 pr-4 font-normal">Nombre del usuario</th>
									<th class="py-2.5 pr-4 font-normal">Rol asignado</th>
									<th class="py-2.5 pr-4 font-normal">Fecha de registro</th>
									<th class="py-2.5 pr-4 font-normal">Estatus</th>
									<th class="py-2.5 pr-2 text-right font-normal"><span class="sr-only">Acciones</span></th>
								</tr>
							</thead>
							<tbody data-testid="tabla-usuarios-organizacion">
								{#each usuarios as usuario (usuario.guid)}
									{@const estatus = estatusDe(usuario)}
									<tr class="border-b border-border last:border-0" data-testid="usuario-organizacion">
										<td class="py-3 pr-4 pl-2 text-xs text-muted-foreground">{usuario.numero}</td>
										<td class="min-w-0 py-3 pr-4">
											<p class="truncate font-medium text-foreground">{usuario.nombre}</p>
											<p class="truncate text-xs text-muted-foreground">{usuario.email}</p>
										</td>
										<td class="py-3 pr-4 text-foreground">{usuario.rolNombre}</td>
										<td class="py-3 pr-4 text-xs text-muted-foreground">{fechaHora(usuario.creadoEn)}</td>
										<td class="py-3 pr-4">
											<span
												class="rounded-md px-2 py-0.5 text-xs font-medium {estatus.clases}"
												data-testid="estatus-usuario-organizacion"
											>
												{estatus.texto}
											</span>
											<IndicadorSesion activo={usuario.activo} sesionActiva={usuario.sesionActiva} testid="sesion-usuario-organizacion" />
										</td>
										<td class="py-3 pr-2 text-right">
											{#if puedeReenviarInvitacion(usuario)}
												<button
													type="button"
													class="mr-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
													data-testid="reenviar-invitacion-organizacion"
													aria-label={`Reenviar la invitación de ${usuario.nombre}`}
													onclick={() => pedirReenvio(usuario)}
												>
													<MailPlus class="size-3.5" />
													Reenviar invitación
												</button>
											{/if}
											<!-- Sin sesión que cerrar a quien está desactivado (ya no tiene), ni a uno
											     mismo (para eso está el menú de la cuenta). -->
											{#if usuario.activo && usuario.guid !== data.usuario?.guid}
												<button
													type="button"
													class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-transparent"
													data-testid="cerrar-sesion-organizacion"
													aria-label={`Cerrar la sesión de ${usuario.nombre}`}
													disabled={!usuario.sesionActiva}
													title={usuario.sesionActiva ? undefined : 'Esta persona no tiene una sesión abierta.'}
													onclick={() => pedirCierre(usuario)}
												>
													<LogOut class="size-3.5" />
													Cerrar sesión
												</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}
		</section>
	</div>
{/if}

<!-- Cerrar una sesión cambia el "Con sesión / Sin sesión" de esa fila: al terminar se
     refresca la lista que ya se ve (sin volver a "Cargando usuarios…"). -->
<MotivoModal
	bind:open={motivoAbierto}
	accion="cerrar-sesion"
	usuario={objetivo}
	organizacion={verGuid}
	alTerminar={() => {
		if (verGuid) return cargarUsuarios(verGuid, true);
	}}
/>

<!-- Después de reenviar, el estatus puede pasar de "Caducada" a "Pendiente": se
     refresca la lista que ya se ve. -->
<ReenviarInvitacionSheet
	bind:open={reenvioAbierto}
	usuario={objetivoReenvio}
	organizacion={verGuid}
	alTerminar={() => {
		if (verGuid) return cargarUsuarios(verGuid, true);
	}}
	alReenviar={() => (invitacionReenviada = true)}
/>

<NuevaOrganizacionSheet
	bind:open={nuevaAbierta}
	recientes={organizaciones.map((o) => ({ nombre: o.nombre, slug: o.slug }))}
	alCrear={() => invalidateAll()}
	alCancelar={() => (avisoCancelado = true)}
/>
