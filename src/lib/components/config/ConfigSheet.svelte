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
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import BadgeAlert from '@lucide/svelte/icons/badge-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Plus from '@lucide/svelte/icons/plus';
	import UsersRound from '@lucide/svelte/icons/users-round';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Clock from '@lucide/svelte/icons/clock';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import {
		borradorTipoDocumental,
		agregarCampoEnCaptura,
		agregarValorLista,
		campoCompleto,
		campoIntacto,
		activarTipoDocumental,
		alternarEjemploDocumental,
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
	let avisoExito = $state(false);
	// Si el wizard que está abierto es un ALTA o la edición de un modelo que ya
	// existía. No se puede deducir al final: el tipo documental entra a la
	// biblioteca al salir del PASO 1, así que para cuando se llega al 3 el
	// borrador ya trae `idGuardado` puesto en los dos casos. El único momento en
	// que se distinguen es al ENTRAR, que es donde se marca.
	let altaEnCurso = $state(false);
	// La activación en vuelo (id del tipo) y su error, si lo hubo. Vive aquí y
	// no en el state global porque es efímero de esta pantalla: un spinner y un
	// letrero, no datos del modelo.
	let activandoId = $state<string | null>(null);
	let errorActivacion = $state('');

	// La rama seleccionada en el árbol del sidebar. Es un FILTRO de la vista,
	// no parte del modelo: por eso vive aquí y no se persiste. null = sin
	// filtro, se listan todos.
	let seleccionadoId = $state<string | null>(null);

	// Lo que la columna derecha lista. Si el tipo seleccionado dejara de
	// existir, el filtro produce lista vacía y se preferiría confundir: el
	// derivado cae a "todos" en ese caso.
	const tiposVisibles = $derived(
		seleccionadoId && tiposDocumentales.some((t) => t.id === seleccionadoId)
			? tiposDocumentales.filter((t) => t.id === seleccionadoId)
			: tiposDocumentales
	);

	// Picar la rama ya seleccionada la des-selecciona: sin esto, la única
	// forma de volver a ver todos sería el renglón "Biblioteca", y no es obvio.
	function seleccionarRama(id: string) {
		seleccionadoId = seleccionadoId === id ? null : id;
	}

	async function activar(id: string) {
		// Un solo vuelo a la vez: activar dos tipos en paralelo funcionaría,
		// pero complica leer qué falló; y el guardia real contra duplicados
		// vive en el back (busca por displayName antes de crear).
		if (activandoId) return;
		errorActivacion = '';
		activandoId = id;
		const r = await activarTipoDocumental(id);
		activandoId = null;
		if (!r.ok) errorActivacion = r.mensaje;
	}

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

	// Las tres etiquetas son las literales del diseño. La del paso 3 decía
	// "Finalizar" mientras ese paso era un placeholder; al construirlo se cambió
	// por la del frame.
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
		if (!open) {
			vista = 'biblioteca';
			avisoExito = false;
			errorActivacion = '';
			seleccionadoId = null;
		}
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
		avisoExito = false;
		errorActivacion = '';
		seleccionadoId = null;
		altaEnCurso = true;
		vista = 'wizard';
	}

	function abrirTipoDocumental(id: string) {
		if (cargarTipoDocumental(id)) {
			avisoExito = false;
			errorActivacion = '';
			seleccionadoId = null;
			altaEnCurso = false;
			vista = 'wizard';
		}
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
			const idEnBiblioteca = guardarTipoDocumental();

			// Sin nombre no hay nada que guardar: `guardarTipoDocumental` sale por
			// su guarda y devuelve null. Se puede llegar aquí porque en el paso 3
			// el botón está siempre habilitado y desde el sidebar se salta a
			// cualquier paso ya visitado — basta con borrar el nombre en el 1 y
			// picar el título del 3.
			//
			// Antes de esto, ese camino limpiaba el borrador igual: el usuario
			// picaba "Guardar configuración", perdía lo capturado y no recibía ni
			// aviso ni error. Ahora se devuelve al paso 1, que es donde vive el
			// campo que falta, sin tocar nada de lo suyo; ahí el pie ya está
			// deshabilitado hasta que lo llene, así que la pantalla explica sola
			// qué falta y no hace falta inventar un mensaje que el diseño no tiene.
			if (idEnBiblioteca === null) {
				borrador.paso = 1;
				return;
			}

			// El borrador se limpia para que el próximo "Nuevo tipo documental"
			// arranque en blanco. Lo capturado no se pierde — vive en la biblioteca.
			limpiarBorrador();
			vista = 'biblioteca';
			// Solo se anuncia el ALTA. Al actualizar un modelo que ya existía no se
			// dice nada: el texto del diseño habla de un tipo AGREGADO, y anunciarlo
			// tras una edición se contradice con la lista de atrás, que sigue
			// teniendo las mismas tarjetas. No hay copy aprobado para "actualizado":
			// vale preguntárselo al UX.
			//
			// `guardarTipoDocumental` NO sirve para distinguirlos: devuelve el id
			// tanto en la rama que hace `push` como en la que hace `Object.assign`.
			avisoExito = altaEnCurso;
			altaEnCurso = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<!-- Escape y el clic fuera se interceptan para que hagan lo MISMO que la X:
	     subir un nivel. Dejarlos cerrando del todo mientras la X regresaba a la
	     Biblioteca era justo la inconsistencia que se acababa de quitar — el
	     usuario no distingue "dismiss" por teclado de "dismiss" por botón.
	     `preventDefault()` cancela el cierre que hace bits-ui por su cuenta y
	     `cerrarNivel()` decide a dónde ir; desde la Biblioteca sí cierra, así que
	     nunca queda uno atrapado. -->
	<Sheet.Content
		onEscapeKeydown={(e) => {
			e.preventDefault();
			cerrarNivel();
		}}
		onInteractOutside={(e) => {
			e.preventDefault();
			cerrarNivel();
		}}
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
			     Escape y el clic fuera hacen lo mismo que este botón: ver los
			     manejadores de Sheet.Content. -->
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
					<!-- Tarjeta "Biblioteca": el padre del árbol. Picarla limpia el filtro
					     — es el gesto natural de "ver todo lo que cuelga de aquí". Por ser
					     botón, su contenido va en <span> (contenido de frase), no en <p>. -->
					<button
						type="button"
						data-testid="raiz-biblioteca"
						class="mt-6 flex w-full items-center gap-3 text-left"
						onclick={() => (seleccionadoId = null)}
					>
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
						>
							<ArchiveIcon />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-medium text-foreground">Biblioteca</span>
							<span class="mt-2 block text-xs text-muted-foreground">
								Localiza tu listado de documentos configurados.
							</span>
						</span>
						<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />
					</button>

					<!-- Submenú de la Biblioteca: un renglón por modelo, colgando en árbol.
					     Es el frame `listado` (1077:65481), que hasta ahora estaba sin
					     construir por no tener el diseño. Su geometría se respeta al pixel:

					       · fila de 38px de alto (`listado`, 282x38)
					       · el eje del árbol cae en x=44 — que es exactamente donde empieza
					         el texto "Biblioteca" de arriba (icono de 32 + gap-3 de 12), así
					         que el hijo queda alineado con el padre y no con su ícono
					       · tramo vertical de 22px centrado en la fila (`line`, y=8 h=22)
					       · guion horizontal de 11.5px a media altura (`line`, y=11 w=11.5)
					       · la etiqueta arranca en x=19.5 respecto al eje (`text`, x=19.5)

					     El tramo vertical va POR FILA, no corrido de arriba abajo: en el
					     frame la línea vive dentro del renglón, así que con varios modelos
					     quedan segmentos separados en vez de un eje continuo. Se deja como
					     está el diseño; con un solo modelo las dos lecturas son idénticas y
					     no hay con qué desempatar. Anotado en docs/pendientes-ux.md.

					     El renglón FILTRA la columna derecha: picar una rama deja visible
					     solo su tarjeta, picarla de nuevo (o picar "Biblioteca") vuelve a
					     mostrar todas. Retomar el modelo quedó solo en la tarjeta — un
					     mismo gesto no debe filtrar y navegar a la vez. -->
					{#if tiposDocumentales.length > 0}
						<ul class="mt-4">
							{#each tiposDocumentales as tipo (tipo.id)}
								<li class="relative flex h-9.5 items-center pl-11">
									<span
										class="absolute top-1/2 left-11 h-5.5 w-px -translate-y-1/2 bg-border"
									></span>
									<span class="absolute top-1/2 left-11 h-px w-[11.5px] bg-border"></span>
									<button
										type="button"
										data-testid="rama-tipo"
										aria-pressed={seleccionadoId === tipo.id}
										class="ml-[19.5px] min-w-0 truncate text-left text-sm font-medium transition-colors {seleccionadoId ===
										tipo.id
											? 'text-primary'
											: 'text-foreground hover:text-primary'}"
										onclick={() => seleccionarRama(tipo.id)}
									>
										{tipo.nombre}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
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
							{#each tiposVisibles as tipo (tipo.id)}
								<!-- Tarjeta del frame 1077:65410 (sección HU038). Sus medidas:
								     botón de 82x38, caja de menú de 24x24 con el glifo de 12x12.

								     Ya NO es un <button> entera. Ahora conviven aquí tres controles
								     —retomar, Activar y el menú— y un <button> dentro de otro es
								     HTML inválido: el navegador deshace el anidamiento y los clics
								     dejan de llegar a quien deben. La zona clicable para retomar se
								     acotó al ícono y los textos, que es lo que el usuario asocia con
								     "abrir esto". De paso se arregló otra invalidez que venía de
								     antes: había <div> y <p> dentro del <button>, y un botón solo
								     admite contenido de frase. -->
								<div
									class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3"
								>
									<button
										type="button"
										data-testid="tarjeta-tipo"
										class="flex min-w-0 flex-1 items-center gap-4 rounded-lg text-left transition-colors hover:opacity-80"
										onclick={() => abrirTipoDocumental(tipo.id)}
									>
										<span
											class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
										>
											<SetupIcon class="size-4" />
										</span>

										<span class="min-w-0 flex-1">
											<span class="block truncate text-sm font-medium text-foreground"
												>{tipo.nombre}</span
											>
											<span class="block truncate text-xs text-muted-foreground">
												<!-- "Sin campos configurados" en vez de "0 campos": un tipo
												     puede entrar a la lista antes de tener ninguno, y un cero
												     suelto se lee como que algo salió mal. -->
												{#if tipo.campos.length === 0}
													Sin campos configurados
												{:else}
													{tipo.campos.length}
													{tipo.campos.length === 1 ? 'campo' : 'campos'}
												{/if}
												{#if etiquetaVertical(tipo.vertical)}
													· {etiquetaVertical(tipo.vertical)}
												{/if}
											</span>
										</span>
									</button>

									<!-- Los dos estados de la tarjeta están dibujados en el archivo: sin
									     activar lleva un Button de 82x38 (1077:65581), y ya activada lo
									     cambia por un Badge de 59x22 (1077:66268). El texto del badge no
									     se puede leer del volcado —es una instancia de componente— así
									     que "Activo" es una suposición mía.
									     NO se implementó el estado intermedio "Validando configuración..."
									     que aparece en una de las capturas: no hay nada que validar sin
									     el back, y una animación de espera sobre trabajo que nadie está
									     haciendo es una mentira con spinner. -->
									{#if tipo.estado === 'activo'}
										<span
											data-testid="insignia-activo"
											class="flex h-5.5 w-14.75 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-700"
										>
											Activo
										</span>
									{:else if activandoId === tipo.id}
										<!-- El estado con spinner del diseño. Ahora es honesto: detrás hay
										     tres llamadas reales a Google (crear el procesador, inicializar
										     su dataset y subir el esquema), medidas en segundos. -->
										<Button size="sm" disabled data-testid="activando-tipo" class="h-9.5 shrink-0 gap-2">
											<LoaderCircle class="size-4 animate-spin" />
											Validando configuración...
										</Button>
									{:else}
										<Button
											size="sm"
											data-testid="activar-tipo"
											class="h-9.5 w-20.5 shrink-0"
											disabled={activandoId !== null}
											onclick={() => activar(tipo.id)}>Activar</Button
										>
									{/if}

									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											{#snippet child({ props })}
												<button
													{...props}
													type="button"
													data-testid="menu-tipo"
													aria-label="Más opciones de {tipo.nombre}"
													class="flex size-6 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted data-[state=open]:bg-muted"
												>
													<MoreVerticalIcon />
												</button>
											{/snippet}
										</DropdownMenu.Trigger>

										<!-- El menú es el frame `settings` (1077:65931): 259x208, con 12px
										     de padding y cuatro renglones de 235x46 pegados uno tras otro.
										     Los rótulos no están en el volcado —son instancias de
										     componente— así que salen de la captura que compartió el
										     usuario. -->
										<DropdownMenu.Content align="end" class="w-64.75 p-3">
											<!-- Tres de los cuatro renglones van DESHABILITADOS: abren pantallas
											     que no existen. "Historial de versiones" es un modal entero en el
											     archivo (1077:66342) que no se ha construido, y "Crear nueva
											     versión" y "Eventos" necesitan `config_version` y su bitácora, que
											     viven en el back. En el frame se ven activos; dejarlos así, vivos y
											     sin hacer nada, es peor mentira que atenuarlos. Se habilitan solos
											     el día que haya a dónde ir. Anotado en docs/pendientes-ux.md. -->
											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												disabled
											>
												<Plus class="size-4 text-muted-foreground" />
												<span>Crear nueva versión</span>
											</DropdownMenu.Item>

											<!-- El interruptor es el indicador del renglón, no un control
											     aparte: ver el porqué en dropdown-menu-switch-item.svelte.
											     `closeOnSelect={false}` deja el menú abierto para poder ver
											     el cambio. -->
											<DropdownMenu.SwitchItem
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												closeOnSelect={false}
												checked={tipo.ejemploDocumental}
												onCheckedChange={(v) => alternarEjemploDocumental(tipo.id, v)}
											>
												<UsersRound class="size-4 text-muted-foreground" />
												<span>Ejemplo documental</span>
											</DropdownMenu.SwitchItem>

											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												disabled
											>
												<Calendar class="size-4 text-muted-foreground" />
												<span>Historial de versiones</span>
											</DropdownMenu.Item>

											<DropdownMenu.Item
												class="h-11.5 gap-3 px-2 whitespace-nowrap"
												disabled
											>
												<Clock class="size-4 text-muted-foreground" />
												<span>Eventos</span>
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
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

		<!-- El contenedor con role="status" está SIEMPRE montado, aunque esté vacío:
		     una región `aria-live` que se monta junto con su texto no se anuncia —
		     el lector de pantalla tiene que estar observándola de antes. Por eso la
		     bandera controla la tarjeta de adentro y no este div. Vacío no mide
		     nada, así que no separa nada.

		     `pl-82.5` es el ancho del sidebar (la misma medida que su `w-82.5`), y
		     con el `mx-8` de la tarjeta el aviso queda alineado exactamente con el
		     título "Modelos documentales agregados". Sin ese padding el borde
		     izquierdo caía en tierra de nadie: ni con el título ni con el sidebar,
		     cruzando por debajo de la división en dos columnas. En el frame el
		     aviso va debajo del modal entero y ocupa unos dos tercios; aquí el
		     panel es de altura completa, así que se adapta al pie de la columna de
		     contenido — que además es donde está el modelo que se acaba de
		     agregar. Anotado en docs/pendientes-ux.md. -->
		<div role="status" aria-live="polite" class="pl-82.5">
			{#if avisoExito && vista === 'biblioteca'}
				<div
					data-testid="aviso-exito"
					class="mx-8 mb-8 flex items-start gap-3 rounded-lg border border-green-200 bg-linear-to-r from-green-50 to-emerald-100/70 px-5 py-4"
				>
					<BadgeCheck class="size-5 shrink-0 fill-green-500 text-white" />
					<div class="min-w-0">
						<p class="text-sm font-semibold text-green-700">Nuevo tipo documental agregado.</p>
						<!-- green-700 y no green-600: sobre `green-50`, el 600 a 12px da
						     ~3.1:1 de contraste y AA pide 4.5:1 para texto normal. El 700
						     llega a ~4.7:1 y además se parece más al verde apagado del
						     frame que el 600, que sale demasiado vivo. -->
						<p class="mt-1 max-w-2xl text-xs text-green-700">
							La configuración se completó con éxito. El modelo documental está listo para
							activarse y ejecutar una prueba de procesamiento para validar su funcionamiento.
						</p>
					</div>
				</div>
			{/if}
			{#if errorActivacion && vista === 'biblioteca'}
				<!-- Gemelo rojo del aviso de éxito: el frame trae un "Alert error"
				     (1077:65797, 684x94) junto al Success. Sin poder ver sus píxeles
				     (cuota de Figma), espeja el diseño del verde con la paleta roja.
				     El texto del cuerpo es el error real del back, no uno genérico:
				     "no se pudo" sin el porqué obliga a adivinar. -->
				<div
					data-testid="aviso-error"
					class="mx-8 mb-8 flex items-start gap-3 rounded-lg border border-red-200 bg-linear-to-r from-red-50 to-rose-100/70 px-5 py-4"
				>
					<BadgeAlert class="size-5 shrink-0 fill-red-500 text-white" />
					<div class="min-w-0">
						<p class="text-sm font-semibold text-red-700">No se pudo activar el modelo.</p>
						<p class="mt-1 max-w-2xl text-xs text-red-700">{errorActivacion}</p>
					</div>
				</div>
			{/if}
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
