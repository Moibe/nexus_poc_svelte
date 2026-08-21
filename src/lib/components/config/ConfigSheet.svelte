<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import SetupIcon from '$lib/components/icons/SetupIcon.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ArchiveIcon from '$lib/components/icons/ArchiveIcon.svelte';
	import ArrowRightIcon from '$lib/components/icons/ArrowRightIcon.svelte';
	import Check from '@lucide/svelte/icons/check';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// El módulo tiene dos vistas, como en Figma:
	//  - 'biblioteca': la pantalla de entrada, con el listado de modelos (hoy
	//    vacío) y el botón para arrancar uno nuevo.
	//  - 'wizard': el alta de tipo documental en 3 pasos.
	// Se entra siempre por 'biblioteca'; el wizard aparece al picar el botón.
	let vista = $state<'biblioteca' | 'wizard'>('biblioteca');

	const steps = [
		{
			title: 'Tipo documental',
			description: 'Define la información básica del tipo documental.'
		},
		{
			title: 'Campos de extracción',
			description: 'Define la información básica del tipo documental.'
		},
		{
			title: 'Propiedades de campo',
			description: 'Configura las propiedades que definirán la información extraída de este campo.'
		}
	];

	const verticales = [
		{ value: 'seguros', label: 'Seguros' },
		{ value: 'bancario', label: 'Bancario / Financiero' },
		{ value: 'retail', label: 'Retail' },
		{ value: 'salud', label: 'Salud' },
		{ value: 'gobierno', label: 'Gobierno' },
		{ value: 'logistica', label: 'Logística' },
		{ value: 'otro', label: 'Otro' }
	];

	let currentStep = $state(1);
	let nombre = $state('');
	let descripcion = $state('');
	let vertical = $state('');

	const verticalLabel = $derived(verticales.find((v) => v.value === vertical)?.label);
	const canContinue = $derived(nombre.trim() !== '' && descripcion.trim() !== '');

	function reset() {
		currentStep = 1;
		nombre = '';
		descripcion = '';
		vertical = '';
	}

	// Al cerrar se vuelve a 'biblioteca' para que la próxima apertura empiece
	// donde marca el diseño, y no a media captura del wizard anterior.
	$effect(() => {
		if (!open) {
			vista = 'biblioteca';
			reset();
		}
	});

	function cancelar() {
		reset();
		vista = 'biblioteca';
	}

	function continuar() {
		if (!canContinue) return;
		if (currentStep < steps.length) {
			currentStep += 1;
		} else {
			open = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		showCloseButton={false}
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<!-- header . navigation -->
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Modulo de configuración
			</Sheet.Title>
			<Sheet.Close>
				{#snippet child({ props })}
					<button
						{...props}
						class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
					>
						<CancelSquareIcon />
						<span class="sr-only">Cerrar</span>
					</button>
				{/snippet}
			</Sheet.Close>
		</div>

		<!-- header.modal -->
		<div class="flex items-center gap-3 px-6 py-4">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
			>
				<SetupIcon />
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="text-lg font-medium text-foreground">Motor de configuración documental</h2>
				<Sheet.Description class="text-sm">
					Configura la forma en que NexusDoc comprende tus documentos.
				</Sheet.Description>
			</div>
		</div>

		<div class="flex min-h-0 flex-1">
			<!-- statusbar: 330px, fondo #fcfcfc y bordes de 2px según Figma -->
			<aside
				class="w-82.5 shrink-0 overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
			>
				{#if vista === 'biblioteca'}
					<p class="text-xs text-foreground">Configuración</p>
					<!-- Tarjeta "Biblioteca": el acceso al listado de modelos ya configurados -->
					<div class="mt-6 flex items-center gap-3">
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
						>
							<ArchiveIcon />
						</span>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-foreground">Biblioteca</p>
							<p class="mt-2 text-xs text-muted-foreground">
								Localiza tu listado de documentos configurados.
							</p>
						</div>
						<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />
					</div>
				{:else}
					<p class="mb-4 text-sm font-semibold text-foreground">Nuevo tipo documental</p>
					<ol class="space-y-6">
						{#each steps as step, i (step.title)}
						{@const n = i + 1}
						{@const state = n < currentStep ? 'completado' : n === currentStep ? 'activo' : 'pendiente'}
						<!-- El subrayado del paso activo va en el verde de éxito de Figma
						     (--exito/exito-2 = #22c55e), no en el color de marca. -->
						<li class={state === 'activo' ? 'border-b-2 border-green-500 pb-4' : 'pb-4'}>
							<div class="mb-1 flex items-center gap-1.5">
								{#if state === 'completado'}
									<Check class="size-3.5 text-green-600" />
									<span class="text-xs font-medium text-green-600">Completado</span>
								{:else if state === 'activo'}
									<span class="size-1.5 rounded-full bg-green-500"></span>
									<span class="text-xs font-medium text-green-600">En configuración</span>
								{:else}
									<span class="text-xs font-medium text-muted-foreground">Por configurar</span>
								{/if}
							</div>
							<p class="text-sm font-semibold text-foreground">{n}. {step.title}</p>
								<p class="mt-1 text-sm text-muted-foreground">{step.description}</p>
							</li>
						{/each}
					</ol>
				{/if}
			</aside>

			<div class="flex-1 overflow-y-auto p-8">
				{#if vista === 'biblioteca'}
					<!-- Estado vacío de la biblioteca de modelos documentales -->
					<div class="flex h-full flex-col items-center justify-center gap-6 text-center">
						<span
							class="flex size-12.5 items-center justify-center rounded-xl border-2 border-muted bg-card text-primary"
						>
							<SetupIcon class="size-6" />
						</span>
						<div>
							<p class="text-sm font-medium text-foreground">
								Comienza configurando un modelo documental
							</p>
							<p class="mt-1 max-w-md text-xs text-muted-foreground">
								Agrega un tipo documental para comenzar a configurar los campos, reglas de extracción
								y validaciones del modelo.
							</p>
						</div>
						<Button class="w-60" onclick={() => (vista = 'wizard')}>Nuevo tipo documental</Button>
					</div>
				{:else if currentStep === 1}
					<h3 class="text-xl font-semibold text-foreground">Nuevo tipo documental</h3>
					<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
						Ingresa la información necesaria para registrar un nuevo tipo documental y continuar
						con la configuración de sus reglas de procesamiento.
					</p>

					<div class="mt-8 max-w-2xl space-y-6">
						<div class="space-y-2">
							<Label for="nombre-tipo">Nombre de tipo documental *</Label>
							<Input
								id="nombre-tipo"
								bind:value={nombre}
								placeholder="Ingresa el nombre del tipo documental a configurar"
							/>
						</div>

						<div class="space-y-2">
							<Label for="descripcion-tipo">Descripción *</Label>
							<Textarea
								id="descripcion-tipo"
								bind:value={descripcion}
								rows={3}
								placeholder="Describe el propósito y contenido de este tipo documental."
							/>
						</div>

						<div class="space-y-2">
							<Label for="vertical-negocio">Vertical de negocio</Label>
							<Select.Root type="single" bind:value={vertical}>
								<Select.Trigger id="vertical-negocio" class="w-full">
									{verticalLabel ?? 'Ingresa una vertical de negocio'}
								</Select.Trigger>
								<Select.Content>
									{#each verticales as v (v.value)}
										<Select.Item value={v.value} label={v.label} />
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>
				{:else}
					<div class="flex h-full flex-col items-center justify-center text-center">
						<p class="text-sm font-semibold text-foreground">{steps[currentStep - 1].title}</p>
						<p class="mt-1 max-w-sm text-sm text-muted-foreground">
							Esta sección aún no está disponible. Vuelve más tarde para configurarla.
						</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- El pie solo existe en el wizard; la pantalla de entrada no lo tiene
		     (así está en Figma: ahí la única acción es el botón del centro). -->
		{#if vista === 'wizard'}
			<div class="flex items-center justify-between border-t border-border px-6 py-4">
				<Button variant="link" class="h-auto p-0 text-destructive" onclick={cancelar}>
					Cancelar registro
				</Button>
				<Button disabled={!canContinue} onclick={continuar}>Continuar y agregar datos</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
