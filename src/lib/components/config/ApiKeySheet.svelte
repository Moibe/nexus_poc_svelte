<script lang="ts">
	/**
	 * Modal "Configuración de API Key" (captura compartida el 2026-09-23).
	 *
	 * Es el HERMANO de `ConfigSheet.svelte`: misma cáscara —encabezado con el
	 * nombre del módulo y su X, banda de título con ícono redondo, y abajo dos
	 * columnas (sidebar de 330px + panel de contenido)—, así que aquí se copia
	 * esa estructura al pie de la letra en vez de inventar una propia. Si esa
	 * cáscara cambia allá, este archivo tiene que seguirla.
	 *
	 * LO QUE TODAVÍA NO EXISTE (a propósito, no es olvido):
	 *
	 *  1. "Nueva API Key" no hace nada. La captura solo trae el estado vacío;
	 *     no hay diseño de la pantalla de alta ni forma de guardarla —
	 *     `nexus_back` no tiene concepto de API keys todavía, ni la app tiene
	 *     autenticación. Inventar aquí un generador de llaves sería fabricar
	 *     credenciales que no autentican nada.
	 *  2. El renglón "API Keys" del sidebar no navega: es la única sección que
	 *     hay, así que no tiene a dónde llevar. La flecha va de adorno, como en
	 *     el diseño. Cuando haya una segunda sección, esto se vuelve botón y el
	 *     panel derecho se parte por `vista`, igual que en ConfigSheet.
	 *  3. No hay listado. El día que existan llaves guardadas, el panel derecho
	 *     alterna entre la tabla y este estado vacío.
	 */
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ArchiveIcon from '$lib/components/icons/ArchiveIcon.svelte';
	import ArrowRightIcon from '$lib/components/icons/ArrowRightIcon.svelte';
	import EmptyState from '$lib/components/home/EmptyState.svelte';
	import Puzzle from '@lucide/svelte/icons/puzzle';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Sheet.Root bind:open>
	<!-- Mismo ancho que el Modulo de configuración: la cáscara es la misma y dos
	     módulos hermanos que abren a distinto tamaño se sienten como dos apps. -->
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-api-key"
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<!-- header . navigation -->
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Configuración de API Key
			</Sheet.Title>
			<!-- Aquí la X sí cierra y ya: a diferencia de ConfigSheet, este módulo no
			     tiene niveles adentro de los que haya que subir. -->
			<Sheet.Close
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</Sheet.Close>
		</div>

		<!-- header.modal -->
		<div class="flex items-center gap-3 px-6 py-4">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
			>
				<Puzzle class="size-4" />
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="text-lg font-medium text-foreground">Claves de acceso API Keys</h2>
				<Sheet.Description class="text-sm">
					Configura y administra las credenciales que permiten autenticar integraciones y
					solicitudes a los servicios de NexusDoc.
				</Sheet.Description>
			</div>
		</div>

		<div class="flex min-h-0 flex-1">
			<!-- statusbar: 330px, fondo y bordes de 2px, igual que el del módulo de
			     configuración. -->
			<aside
				class="w-82.5 shrink-0 overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
			>
				<p class="text-xs text-foreground">Configuración</p>
				<!-- La tarjeta de la sección, con la misma forma que "Biblioteca" allá
				     (ícono en cuadro redondeado + título + descripción + flecha). Va
				     como <div> y no como <button> porque hoy no navega a ningún lado:
				     un botón que no hace nada promete algo que no cumple. -->
				<div class="mt-6 flex w-full items-center gap-3" data-testid="seccion-api-keys">
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
					>
						<ArchiveIcon />
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-foreground">API Keys</p>
						<p class="mt-2 text-xs text-muted-foreground">
							Localiza tu listado de API Keys configuradas
						</p>
					</div>
					<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />
				</div>
			</aside>

			<div class="flex-1 overflow-y-auto p-8">
				<!-- Estado vacío. `EmptyState` es el mismo componente de los paneles del
				     Home —ícono en cuadro de 50px, título y descripción—, que es justo
				     la forma que dibuja la captura; lo único que no trae es el botón,
				     así que ese va aquí abajo. -->
				<div class="flex h-full flex-col items-center justify-center gap-6">
					<EmptyState
						icon={Puzzle}
						title="Configura tu primera API Key"
						description="Genera una clave de acceso para autenticar de forma segura las solicitudes e integraciones disponibles."
					/>
					<!-- Sin `onclick`: ver la nota 1 del encabezado del archivo. -->
					<Button class="w-60" data-testid="nueva-api-key">Nueva API Key</Button>
				</div>
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>
