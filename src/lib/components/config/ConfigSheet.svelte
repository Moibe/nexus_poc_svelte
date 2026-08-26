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
	import Minus from '@lucide/svelte/icons/minus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import {
		borradorTipoDocumental,
		agregarCampoEnCaptura,
		campoCompleto,
		eliminarTipoDocumental,
		etiquetaVertical,
		guardarTipoDocumental,
		tiposDocumentales,
		VERTICALES,
		guardarBorrador,
		limpiarBorrador,
		quitarCampo,
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


	// El estado del wizard vive en el módulo, no aquí, y se respalda en
	// localStorage. Antes eran `$state` locales que se borraban al cerrar: si
	// cerrabas la ventana —o se te iba un refresh— perdías la captura completa.
	const borrador = borradorTipoDocumental;

	const verticalLabel = $derived(etiquetaVertical(borrador.vertical));

	const etiquetaTipo = (valor: string) => TIPOS_DE_DATO.find((t) => t.value === valor)?.label;

	// El formulario de arriba se puede "Agregar" solo cuando está completo.
	const puedeAgregar = $derived(campoCompleto(borrador.campoEnCaptura));

	// Se puede pasar al paso 3 si ya hay campos en la lista, o si el formulario
	// tiene uno completo listo para entrar. Lo segundo evita el caso cruel de
	// haber llenado el último campo y que el botón esté apagado por no haber
	// picado "Agregar" — al guardar se agrega solo.
	const canContinue = $derived(
		borrador.paso === 1
			? borrador.nombre.trim() !== '' && borrador.descripcion.trim() !== ''
			: borrador.paso === 2
				? borrador.campos.length > 0 || puedeAgregar
				// Paso 3: habilitado. Es un placeholder sin nada que validar, y con el
				// botón apagado la única salida del wizard era la X — se veía roto. El
				// tipo documental ya quedó guardado en el paso 2, así que aquí solo se
				// cierra.
				: true
	);

	// "Finalizar" NO viene de Figma: el frame del paso 3 no está implementado y no
	// sé qué dice su pie. Es una etiqueta honesta para un placeholder — cuando se
	// construya el paso 3, se cambia por la del diseño.
	const etiquetaAvance = $derived(
		borrador.paso === 1
			? 'Continuar y agregar datos'
			: borrador.paso === 2
				? 'Guardar y agregar propiedades'
				: 'Finalizar'
	);

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
		// Si quedó un campo completo sin "Agregar", se agrega en vez de perderlo.
		if (borrador.paso === 2) {
			agregarCampoEnCaptura();
			// El botón dice "Guardar": aquí es donde el tipo documental entra a la
			// biblioteca. Si el usuario abandona el paso 3, el tipo ya quedó — con
			// sus campos pero sin propiedades, que es un borrador legítimo.
			guardarTipoDocumental();
		}
		if (borrador.paso < steps.length) {
			borrador.paso += 1;
		} else {
			// Fin del wizard: el borrador se limpia para que el próximo "Nuevo tipo
			// documental" arranque en blanco. Lo capturado no se pierde — ya vive en
			// la biblioteca.
			limpiarBorrador();
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
					{#if tiposDocumentales.length > 0}
						<!-- Biblioteca poblada. Estructura tomada del frame 1077:65410:
						     título "Modelos documentales agregados" y una tarjeta por
						     modelo (682x72). No pude ver los píxeles —se agotó la cuota de
						     Figma— así que el espaciado y el detalle fino quedan pendientes
						     de una pasada de fidelidad contra el frame. -->
						<h3 class="text-xl font-semibold text-foreground">Modelos documentales agregados</h3>

						<div class="mt-4 flex flex-col gap-3">
							{#each tiposDocumentales as tipo (tipo.id)}
								<div
									class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3"
								>
									<span
										class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
									>
										<SetupIcon class="size-4" />
									</span>

									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-foreground">{tipo.nombre}</p>
										<p class="truncate text-xs text-muted-foreground">
											{tipo.campos.length}
											{tipo.campos.length === 1 ? 'campo' : 'campos'}
											{#if etiquetaVertical(tipo.vertical)}
												· {etiquetaVertical(tipo.vertical)}
											{/if}
										</p>
									</div>

									<span class="shrink-0 text-xs text-muted-foreground">Administrador</span>

									<!-- ELIMINAR: no está en el frame, que en su lugar tiene un botón
									     (82x38) y un ícono de menú. Ese botón es de HU038 ("Activar
									     versión"), que todavía no existe. Sin algo aquí, un tipo
									     guardado por error se queda para siempre. -->
									<button
										type="button"
										aria-label={`Eliminar ${tipo.nombre}`}
										class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
										onclick={() => eliminarTipoDocumental(tipo.id)}
									>
										<Trash2 class="size-4" />
									</button>
								</div>
							{/each}
						</div>

						<div class="mt-8">
							<Button class="w-60" onclick={() => (vista = 'wizard')}>Nuevo tipo documental</Button>
						</div>
					{:else}
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
					{/if}
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
									{#each VERTICALES as v (v.value)}
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

					<!-- El formulario de alta. Siempre en blanco: no es un elemento más de
					     la lista, es el que da de alta. Así está en Figma (1067:62363). -->
					<div class="mt-8 max-w-3xl rounded-xl border border-border bg-background p-6">
						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="campo-nombre">Nombre del campo *</Label>
								<Input
									id="campo-nombre"
									bind:value={borrador.campoEnCaptura.nombre}
									placeholder="Ingresa nombre de campo"
								/>
							</div>

							<div class="space-y-2">
								<Label for="campo-tipo">Tipo de dato *</Label>
								<Select.Root type="single" bind:value={borrador.campoEnCaptura.tipoDato}>
									<Select.Trigger id="campo-tipo" class="w-full">
										{etiquetaTipo(borrador.campoEnCaptura.tipoDato) ?? 'Selecciona un tipo de campo'}
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
							<Label for="campo-desc">Descripción funcional *</Label>
							<Textarea
								id="campo-desc"
								bind:value={borrador.campoEnCaptura.descripcion}
								rows={3}
								placeholder="Describe qué información representa este campo y cómo debe interpretarse durante la extracción."
							/>
						</div>

						<div class="mt-6 flex items-center justify-between gap-4">
							<div class="flex items-center gap-2">
								<Checkbox
									id="campo-obligatorio"
									checked={borrador.campoEnCaptura.obligatorio}
									onCheckedChange={(v) => (borrador.campoEnCaptura.obligatorio = v === true)}
								/>
								<Label for="campo-obligatorio" class="font-normal text-muted-foreground">
									Obligatorio
								</Label>
							</div>

							<!-- Deshabilitado mientras el campo esté incompleto: es el único
							     camino para que entre a la lista, y dejarlo picar sin efecto
							     visible se siente como que la app se tragó el clic. -->
							<Button
								variant="link"
								class="h-auto gap-1.5 p-0 text-primary"
								disabled={!puedeAgregar}
								onclick={agregarCampoEnCaptura}
							>
								<CirclePlus class="size-4" />
								Agregar otro campo
							</Button>
						</div>
					</div>

					{#if borrador.campos.length > 0}
						<h4 class="mt-8 text-xl font-semibold text-foreground">Campos agregados</h4>

						<div class="mt-4 flex max-w-3xl flex-col gap-4">
							{#each borrador.campos as campo (campo.id)}
								<div class="flex items-end gap-4">
									<div class="grid flex-1 gap-4 md:grid-cols-2">
										<div class="space-y-2">
											<Label for="agregado-nombre-{campo.id}">Nombre del campo</Label>
											<!-- readonly, no disabled: `disabled` los saca del orden de
											     tabulación y del lector de pantalla, y este contenido sí
											     hay que poder leerlo. La edición no existe en el diseño;
											     para cambiar algo se quita y se vuelve a agregar. -->
											<Input
												id="agregado-nombre-{campo.id}"
												value={campo.nombre}
												readonly
												class="bg-muted text-muted-foreground"
											/>
										</div>
										<div class="space-y-2">
											<Label for="agregado-tipo-{campo.id}">Tipo de dato</Label>
											<Input
												id="agregado-tipo-{campo.id}"
												value={etiquetaTipo(campo.tipoDato) ?? campo.tipoDato}
												readonly
												class="bg-muted text-muted-foreground"
											/>
										</div>
									</div>

									<button
										type="button"
										aria-label={`Quitar el campo ${campo.nombre}`}
										class="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100"
										onclick={() => quitarCampo(campo.id)}
									>
										<Minus class="size-4" />
									</button>
								</div>
							{/each}
						</div>
					{/if}
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
