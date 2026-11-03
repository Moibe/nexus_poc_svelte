<script lang="ts">
	/**
	 * Expediente · Expedientes (2026-10-24, Figma Sprint 5 HUN2: estado vacío `5387:99538`, listado `5387:101094`). Ver los expedientes
	 * de la organización, buscarlos, filtrarlos, ordenarlos, CREAR uno y abrirlo. El encabezado lo pone `./+layout.svelte`.
	 *
	 * Un expediente es la carpeta de un cliente o de un caso: un RECEPTÁCULO de documentos. Desde el 2026-10-29 (decisión de Moibe) NO
	 * tiene tipo: lo que tiene tipo son sus expedientes virtuales, que se arman dentro de cada expediente (`/expediente/[id]`). Tres estados:
	 *   · Sin expedientes: el estado vacío del diseño, con su tarjeta «Crea un nuevo expediente» (solo para quien organiza).
	 *   · Con expedientes: el listado, que se ve como LISTA (una tabla con una fila por expediente) o como MOSAICO (una carpeta por
	 *     expediente, que es el del diseño). Es lo mismo en las dos: los mismos filtros, el mismo orden y los mismos expedientes.
	 *   · Con expedientes, pero ninguno cumple lo buscado o filtrado: se dice, para que no parezca un error.
	 *
	 * Desde 2026-10-25 (pedido de Moibe) el listado es una tabla con columnas. Cada columna ordena al picar su encabezado (en el mosaico,
	 * que no tiene encabezados, ordena el menú «Ordenar»: son los mismos órdenes). Los filtros son el buscador —el nombre, sin importar
	 * mayúsculas ni acentos—, con o sin documentos y la fecha de creación. Un expediente se abre con un clic en su fila o en su carpeta.
	 * (Hasta el 2026-10-29 la columna y el filtro que más importaban eran los del tipo; se fueron con él.)
	 *
	 * Lo que se aparta del diseño: la tarjeta lleva el NOMBRE y no un folio; el buscador dice «Buscar expediente» (el del diseño dice
	 * «Buscar tipo documental», heredado de otra pantalla).
	 *
	 * La vista se recuerda en una cookie que lee `+page.server.ts` (así no hay destello de la otra al cargar); el orden y los filtros
	 * se quedan en la pantalla, no se recuerdan.
	 *
	 * Quién puede crear lo decide nexus_back; aquí `puedeOrganizar` solo decide qué se OFRECE. Todos los roles ven la lista.
	 */
	import { invalidateAll } from '$app/navigation';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import List from '@lucide/svelte/icons/list';
	import Sparkles from '@lucide/svelte/icons/sparkles';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import AlternarVista from '$lib/components/expedientes/AlternarVista.svelte';
	import BarraFiltrosExpedientes from '$lib/components/expedientes/BarraFiltrosExpedientes.svelte';
	import ExpedienteModal from '$lib/components/expedientes/ExpedienteModal.svelte';
	import OrdenarMenu from '$lib/components/expedientes/OrdenarMenu.svelte';
	import TablaExpedientes from '$lib/components/expedientes/TablaExpedientes.svelte';
	import TarjetaExpediente from '$lib/components/expedientes/TarjetaExpediente.svelte';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		COOKIE_VISTA_EXPEDIENTES,
		filtrarExpedientes,
		hayFiltros,
		mensajeSinResultados,
		OPCIONES_ORDEN_EXPEDIENTES,
		ordenAlPicar,
		ordenarExpedientes,
		SIN_FILTROS,
		type ColumnaExpedientes,
		type FiltrosExpedientes,
		type OrdenExpedientes,
		type VistaExpedientes
	} from '$lib/expedientes/expedientes';

	let { data } = $props();

	const expedientes = $derived(data.expedientes);

	/** Siempre un objeto nuevo, con sus listas propias: `SIN_FILTROS` es la constante y no se debe tocar. */
	const sinFiltros = (): FiltrosExpedientes => ({ ...SIN_FILTROS, documentos: [] });

	let filtros = $state<FiltrosExpedientes>(sinFiltros());
	let orden = $state<OrdenExpedientes>('recientes');
	/** La vista que eligió quien mira en esta visita; mientras no elija, manda la cookie que leyó el servidor. */
	let vistaElegida = $state<VistaExpedientes | null>(null);
	const vista = $derived(vistaElegida ?? data.vista);

	const filtrando = $derived(hayFiltros(filtros));
	const visibles = $derived(ordenarExpedientes(filtrarExpedientes(expedientes, filtros), orden));

	function elegirVista(nueva: VistaExpedientes) {
		vistaElegida = nueva;
		// Un año, solo para `/expediente` (de ahí cuelga el detalle, y nada más la necesita). `Secure` solo si la página va por https:
		// en http el navegador descartaría la cookie entera.
		document.cookie = `${COOKIE_VISTA_EXPEDIENTES}=${nueva}; path=/expediente; max-age=31536000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
	}

	function picarColumna(columna: ColumnaExpedientes) {
		orden = ordenAlPicar(orden, columna);
	}

	let expedienteAbierto = $state(false);
	/** El último alta que salió bien, para el aviso verde. Se apaga al abrir otra: a partir de ahí hablaría de la anterior. */
	let aviso = $state<{ testid: string; titulo: string; cuerpo: string } | null>(null);

	function abrirAltaExpediente() {
		aviso = null;
		expedienteAbierto = true;
	}
</script>

<svelte:head><title>Biblioratum — Expedientes</title></svelte:head>

<!-- El contenedor con `aria-live` va SIEMPRE montado y la bandera controla el aviso de adentro: una región que se monta junto con
     su texto no se anuncia. Vacío no mide nada. -->
<div role="status" aria-live="polite">
	{#if aviso}
		<AvisoVerde testid={aviso.testid} titulo={aviso.titulo} cuerpo={aviso.cuerpo} />
	{/if}
</div>

{#if expedientes.length === 0}
	<div class="flex flex-col items-center gap-6 rounded-2xl border-2 border-border bg-card py-24 text-center" data-testid="expedientes-vacio">
		<Sparkles class="size-12.5 text-primary" />
		<div>
			<h2 class="text-2xl font-semibold text-foreground">Aún no tienes expedientes registrados</h2>
			<p class="mt-3 max-w-xl text-base text-muted-foreground">
				Aquí encontrarás los expedientes creados y los documentos asociados a cada uno.
				{#if data.puedeOrganizar}
					Crea tu primer expediente para comenzar a organizar y centralizar la información documental.
				{/if}
			</p>
		</div>
		{#if data.puedeOrganizar}
			<button
				type="button"
				class="flex w-full max-w-120 items-start gap-3 rounded-xl border border-slate-300 bg-card p-3 text-left transition-colors hover:bg-muted"
				data-testid="crear-primer-expediente"
				onclick={abrirAltaExpediente}
			>
				<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
					<FolderPlus class="size-4" />
				</span>
				<span class="min-w-0 flex-1">
					<span class="block text-lg font-medium text-secondary-foreground">Crea un nuevo expediente</span>
					<span class="mt-3 block text-sm text-muted-foreground">
						Crea un expediente para agrupar documentos relacionados, mantener su información organizada.
					</span>
				</span>
			</button>
		{:else}
			<p class="max-w-md text-sm text-muted-foreground">Quien organiza expedientes en tu organización puede crear el primero.</p>
		{/if}
	</div>
{:else}
	<div class="rounded-2xl border-2 border-border bg-card p-3">
		<div class="flex min-h-12.5 flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
					<List class="size-4" />
				</span>
				<div>
					<p class="text-sm font-medium text-foreground">Listado de expedientes</p>
					<p class="flex items-center gap-1 text-xs text-muted-foreground">
						<span
							class="flex size-4.25 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-medium text-primary"
							data-testid="total-expedientes">{expedientes.length}</span
						>
						Total de expedientes
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<div class="flex h-9 w-58.5 items-center gap-3 rounded-lg border border-border bg-background px-3">
					<SearchIcon />
					<input
						type="search"
						placeholder="Buscar expediente"
						aria-label="Buscar expediente"
						bind:value={filtros.texto}
						data-testid="buscar-expediente"
						class="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
					/>
				</div>
				<span class="h-9 w-px bg-border" aria-hidden="true"></span>
				<!-- En la lista se ordena picando el encabezado de cada columna; el mosaico no tiene encabezados, y para eso es este menú. -->
				{#if vista === 'mosaico'}
					<OrdenarMenu valor={orden} opciones={OPCIONES_ORDEN_EXPEDIENTES} alCambiar={(valor) => (orden = valor)} testid="ordenar-expedientes" />
				{/if}
				<AlternarVista valor={vista} alCambiar={elegirVista} />
				{#if data.puedeOrganizar}
					<span class="h-9.5 w-px bg-border" aria-hidden="true"></span>
					<Button size="icon" class="size-9.5" data-testid="nuevo-expediente" aria-label="Nuevo expediente" title="Nuevo expediente" onclick={abrirAltaExpediente}>
						<FolderPlus class="size-4" />
					</Button>
				{/if}
			</div>
		</div>

		<BarraFiltrosExpedientes
			bind:filtros
			{filtrando}
			mostrados={visibles.length}
			total={expedientes.length}
			alLimpiar={() => (filtros = sinFiltros())}
		/>

		{#if visibles.length === 0}
			<p class="py-16 text-center text-sm text-muted-foreground" data-testid="expedientes-sin-resultados">{mensajeSinResultados(filtros)}</p>
		{:else if vista === 'lista'}
			<TablaExpedientes expedientes={visibles} {orden} alPicar={picarColumna} />
		{:else}
			<ul class="mt-3 flex flex-wrap gap-3" data-testid="mosaico-expedientes">
				{#each visibles as expediente (expediente.id)}
					<li><TarjetaExpediente {expediente} /></li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<ExpedienteModal
	bind:open={expedienteAbierto}
	alCrear={async (nombre) => {
		// El expediente YA está guardado: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		aviso = { testid: 'expediente-creado-aviso', titulo: 'Expediente creado', cuerpo: `«${nombre}» quedó registrado en tu organización.` };
		await invalidateAll();
	}}
/>
