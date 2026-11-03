<script lang="ts">
	/**
	 * La lista de PROCESOS del motor de reglas (2026-10-29): por aquí se entra al motor, y de aquí se llega al lienzo de uno
	 * (`/motor-de-reglas/[id]`) o a uno nuevo (`/motor-de-reglas/nuevo`). Hasta ese día «Motor de reglas» abría directo el lienzo.
	 *
	 * Sale del Figma Sprint 5, HUN5 «Crear proceso» (frames `5480:105161` el estado vacío, `5503:107128` la lista, `5503:107474` el menú
	 * de una tarjeta y `5503:108095` el aviso de desactivar). Lo visual es el del diseño, y el esqueleto es el mismo de la biblioteca de
	 * tipos documentales (`ModuloConfiguracion.svelte`): una tarjeta grande con su encabezado y su X, y las tarjetas (en el diseño, con una barra lateral
	 * a la izquierda, que aquí ya no existe: ver abajo).
	 *
	 * SIN ramas en la barra lateral (2026-11-03, Moibe: «ver el proceso en el árbol de la izquierda y en el panel de la derecha no me hace
	 * mucho sentido»). El Figma dibuja cada proceso como una rama del árbol, y aquí se copió junto con el gesto de la biblioteca (picar una
	 * rama dejaba solo su tarjeta), pero en la biblioteca el árbol además reordena y navega la calibración; aquí solo repetía las tarjetas.
	 * Tampoco queda la tarjeta de la sección «Procesos configurados» (con su flecha), que seguía leyéndose como una entrada de menú cuyo
	 * contenido era el panel de la derecha (Moibe, mismo día: «también quítala»), y con eso la barra quedó con un rótulo y un botón: se quitó
	 * ENTERA («ya no tiene propósito»). «Nuevo proceso» pasó a la banda del título, a la derecha; las tarjetas ocupan todo el ancho y SON la lista.
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
	 * cosas por accidente): se abre con su nombre, que es un enlace, o con el lápiz de su tarjeta (ya no hay menú ⋮, 2026-11-03).
	 *
	 * Solo lo ve quien administra: el candado está en `+layout.server.ts`.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import Settings from '@lucide/svelte/icons/settings';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { avisarExito } from '$lib/state/avisos.svelte';
	import {
		cargarProcesos,
		estadoProcesos,
		guardarProceso,
		procesoActivo,
		reiniciarProcesos,
		tieneResultado,
		tiposDelProceso,
		type ProcesoGuardado
	} from '$lib/state/procesos.svelte';

	/** En el orden en que el servidor los entrega (el de su creación): una tarjeta no debe brincar de lugar al activarla o desactivarla. */
	const procesos = $derived(estadoProcesos.lista);

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
			<Settings class="size-4" />
		</span>
		<div class="min-w-0 flex-1">
			<h2 class="text-lg font-medium text-foreground">Configura tus procesos documentales</h2>
			<p class="text-sm text-muted-foreground">
				Un proceso es un conjunto de reglas que corre sobre un expediente: elige los tipos documentales como entradas y combina operadores
				para validarlos.
			</p>
		</div>
		<!-- Sin barra lateral (2026-11-03): sin ramas ni sección ya no tenía propósito, y «Nuevo proceso» pasó aquí, a la derecha del título (como «Agregar
		     nuevo tipo documental» en la Biblioteca). Sin procesos, el acceso es «Crear proceso» del centro. -->
		{#if estadoProcesos.cargada && procesos.length > 0}
			<Button class="shrink-0" data-testid="nuevo-proceso" onclick={nuevo}>Nuevo proceso</Button>
		{/if}
	</div>

	<div class="flex min-h-0 flex-1">
		<div class="flex-1 overflow-y-auto border-t-2 border-muted p-8">
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
						<Settings class="size-6" />
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
					{#each procesos as p (p.id)}
						{@const activo = procesoActivo(p)}
						{@const tipos = tiposDelProceso(p)}
						{@const tipoVirtual = p.datos.tipoExpedienteVirtualId}
						<div class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3" data-testid="tarjeta-proceso" data-proceso-id={p.id}>
							<div class="flex min-w-0 flex-1 items-center gap-4">
								<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
									<Settings class="size-4" />
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
									<!-- El tipo de expediente virtual sobre el que corre (2026-10-29). -->
									<span class="block truncate text-xs text-muted-foreground" data-testid="proceso-tipo-virtual-en-lista">
										{#if tipoVirtual}
											Corre sobre: {page.data.tiposVirtuales?.find((t: { id: string; nombre: string }) => t.id === tipoVirtual)?.nombre ?? 'un tipo de expediente virtual'}
										{:else}
											Sin tipo de expediente virtual
										{/if}
									</span>
									<!-- Desde el 2026-11-03 el Resultado es obligatorio: los procesos de antes que no lo traen se siguen abriendo, pero no se pueden ejecutar. -->
									{#if !tieneResultado(p)}
										<span class="block truncate text-xs text-amber-700 dark:text-amber-400" data-testid="proceso-sin-resultado" title="Ábrelo y agrega el nodo «Resultado» para poder ejecutarlo">
											Sin Resultado: ábrelo y agrégalo para poder ejecutarlo
										</span>
									{/if}
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

							<!-- Dos íconos directos en vez del menú ⋮ (2026-11-03, Moibe: «no usemos puntitos aquí»): el lápiz abre el proceso y el de encendido lo activa o desactiva.
							     Cada uno dice lo que hace en su `title` y en su `aria-label`; el de encendido no pide confirmación al activar, y al desactivar sí (abajo). -->
							<div class="flex shrink-0 items-center gap-1">
								<a
									href={rutaDe(p.id)}
									data-testid="proceso-editar"
									title="Editar"
									aria-label="Editar {p.datos.nombre}"
									class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
								>
									<Pencil class="size-4" />
								</a>
								<button
									type="button"
									data-testid="proceso-alternar-activo"
									title={activo ? 'Desactivar' : 'Activar'}
									aria-label="{activo ? 'Desactivar' : 'Activar'} {p.datos.nombre}"
									disabled={cambiandoId === p.id}
									onclick={() => (activo ? (porDesactivar = p) : void cambiarActivo(p, true))}
									class="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 {activo ? 'text-muted-foreground hover:text-foreground' : 'text-primary'}"
								>
									<Power class="size-4" />
								</button>
							</div>
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
