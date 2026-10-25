<script lang="ts">
	/**
	 * Configuración · Tipos de expediente (2026-10-24). Ver los tipos de expediente de la organización, DAR DE ALTA uno nuevo,
	 * EDITARLO (su nombre y su esquema) y BORRARLO.
	 *
	 * Vivía en `/expediente/tipos`, como pestaña junto al listado de expedientes; el 2026-10-25 se mudó aquí, a una de las secciones
	 * del módulo de configuración, porque un tipo es algo que se CONFIGURA una vez y no algo que se trabaja a diario. En
	 * `/expediente` quedaron los expedientes, sin pestañas. Como ya no hay cáscara que ponga el encabezado, la migaja y el título
	 * los pone esta pantalla.
	 *
	 * Un tipo de expediente es la clase de la que salen los expedientes («Expediente médico», «Expediente de un choque»); cada
	 * expediente es una instancia de un tipo, con los documentos de UN caso (un paciente, un choque). Un tipo tiene VARIOS tipos
	 * documentales y ese conjunto es su esquema: se define AL CREARLO (el modal exige al menos uno), la tabla lo muestra y se puede
	 * cambiar después (un esquema nunca se deja vacío).
	 *
	 * **Editar** abre el mismo modal del alta con el nombre y el esquema actuales. Los expedientes del tipo ven el nombre nuevo sin
	 * tocarlos, y cambiar el esquema no toca sus documentos. El aviso verde dice lo que de verdad cambió.
	 * **Borrar** pide confirmación con el diálogo de la casa (`ConfirmarAccion`, nunca el `confirm()` del navegador). Un tipo CON expedientes
	 * no se puede borrar —todo expediente es instancia de un tipo—: el botón no se apaga (apagado no explicaría nada), abre un aviso que lo
	 * dice con cuántos tiene. Nexus_back lo vuelve a comprobar al borrar y, si en el ínterin alguien creó un expediente de ese tipo, el
	 * aviso sale igual con lo que diga el servidor.
	 *
	 * Tres estados, como la pantalla de Usuarios, de la que se tomó el lenguaje (tarjeta con tabla, estado vacío y aviso verde): sin
	 * tipos —con el botón para crear el primero, solo para quien administra—, y con tipos. El «tipo de expediente» NO existe en el
	 * Figma (se buscó en todo el Sprint 5 el 2026-10-24): es una adición del producto, así que esta pantalla no tiene un diseño propio.
	 *
	 * Quién puede crear, editar y borrar lo decide nexus_back (Administrador y Supervisor); aquí `puedeAdministrar` solo decide si se
	 * OFRECEN los botones. Todos los roles ven la lista.
	 */
	import { invalidateAll } from '$app/navigation';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import TipoExpedienteModal from '$lib/components/expedientes/TipoExpedienteModal.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { fechaCorta } from '$lib/expedientes/expedientes';
	import { avisoDeEdicionDeTipo, type TipoDeExpediente } from '$lib/expedientes/tipos';

	let { data } = $props();

	const tipos = $derived(data.tipos);

	/** Cuántos tipos documentales del esquema se nombran en la fila; el resto se cuenta («+2») y se lee completo al pasar el cursor. */
	const MAX_VISIBLES = 3;
	/** Un tipo documental que ya se borró de la biblioteca sigue en el esquema como un id sin nombre. */
	const SIN_NOMBRE = 'Tipo documental eliminado';

	let altaAbierta = $state(false);
	let edicionAbierta = $state(false);
	/** El tipo que se edita: el modal de edición lo recibe (con su nombre y su esquema), y el aviso verde lo usa para decir cómo se llamaba. */
	let aEditar = $state<TipoDeExpediente | null>(null);
	/** El tipo que se está por borrar (la confirmación abierta). */
	let aBorrar = $state<TipoDeExpediente | null>(null);
	/** Por qué no se pudo borrar un tipo (o qué falló): un aviso con un solo botón. */
	let sinBorrar = $state<{ titulo: string; mensaje: string } | null>(null);
	/** Lo último que salió bien (alta, cambio de nombre, borrado), para el aviso verde. Se apaga al empezar otra cosa: hablaría de la anterior. */
	let aviso = $state<{ testid: string; titulo: string; cuerpo: string } | null>(null);

	function abrirAlta() {
		aviso = null;
		altaAbierta = true;
	}

	function abrirEdicion(tipo: TipoDeExpediente) {
		aviso = null;
		aEditar = tipo;
		edicionAbierta = true;
	}

	const conExpedientes = (nombre: string, total: number) =>
		`«${nombre}» tiene ${total} ${total === 1 ? 'expediente' : 'expedientes'}: un tipo con expedientes no se puede borrar.`;

	function pedirBorrado(tipo: TipoDeExpediente) {
		aviso = null;
		if (tipo.totalExpedientes > 0) {
			sinBorrar = { titulo: 'No se puede borrar el tipo', mensaje: conExpedientes(tipo.nombre, tipo.totalExpedientes) };
			return;
		}
		aBorrar = tipo;
	}

	async function borrar(tipo: TipoDeExpediente) {
		let r: Response;
		try {
			r = await fetch(`/api/tipos-expediente/${encodeURIComponent(tipo.id)}`, { method: 'DELETE' });
		} catch {
			sinBorrar = { titulo: 'No se pudo borrar el tipo', mensaje: 'No se pudo contactar al servidor. Intenta de nuevo.' };
			return;
		}
		const datos = await r.json().catch(() => null);
		if (!r.ok) {
			const ocupado = datos?.codigo === 'con_expedientes';
			sinBorrar = {
				titulo: ocupado ? 'No se puede borrar el tipo' : 'No se pudo borrar el tipo',
				mensaje: datos?.mensaje ?? 'Intenta de nuevo.'
			};
			// Si el conteo de la pantalla estaba viejo (alguien creó un expediente de ese tipo), se pone al día.
			if (ocupado) await invalidateAll();
			return;
		}
		// El tipo YA está borrado: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		aviso = { testid: 'tipo-expediente-borrado-aviso', titulo: 'Tipo de expediente borrado', cuerpo: `«${tipo.nombre}» se borró de tu organización.` };
		await invalidateAll();
	}
</script>

<svelte:head><title>NexusDoc AI — Tipos de expediente</title></svelte:head>

<p class="text-xs text-muted-foreground">
	<a href="/configuracion" class="transition-colors hover:text-foreground" data-testid="volver-a-configuracion">Configuración</a> / Tipos de
	expediente
</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Tipos de expediente</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Un tipo de expediente es la plantilla de la que salen tus expedientes, por ejemplo «Expediente médico» o «Expediente de un
		choque». Cada expediente es una instancia de un tipo y guarda los documentos de un caso: de un paciente, de un choque.
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

{#if tipos.length === 0}
	<div class="mt-6 flex flex-col items-center gap-6 rounded-2xl border-2 border-border bg-card py-24 text-center" data-testid="tipos-expediente-vacio">
		<Sparkles class="size-10 text-primary" />
		{#if data.puedeAdministrar}
			<div>
				<p class="text-lg font-medium text-foreground">Crea tu primer tipo de expediente</p>
				<p class="mt-1 max-w-lg text-sm text-muted-foreground">
					Define la clase de expediente con la que trabaja tu organización. Después, cada caso —un paciente, un choque— será un
					expediente de ese tipo, con sus propios documentos.
				</p>
			</div>
			<button
				type="button"
				class="flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted"
				data-testid="crear-primer-tipo-expediente"
				onclick={abrirAlta}
			>
				<span class="mt-0.5 shrink-0 text-primary"><FolderPlus class="size-5" /></span>
				<span class="min-w-0 flex-1">
					<span class="block text-sm font-medium text-foreground">Nuevo tipo de expediente</span>
					<span class="block text-xs text-muted-foreground">Ponle un nombre, por ejemplo «Expediente médico», y elige sus tipos documentales.</span>
				</span>
			</button>
		{:else}
			<div>
				<p class="text-lg font-medium text-foreground">Todavía no hay tipos de expediente</p>
				<p class="mt-1 max-w-lg text-sm text-muted-foreground">Quien administra tu organización puede crear el primero.</p>
			</div>
		{/if}
	</div>
{:else}
	<div class="mt-6 rounded-2xl border-2 border-border bg-card p-5">
		<div class="flex flex-wrap items-center gap-3">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-foreground">Listado de tipos de expediente</p>
				<p class="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="total-tipos-expediente">
					<FolderOpen class="size-3.5" />
					{tipos.length}
					{tipos.length === 1 ? 'tipo de expediente en total' : 'tipos de expediente en total'}
				</p>
			</div>
			{#if data.puedeAdministrar}
				<Button data-testid="nuevo-tipo-expediente" onclick={abrirAlta}>
					<Plus class="size-4" />
					Nuevo tipo de expediente
				</Button>
			{/if}
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-y border-border text-xs text-muted-foreground">
						<th class="py-2.5 pr-4 pl-2 font-normal">Tipo de expediente</th>
						<th class="py-2.5 pr-4 font-normal">Tipos documentales</th>
						<th class="py-2.5 pr-4 font-normal">Expedientes</th>
						<th class="py-2.5 pr-2 font-normal">Fecha de creación</th>
						{#if data.puedeAdministrar}
							<th class="w-20 py-2.5 pr-2"><span class="sr-only">Acciones</span></th>
						{/if}
					</tr>
				</thead>
				<tbody data-testid="tabla-tipos-expediente">
					{#each tipos as tipo (tipo.id)}
						<tr class="border-b border-border last:border-0" data-tipo-id={tipo.id}>
							<td class="min-w-0 py-3 pr-4 pl-2">
								<p class="truncate font-medium text-foreground" data-testid="tipo-expediente-nombre">{tipo.nombre}</p>
							</td>
							<td class="py-3 pr-4" data-testid="tipo-expediente-esquema">
								{#if tipo.tiposDocumentales.length === 0}
									<span class="text-xs text-muted-foreground">Sin esquema</span>
								{:else}
									<div class="flex flex-wrap items-center gap-1" title={tipo.tiposDocumentales.map((t) => t.nombre ?? SIN_NOMBRE).join(', ')}>
										{#each tipo.tiposDocumentales.slice(0, MAX_VISIBLES) as td (td.id)}
											<span
												class="max-w-40 truncate rounded-sm border border-border bg-secondary px-2 py-0.5 text-xs text-foreground"
												data-testid="tipo-expediente-esquema-item"
											>
												{td.nombre ?? SIN_NOMBRE}
											</span>
										{/each}
										{#if tipo.tiposDocumentales.length > MAX_VISIBLES}
											<span class="text-xs text-muted-foreground" data-testid="tipo-expediente-esquema-mas">
												+{tipo.tiposDocumentales.length - MAX_VISIBLES}
											</span>
										{/if}
									</div>
								{/if}
							</td>
							<td class="py-3 pr-4 text-foreground" data-testid="tipo-expediente-total">{tipo.totalExpedientes}</td>
							<td class="py-3 pr-2 text-xs text-muted-foreground">{fechaCorta(tipo.creadoEn)}</td>
							{#if data.puedeAdministrar}
								<td class="py-2 pr-2">
									<div class="flex items-center justify-end gap-1">
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Editar «${tipo.nombre}»`}
											title="Editar"
											data-testid="editar-tipo-expediente"
											onclick={() => abrirEdicion(tipo)}
										>
											<Pencil />
										</Button>
										<Button
											variant="ghost"
											size="icon-sm"
											class="text-destructive hover:bg-destructive/10 hover:text-destructive"
											aria-label={`Borrar «${tipo.nombre}»`}
											title="Borrar"
											data-testid="borrar-tipo-expediente"
											onclick={() => pedirBorrado(tipo)}
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

<TipoExpedienteModal
	bind:open={altaAbierta}
	tiposDocumentales={data.tiposDocumentales}
	tiposDocumentalesFallo={data.tiposDocumentalesFallo}
	alCrear={async (nombre, total) => {
		// El tipo YA está guardado: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		aviso = {
			testid: 'tipo-expediente-creado-aviso',
			titulo: 'Tipo de expediente creado',
			cuerpo: `«${nombre}» quedó registrado en tu organización, con ${total} ${total === 1 ? 'tipo documental' : 'tipos documentales'} en su esquema.`
		};
		await invalidateAll();
	}}
/>

<TipoExpedienteModal
	bind:open={edicionAbierta}
	tipo={aEditar}
	tiposDocumentales={data.tiposDocumentales}
	tiposDocumentalesFallo={data.tiposDocumentalesFallo}
	alEditar={async (resultado) => {
		// El tipo YA está guardado: el aviso se pone antes de recargar. Si nada cambió de verdad no hay de qué avisar (y `aviso` ya venía apagado).
		aviso = avisoDeEdicionDeTipo(aEditar?.nombre ?? '', resultado);
		await invalidateAll();
	}}
/>

<ConfirmarAccion
	abierto={aBorrar !== null}
	titulo="Borrar el tipo de expediente"
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
