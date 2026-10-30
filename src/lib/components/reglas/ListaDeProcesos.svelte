<script lang="ts">
	/**
	 * La lista de PROCESOS del motor de reglas (2026-10-29): por aquí se entra al motor, y de aquí se llega al lienzo de uno
	 * (`/motor-de-reglas/[id]`) o a uno nuevo (`/motor-de-reglas/nuevo`). Hasta ese día «Motor de reglas» abría directo el lienzo.
	 *
	 * Sale del Figma Sprint 5, HUN5 «Crear proceso» (frames `5480:105161` el estado vacío, `5503:107128` la lista, `5503:107474` el menú
	 * de una tarjeta y `5503:108095` el aviso de desactivar). Lo visual es el del diseño, y el esqueleto es el mismo de la biblioteca de
	 * tipos documentales (`ModuloConfiguracion.svelte`): una tarjeta grande con su encabezado y su X, una barra lateral con el árbol y,
	 * a la derecha, las tarjetas. Como allá, picar una rama del árbol deja visible solo su tarjeta y volver a picarla (o picar
	 * «Procesos configurados») las muestra todas.
	 *
	 * Lo que se aparta del diseño, porque el diseño es de antes del lienzo:
	 *   · Los textos hablan de «campos requeridos de cada documento»; un proceso de hoy es un conjunto de REGLAS sobre un expediente, y
	 *     los textos lo dicen así.
	 *   · El botón de abajo a la izquierda dice «Nueva plantilla documental» en el diseño (es el rótulo de la biblioteca, copiado): aquí
	 *     dice «Nuevo proceso».
	 *   · «Documentos configurados | N» cuenta los tipos documentales que el proceso trae como entradas.
	 *   · Activar y desactivar SOLO marca el proceso (se guarda en el servidor): todavía no hay un motor que corra procesos sobre
	 *     expedientes y lo respete. El aviso es el del diseño.
	 *
	 * La tarjeta no se abre picando en su espacio vacío (misma regla que la biblioteca: se pidió así porque un clic en el vacío abría
	 * cosas por accidente): se abre con su nombre, que es un enlace, o con «Editar» del menú ⋮.
	 *
	 * Solo lo ve quien administra: el candado está en `+layout.server.ts`.
	 */
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';

	import ArchiveIcon from '$lib/components/icons/ArchiveIcon.svelte';
	import ArrowRightIcon from '$lib/components/icons/ArrowRightIcon.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { avisarExito } from '$lib/state/avisos.svelte';
	import {
		cargarProcesos,
		estadoProcesos,
		guardarProceso,
		procesoActivo,
		reiniciarProcesos,
		tiposDelProceso,
		type ProcesoGuardado
	} from '$lib/state/procesos.svelte';

	/** En el orden en que el servidor los entrega (el de su creación): una tarjeta no debe brincar de lugar al activarla o desactivarla. */
	const procesos = $derived(estadoProcesos.lista);

	/** La rama del árbol que se está viendo; `null` = todas. */
	let seleccionadoId = $state<string | null>(null);
	const visibles = $derived(seleccionadoId ? procesos.filter((p) => p.id === seleccionadoId) : procesos);

	// Si el proceso seleccionado ya no está (lo borró otra persona), se vuelve a ver todo en vez de dejar la lista en blanco.
	$effect(() => {
		if (seleccionadoId && !procesos.some((p) => p.id === seleccionadoId)) seleccionadoId = null;
	});

	function seleccionarRama(id: string) {
		seleccionadoId = seleccionadoId === id ? null : id;
	}

	const rutaDe = (id: string) => `/motor-de-reglas/${encodeURIComponent(id)}`;
	const nuevo = () => void goto('/motor-de-reglas/nuevo');
	const salir = () => void goto('/');

	onMount(() => {
		reiniciarProcesos();
		void cargarProcesos();
		return () => reiniciarProcesos();
	});

	// ── Activar y desactivar ─────────────────────────────────────────────────

	/** El proceso que se está por desactivar (activar no pregunta: no deja de hacer nada). */
	let porDesactivar = $state<ProcesoGuardado | null>(null);
	let cambiandoId = $state<string | null>(null);
	let falla = $state<{ titulo: string; mensaje: string } | null>(null);

	async function cambiarActivo(p: ProcesoGuardado, activo: boolean) {
		cambiandoId = p.id;
		const nombre = p.datos.nombre;
		const r = await guardarProceso(p.id, p.revision, { ...p.datos, activo });
		cambiandoId = null;
		if (r.ok) {
			avisarExito(activo ? 'Proceso activado' : 'Proceso desactivado', `«${nombre}» quedó ${activo ? 'activo' : 'inactivo'}.`);
			return;
		}
		if (r.conflicto || r.status === 404) {
			// Otra persona lo tocó o lo borró mientras esta lista estaba abierta: se lee de nuevo y no se pisa nada.
			await cargarProcesos();
			falla = {
				titulo: r.status === 404 ? 'Este proceso ya no existe' : 'Otra persona modificó este proceso',
				mensaje: r.status === 404 ? 'Otra persona lo eliminó. La lista ya está al día.' : 'La lista ya está al día; revisa cómo quedó y vuelve a intentarlo.'
			};
			return;
		}
		falla = { titulo: activo ? 'No se pudo activar el proceso' : 'No se pudo desactivar el proceso', mensaje: r.mensaje };
	}
</script>

<!-- La misma tarjeta grande que la biblioteca de tipos documentales (ver `ModuloConfiguracion.svelte`): conserva la altura de la ventana
     para que sus dos columnas tengan scroll propio, y en una pantalla baja se queda en su alto mínimo y crece la página. -->
<div class="flex h-[calc(100vh-18rem)] min-h-150 flex-col overflow-hidden rounded-2xl border-2 border-border bg-card" data-testid="lista-procesos">
	<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
		<p class="flex-1 text-base font-medium text-foreground">Configuración de proceso</p>
		<button
			type="button"
			class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
			data-testid="salir-motor-de-reglas"
			onclick={salir}
		>
			<CancelSquareIcon />
			<span class="sr-only">Cerrar</span>
		</button>
	</div>

	<div class="flex items-center gap-3 px-6 py-4">
		<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
			<FolderPlus class="size-4" />
		</span>
		<div class="min-w-0 flex-1">
			<h2 class="text-lg font-medium text-foreground">Configura tus procesos documentales</h2>
			<p class="text-sm text-muted-foreground">
				Un proceso es un conjunto de reglas que corre sobre un expediente: elige los tipos documentales como entradas y combina operadores
				para validarlos.
			</p>
		</div>
	</div>

	<div class="flex min-h-0 flex-1">
		<aside class="flex w-82.5 shrink-0 flex-col overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6">
			<p class="text-xs text-foreground">Procesos</p>
			<button
				type="button"
				data-testid="raiz-procesos"
				class="mt-6 flex w-full items-center gap-3 text-left"
				onclick={() => (seleccionadoId = null)}
			>
				<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
					<ArchiveIcon />
				</span>
				<span class="min-w-0 flex-1">
					<span class="block text-sm font-medium text-foreground">Procesos configurados</span>
					<span class="mt-2 block text-xs text-muted-foreground">Localiza tu listado de procesos configurados.</span>
				</span>
				<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />
			</button>

			{#if procesos.length > 0}
				<!-- El árbol de la biblioteca: eje a x=44 (pl-11), un tramo vertical y un guion horizontal por renglón. -->
				<ul class="mt-4">
					{#each procesos as p (p.id)}
						<li class="relative flex h-9.5 items-center pl-11">
							<span class="absolute top-1/2 left-11 h-5.5 w-px -translate-y-1/2 bg-border"></span>
							<span class="absolute top-1/2 left-11 h-px w-[11.5px] bg-border"></span>
							<button
								type="button"
								data-testid="rama-proceso"
								aria-pressed={seleccionadoId === p.id}
								class="ml-[19.5px] min-w-0 truncate text-left text-sm font-medium transition-colors {seleccionadoId === p.id
									? 'text-primary'
									: 'text-foreground hover:text-primary'}"
								onclick={() => seleccionarRama(p.id)}
							>
								{p.datos.nombre}
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="mt-auto pt-6">
				<Button class="w-full" data-testid="nuevo-proceso" onclick={nuevo}>Nuevo proceso</Button>
			</div>
		</aside>

		<div class="flex-1 overflow-y-auto p-8">
			{#if !estadoProcesos.cargada}
				<!-- La lista vive en el servidor (por organización) y todavía no llega: un «Crea tu proceso» ahora se leería como «no tienes
				     ninguno». Con un error, la salida es reintentar. -->
				{#if estadoProcesos.error}
					<div class="flex flex-col items-start gap-3" data-testid="procesos-error" role="alert">
						<h3 class="text-xl font-semibold text-foreground">No se pudieron cargar tus procesos</h3>
						<p class="text-sm text-muted-foreground">{estadoProcesos.error}</p>
						<Button onclick={() => void cargarProcesos()}>Reintentar</Button>
					</div>
				{:else}
					<p class="text-sm text-muted-foreground" data-testid="procesos-cargando" role="status">Cargando los procesos de tu organización…</p>
				{/if}
			{:else if procesos.length === 0}
				<div class="flex h-full flex-col items-center justify-center gap-6 text-center" data-testid="procesos-vacio">
					<span class="flex size-12.5 items-center justify-center rounded-xl border-2 border-muted bg-card text-primary">
						<FolderPlus class="size-6" />
					</span>
					<div>
						<p class="text-sm font-medium text-foreground">Crea tu proceso</p>
						<p class="mt-1 max-w-md text-xs text-muted-foreground">
							Define los tipos documentales que forman parte del proceso y las reglas que deben cumplir los documentos de un expediente.
							Biblioratum probará cada regla con valores de ejemplo mientras la armas.
						</p>
					</div>
					<Button class="w-60" data-testid="crear-proceso" onclick={nuevo}>Crear proceso</Button>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each visibles as p (p.id)}
						{@const activo = procesoActivo(p)}
						{@const tipos = tiposDelProceso(p)}
						<div class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3" data-testid="tarjeta-proceso" data-proceso-id={p.id}>
							<div class="flex min-w-0 flex-1 items-center gap-4">
								<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
									<FolderPlus class="size-4" />
								</span>
								<span class="min-w-0 flex-1">
									<a
										href={rutaDe(p.id)}
										data-testid="proceso-nombre-enlace"
										class="block truncate text-base font-medium text-foreground transition-colors hover:text-primary hover:underline"
										title={p.datos.nombre}>{p.datos.nombre}</a
									>
									<span class="block truncate text-xs text-muted-foreground" data-testid="proceso-documentos">
										{#if tipos === 0}
											Sin documentos configurados
										{:else}
											Documentos configurados | {tipos}
										{/if}
									</span>
								</span>
							</div>

							{#if cambiandoId === p.id}
								<span class="flex h-5.5 shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground" data-testid="proceso-guardando">
									<LoaderCircle class="size-3.5 animate-spin" />
									Guardando…
								</span>
							{:else}
								<span
									data-testid="insignia-proceso"
									data-estado={activo ? 'activo' : 'inactivo'}
									class="flex h-5.5 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium {activo
										? 'bg-green-50 text-green-700'
										: 'bg-muted text-muted-foreground'}"
								>
									<span class="size-1.5 rounded-full {activo ? 'bg-green-500' : 'bg-muted-foreground/60'}" aria-hidden="true"></span>
									{activo ? 'Activo' : 'Inactivo'}
								</span>
							{/if}

							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											type="button"
											data-testid="menu-proceso"
											aria-label="Más opciones de {p.datos.nombre}"
											disabled={cambiandoId === p.id}
											class="flex size-6 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted data-[state=open]:bg-muted disabled:pointer-events-none disabled:opacity-50"
										>
											<MoreVerticalIcon />
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
								<!-- El menú del frame 5503:107474: «Editar», una raya punteada y «Desactivar» (o «Activar») en azul con su ícono de encendido. -->
								<DropdownMenu.Content align="end" class="w-44 p-3">
									<DropdownMenu.Item class="h-11.5 gap-3 px-2 whitespace-nowrap" data-testid="proceso-editar" onSelect={() => void goto(rutaDe(p.id))}>
										<Pencil class="size-4 text-muted-foreground" />
										<span>Editar</span>
									</DropdownMenu.Item>
									<div class="my-1 border-t border-dashed border-border" aria-hidden="true"></div>
									<DropdownMenu.Item
										class="h-11.5 gap-3 px-2 whitespace-nowrap text-primary"
										data-testid="proceso-alternar-activo"
										onSelect={() => (activo ? (porDesactivar = p) : void cambiarActivo(p, true))}
									>
										<Power class="size-4" />
										<span>{activo ? 'Desactivar' : 'Activar'}</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- El aviso del frame 5503:108095, con el dialogo de la casa (sin el ícono ni el formato centrado del diseño: es el mismo de las demás
     confirmaciones). Desactivar no destruye nada y se revierte con «Activar», por eso es el neutral. -->
<ConfirmarAccion
	abierto={porDesactivar !== null}
	titulo="¿Desactivar proceso documental?"
	mensaje="Al desactivar este proceso, dejará de recibir nuevas correlaciones de documentos. Los documentos y expedientes existentes no se verán afectados y permanecerán disponibles para su consulta. ¿Deseas continuar?"
	variante="neutral"
	etiquetaConfirmar="Continuar"
	onConfirmar={() => {
		const p = porDesactivar;
		porDesactivar = null;
		if (p) void cambiarActivo(p, false);
	}}
	onCerrar={() => (porDesactivar = null)}
/>

<ConfirmarAccion
	abierto={falla !== null}
	titulo={falla?.titulo ?? ''}
	mensaje={falla?.mensaje ?? ''}
	variante="neutral"
	soloAviso
	etiquetaConfirmar="Entendido"
	onConfirmar={() => (falla = null)}
	onCerrar={() => (falla = null)}
/>
