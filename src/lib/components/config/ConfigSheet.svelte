<script lang="ts">
	import { untrack } from 'svelte';
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
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import Minus from '@lucide/svelte/icons/minus';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import AlertCircle from '@lucide/svelte/icons/circle-alert';
	import {
		borradorTipoDocumental,
		agregarCampoEnCaptura,
		agregarValorLista,
		campoCompleto,
		campoIntacto,
		cargarTipoDocumental,
		etiquetaVertical,
		guardarTipoDocumental,
		hayBorrador,
		irAPaso,
		pasoNavegable,
		tiposDocumentales,
		VERTICALES,
		guardarBorrador,
		limpiarBorrador,
		nombreCampoDuplicado,
		quitarCampo,
		quitarValorLista,
		sincronizarTipoGuardado,
		valorListaDuplicado,
		CARDINALIDADES,
		REGLAS_TRANSFORMACION,
		TIPOS_DE_DATO,
		UMBRALES_CONFIANZA
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
	const etiquetaRegla = (valor: string) =>
		REGLAS_TRANSFORMACION.find((r) => r.value === valor)?.label;

	const nombreDuplicado = $derived(
		nombreCampoDuplicado(borrador.campoEnCaptura.nombre, borrador.campos)
	);

	// El formulario se puede "Agregar" cuando está completo Y su nombre no choca
	// con uno ya agregado.
	const puedeAgregar = $derived(campoCompleto(borrador.campoEnCaptura) && !nombreDuplicado);

	// Se puede pasar al paso 3 si ya hay campos en la lista, o si el formulario
	// tiene uno completo listo para entrar. Lo segundo evita el caso cruel de
	// haber llenado el último campo y que el botón esté apagado por no haber
	// picado "Agregar" — al guardar se agrega solo.
	const canContinue = $derived(
		borrador.paso === 1
			? borrador.nombre.trim() !== '' && borrador.descripcion.trim() !== ''
			: borrador.paso === 2
				// Los campos son OPCIONALES para avanzar: el tipo documental ya quedó
				// guardado al salir del paso 1, así que exigir al menos uno aquí
				// dejaría atrapado a quien creó el tipo sin campos a propósito.
				//
				// Lo único que sí bloquea es un formulario que NO se va a poder
				// guardar: a medias, o con el nombre repetido. Dejarlo pasar lo
				// tiraría en silencio, porque `continuar()` intenta agregarlo y
				// `agregarCampoEnCaptura` lo rechazaría sin que nadie se entere.
				// Vacío o listo para agregar, adelante.
				? campoIntacto(borrador.campoEnCaptura) || puedeAgregar
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
				// "Guardar configuración" es el texto literal del frame del paso 3.
				: 'Guardar configuración'
	);

	// Se persiste en cuanto cambia algo, no al picar "Continuar": lo que se
	// quiere salvar es precisamente lo capturado cuando el usuario NO llegó a
	// confirmar nada.
	$effect(() => {
		// Se recorren TODAS las propiedades, en vez de enumerarlas a mano, para
		// que el efecto dependa de cada una. La versión anterior listaba cuatro
		// (`nombre`, `tipoDato`, `descripcion`, `obligatorio`) y al agregar las del
		// paso 3 —umbral, regla, cardinalidad— y `valorEstructura`, esas quedaron
		// FUERA de las dependencias: cambiarlas no disparaba el guardado y se
		// perdían si se cerraba el wizard a media captura.
		//
		// Con el recorrido, cualquier propiedad que se agregue en el futuro queda
		// cubierta sola. Es la diferencia entre una lista que hay que recordar
		// actualizar y una que no puede desactualizarse.
		// Recorrido PROFUNDO. La versión anterior leía `o[clave]` y con eso bastaba
		// para escalares, pero de un arreglo solo leía la REFERENCIA — nunca su
		// contenido. Consecuencia real: quitar un valor del listado de un campo
		// `Lista` no disparaba el guardado (un `splice` no cambia la referencia),
		// mientras que agregarlo sí, pero de rebote: `agregarValorLista` también
		// limpia un campo de texto, y ESE sí estaba vigilado. Un guardado que
		// funciona por efecto colateral es peor que uno que no funciona.
		const tocar = (v: unknown) => {
			if (Array.isArray(v)) {
				void v.length;
				for (const x of v) tocar(x);
			} else if (v !== null && typeof v === 'object') {
				for (const clave of Object.keys(v)) tocar((v as Record<string, unknown>)[clave]);
			}
		};
		tocar(borrador);

		// untrack es OBLIGATORIO aquí, no una optimización: `guardarTipoDocumental`
		// BUSCA la entrada dentro de `tiposDocumentales` (lectura) y luego le
		// asigna los datos nuevos (escritura). Sin untrack, el efecto queda
		// suscrito a ese mismo arreglo que él mismo modifica y Svelte entra en
		// bucle — `effect_update_depth_exceeded`. Las dependencias reales son solo
		// los campos del borrador que se leen arriba.
		untrack(() => {
			guardarBorrador();
			// Si este borrador ya corresponde a un tipo de la biblioteca, lo que se
			// teclea viaja de inmediato a esa entrada. Eso es lo que permite que
			// "Nuevo tipo documental" empiece siempre en blanco sin que nadie
			// pierda trabajo a medio capturar.
			sincronizarTipoGuardado();
		});
	});

	// Al cerrar se vuelve a 'biblioteca' para que la próxima apertura empiece
	// donde marca el diseño. Lo que YA NO se hace es borrar lo capturado: el
	// borrador sobrevive, así que al volver a entrar al wizard los campos
	// siguen llenos. Vaciarlo es una acción explícita ("Cancelar").
	$effect(() => {
		if (!open) vista = 'biblioteca';
	});

	/**
	 * "Regresar": retrocede un paso. Antes era "Cancelar registro" y borraba el
	 * borrador — un nombre que además prometía de más, porque el tipo documental
	 * ya vive en la biblioteca desde que sale del paso 1: cancelar el borrador no
	 * cancelaba el registro.
	 *
	 * En el paso 1 no hay paso anterior, así que regresa a la Biblioteca: es la
	 * pantalla de la que se viene. Nada se pierde — el borrador sigue guardado y
	 * el tipo sigue en la lista.
	 */
	/** La X del header. Sube un nivel en vez de cerrar de golpe. */
	function cerrarNivel() {
		if (vista === 'wizard') vista = 'biblioteca';
		else open = false;
	}

	function regresar() {
		if (borrador.paso > 1) borrador.paso -= 1;
		else vista = 'biblioteca';
	}

	/** "Nuevo tipo documental": SIEMPRE en blanco. Retomar uno existente se hace
	 *  picando su tarjeta en la lista, que es donde el usuario lo busca. */
	function nuevoTipoDocumental() {
		// RESCATE antes de limpiar. El diseño se apoya en un invariante: "todo lo
		// capturado ya viajó a la biblioteca, así que limpiar no pierde nada". Eso
		// es cierto para datos nuevos —el tipo se guarda al salir del paso 1— pero
		// NO para un borrador escrito por una versión anterior a que existiera la
		// biblioteca: ese llega con `idGuardado` en null y sin tarjeta que lo abra,
		// así que este botón era su única affordance visible... y lo destruía. En
		// la versión que escribió ese dato, este mismo botón era el que lo RETOMABA.
		//
		// `guardarTipoDocumental` no hace nada si no hay nombre, así que un
		// borrador vacío se limpia como siempre.
		if (!borrador.idGuardado && hayBorrador()) guardarTipoDocumental();
		limpiarBorrador();
		vista = 'wizard';
	}

	function abrirTipoDocumental(id: string) {
		if (cargarTipoDocumental(id)) vista = 'wizard';
	}

	function continuar() {
		if (!canContinue) return;
		// Si quedó un campo completo sin "Agregar", se agrega en vez de perderlo.
		if (borrador.paso === 2) agregarCampoEnCaptura();

		// El tipo documental entra a la biblioteca al salir del PASO 1, no al
		// final: en cuanto tiene nombre y descripción ya es un tipo documental.
		// Los campos son configuración suya, no requisito para que exista.
		//
		// Volver a llamarla en el paso 2 no duplica: `guardarTipoDocumental`
		// actualiza la entrada cuando el borrador ya trae `idGuardado`. Así los
		// campos se agregan a la MISMA entrada que se creó un paso antes.
		if (borrador.paso === 1 || borrador.paso === 2) guardarTipoDocumental();
		if (borrador.paso < steps.length) {
			borrador.paso += 1;
			// Solo crece: volver atrás desde el sidebar no debe cerrar pasos que ya
			// se habían visitado.
			borrador.pasoMaximo = Math.max(borrador.pasoMaximo, borrador.paso);
		} else {
			// Fin del wizard. El guardado explícito es redundante con la
			// sincronización en vivo, pero cuesta nada y cubre el caso de que esa
			// sincronización se rompa alguna vez: lo último que hace el usuario no
			// debería depender de un efecto.
			guardarTipoDocumental();
			// El borrador se limpia para que el próximo "Nuevo tipo documental"
			// arranque en blanco. Lo capturado no se pierde — vive en la biblioteca.
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
			<!-- La X sube UN NIVEL, no cierra siempre: estando en el wizard regresa a
			     la Biblioteca; estando ya en la Biblioteca sí cierra el módulo. Antes
			     era un `Sheet.Close` puro, así que a media captura de un tipo te
			     sacaba hasta el Home — dos niveles de golpe, y para volver había que
			     reabrir el módulo desde el engrane.
			     Escape y el clic fuera SÍ siguen cerrando del todo, que es lo que
			     cualquiera espera de un modal, y no pierden nada: el borrador queda
			     guardado. -->
			<button
				type="button"
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
				onclick={cerrarNivel}
			>
				<CancelSquareIcon />
				<span class="sr-only">
					{vista === 'wizard' ? 'Volver al módulo de configuración' : 'Cerrar'}
				</span>
			</button>
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
						<!-- El estado se calcula contra `pasoMaximo`, no contra `paso`: al
						     regresar al paso 1 desde el sidebar, los pasos 2 y 3 ya visitados
						     deben seguir diciendo "Listo". Con `paso` volverían a "Por
						     configurar" y se leería como si se hubiera perdido el avance. -->
						{@const state =
							n === borrador.paso
								? 'activo'
								: n <= borrador.pasoMaximo
									? 'completado'
									: 'pendiente'}
						{@const navegable = pasoNavegable(n) && n !== borrador.paso}
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
							{#if navegable}
								<!-- Solo los pasos YA VISITADOS son clicables, en cualquier
								     dirección: si llegaste al 3 y volviste al 1, picar el 3 te
								     regresa. Lo que no se puede es abrir uno al que nunca se llegó
								     — saltar al 3 sin haber definido campos mostraría una pantalla
								     que no tiene de qué hablar.
								     Avanzar MÁS ALLÁ del máximo sigue siendo exclusivo del botón del
								     pie, que es el que valida lo capturado antes de dejar pasar. -->
								<button
									type="button"
									class="block text-left text-sm font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
									onclick={() => irAPaso(n)}
								>
									{n}. {step.title}
								</button>
							{:else}
								<p class="text-sm font-semibold text-foreground">{n}. {step.title}</p>
							{/if}
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
								<!-- La tarjeta entera es el control para retomar el tipo. El frame
								     tiene aquí un botón de 82x38 (de HU038) y un ícono de menú; sin
								     esos, hacer clicable la fila completa es el gesto más obvio y no
								     agrega elementos que el UX tendría que revisar. La flecha es la
								     misma que ya usa el renglón "Biblioteca" del sidebar. -->
								<button
									type="button"
									class="flex w-full items-center gap-4 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
									onclick={() => abrirTipoDocumental(tipo.id)}
								>
									<span
										class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
									>
										<SetupIcon class="size-4" />
									</span>

									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-foreground">{tipo.nombre}</p>
										<p class="truncate text-xs text-muted-foreground">
											<!-- "Sin campos configurados" en vez de "0 campos": ahora un
											     tipo puede entrar a la lista antes de tener ninguno, y un
											     cero suelto se lee como que algo salió mal. -->
											{#if tipo.campos.length === 0}
												Sin campos configurados
											{:else}
												{tipo.campos.length}
												{tipo.campos.length === 1 ? 'campo' : 'campos'}
											{/if}
											{#if etiquetaVertical(tipo.vertical)}
												· {etiquetaVertical(tipo.vertical)}
											{/if}
										</p>
									</div>

									<span class="shrink-0 text-xs text-muted-foreground">Administrador</span>

									<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />

									<!-- Aquí va, en el frame 1077:65410, un botón de 82x38 más un ícono
									     de menú de 24x24. Ese botón es de HU038 ("Activar versión de
									     Configuration Table para producción"), que todavía no existe, y
									     no pude ver los píxeles del frame porque se agotó la cuota de
									     Figma.
									     Hubo aquí un botón de eliminar propio; se retiró el 2026-08-26
									     por no estar en el diseño. `eliminarTipoDocumental()` sigue en
									     el módulo de estado, probada y lista para cuando haya un control
									     real. Ver docs/pendientes-ux.md. -->
								</button>
							{/each}
						</div>

						<div class="mt-8">
							<Button class="w-60" onclick={nuevoTipoDocumental}>Nuevo tipo documental</Button>
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
						<Button class="w-60" onclick={nuevoTipoDocumental}>Nuevo tipo documental</Button>
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
								<!-- El borde rojo lo pinta el propio Input a través de aria-invalid
								     (trae `aria-invalid:border-destructive`), así que el atributo no es
								     solo accesibilidad: es también lo que dispara el estilo. -->
								<div class="relative">
									<Input
										id="campo-nombre"
										bind:value={borrador.campoEnCaptura.nombre}
										placeholder="Ingresa nombre de campo"
										aria-invalid={nombreDuplicado}
										aria-describedby={nombreDuplicado ? 'campo-nombre-error' : undefined}
										class={nombreDuplicado ? 'pr-9' : undefined}
									/>
									{#if nombreDuplicado}
										<AlertCircle
											class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-destructive"
										/>
									{/if}
								</div>
								{#if nombreDuplicado}
									<!-- Texto literal del frame. Mi versión anterior nombraba el campo
									     en conflicto («Ya agregaste un campo llamado "curp"»), que ayuda
									     cuando hay muchos, pero el diseño manda. -->
									<p id="campo-nombre-error" class="text-xs text-destructive">
										Ya existe un campo con este nombre. Utiliza uno diferente.
									</p>
								{/if}
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

						<!-- "Valor de estructura": renglón propio y solo la columna izquierda,
						     como en el frame. SIN asterisco — es opcional. Es un valor de
						     EJEMPLO que muestra la forma esperada del dato, no una validación:
						     su destino en el diccionario es `field_definition.prompt_hint`. -->
						<div class="mt-6 grid gap-6 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="campo-estructura">Valor de estructura</Label>
								<Input
									id="campo-estructura"
									bind:value={borrador.campoEnCaptura.valorEstructura}
									placeholder="Ingresa un valor de ejemplo"
								/>
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
					<h3 class="text-xl font-semibold text-foreground">Propiedades de campo</h3>
					<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
						Personaliza las propiedades del campo para mejorar la precisión y calidad de la
						extracción documental.
					</p>

					{#if borrador.campos.length === 0}
						<!-- Estado vacío que el frame no contempla: ahí siempre hay campos.
						     Puede pasar porque los campos son opcionales para avanzar, y sin
						     esto la pantalla quedaría en blanco sin explicación. -->
						<div class="mt-10 rounded-xl border border-dashed border-border p-8 text-center">
							<p class="text-sm font-medium text-foreground">Todavía no hay campos que configurar</p>
							<p class="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
								Regresa al paso 2 y agrega al menos un campo de extracción para poder definir sus
								propiedades.
							</p>
						</div>
					{:else}
						<Accordion.Root type="single" class="mt-8 flex max-w-3xl flex-col gap-3">
							{#each borrador.campos as campo (campo.id)}
								<Accordion.Item
									value={campo.id}
									class="rounded-xl border border-border bg-background px-4 last:border-b"
								>
									<Accordion.Trigger class="gap-3 hover:no-underline">
										<span
											class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card font-mono text-xs text-primary"
										>
											{'{ }'}
										</span>
										<span class="min-w-0 flex-1 text-left">
											<span class="block truncate text-sm font-medium text-foreground">
												{campo.nombre}
											</span>
											{#if campo.descripcion.trim()}
												<span class="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
													{campo.descripcion}
												</span>
											{/if}
										</span>
										<span
											class="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground"
										>
											{etiquetaTipo(campo.tipoDato) ?? campo.tipoDato}
										</span>
									</Accordion.Trigger>

									<!-- La línea vertical a la izquierda es el `line` de 22px del frame:
									     ata visualmente el panel con su encabezado. -->
									<Accordion.Content class="border-l border-border pb-4 pl-6 ml-4">
										<div class="grid gap-6 md:grid-cols-2">
											<div class="space-y-2">
												<Label for="umbral-{campo.id}">Umbral de confianza *</Label>
												<Select.Root type="single" bind:value={campo.umbralConfianza}>
													<Select.Trigger id="umbral-{campo.id}" class="w-full">
														{campo.umbralConfianza ? `${campo.umbralConfianza}%` : 'Selecciona un umbral'}
													</Select.Trigger>
													<Select.Content>
														{#each UMBRALES_CONFIANZA as u (u.value)}
															<Select.Item value={u.value} label={u.label} />
														{/each}
													</Select.Content>
												</Select.Root>
											</div>

											<div class="space-y-2">
												<Label for="regla-{campo.id}">Reglas de transformación</Label>
												<Select.Root type="single" bind:value={campo.reglaTransformacion}>
													<Select.Trigger id="regla-{campo.id}" class="w-full">
														<span class="truncate">
															{etiquetaRegla(campo.reglaTransformacion) ??
																'Selecciona regla de transformación'}
														</span>
													</Select.Trigger>
													<Select.Content>
														{#each REGLAS_TRANSFORMACION as r (r.value)}
															<Select.Item value={r.value} label={r.label} />
														{/each}
													</Select.Content>
												</Select.Root>
											</div>
										</div>

										{#if campo.tipoDato === 'lista'}
											<!-- Solo para tipo "Lista": son los valores permitidos del
											     campo, o sea `catalog_value` (2.3 del diccionario). Aparece
											     entre las reglas y la cardinalidad, como en el frame. -->
											{@const duplicado = valorListaDuplicado(
												campo.valorListaEnCaptura,
												campo.valoresLista
											)}
											{@const puedeAgregarValor =
												campo.valorListaEnCaptura.trim() !== '' && !duplicado}

											<div class="mt-6 space-y-2">
												<Label for="listado-{campo.id}">Agregar listado</Label>
												<Input
													id="listado-{campo.id}"
													bind:value={campo.valorListaEnCaptura}
													placeholder="Ingresa un listado personalizado"
													aria-invalid={duplicado}
													onkeydown={(e) => {
														// Enter agrega el valor: teclear una lista de diez
														// elementos sin poder usar Enter es innecesariamente
														// lento. No está en el frame, pero tampoco lo contradice.
														if (e.key === 'Enter') {
															e.preventDefault();
															agregarValorLista(campo);
														}
													}}
												/>
												{#if duplicado}
													<p class="text-xs text-destructive">
														Ese valor ya está en el listado.
													</p>
												{/if}

												<div class="flex justify-end">
													<Button
														variant="link"
														class="h-auto gap-1.5 p-0 text-primary"
														disabled={!puedeAgregarValor}
														onclick={() => agregarValorLista(campo)}
													>
														<CirclePlus class="size-4" />
														Agregar otro campo
													</Button>
												</div>

												{#if campo.valoresLista.length > 0}
													<div class="flex flex-wrap gap-2 pt-1">
														{#each campo.valoresLista as valor (valor)}
															<span
																class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pr-1.5 pl-3 text-xs text-foreground"
															>
																{valor}
																<button
																	type="button"
																	aria-label={`Quitar ${valor} del listado`}
																	class="text-muted-foreground transition-colors hover:text-destructive"
																	onclick={() => quitarValorLista(campo, valor)}
																>
																	<CircleX class="size-3.5" />
																</button>
															</span>
														{/each}
													</div>
												{/if}
											</div>
										{/if}

										<div class="mt-6 rounded-xl border border-border p-4">
											<p class="text-sm font-medium text-foreground">Cardinalidad</p>
											<RadioGroup.Root bind:value={campo.cardinalidad} class="mt-3 gap-0">
												{#each CARDINALIDADES as c, i (c.value)}
													{#if i > 0}
														<div class="my-3 border-t border-border"></div>
													{/if}
													<div class="flex items-start gap-3">
														<RadioGroup.Item
															value={c.value}
															id="card-{campo.id}-{c.value}"
															class="mt-0.5"
														/>
														<Label
															for="card-{campo.id}-{c.value}"
															class="flex-1 cursor-pointer font-normal"
														>
															<span class="block text-sm text-foreground">{c.label}</span>
															<span class="mt-1 block text-xs leading-relaxed text-muted-foreground">
																{c.descripcion}
															</span>
														</Label>
													</div>
												{/each}
											</RadioGroup.Root>
										</div>

										<!-- Mismo dato que el checkbox "Obligatorio" del paso 2: en el
										     diseño aparece en las dos pantallas, así que se enlaza a la
										     MISMA propiedad. Cambiarlo aquí lo cambia allá. -->
										<div class="mt-6 flex items-center gap-2">
											<Checkbox
												id="obligatorio-{campo.id}"
												checked={campo.obligatorio}
												onCheckedChange={(v) => (campo.obligatorio = v === true)}
											/>
											<Label for="obligatorio-{campo.id}" class="font-normal text-muted-foreground">
												Obligatorio
											</Label>
										</div>
									</Accordion.Content>
								</Accordion.Item>
							{/each}
						</Accordion.Root>
					{/if}
				{/if}
			</div>
		</div>

		<!-- El pie solo existe en el wizard; la pantalla de entrada no lo tiene
		     (así está en Figma: ahí la única acción es el botón del centro). -->
		{#if vista === 'wizard'}
			<div class="flex items-center justify-between border-t border-border px-6 py-4">
				<!-- Verde, no el rojo del frame: ahí era "Cancelar registro" y el rojo
				     (--error) señalaba una acción destructiva. "Regresar" no lo es, y
				     dejarlo rojo hacía dudar antes de picarlo. Se usa el mismo
				     `text-green-600` que ya llevan "Listo" y "En configuración" en el
				     sidebar, que es el verde de éxito del archivo (--exito/exito-2). -->
				<Button variant="link" class="h-auto p-0 text-green-600" onclick={regresar}>
					Regresar
				</Button>
				<Button disabled={!canContinue} onclick={continuar}>{etiquetaAvance}</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
