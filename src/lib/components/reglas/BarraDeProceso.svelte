<script lang="ts">
	/**
	 * La barra de arriba del lienzo (motor de reglas, 2026-10-20): el nombre del proceso, si está guardado, y lo que se hace con él:
	 * volver a la lista de procesos, borrarlo y guardarlo.
	 *
	 * Hasta el 2026-10-29 la barra traía un selector «Procesos ▾» para abrir otro y un «Nuevo»; desde que el motor arranca en la lista de
	 * procesos (`/motor-de-reglas`), abrir otro o empezar uno nuevo se hace allá, y aquí queda «Procesos» para regresar. Es un enlace
	 * normal: si hay cambios sin guardar, el lienzo pregunta antes de dejarlos (`beforeNavigate`).
	 *
	 * Desde el 2026-10-29 trae también el TIPO DE EXPEDIENTE VIRTUAL sobre el que corre el proceso («Corre sobre: Solicitud de crédito»):
	 * un selector con los tipos de la organización y «Sin tipo». Cambiarlo es un cambio del proceso, como el nombre: se guarda con «Guardar».
	 *
	 * Es solo presentación: quien decide qué pasa con cada botón es `LienzoDeProceso`, que es dueño del dibujo.
	 */
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Save from '@lucide/svelte/icons/save';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { EstadoDeProceso } from '$lib/state/procesos.svelte';

	/** El valor del selector cuando el proceso no tiene tipo (el selector no admite `null`). */
	const SIN_TIPO = '';

	let {
		nombre = $bindable(),
		tipoVirtual = $bindable(),
		tiposVirtuales,
		estado,
		guardando,
		puedeGuardar,
		puedeBorrar,
		alGuardar,
		alBorrar
	}: {
		nombre: string;
		/** El id del tipo de expediente virtual elegido, o `null`. */
		tipoVirtual: string | null;
		/** Los tipos de expediente virtual de la organización. */
		tiposVirtuales: { id: string; nombre: string }[];
		estado: EstadoDeProceso;
		guardando: boolean;
		puedeGuardar: boolean;
		puedeBorrar: boolean;
		alGuardar: () => void;
		alBorrar: () => void;
	} = $props();

	const TEXTO_DE_ESTADO: Record<EstadoDeProceso, string> = {
		nuevo: 'Proceso nuevo',
		sin_guardar: 'Sin guardar',
		cambios: 'Cambios sin guardar',
		guardado: 'Todos los cambios guardados'
	};

	const elegido = $derived(tiposVirtuales.find((t) => t.id === tipoVirtual) ?? null);
</script>

<div class="mt-6 flex flex-wrap items-center gap-3" data-testid="barra-proceso">
	<Button variant="outline" href="/motor-de-reglas" data-testid="volver-a-procesos">
		<ChevronLeft />
		Procesos
	</Button>
	<div class="w-full max-w-sm min-w-56 flex-1">
		<label class="sr-only" for="nombre-del-proceso">Nombre del proceso</label>
		<Input id="nombre-del-proceso" data-testid="proceso-nombre" bind:value={nombre} maxlength={200} placeholder="Nombre del proceso" autocomplete="off" />
	</div>
	<div class="flex items-center gap-2">
		<label class="shrink-0 text-xs text-muted-foreground" for="tipo-virtual-del-proceso">Corre sobre</label>
		<Select.Root type="single" value={tipoVirtual ?? SIN_TIPO} onValueChange={(v) => (tipoVirtual = v === SIN_TIPO ? null : v)}>
			<Select.Trigger
				id="tipo-virtual-del-proceso"
				class="h-9 w-56"
				data-testid="proceso-tipo-virtual"
				title="El tipo de expediente virtual sobre cuyas instancias corre este proceso"
			>
				<!-- Un id que no está en la lista (un tipo que se borró mientras el lienzo estaba abierto) se dice, en vez de esconderlo. -->
				{elegido?.nombre ?? (tipoVirtual ? 'Tipo que ya no existe' : 'Sin tipo de expediente virtual')}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value={SIN_TIPO} label="Sin tipo de expediente virtual" data-testid="opcion-sin-tipo-virtual" />
				{#each tiposVirtuales as t (t.id)}
					<Select.Item value={t.id} label={t.nombre} data-testid="opcion-tipo-virtual" />
				{/each}
			</Select.Content>
		</Select.Root>
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
