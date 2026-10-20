<script lang="ts">
	/**
	 * La barra de arriba del lienzo (motor de reglas, 2026-10-20): el nombre del proceso, si está guardado, y lo que se hace con él:
	 * abrir otro de la organización, empezar uno nuevo, borrarlo y guardarlo.
	 *
	 * Es solo presentación: quien decide qué pasa con cada botón (y qué se pregunta antes, si hay cambios sin guardar) es
	 * `LienzoDeProceso`, que es dueño del dibujo.
	 */
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Plus from '@lucide/svelte/icons/plus';
	import Save from '@lucide/svelte/icons/save';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { estadoProcesos, type EstadoDeProceso } from '$lib/state/procesos.svelte';

	let {
		nombre = $bindable(),
		estado,
		actualId,
		guardando,
		puedeGuardar,
		puedeBorrar,
		alGuardar,
		alNuevo,
		alAbrir,
		alBorrar
	}: {
		nombre: string;
		estado: EstadoDeProceso;
		/** El proceso que está en el lienzo, para marcarlo en la lista. */
		actualId: string;
		guardando: boolean;
		puedeGuardar: boolean;
		puedeBorrar: boolean;
		alGuardar: () => void;
		alNuevo: () => void;
		alAbrir: (id: string) => void;
		alBorrar: () => void;
	} = $props();

	const TEXTO_DE_ESTADO: Record<EstadoDeProceso, string> = {
		nuevo: 'Proceso nuevo',
		sin_guardar: 'Sin guardar',
		cambios: 'Cambios sin guardar',
		guardado: 'Todos los cambios guardados'
	};

	/** Los más recientes primero: lo que se acaba de tocar es lo que se quiere volver a abrir. */
	const recientes = $derived([...estadoProcesos.lista].sort((a, b) => (b.modificadoEn ?? '').localeCompare(a.modificadoEn ?? '')));

	function cuando(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="mt-6 flex flex-wrap items-center gap-3" data-testid="barra-proceso">
	<div class="w-full max-w-sm min-w-56 flex-1">
		<label class="sr-only" for="nombre-del-proceso">Nombre del proceso</label>
		<Input id="nombre-del-proceso" data-testid="proceso-nombre" bind:value={nombre} maxlength={200} placeholder="Nombre del proceso" autocomplete="off" />
	</div>
	<span
		data-testid="proceso-estado"
		data-estado={estado}
		role="status"
		class="text-xs {estado === 'cambios' || estado === 'sin_guardar' ? 'font-medium text-foreground' : 'text-muted-foreground'}"
	>
		{TEXTO_DE_ESTADO[estado]}
	</span>

	<div class="ml-auto flex flex-wrap items-center gap-2">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" data-testid="menu-procesos">
						<FolderOpen />
						Procesos
						<ChevronDown />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-80">
				{#if estadoProcesos.error}
					<p class="px-3 py-2 text-xs text-destructive" data-testid="procesos-error">{estadoProcesos.error}</p>
				{:else if !estadoProcesos.cargada}
					<p class="px-3 py-2 text-xs text-muted-foreground" data-testid="procesos-cargando">Cargando…</p>
				{:else if recientes.length === 0}
					<p class="px-3 py-2 text-xs text-muted-foreground" data-testid="procesos-vacio">Todavía no hay procesos guardados.</p>
				{:else}
					{#each recientes as proceso (proceso.id)}
						<DropdownMenu.Item
							class="flex-col items-start gap-0 py-2"
							data-testid="proceso-en-lista"
							data-proceso-id={proceso.id}
							onSelect={() => alAbrir(proceso.id)}
						>
							<span class="w-full truncate text-sm font-medium">
								{proceso.datos.nombre}{#if proceso.id === actualId}<span class="font-normal text-muted-foreground"> · abierto</span>{/if}
							</span>
							<span class="text-xs text-muted-foreground">Modificado {cuando(proceso.modificadoEn)}</span>
						</DropdownMenu.Item>
					{/each}
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<Button variant="outline" data-testid="nuevo-proceso" onclick={alNuevo}>
			<Plus />
			Nuevo
		</Button>
		{#if puedeBorrar}
			<Button variant="destructive" data-testid="eliminar-proceso" onclick={alBorrar}>
				<Trash2 />
				Eliminar
			</Button>
		{/if}
		<Button
			data-testid="guardar-proceso"
			disabled={!puedeGuardar || guardando}
			title={!nombre.trim() ? 'Ponle un nombre al proceso para guardarlo' : !puedeGuardar ? 'No hay cambios que guardar' : 'Guardar (Ctrl+S)'}
			onclick={alGuardar}
		>
			<Save />
			{guardando ? 'Guardando…' : 'Guardar'}
		</Button>
	</div>
</div>
