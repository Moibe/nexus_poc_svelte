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
	 * un selector con los tipos de la organización. Cambiarlo es un cambio del proceso, como el nombre: se guarda con «Guardar».
	 *
	 * Si la organización NO tiene ningún tipo de expediente virtual (2026-11-03, Moibe: «que aparezca ahí una instrucción de lo que son los
	 * expedientes virtuales, en un pequeño cuadrito modal, y un link para que te lleve a donde se crean»), el selector no tiene nada que
	 * ofrecer: se vuelve un botón con el mismo aspecto que abre un cuadrito que explica qué son y lleva a Configuración › Tipos de expediente
	 * virtual. Si los tipos no se pudieron LEER (`tiposVirtualesFallo`), el cuadrito lo dice en vez de afirmar que no hay.
	 *
	 * «Guardar» NO se apaga de verdad cuando falta algo (2026-11-03, Moibe: «si el botón está greyado y lo pican, que le avise que hay que ponerle
	 * nombre al proceso y focusee el cursor ahí»): un botón con `disabled` no recibe clics, así que se ve apagado (`aria-disabled`, mismo gris) y
	 * al pulsarlo dice qué falta, bajo el campo que corresponde: sin nombre, el cursor va al nombre; con nombre pero sin tipo, al selector del
	 * tipo. Sin cambios que guardar no dice nada (su título ya lo explica). Solo se apaga con `disabled` mientras guarda.
	 *
	 * Desde el 2026-11-03 el tipo es OBLIGATORIO para guardar (ya no hay «Sin tipo»; Moibe: «me gustan, haz todas tus recomendaciones»): de él
	 * salen los tipos documentales que el lienzo ofrece. Elegir uno NO lo asigna aquí: avisa a `alCambiarTipo`, porque cambiarlo con nodos
	 * puestos puede quitar algunos y el lienzo pregunta antes.
	 *
	 * Desde el 2026-11-03 el RESULTADO también es obligatorio (Moibe: «sí, que sea obligatorio el Resultado»): sin su nodo no se guarda, porque un
	 * proceso sin la palabra con la que termina no tiene con qué contestar cuando se ejecute. Con nombre y tipo pero sin Resultado, «Guardar» lo dice
	 * bajo el botón y le pide a la paleta (`alFaltaResultado`) que abra «Salidas del proceso» y señale el botón del Resultado. Basta con que el nodo
	 * exista: conectarlo a una regla no se exige para guardar (se puede dejar a medias), pero un proceso sin regla en su Resultado no se ejecuta.
	 *
	 * Es solo presentación: quien decide qué pasa con cada botón es `LienzoDeProceso`, que es dueño del dibujo.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Info from '@lucide/svelte/icons/info';
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
		tipoVirtual,
		tiposVirtuales,
		tiposVirtualesFallo = false,
		estado,
		guardando,
		puedeGuardar,
		puedeBorrar,
		tieneResultado,
		alGuardar,
		alBorrar,
		alCambiarTipo,
		alFaltaResultado
	}: {
		nombre: string;
		/** El id del tipo de expediente virtual elegido, o `null`. */
		tipoVirtual: string | null;
		/** Los tipos de expediente virtual de la organización. */
		tiposVirtuales: { id: string; nombre: string }[];
		/** Los tipos no se pudieron leer: «no hay ninguno» no sería verdad. */
		tiposVirtualesFallo?: boolean;
		estado: EstadoDeProceso;
		guardando: boolean;
		puedeGuardar: boolean;
		puedeBorrar: boolean;
		/** El lienzo ya trae su nodo de «Resultado» (obligatorio para guardar). */
		tieneResultado: boolean;
		alGuardar: () => void;
		alBorrar: () => void;
		/** Se eligió otro tipo: el lienzo decide si lo aplica (puede preguntar antes). */
		alCambiarTipo: (id: string) => void;
		/** Se pulsó «Guardar» sin Resultado: que la paleta lo señale. */
		alFaltaResultado: () => void;
	} = $props();

	const TEXTO_DE_ESTADO: Record<EstadoDeProceso, string> = {
		nuevo: 'Proceso nuevo',
		sin_guardar: 'Sin guardar',
		cambios: 'Cambios sin guardar',
		guardado: 'Todos los cambios guardados'
	};

	const elegido = $derived(tiposVirtuales.find((t) => t.id === tipoVirtual) ?? null);
	/** Qué le falta al proceso para guardarse, si la persona pulsó «Guardar» sin eso: se dice bajo el campo y se quita al llenarlo. */
	let falta = $state<'nombre' | 'tipo' | 'resultado' | null>(null);
	$effect(() => {
		if (falta === 'nombre' && nombre.trim() !== '') falta = null;
		if (falta === 'tipo' && tipoVirtual) falta = null;
		if (falta === 'resultado' && tieneResultado) falta = null;
	});

	function pulsarGuardar() {
		if (guardando) return;
		if (puedeGuardar) {
			falta = null;
			alGuardar();
		} else if (!nombre.trim()) {
			falta = 'nombre';
			document.getElementById('nombre-del-proceso')?.focus();
		} else if (!tipoVirtual) {
			falta = 'tipo';
			document.getElementById('tipo-virtual-del-proceso')?.focus();
		} else if (!tieneResultado) {
			falta = 'resultado';
			alFaltaResultado();
		}
		// Sin cambios que guardar: no hay nada que decir; el título del botón ya lo explica.
	}

	/** El cuadrito que explica qué son los expedientes virtuales (solo cuando no hay tipos que elegir). */
	let ayudaAbierta = $state(false);
</script>

<div class="mt-6 flex flex-wrap items-center gap-3" data-testid="barra-proceso">
	<Button variant="outline" href="/motor-de-reglas" data-testid="volver-a-procesos">
		<ChevronLeft />
		Procesos
	</Button>
	<div class="relative w-full max-w-sm min-w-56 flex-1">
		<label class="sr-only" for="nombre-del-proceso">Nombre del proceso</label>
		<Input
			id="nombre-del-proceso"
			data-testid="proceso-nombre"
			bind:value={nombre}
			maxlength={200}
			placeholder="Nombre del proceso"
			autocomplete="off"
			aria-invalid={falta === 'nombre' ? true : undefined}
		/>
		{#if falta === 'nombre'}
			<p role="alert" data-testid="falta-nombre" class="absolute top-full left-0 z-10 mt-1.5 rounded-md border border-destructive/30 bg-card px-2.5 py-1.5 text-xs text-destructive shadow-md">
				Ponle un nombre al proceso para guardarlo.
			</p>
		{/if}
	</div>
	<div class="relative flex items-center gap-2">
		<label class="shrink-0 text-xs text-muted-foreground" for="tipo-virtual-del-proceso">Corre sobre</label>
		{#if falta === 'tipo'}
			<p role="alert" data-testid="falta-tipo" class="absolute top-full left-0 z-10 mt-1.5 rounded-md border border-destructive/30 bg-card px-2.5 py-1.5 text-xs text-destructive shadow-md">
				Elige sobre qué tipo de expediente virtual corre el proceso para guardarlo.
			</p>
		{/if}
		{#if tiposVirtuales.length === 0}
			<button
				type="button"
				id="tipo-virtual-del-proceso"
				data-testid="proceso-sin-tipos-virtuales"
				class="flex h-9 w-64 items-center justify-between gap-1.5 rounded-lg border border-primary bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors hover:bg-muted"
				title="Todavía no hay tipos de expediente virtual: pulsa para ver qué son y dónde se crean"
				onclick={() => (ayudaAbierta = true)}
			>
				<span class="min-w-0 flex-1 truncate text-left">{tiposVirtualesFallo ? 'No se pudieron leer los tipos' : 'Aún no hay tipos'}</span>
				<ChevronDown class="pointer-events-none size-4 text-muted-foreground" />
			</button>
		{:else}
			<!-- Controlado de verdad (binding con función): si el lienzo no aplica el cambio (la persona canceló), el selector se queda en el tipo de
			     siempre y volver a elegir la otra opción vuelve a preguntar. Con `value` suelto se quedaba con lo último que se pulsó. -->
			<Select.Root
				type="single"
				bind:value={() => tipoVirtual ?? SIN_TIPO, (v) => v !== SIN_TIPO && alCambiarTipo(v)}
			>
				<Select.Trigger
					id="tipo-virtual-del-proceso"
					class="h-9 w-64 {tipoVirtual ? '' : 'border-primary'}"
					data-testid="proceso-tipo-virtual"
					title="El tipo de expediente virtual sobre cuyas instancias corre este proceso"
				>
					<!-- Un id que no está en la lista (un tipo que se borró mientras el lienzo estaba abierto) se dice, en vez de esconderlo. -->
					<!-- `truncate` en un span propio: el texto largo se corta con «…» dentro del selector y no se sale de él (2026-11-03). -->
					<span class="min-w-0 flex-1 truncate text-left" title={elegido?.nombre}>
						{elegido?.nombre ?? (tipoVirtual ? 'Tipo que ya no existe' : 'Elige un tipo')}
					</span>
				</Select.Trigger>
				<Select.Content>
					{#each tiposVirtuales as t (t.id)}
						<Select.Item value={t.id} label={t.nombre} data-testid="opcion-tipo-virtual" />
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}
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
		<div class="relative">
			<Button
				data-testid="guardar-proceso"
				disabled={guardando}
				aria-disabled={!puedeGuardar || guardando}
				class={!puedeGuardar && !guardando ? 'cursor-not-allowed opacity-50' : ''}
				title={!nombre.trim()
					? 'Ponle un nombre al proceso para guardarlo'
					: !tipoVirtual
						? 'Elige sobre qué tipo de expediente virtual corre el proceso para guardarlo'
						: !tieneResultado
							? 'Agrega el nodo «Resultado» para guardarlo'
							: !puedeGuardar
								? 'No hay cambios que guardar'
								: 'Guardar (Ctrl+S)'}
				onclick={pulsarGuardar}
			>
				<Save />
				{guardando ? 'Guardando…' : 'Guardar'}
			</Button>
			{#if falta === 'resultado'}
				<p role="alert" data-testid="falta-resultado" class="absolute top-full right-0 z-10 mt-1.5 w-72 rounded-md border border-destructive/30 bg-card px-2.5 py-1.5 text-xs text-destructive shadow-md">
					Agrega el nodo «Resultado» para guardar: es la palabra con la que termina el proceso. Lo encuentras en «Salidas del proceso».
				</p>
			{/if}
		</div>
	</div>
</div>

<!-- El cuadrito de ayuda: qué es un expediente virtual y a dónde ir a crear su tipo. -->
<DialogPrimitive.Root bind:open={ayudaAbierta}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-sin-tipos-virtuales"
			class="fixed top-1/2 left-1/2 z-60 flex w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<div class="flex items-start gap-3">
				<span class="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"><Info class="size-4" /></span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-base font-medium text-foreground">
						{tiposVirtualesFallo ? 'No se pudieron leer los tipos de expediente virtual' : 'Todavía no hay expedientes virtuales'}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="mt-1.5 space-y-2 text-sm text-muted-foreground">
						{#if tiposVirtualesFallo}
							<span class="block">Recarga la página para intentarlo de nuevo.</span>
						{:else}
							<span class="block">
								Un <strong class="font-medium text-foreground">expediente virtual</strong> es un grupo de documentos de un expediente —por ejemplo, los de la solicitud de
								crédito de Juan Pérez— que se arma según un <strong class="font-medium text-foreground">tipo de expediente virtual</strong>, que dice qué tipos
								documentales lleva.
							</span>
							<span class="block">Un proceso corre sobre los expedientes virtuales de un tipo, así que primero hay que crear ese tipo.</span>
						{/if}
					</DialogPrimitive.Description>
				</div>
			</div>
			<div class="flex items-center justify-end gap-3 pt-1">
				<Button type="button" variant="link" class="h-9 px-3" data-testid="cerrar-sin-tipos-virtuales" onclick={() => (ayudaAbierta = false)}>Cerrar</Button>
				{#if !tiposVirtualesFallo}
					<Button href="/configuracion/tipos-expediente" class="h-9 px-4" data-testid="ir-a-crear-tipos-virtuales">Crear un tipo de expediente virtual</Button>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
