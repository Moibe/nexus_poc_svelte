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
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import X from '@lucide/svelte/icons/x';
	import {
		borradorTipoDocumental,
		campoCompleto,
		campoIntacto,
		campoVacio,
		guardarBorrador,
		limpiarBorrador,
		TIPOS_DE_DATO
	} from '$lib/state/configuracion.svelte';

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

	// El estado del wizard vive en el módulo, no aquí, y se respalda en
	// localStorage. Antes eran `$state` locales que se borraban al cerrar: si
	// cerrabas la ventana —o se te iba un refresh— perdías la captura completa.
	const borrador = borradorTipoDocumental;

	const verticalLabel = $derived(verticales.find((v) => v.value === borrador.vertical)?.label);

	const etiquetaTipo = (valor: string) => TIPOS_DE_DATO.find((t) => t.value === valor)?.label;

	// Las tarjetas que el usuario ni tocó no cuentan para nada: ni bloquean el
	// guardado ni se van a guardar. Solo estorbarían si contaran como incompletas.
	const camposUtiles = $derived(borrador.campos.filter((c) => !campoIntacto(c)));

	// Se puede avanzar cuando hay al menos un campo y NINGUNO quedó a medias.
	// Un campo a medias sí bloquea: dejarlo pasar lo perdería en silencio, que es
	// peor que un botón deshabilitado.
	const camposListos = $derived(camposUtiles.length > 0 && camposUtiles.every(campoCompleto));

	const canContinue = $derived(
		borrador.paso === 1
			? borrador.nombre.trim() !== '' && borrador.descripcion.trim() !== ''
			: borrador.paso === 2
				? camposListos
				: false
	);

	const etiquetaAvance = $derived(
		borrador.paso === 1 ? 'Continuar y agregar datos' : 'Guardar y agregar propiedades'
	);

	// Al llegar al paso 2 siempre tiene que haber una tarjeta visible: en Figma
	// la pantalla nunca aparece en blanco. Converge — en cuanto hay una, deja de
	// entrar.
	$effect(() => {
		if (vista === 'wizard' && borrador.paso === 2 && borrador.campos.length === 0) {
			borrador.campos.push(campoVacio());
		}
	});

	function agregarCampo() {
		borrador.campos.push(campoVacio());
	}

	function quitarCampo(id: string) {
		const i = borrador.campos.findIndex((c) => c.id === id);
		if (i !== -1) borrador.campos.splice(i, 1);
	}

	// Se persiste en cuanto cambia algo, no al picar "Continuar": lo que se
	// quiere salvar es precisamente lo capturado cuando el usuario NO llegó a
	// confirmar nada.
	$effect(() => {
		// Se leen los cuatro para que el efecto dependa de todos.
		void [borrador.nombre, borrador.descripcion, borrador.vertical, borrador.paso];
		// Recorrer los campos hace que el efecto dependa de cada propiedad de
		// cada uno: sin esto, teclear dentro de una tarjeta no dispara el guardado.
		for (const c of borrador.campos) void [c.nombre, c.tipoDato, c.descripcion, c.obligatorio];
		guardarBorrador();
	});

	// Al cerrar se vuelve a 'biblioteca' para que la próxima apertura empiece
	// donde marca el diseño. Lo que YA NO se hace es borrar lo capturado: el
	// borrador sobrevive, así que al volver a entrar al wizard los campos
	// siguen llenos. Vaciarlo es una acción explícita ("Cancelar").
	$effect(() => {
		if (!open) vista = 'biblioteca';
	});

	function cancelar() {
		limpiarBorrador();
		vista = 'biblioteca';
	}

	function continuar() {
		if (!canContinue) return;
		if (borrador.paso < steps.length) {
			borrador.paso += 1;
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
						{@const state = n < borrador.paso ? 'completado' : n === borrador.paso ? 'activo' : 'pendiente'}
						<!-- El subrayado del paso activo va en el verde de éxito de Figma
						     (--exito/exito-2 = #22c55e), no en el color de marca. -->
						<li class={state === 'activo' ? 'border-b-2 border-green-500 pb-4' : 'pb-4'}>
							<div class="mb-1 flex items-center gap-1.5">
								{#if state === 'completado'}
									<Check class="size-3.5 text-green-600" />
									<!-- "Listo", no "Completado": es el texto literal del frame
									     1060:61194 de Figma. Se había puesto "Completado" al
									     implementar el paso 1, cuando ese estado todavía no se veía
									     en ninguna pantalla y no había contra qué contrastarlo. -->
									<span class="text-xs font-medium text-green-600">Listo</span>
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
				{:else if borrador.paso === 1}
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
								bind:value={borrador.nombre}
								placeholder="Ingresa el nombre del tipo documental a configurar"
							/>
						</div>

						<div class="space-y-2">
							<Label for="descripcion-tipo">Descripción *</Label>
							<Textarea
								id="descripcion-tipo"
								bind:value={borrador.descripcion}
								rows={3}
								placeholder="Describe el propósito y contenido de este tipo documental."
							/>
						</div>

						<div class="space-y-2">
							<Label for="vertical-negocio">Vertical de negocio</Label>
							<Select.Root type="single" bind:value={borrador.vertical}>
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
				{:else if borrador.paso === 2}
					<h3 class="text-xl font-semibold text-foreground">Nuevo campo de extracción</h3>
					<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
						Completa la información requerida para agregar un nuevo campo al modelo documental y
						mejorar la precisión de la extracción automática.
					</p>

					<div class="mt-8 flex max-w-3xl flex-col gap-4">
						{#each borrador.campos as campo, i (campo.id)}
							<div class="relative rounded-xl border border-border bg-background p-6">
								{#if borrador.campos.length > 1}
									<!-- QUITAR TARJETA: no está en Figma. El frame solo dibuja una
									     tarjeta, así que no contempla el caso de haber agregado una de
									     más. Sin esto, una tarjeta agregada por error y con una sola
									     letra escrita deja el botón de guardar deshabilitado y la única
									     salida es "Cancelar registro", que borra TODO lo capturado.
									     Solo aparece cuando hay más de una. -->
									<button
										type="button"
										aria-label="Quitar este campo"
										class="absolute top-3 right-3 flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										onclick={() => quitarCampo(campo.id)}
									>
										<X class="size-3.5" />
									</button>
								{/if}

								<div class="grid gap-6 md:grid-cols-2">
									<div class="space-y-2">
										<Label for="campo-nombre-{campo.id}">Nombre del campo *</Label>
										<Input
											id="campo-nombre-{campo.id}"
											bind:value={campo.nombre}
											placeholder="Ingresa nombre de campo"
										/>
									</div>

									<div class="space-y-2">
										<Label for="campo-tipo-{campo.id}">Tipo de dato *</Label>
										<Select.Root type="single" bind:value={campo.tipoDato}>
											<Select.Trigger id="campo-tipo-{campo.id}" class="w-full">
												{etiquetaTipo(campo.tipoDato) ?? 'Selecciona un tipo de campo'}
											</Select.Trigger>
											<Select.Content>
												{#each TIPOS_DE_DATO as tipo (tipo.value)}
													<Select.Item value={tipo.value} label={tipo.label} />
												{/each}
											</Select.Content>
										</Select.Root>
									</div>
								</div>

								<div class="mt-6 space-y-2">
									<Label for="campo-desc-{campo.id}">Descripción funcional *</Label>
									<Textarea
										id="campo-desc-{campo.id}"
										bind:value={campo.descripcion}
										rows={3}
										placeholder="Describe qué información representa este campo y cómo debe interpretarse durante la extracción."
									/>
								</div>

								<div class="mt-6 flex items-center justify-between gap-4">
									<div class="flex items-center gap-2">
										<Checkbox
											id="campo-obligatorio-{campo.id}"
											checked={campo.obligatorio}
											onCheckedChange={(v) => (campo.obligatorio = v === true)}
										/>
										<Label
											for="campo-obligatorio-{campo.id}"
											class="font-normal text-muted-foreground"
										>
											Obligatorio
										</Label>
									</div>

									<!-- El enlace vive solo en la última tarjeta. En Figma está dentro
									     de la única que existe; repetirlo en todas dejaría varios
									     "agregar" apilados sin que ninguno signifique algo distinto. -->
									{#if i === borrador.campos.length - 1}
										<Button
											variant="link"
											class="h-auto gap-1.5 p-0 text-primary"
											onclick={agregarCampo}
										>
											<CirclePlus class="size-4" />
											Agregar otro campo
										</Button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="flex h-full flex-col items-center justify-center text-center">
						<p class="text-sm font-semibold text-foreground">{steps[borrador.paso - 1].title}</p>
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
				<Button disabled={!canContinue} onclick={continuar}>{etiquetaAvance}</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
