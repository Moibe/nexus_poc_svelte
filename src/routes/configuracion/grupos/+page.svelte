<script lang="ts">
	/**
	 * Configuración · Grupos (2026-11-03, decisión de Moibe). Ver los grupos de la organización, DAR DE ALTA uno nuevo, RENOMBRARLO y BORRARLO.
	 *
	 * Un grupo es el nivel de arriba de los expedientes: varios expedientes viven juntos en un grupo, y cada organización lo llama como quiere
	 * (áreas, departamentos, trimestres del año…), así que el nombre genérico es «Grupo». Es UN SOLO nivel: un grupo tiene expedientes y nada
	 * más; los expedientes no se anidan ni los grupos tampoco. Se crean AQUÍ, antes que los expedientes, y al crear un expediente se elige a
	 * cuál pertenece (`ExpedienteModal`); los expedientes anteriores a los grupos se asignan después, desde su detalle.
	 *
	 * **Renombrar** abre el mismo modal del alta con el nombre actual; los expedientes del grupo ven el nombre nuevo sin tocarlos.
	 * **Borrar** pide confirmación con el diálogo de la casa (`ConfirmarAccion`, nunca el `confirm()` del navegador). Un grupo CON expedientes
	 * no se puede borrar —un expediente con grupo no puede quedarse sin él—: el botón no se apaga (apagado no explicaría nada), abre un aviso que
	 * lo dice con cuántos tiene. Nexus_back lo vuelve a comprobar al borrar y, si en el ínterin alguien creó un expediente en ese grupo, el aviso
	 * sale igual con lo que diga el servidor. La cuenta de expedientes es un enlace al listado ya filtrado por ese grupo.
	 *
	 * Tres estados, con el lenguaje de «Tipos de expediente virtual» (tarjeta con tabla, estado vacío y aviso verde): sin grupos —con el botón
	 * para crear el primero, solo para quien administra— y con grupos. El grupo NO existe en el Figma: es una adición del producto, así que esta
	 * pantalla no tiene un diseño propio.
	 *
	 * Quién puede crear, renombrar y borrar lo decide nexus_back (Administrador y Supervisor); aquí `puedeAdministrar` solo decide si se OFRECEN
	 * los botones. Todos los roles ven la lista.
	 */
	import { invalidateAll } from '$app/navigation';
	import Layers from '@lucide/svelte/icons/layers';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import GrupoModal from '$lib/components/expedientes/GrupoModal.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { fechaCorta } from '$lib/expedientes/expedientes';
	import { avisoDeRenombrarGrupo, motivoDeNoBorrarGrupo, type Grupo } from '$lib/expedientes/grupos';

	let { data } = $props();

	const grupos = $derived(data.grupos);

	let altaAbierta = $state(false);
	let edicionAbierta = $state(false);
	/** El grupo que se renombra: el modal lo recibe con su nombre actual. */
	let aEditar = $state<Grupo | null>(null);
	/** El grupo que se está por borrar (la confirmación abierta). */
	let aBorrar = $state<Grupo | null>(null);
	/** Por qué no se pudo borrar un grupo (o qué falló): un aviso con un solo botón. */
	let sinBorrar = $state<{ titulo: string; mensaje: string } | null>(null);
	/** Lo último que salió bien (alta, renombre, borrado), para el aviso verde. Se apaga al empezar otra cosa: hablaría de la anterior. */
	let aviso = $state<{ testid: string; titulo: string; cuerpo: string } | null>(null);

	function abrirAlta() {
		aviso = null;
		altaAbierta = true;
	}

	function abrirEdicion(grupo: Grupo) {
		aviso = null;
		aEditar = grupo;
		edicionAbierta = true;
	}

	function pedirBorrado(grupo: Grupo) {
		aviso = null;
		if (grupo.totalExpedientes > 0) {
			sinBorrar = { titulo: 'No se puede borrar el grupo', mensaje: motivoDeNoBorrarGrupo(grupo.nombre, grupo.totalExpedientes) };
			return;
		}
		aBorrar = grupo;
	}

	async function borrar(grupo: Grupo) {
		let r: Response;
		try {
			r = await fetch(`/api/grupos/${encodeURIComponent(grupo.id)}`, { method: 'DELETE' });
		} catch {
			sinBorrar = { titulo: 'No se pudo borrar el grupo', mensaje: 'No se pudo contactar al servidor. Intenta de nuevo.' };
			return;
		}
		const datos = await r.json().catch(() => null);
		if (!r.ok) {
			const ocupado = datos?.codigo === 'con_expedientes';
			sinBorrar = {
				titulo: ocupado ? 'No se puede borrar el grupo' : 'No se pudo borrar el grupo',
				mensaje: datos?.mensaje ?? 'Intenta de nuevo.'
			};
			// Si la cuenta de la pantalla estaba vieja (alguien creó un expediente en ese grupo), se pone al día.
			if (ocupado) await invalidateAll();
			return;
		}
		// El grupo YA está borrado: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		aviso = { testid: 'grupo-borrado-aviso', titulo: 'Grupo borrado', cuerpo: `«${grupo.nombre}» se borró de tu organización.` };
		await invalidateAll();
	}
</script>

<svelte:head><title>Biblioratum — Grupos</title></svelte:head>

<p class="text-xs text-muted-foreground">
	<a href="/configuracion" class="transition-colors hover:text-foreground" data-testid="volver-a-configuracion">Configuración</a> / Grupos
</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Grupos</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Un grupo reúne varios expedientes: tus áreas, departamentos, trimestres del año… como los llame tu organización. Se crean aquí, antes que
		los expedientes, y al crear un expediente eliges a cuál pertenece. Es un solo nivel: un grupo tiene expedientes y nada más.
	</p>
</div>

<!-- El contenedor con `aria-live` va SIEMPRE montado y la bandera controla el aviso de adentro: una región que se monta junto con
     su texto no se anuncia. Vacío no mide nada; el margen va dentro del `if` por lo mismo. -->
<div role="status" aria-live="polite">
	{#if aviso}
		<div class="mt-6">
			<AvisoVerde testid={aviso.testid} titulo={aviso.titulo} cuerpo={aviso.cuerpo} />
		</div>
	{/if}
</div>

{#if grupos.length === 0}
	<div class="mt-6 flex flex-col items-center gap-6 rounded-2xl border-2 border-border bg-card py-24 text-center" data-testid="grupos-vacio">
		<Sparkles class="size-10 text-primary" />
		{#if data.puedeAdministrar}
			<div>
				<p class="text-lg font-medium text-foreground">Crea tu primer grupo</p>
				<p class="mt-1 max-w-lg text-sm text-muted-foreground">
					Sin un grupo no se puede crear un expediente. Define cómo se ordenan los de tu organización, por ejemplo «Ventas» o «T1 2026».
				</p>
			</div>
			<button
				type="button"
				class="flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted"
				data-testid="crear-primer-grupo"
				onclick={abrirAlta}
			>
				<span class="mt-0.5 shrink-0 text-primary"><Layers class="size-5" /></span>
				<span class="min-w-0 flex-1">
					<span class="block text-sm font-medium text-foreground">Nuevo grupo</span>
					<span class="block text-xs text-muted-foreground">Ponle un nombre, por ejemplo «Recursos Humanos».</span>
				</span>
			</button>
		{:else}
			<div>
				<p class="text-lg font-medium text-foreground">Todavía no hay grupos</p>
				<p class="mt-1 max-w-lg text-sm text-muted-foreground">Quien administra tu organización puede crear el primero.</p>
			</div>
		{/if}
	</div>
{:else}
	<div class="mt-6 rounded-2xl border-2 border-border bg-card p-5">
		<div class="flex flex-wrap items-center gap-3">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-foreground">Listado de grupos</p>
				<p class="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="total-grupos">
					<Layers class="size-3.5" />
					{grupos.length}
					{grupos.length === 1 ? 'grupo en total' : 'grupos en total'}
				</p>
			</div>
			{#if data.puedeAdministrar}
				<Button data-testid="nuevo-grupo" onclick={abrirAlta}>
					<Plus class="size-4" />
					Nuevo grupo
				</Button>
			{/if}
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-y border-border text-xs text-muted-foreground">
						<th class="py-2.5 pr-4 pl-2 font-normal">Grupo</th>
						<th class="py-2.5 pr-4 font-normal">Expedientes</th>
						<th class="py-2.5 pr-2 font-normal">Fecha de creación</th>
						{#if data.puedeAdministrar}
							<th class="w-20 py-2.5 pr-2"><span class="sr-only">Acciones</span></th>
						{/if}
					</tr>
				</thead>
				<tbody data-testid="tabla-grupos">
					{#each grupos as grupo (grupo.id)}
						<tr class="border-b border-border last:border-0" data-grupo-id={grupo.id}>
							<td class="min-w-0 py-3 pr-4 pl-2">
								<p class="truncate font-medium text-foreground" data-testid="grupo-nombre">{grupo.nombre}</p>
							</td>
							<td class="py-3 pr-4 text-foreground" data-testid="grupo-total">
								<!-- La cuenta es la de los expedientes del grupo; picarla lleva al listado ya filtrado por él. Con cero no hay a dónde ir,
								     así que es solo el número. -->
								{#if grupo.totalExpedientes > 0}
									<a
										href={`/expediente?grupo=${encodeURIComponent(grupo.id)}`}
										class="-ml-1.5 inline-block rounded-md px-1.5 py-0.5 font-medium text-primary underline-offset-2 transition-colors outline-none hover:bg-primary/10 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
										data-testid="ver-expedientes-del-grupo"
										title="Ver los expedientes de «{grupo.nombre}»"
										aria-label="Ver {grupo.totalExpedientes === 1 ? 'el expediente' : `los ${grupo.totalExpedientes} expedientes`} de «{grupo.nombre}»"
										>{grupo.totalExpedientes}</a
									>
								{:else}
									{grupo.totalExpedientes}
								{/if}
							</td>
							<td class="py-3 pr-2 text-xs text-muted-foreground">{fechaCorta(grupo.creadoEn)}</td>
							{#if data.puedeAdministrar}
								<td class="py-2 pr-2">
									<div class="flex items-center justify-end gap-1">
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Renombrar «${grupo.nombre}»`}
											title="Renombrar"
											data-testid="renombrar-grupo"
											onclick={() => abrirEdicion(grupo)}
										>
											<Pencil />
										</Button>
										<Button
											variant="ghost"
											size="icon-sm"
											class="text-destructive hover:bg-destructive/10 hover:text-destructive"
											aria-label={`Borrar «${grupo.nombre}»`}
											title="Borrar"
											data-testid="borrar-grupo"
											onclick={() => pedirBorrado(grupo)}
										>
											<Trash2 />
										</Button>
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

<GrupoModal
	bind:open={altaAbierta}
	alCrear={async (nombre) => {
		// El grupo YA está guardado: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		aviso = { testid: 'grupo-creado-aviso', titulo: 'Grupo creado', cuerpo: `«${nombre}» quedó registrado en tu organización.` };
		await invalidateAll();
	}}
/>

<GrupoModal
	bind:open={edicionAbierta}
	grupo={aEditar}
	alRenombrar={async (antes, despues, cambiado) => {
		// El grupo YA está guardado: el aviso se pone antes de recargar. Si el nombre ya era ese no hay de qué avisar (y `aviso` ya venía apagado).
		aviso = avisoDeRenombrarGrupo(antes, despues, cambiado);
		await invalidateAll();
	}}
/>

<ConfirmarAccion
	abierto={aBorrar !== null}
	titulo="Borrar el grupo"
	mensaje={`«${aBorrar?.nombre ?? ''}» se borrará de tu organización y no se puede deshacer.`}
	etiquetaConfirmar="Borrar"
	onConfirmar={() => {
		if (aBorrar) void borrar(aBorrar);
	}}
	onCerrar={() => (aBorrar = null)}
/>

<ConfirmarAccion
	abierto={sinBorrar !== null}
	titulo={sinBorrar?.titulo ?? ''}
	mensaje={sinBorrar?.mensaje ?? ''}
	variante="neutral"
	soloAviso
	etiquetaConfirmar="Entendido"
	onConfirmar={() => {}}
	onCerrar={() => (sinBorrar = null)}
/>
