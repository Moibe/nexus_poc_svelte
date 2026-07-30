<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import Settings from '@lucide/svelte/icons/settings';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';

	let { open = $bindable(false) }: { open?: boolean } = $props();

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

	function cancelar() {
		reset();
		open = false;
	}

	function continuar() {
		if (!canContinue) return;
		if (currentStep < steps.length) {
			currentStep += 1;
		} else {
			open = false;
			reset();
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		showCloseButton={false}
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<div class="flex items-center justify-between px-6 py-4">
			<Sheet.Title class="text-sm font-medium text-foreground">Modulo de configuración</Sheet.Title>
			<Sheet.Close>
				{#snippet child({ props })}
					<button
						{...props}
						class="flex size-7 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<X class="size-4" />
						<span class="sr-only">Cerrar</span>
					</button>
				{/snippet}
			</Sheet.Close>
		</div>

		<div class="flex items-start gap-3 px-6 pb-5">
			<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
				<Settings class="size-5" />
			</span>
			<div class="space-y-1">
				<h2 class="text-lg font-semibold text-foreground">Motor de configuración documental</h2>
				<Sheet.Description>
					Configura la forma en que NexusDoc AI comprende tus documentos.
				</Sheet.Description>
			</div>
		</div>

		<Separator />

		<div class="flex min-h-0 flex-1">
			<aside class="w-65 shrink-0 overflow-y-auto border-r border-border p-6">
				<p class="mb-4 text-sm font-semibold text-foreground">Nuevo tipo documental</p>
				<ol class="space-y-6">
					{#each steps as step, i (step.title)}
						{@const n = i + 1}
						{@const state = n < currentStep ? 'completado' : n === currentStep ? 'activo' : 'pendiente'}
						<li class={state === 'activo' ? 'border-b-2 border-primary pb-4' : 'pb-4'}>
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
			</aside>

			<div class="flex-1 overflow-y-auto p-8">
				{#if currentStep === 1}
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

		<div class="flex items-center justify-between border-t border-border px-6 py-4">
			<Button variant="link" class="h-auto p-0 text-destructive" onclick={cancelar}>
				Cancelar registro
			</Button>
			<Button disabled={!canContinue} onclick={continuar}>Continuar y agregar datos</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
