<script lang="ts">
	/**
	 * Modal "Configuración de API Key" (capturas del 2026-09-23).
	 *
	 * Es el HERMANO de `ConfigSheet.svelte`: misma cáscara —encabezado con el
	 * nombre del módulo y su X, banda de título con ícono redondo, y abajo dos
	 * columnas (sidebar de 330px + panel de contenido)—, así que aquí se copia
	 * esa estructura al pie de la letra en vez de inventar una propia. Si esa
	 * cáscara cambia allá, este archivo tiene que seguirla.
	 *
	 * TRES vistas, las tres dibujadas: el estado vacío de entrada, el formulario
	 * de alta, y la pantalla del secret recién creado.
	 *
	 * LO QUE NO ES REAL TODAVÍA (a propósito, no es olvido):
	 *
	 *  1. El secret se genera EN EL NAVEGADOR y no lo reconoce nadie. `nexus_back`
	 *     no tiene concepto de API keys y la app no tiene autenticación; la única
	 *     llave real del sistema es `NEXUS_API_KEY`, variable de entorno del
	 *     servidor de SvelteKit que el navegador jamás ve (`$lib/server/nexus.ts`).
	 *     O sea: esto tiene FORMA de credencial y no autentica nada. El día que el
	 *     back maneje llaves de verdad se generan EN EL SERVIDOR y se guarda su
	 *     hash, nunca aquí — que no se herede esto por inercia.
	 *  2. Nada se persiste. El secret vive en memoria y se destruye al cerrar, que
	 *     es lo único que cumple la promesa impresa en la propia pantalla ("no
	 *     volveremos a mostrarlo después de cerrar esta vista"): guardarlo en
	 *     localStorage la rompería en la primera reapertura.
	 *  3. El renglón "API Keys" del sidebar no navega y no hay listado: es la única
	 *     sección que hay. La flecha va de adorno, como en el diseño.
	 */
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ArchiveIcon from '$lib/components/icons/ArchiveIcon.svelte';
	import ArrowRightIcon from '$lib/components/icons/ArrowRightIcon.svelte';
	import EmptyState from '$lib/components/home/EmptyState.svelte';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Ban from '@lucide/svelte/icons/ban';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import { PREFIJO } from '$lib/apiKeys/formato';
	import {
		apiKeys,
		emitirApiKey,
		revocarApiKey,
		estadoDe,
		estadoApiKeys,
		reconocerFallaDeGuardado,
		type ApiKeyGuardada
	} from '$lib/state/apiKeys.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	/** La vista de entrada es el LISTADO, que por dentro decide si muestra las
	 *  tarjetas o el estado vacío — son la misma pantalla con y sin llaves. */
	let vista = $state<'lista' | 'nueva' | 'creada'>('lista');

	// El borrador del alta. NO se limpia al cerrar el modal —igual que el
	// borrador del Modulo de configuración—: quien cerró por accidente a media
	// captura no debería perder lo escrito. Se limpia al cancelar, que sí es una
	// decisión explícita. OJO: el secret es la EXCEPCIÓN a esta política, ver el
	// `$effect` de cierre allá abajo.
	let nombre = $state('');
	let descripcion = $state('');

	/** Las cuatro opciones del desplegable abierto (captura del 2026-09-23). No
	 *  hay "sin expiración", lo que encaja con el rótulo de abajo: siempre hay
	 *  una fecha de vencimiento que mostrar. */
	const EXPIRACIONES = [
		{ value: '1', label: '1 día' },
		{ value: '7', label: '7 días' },
		{ value: '30', label: '30 días' },
		{ value: '90', label: '90 días' }
	];
	let expiracion = $state('1');

	const etiquetaExpiracion = $derived(
		EXPIRACIONES.find((e) => e.value === expiracion)?.label ?? EXPIRACIONES[0].label
	);

	/** La fecha del rótulo se CALCULA a partir de hoy y de la opción elegida. En
	 *  la captura dice "20 de agosto de 2026", que es la fecha en que se dibujó
	 *  la pantalla; dejarla fija mostraría una expiración ya vencida. */
	const fechaExpiracion = $derived(
		new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(
			new Date(Date.now() + Number(expiracion) * 24 * 60 * 60 * 1000)
		)
	);

	/** Los tres campos llevan asterisco en el diseño, así que los tres son
	 *  obligatorios. `trim()` para que puros espacios no cuenten como llenos. */
	const formularioCompleto = $derived(nombre.trim() !== '' && descripcion.trim() !== '');

	// ---- El secret ----------------------------------------------------------

	let secret = $state('');
	let copiado = $state(false);
	let errorCopiado = $state('');
	let botonCopiar = $state<HTMLElement | null>(null);
	let nodoSecret = $state<HTMLElement | null>(null);

	/** Cuánto dura el "Copiado" antes de que el ícono vuelva a su forma normal. */
	const DURACION_COPIADO_MS = 2000;
	let temporizadorCopiado: ReturnType<typeof setTimeout> | null = null;

	function limpiarTemporizador() {
		if (temporizadorCopiado !== null) {
			clearTimeout(temporizadorCopiado);
			temporizadorCopiado = null;
		}
	}

	/** El formato de la llave NO vive aquí: lo define `$lib/apiKeys/formato`,
	 *  que es la especificación que `nexus_back` va a tener que reimplementar el
	 *  día que las valide. Esta pantalla solo la pide y la muestra. */
	function crearApiKey() {
		secret = emitirApiKey({
			nombre,
			descripcion,
			diasParaExpirar: Number(expiracion)
		}).secret;
		// Si no se pudo persistir, `emitirApiKey` ya prendió
		// `estadoApiKeys.falloAlGuardar` y el aviso del final del archivo lo dice.
		// El secret se muestra igual: existe, y quien lo pidió tiene derecho a verlo.
		// El borrador se limpia en cuanto la llave SE CREA. Si no, la siguiente
		// alta nace con el nombre y la descripción de la anterior — y ahí el
		// argumento de "no perder lo escrito" ya no aplica: lo escrito se usó.
		nombre = '';
		descripcion = '';
		expiracion = '1';
		copiado = false;
		errorCopiado = '';
		limpiarTemporizador();
		vista = 'creada';
	}

	/** Copiar, en tres escalones.
	 *
	 *  El repo tiene una regla escrita de NO poner botones de copiar (VistaJson,
	 *  el ID del procesador en ConfigSheet, docs/pendientes-ux.md) porque
	 *  `navigator.clipboard` es API de contexto seguro y el server de CSI sirve por
	 *  HTTP plano, donde no existe. Aquí el botón SÍ va, y es la excepción: en las
	 *  otras pantallas copiar es comodidad y el texto seleccionable alcanza; en
	 *  ésta el secret se muestra UNA vez, así que copiar es la función principal
	 *  de la pantalla. Lo que no se hace es llamar a `navigator.clipboard` a
	 *  secas: eso no haría nada en producción, sin error visible, justo donde
	 *  perderlo cuesta la llave.
	 *
	 *   1. `navigator.clipboard` cuando existe (HTTPS o localhost). El `?.` es
	 *      obligatorio y el `catch` también: puede RECHAZAR por permiso denegado o
	 *      por documento sin foco aunque la API esté ahí.
	 *   2. `execCommand` sobre una selección temporal, que sí corre en HTTP plano.
	 *      Está deprecado y DEVUELVE `false` en vez de lanzar, por eso se revisa el
	 *      booleano y no basta con el try.
	 *   3. Si los dos fallan se dice en la misma tarjeta, sin `alert()`. La caja es
	 *      siempre seleccionable, que es la red de seguridad heredada de VistaJson. */
	async function copiar() {
		let ok = false;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(secret);
				ok = true;
			}
		} catch {
			ok = false;
		}

		if (!ok) ok = copiarSeleccionandoElNodo();

		limpiarTemporizador();
		copiado = ok;
		errorCopiado = ok
			? ''
			: 'No se pudo copiar automáticamente. El secret quedó seleccionado: cópialo con Ctrl+C (Cmd+C en Mac).';
		if (ok) {
			temporizadorCopiado = setTimeout(() => {
				copiado = false;
				temporizadorCopiado = null;
			}, DURACION_COPIADO_MS);
		}
	}

	/** El plan B, que en producción es el ÚNICO camino.
	 *
	 *  NO crea un <textarea> aparte, que es el truco de manual: ese elemento
	 *  viviría fuera del Sheet, y el `FocusScope` de bits-ui (trampa de foco del
	 *  Dialog, prendida por default) escucha `focusin` en captura y DEVUELVE el
	 *  foco al instante. `select()` dispara ese `focusin` de forma síncrona, así
	 *  que para cuando corre `execCommand` la selección del documento ya está
	 *  vacía y copiar devuelve `false`. Medido en Chrome real, no deducido.
	 *
	 *  En vez de eso se selecciona el <code> que YA está dentro del panel, con un
	 *  `Range`: `execCommand` opera sobre la selección del documento y no
	 *  necesita mover el foco, así que la trampa ni se entera. Apagar la trampa
	 *  (`trapFocus={false}`) arreglaría el síntoma rompiendo la accesibilidad del
	 *  modal, que es peor. */
	function copiarSeleccionandoElNodo(): boolean {
		const seleccion = window.getSelection();
		if (!nodoSecret || !seleccion) return false;

		const rango = document.createRange();
		rango.selectNodeContents(nodoSecret);
		seleccion.removeAllRanges();
		seleccion.addRange(rango);

		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}

		// Si copió, se suelta la selección (ya cumplió). Si NO copió, se DEJA
		// seleccionado a propósito: es lo que promete el aviso, y con eso Ctrl+C
		// basta — el atajo copia la selección del documento sin importar dónde
		// quedó el foco, así que también sirve a quien navega con teclado.
		if (ok) seleccion.removeAllRanges();
		return ok;
	}

	/** Ir al alta. Se limpia lo que haya quedado de una vuelta anterior para que
	 *  el formulario no herede el aviso de copiado ni un secret viejo. */
	function irANueva() {
		avisoRevocada = false;
		vista = 'nueva';
	}

	/** `12/08/2026 · 12:45`. Las fechas se guardan en ISO/UTC y se muestran en la
	 *  hora local de quien mira, que es lo que espera cualquiera leyendo una
	 *  pantalla. */
	function fechaHora(iso: string): string {
		const f = new Date(iso);
		if (Number.isNaN(f.getTime())) return '—';
		const dia = String(f.getDate()).padStart(2, '0');
		const mes = String(f.getMonth() + 1).padStart(2, '0');
		const hh = String(f.getHours()).padStart(2, '0');
		const mm = String(f.getMinutes()).padStart(2, '0');
		return `${dia}/${mes}/${f.getFullYear()} · ${hh}:${mm}`;
	}

	function fecha(iso: string): string {
		return fechaHora(iso).split(' · ')[0];
	}

	/** El renglón chico de cada tarjeta, que cambia con el estado.
	 *
	 *  OJO con el caso revocada: el diseño dice "Último uso: <fecha>" y aquí dice
	 *  "Revocada el:". No es un descuido — no existe telemetría de uso: ninguna
	 *  llave se ha usado nunca porque `nexus_back` no las conoce, así que un
	 *  "último uso" sería una fecha inventada en la pantalla donde menos se puede
	 *  inventar. La fecha de revocación sí es un hecho que tenemos. Cuando el back
	 *  registre uso, esto vuelve al texto del diseño. */
	function leyendaDe(llave: ApiKeyGuardada): string {
		const estado = estadoDe(llave);
		if (estado === 'revocada') return `Revocada el: ${fecha(llave.revocadaEn ?? '')}`;
		if (estado === 'expirada') return `Expiró el: ${fecha(llave.expiraEn)}`;
		const dias = Math.ceil((Date.parse(llave.expiraEn) - Date.now()) / (24 * 60 * 60 * 1000));
		return `Expira en: ${dias} ${dias === 1 ? 'día' : 'días'}`;
	}

	const ETIQUETA_ESTADO = {
		activa: { texto: 'Activa', clase: 'bg-green-50 text-green-700' },
		expirada: { texto: 'Expirada', clase: 'bg-muted text-muted-foreground' },
		revocada: { texto: 'Revocada', clase: 'bg-red-50 text-red-700' }
	};

	/** La rama seleccionada en el árbol del sidebar. Es un FILTRO de la columna
	 *  derecha, no una navegación: `null` significa "muéstralas todas". */
	let seleccionadaId = $state<string | null>(null);

	const llavesVisibles = $derived(
		seleccionadaId === null ? apiKeys : apiKeys.filter((k) => k.id === seleccionadaId)
	);

	/** Se prende al revocar con éxito y se apaga al salir del listado o cerrar,
	 *  igual que el aviso de alta de la Biblioteca. No se auto-oculta con un
	 *  temporizador: quien revocó algo irreversible merece leerlo a su ritmo. */
	let avisoRevocada = $state(false);

	/** La llave que el menú `⋮` quiere revocar, esperando confirmación. */
	let llaveARevocar = $state<ApiKeyGuardada | null>(null);

	function cancelar() {
		nombre = '';
		descripcion = '';
		expiracion = '1';
		vista = 'lista';
	}

	/** "Listo" REGRESA AL LISTADO, y de paso destruye el secret.
	 *
	 *  Hasta que existió el listado (2026-09-24) esto cerraba el módulo entero, y
	 *  tenía sentido: la vista de entrada era el estado vacío, que dice "Configura
	 *  tu primera API Key" — mostrarlo tres segundos después de "creada
	 *  correctamente" era la app contradiciéndose sola. Ahora la entrada es la
	 *  lista, donde la llave recién creada aparece como Activa, así que volver ahí
	 *  confirma lo que acaba de pasar en vez de negarlo.
	 *
	 *  El secret se limpia aquí y no solo al cerrar: si se quedara en memoria,
	 *  entrar otra vez al alta y cancelar podría devolver la vista con la llave
	 *  anterior en pantalla. */
	function listo() {
		secret = '';
		copiado = false;
		errorCopiado = '';
		limpiarTemporizador();
		vista = 'lista';
	}

	/** El "Cerrar" del pie del listado. Es la única salida que cierra el módulo
	 *  además de la X, y no destruye nada que no destruya ya el cierre. */
	function cerrar() {
		open = false;
	}

	/** Al cerrar, el secret SE DESTRUYE y la vista vuelve al principio. Es la
	 *  excepción a la política de arriba (el borrador de nombre/descripción sí
	 *  sobrevive): sin esto, cerrar con la X y reabrir mostraría otra vez el mismo
	 *  secret, y el párrafo que el propio diseño manda imprimir —"no volveremos a
	 *  mostrarlo después de cerrar esta vista"— sería falso desde el primer día.
	 *  Mismo patrón que el `$effect` de cierre de ConfigSheet. */
	$effect(() => {
		if (open) return;
		vista = 'lista';
		secret = '';
		copiado = false;
		errorCopiado = '';
		avisoRevocada = false;
		limpiarTemporizador();
	});

	/** El botón que se venía usando ("Crear API Key") se desmonta al cambiar de
	 *  vista, y con él se va el foco. Sin esto, quien navega con teclado o con
	 *  lector de pantalla no se entera de que apareció un secret. */
	$effect(() => {
		if (vista === 'creada') botonCopiar?.focus();
	});
</script>

<!-- Los dos avisos verdes del módulo (capturas del 2026-09-24) son el MISMO
     bloque con otro texto, así que va una sola vez. El estilo no se inventó:
     es el del "Nuevo tipo documental agregado." del módulo hermano — borde y
     degradado verdes, `BadgeCheck` relleno, y `green-700` para el texto porque
     el 600 sobre `green-50` da ~3.1:1 y AA pide 4.5:1 (la nota completa está
     allá).

     OJO con lo que prometen los dos textos, que son literales de las capturas:
     hablan de "solicitudes autenticadas en NexusDoc", y hoy ninguna llave
     autentica nada porque `nexus_back` no las conoce. Se deja el copy del
     diseño a pedido explícito ("eventualmente lo hará"). -->
{#snippet avisoVerde(testid: string, titulo: string, cuerpo: string)}
	<div
		data-testid={testid}
		class="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-linear-to-r from-green-50 to-emerald-100/70 px-5 py-4"
	>
		<BadgeCheck class="size-5 shrink-0 fill-green-500 text-white" />
		<div class="min-w-0">
			<p class="text-sm font-semibold text-green-700">{titulo}</p>
			<p class="mt-1 max-w-2xl text-xs text-green-700">{cuerpo}</p>
		</div>
	</div>
{/snippet}

<Sheet.Root bind:open>
	<!-- Mismo ancho que el Modulo de configuración: la cáscara es la misma y dos
	     módulos hermanos que abren a distinto tamaño se sienten como dos apps.
	     Con el secret en pantalla, Escape y el clic fuera se IGNORAN: por default
	     bits-ui cierra con los dos, y aquí cerrar destruye el secret para siempre
	     (ver el `$effect` de cierre). Quedan la X y "Listo", que son salidas
	     deliberadas. -->
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-api-key"
		escapeKeydownBehavior={vista === 'creada' ? 'ignore' : 'close'}
		interactOutsideBehavior={vista === 'creada' ? 'ignore' : 'close'}
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<!-- header . navigation -->
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Configuración de API Key
			</Sheet.Title>
			<!-- La X cierra el módulo completo, desde cualquiera de las tres vistas. A
			     diferencia de ConfigSheet no sube de nivel: el camino de vuelta al
			     estado vacío es "Cancelar configuración", que además limpia lo
			     capturado; la X deja el borrador en pie (pero NO el secret). -->
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
			     configuración. Es el mismo en las tres vistas: así lo dibujan las tres
			     capturas. -->
			<aside
				class="flex w-82.5 shrink-0 flex-col overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
			>
				<p class="text-xs text-foreground">Configuración</p>
				<!-- La tarjeta de la sección, con la misma forma que "Biblioteca" allá
				     (ícono en cuadro redondeado + título + descripción + flecha). Va como
				     <div> y no como <button> porque hoy no navega a ningún lado: un botón
				     que no hace nada promete algo que no cumple. -->
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

				<!-- El árbol de llaves, con la misma geometría que el de la Biblioteca en
				     el módulo hermano: el eje cae en x=44 —que es donde empieza el texto
				     "API Keys" de arriba (ícono de 32 + gap-3 de 12)—, tramo vertical de
				     22px centrado en la fila y guion horizontal de 11.5px a media altura.
				     Picar una rama FILTRA la columna derecha; picarla de nuevo quita el
				     filtro. Es el mismo gesto que allá, y la captura muestra justamente la
				     rama resaltada. -->
				{#if apiKeys.length > 0}
					<ul class="mt-4">
						{#each apiKeys as llave (llave.id)}
							<li class="relative flex h-9.5 items-center pl-11">
								<span class="absolute top-1/2 left-11 h-5.5 w-px -translate-y-1/2 bg-border"
								></span>
								<span class="absolute top-1/2 left-11 h-px w-[11.5px] bg-border"></span>
								<button
									type="button"
									data-testid="rama-api-key"
									aria-pressed={seleccionadaId === llave.id}
									class="ml-[19.5px] min-w-0 flex-1 truncate rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors {seleccionadaId ===
									llave.id
										? 'bg-muted text-foreground'
										: 'text-foreground hover:text-primary'}"
									onclick={() =>
									(seleccionadaId = seleccionadaId === llave.id ? null : llave.id)}
								>
									{llave.nombre}
								</button>
							</li>
						{/each}
					</ul>

					<!-- Al PIE del sidebar, como en la captura. Solo con llaves ya
					     emitidas: en el estado vacío el acceso es el botón del centro, que
					     es lo que dibuja su propia captura, y dos botones para lo mismo en
					     la misma pantalla se leen como dos cosas distintas. -->
					{#if vista === 'lista'}
						<Button class="mt-auto w-full" data-testid="nueva-api-key-sidebar" onclick={irANueva}>
							Nueva API Key
						</Button>
					{/if}
				{/if}
			</aside>

			<!-- El pie vive DENTRO de esta columna, no debajo del modal entero: en las
			     capturas su línea divisoria arranca donde termina el sidebar. -->
			<div class="flex min-h-0 flex-1 flex-col">
				<div class="flex-1 overflow-y-auto p-8">
					<!-- Los avisos del módulo. Son dos y comparten bloque (ver el snippet
					     `avisoVerde` arriba): "API creada" en la vista del secret, y "API Key
					     revocada" de vuelta en el listado.

					     Van ARRIBA del contenido, no debajo: confirman lo que acabas de hacer,
					     y lo que sigue —copiar la llave, o revisar el listado— es la acción
					     pendiente. Un aviso al pie se lee cuando ya te ibas.

					     El contenedor con `aria-live` va SIEMPRE montado y la bandera controla
					     la tarjeta de adentro: una región que se monta junto con su texto no se
					     anuncia, el lector tiene que estar observándola de antes. Vacío no mide
					     nada, así que no separa nada cuando no hay aviso. -->
					<div role="status" aria-live="polite">
						{#if vista === 'creada'}
							{@render avisoVerde(
								'aviso-api-creada',
								'API creada correctamente',
								'La credencial se generó correctamente y ya está disponible para realizar solicitudes autenticadas en NexusDoc.'
							)}
						{:else if avisoRevocada}
							{@render avisoVerde(
								'aviso-api-revocada',
								'API Key revocada correctamente',
								'La credencial fue invalidada de inmediato y ya no podrá utilizarse para realizar nuevas solicitudes autenticadas en NexusDoc.'
							)}
						{/if}
					</div>

					{#if vista === 'lista'}
						{#if apiKeys.length > 0}
							<!-- Una tarjeta por llave (captura del 2026-09-24). El renglón chico
							     dice `nxdoc | <creación>` y, tras el ícono de calendario, lo que
							     corresponda a su estado — ver `leyendaDe`. -->
							<div class="flex flex-col gap-3">
								{#each llavesVisibles as llave (llave.id)}
									{@const estado = estadoDe(llave)}
									<div
										data-testid="tarjeta-api-key"
										class="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
									>
										<span
											class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground"
										>
											<KeyRound class="size-4" />
										</span>
										<div class="min-w-0 flex-1">
											<p class="truncate text-base font-medium text-foreground">{llave.nombre}</p>
											<p class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
												<span class="truncate">{PREFIJO} | {fechaHora(llave.creadaEn)}</span>
												<CalendarDays class="size-3.5 shrink-0" aria-hidden="true" />
												<span class="truncate">{leyendaDe(llave)}</span>
											</p>
										</div>
										<span
											data-testid="chip-estado-api-key"
											class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium {ETIQUETA_ESTADO[estado].clase}"
										>
											{ETIQUETA_ESTADO[estado].texto}
										</span>
										<DropdownMenu.Root>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														type="button"
														aria-label="Más opciones de {llave.nombre}"
														class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted data-[state=open]:bg-muted"
													>
														<MoreVerticalIcon />
													</button>
												{/snippet}
											</DropdownMenu.Trigger>
											<!-- Los dos renglones de la captura del 2026-09-24. Mismo
											     formato que el menú `⋮` del módulo hermano: renglón de
											     46px, ícono de 16 en gris y rótulo. -->
											<DropdownMenu.Content align="end" class="w-56 p-3">
												<!-- "Métricas" NO tiene a dónde ir todavía: no existe la
												     pantalla, y sobre todo no existe el dato — ninguna llave
												     se ha usado nunca porque `nexus_back` no las conoce, que
												     es la misma razón por la que el renglón de una llave
												     revocada no dice "Último uso". Se deja SIN `onSelect`, no
												     con uno vacío, para que al leer el código sea obvio que
												     falta cablearlo — mismo criterio que "Generar prompt" en
												     la Biblioteca. -->
												<DropdownMenu.Item
													data-testid="metricas-api-key"
													class="h-11.5 gap-3 px-2 whitespace-nowrap"
												>
													<ChartLine class="size-4 text-muted-foreground" />
													<span>Métricas</span>
												</DropdownMenu.Item>
												<!-- Rojo porque es irreversible, y apagado cuando la llave ya
												     no está activa: revocar algo vencido o ya revocado no
												     cambia nada. El ícono es una aproximación — en la captura
												     no se alcanza a distinguir cuál es. -->
												<DropdownMenu.Item
													data-testid="revocar-api-key"
													disabled={estado !== 'activa'}
													class="h-11.5 gap-3 px-2 whitespace-nowrap text-destructive data-highlighted:text-destructive"
													onSelect={() => (llaveARevocar = llave)}
												>
													<Ban class="size-4" />
													<span>Revocar</span>
												</DropdownMenu.Item>
											</DropdownMenu.Content>
										</DropdownMenu.Root>
									</div>
								{/each}
							</div>
						{:else}
							<!-- Estado vacío. `EmptyState` es el mismo componente de los paneles
							     del Home —ícono en cuadro de 50px, título y descripción—, que es
							     justo la forma que dibuja la captura; lo único que no trae es el
							     botón, así que ese va aquí abajo. -->
							<div class="flex h-full flex-col items-center justify-center gap-6">
								<EmptyState
									icon={Puzzle}
									iconClass="text-primary"
									title="Configura tu primera API Key"
									description="Genera una clave de acceso para autenticar de forma segura las solicitudes e integraciones disponibles."
								/>
								<Button
									class="w-60"
									data-testid="nueva-api-key"
									onclick={irANueva}
								>
									Nueva API Key
								</Button>
							</div>
						{/if}
					{:else if vista === 'nueva'}
						<p class="text-sm text-muted-foreground">Configuración de nueva API Key</p>

						<div class="mt-4 rounded-xl border border-border p-6">
							<p class="text-sm text-muted-foreground">Completa la información requerida.</p>

							<!-- Nombre y Expiración comparten renglón; Descripción ocupa los dos,
							     como en la captura. Debajo de 640px se apilan: a ese ancho dos
							     columnas dejan el select sin aire para su etiqueta. -->
							<div class="mt-6 grid gap-6 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="nombre-api-key">Nombre API Key *</Label>
									<Input
										id="nombre-api-key"
										bind:value={nombre}
										placeholder="Ej. Integración producción"
									/>
								</div>

								<div class="space-y-2">
									<Label for="expiracion-api-key">Expiración *</Label>
									<Select.Root type="single" bind:value={expiracion}>
										<Select.Trigger id="expiracion-api-key" class="w-full">
											{etiquetaExpiracion}
										</Select.Trigger>
										<Select.Content>
											{#each EXPIRACIONES as e (e.value)}
												<Select.Item value={e.value} label={e.label} />
											{/each}
										</Select.Content>
									</Select.Root>
									<p class="text-xs text-muted-foreground" data-testid="fecha-expiracion">
										Esta clave expira el {fechaExpiracion}.
									</p>
								</div>

								<div class="space-y-2 sm:col-span-2">
									<Label for="descripcion-api-key">Descripción *</Label>
									<Textarea
										id="descripcion-api-key"
										bind:value={descripcion}
										rows={3}
										placeholder="Describe el propósito o uso de esta API Key"
									/>
								</div>
							</div>
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">Configuración de nueva API Key</p>

						<div class="mt-4 rounded-xl border border-border p-6">
							<h3 class="text-base font-medium text-foreground">API Key creada correctamente</h3>
							<p class="mt-2 text-sm text-muted-foreground">
								Guarda el secret en un lugar seguro. Por motivos de seguridad, no volveremos a
								mostrarlo después de cerrar esta vista.
							</p>

							<!-- `break-all` y `min-w-0`, nunca `truncate`: un secret cortado se
							     copia mal y no hay segunda oportunidad de verlo. `select-text`
							     siempre, pase lo que pase con el botón: es la red de seguridad. -->
							<div class="mt-6 flex items-center gap-3 rounded-lg border border-border px-4 py-3">
								<!-- Se queda como <code> plano, sin `tabindex`: cuando copiar falla,
								     el secret queda SELECCIONADO (ver `copiarSeleccionandoElNodo`) y
								     Ctrl+C copia la selección del documento sin importar dónde esté
								     el foco — así que quien usa teclado no necesita poder tabular
								     hasta aquí. Hacerlo enfocable exigiría un rol interactivo que un
								     <code> no tiene, y prometería una edición que no existe. -->
								<code
									bind:this={nodoSecret}
									data-testid="secret-api-key"
									class="min-w-0 flex-1 font-mono text-sm break-all text-foreground select-text"
								>{secret}</code>
								<Button
									bind:ref={botonCopiar}
									variant="ghost"
									size="icon"
									class="shrink-0 text-muted-foreground"
									data-testid="copiar-secret"
									onclick={copiar}
								>
									{#if copiado}
										<Check class="size-4" />
									{:else}
										<Copy class="size-4" />
									{/if}
									<span class="sr-only">Copiar secret</span>
								</Button>
							</div>

							<!-- El contenedor con `aria-live` va SIEMPRE montado, aunque esté
							     vacío: una región que se monta junto con su texto no se anuncia
							     —el lector tiene que estar observándola de antes—. Misma razón
							     que el aviso de éxito de ConfigSheet. Vacío no mide nada. -->
							<div
								role="status"
								aria-live="polite"
								data-testid="aviso-copiado"
								class="text-xs {errorCopiado ? 'text-destructive' : 'text-muted-foreground'}"
							>
								<!-- El margen va en el texto y no en el contenedor: el contenedor
								     está SIEMPRE montado, y con `mt-2` metía 8px de aire bajo el
								     secret aun estando vacío. -->
								{#if copiado}
									<p class="mt-2">Secret copiado al portapapeles.</p>
								{:else if errorCopiado}
									<p class="mt-2">{errorCopiado}</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				{#if vista === 'lista' && apiKeys.length > 0}
					<div class="flex items-center justify-end border-t border-border px-6 py-4">
						<Button data-testid="cerrar-api-keys" onclick={cerrar}>Cerrar</Button>
					</div>
				{:else if vista === 'nueva'}
					<!-- Los dos a la derecha, como en la captura. "Cancelar configuración"
					     con el mismo variant="link" rojo que ya usan Calibración y la
					     evaluación de prompts en el módulo hermano. -->
					<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
						<Button
							variant="link"
							class="h-auto p-0 text-destructive"
							data-testid="cancelar-api-key"
							onclick={cancelar}
						>
							Cancelar configuración
						</Button>
						<Button
							data-testid="crear-api-key"
							disabled={!formularioCompleto}
							onclick={crearApiKey}
						>
							Crear API Key
						</Button>
					</div>
				{:else if vista === 'creada'}
					<!-- Un solo botón, a la derecha: así lo trae la captura. -->
					<div class="flex items-center justify-end border-t border-border px-6 py-4">
						<Button data-testid="listo-api-key" onclick={listo}>Listo</Button>
					</div>
				{/if}
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>

<!-- Revocar es irreversible: una llave revocada no se puede volver a activar,
     porque su secret ya no existe en ningún lado. Va con `ConfirmarAccion`, que
     es el `AlertDialog` del proyecto — y NO con `confirm()` del navegador, que
     no se usa aquí. -->
<ConfirmarAccion
	abierto={llaveARevocar !== null}
	titulo="¿Revocar esta API Key?"
	mensaje={llaveARevocar
		? `"${llaveARevocar.nombre}" dejará de funcionar de inmediato y no se puede reactivar: su secret ya no existe. Si la necesitas otra vez, hay que crear una nueva.`
		: ''}
	etiquetaConfirmar="Revocar"
	onConfirmar={() => {
		// El aviso solo sale si la revocación se PERSISTIÓ. Si localStorage la
		// rechazó, `revocarApiKey` la deshace y salta el otro aviso, el de fallo:
		// decir "revocada correctamente" ahí sería la mentira más cara de esta
		// pantalla, porque la llave seguiría viva.
		if (llaveARevocar) avisoRevocada = revocarApiKey(llaveARevocar.id);
	}}
	onCerrar={() => (llaveARevocar = null)}
/>

<!-- El aviso de que localStorage no aceptó la escritura. Mismo componente y
     mismo criterio que en la Biblioteca: `soloAviso` porque el hecho ya ocurrió
     y no hay nada que cancelar. Aquí pesa más que allá — una llave que no se
     guardó no se puede recapturar, porque su secret se mostró una sola vez. -->
<ConfirmarAccion
	abierto={estadoApiKeys.falloAlGuardar}
	variante="destructivo"
	soloAviso
	titulo="No se pudo guardar en este navegador"
	mensaje="La API Key se generó, pero no quedó registrada en este navegador (almacenamiento lleno o bloqueado), así que no va a aparecer en el listado. Guarda el secret que tienes en pantalla antes de cerrar: no se vuelve a mostrar."
	etiquetaConfirmar="Entendido"
	onConfirmar={reconocerFallaDeGuardado}
	onCerrar={reconocerFallaDeGuardado}
/>
