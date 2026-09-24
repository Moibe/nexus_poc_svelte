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

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let vista = $state<'vacio' | 'nueva' | 'creada'>('vacio');

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

	const ALFABETO = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

	/** Cadena aleatoria en base62.
	 *
	 *  `crypto.getRandomValues` SÍ existe en contexto inseguro: el veto escrito en
	 *  `bandeja.svelte.ts` y `configuracion.svelte.ts` es a `crypto.randomUUID` y a
	 *  `crypto.subtle`, que son las que NO están definidas en el server de CSI
	 *  (HTTP plano por IP) y tronaron la app el 2026-08-18. Aun así se verifica
	 *  antes de llamarla y hay plan B: este proyecto ya se quemó dos veces dando
	 *  por hecho que una API de `crypto` estaba ahí.
	 *
	 *  El rechazo de bytes >= 248 no es adorno: 256 % 62 = 8, así que con
	 *  `byte % 62` a secas las primeras ocho letras del alfabeto saldrían ~1.6%
	 *  más seguido que el resto. */
	function azar(largo: number): string {
		const hayCrypto =
			typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
		let salida = '';
		while (salida.length < largo) {
			// Se piden de más porque el rechazo descarta algunos bytes.
			const bytes = new Uint8Array((largo - salida.length) * 2);
			if (hayCrypto) crypto.getRandomValues(bytes);
			else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
			for (const b of bytes) {
				if (b >= 248) continue;
				salida += ALFABETO[b % 62];
				if (salida.length === largo) break;
			}
		}
		return salida;
	}

	/** La forma sale del ejemplo del diseño: `nxdoc_live_<4>_sk_<32>`. El dibujo
	 *  trae 31 caracteres en el último tramo; se usan 32, que es el número redondo
	 *  y lo que haría un proveedor real: un string dibujado no es una
	 *  especificación. */
	function generarSecret(): string {
		return `nxdoc_live_${azar(4)}_sk_${azar(32)}`;
	}

	function crearApiKey() {
		secret = generarSecret();
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

	function cancelar() {
		nombre = '';
		descripcion = '';
		expiracion = '1';
		vista = 'vacio';
	}

	/** "Listo" CIERRA el módulo, no regresa al estado vacío: ese estado dice
	 *  "Configura tu primera API Key", y mostrarlo tres segundos después de "API
	 *  Key creada correctamente" es la app contradiciéndose sola en la misma
	 *  pantalla. Cerrar no niega nada; y el listado donde iría a parar la llave
	 *  todavía no existe. */
	function listo() {
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
		vista = 'vacio';
		secret = '';
		copiado = false;
		errorCopiado = '';
		limpiarTemporizador();
	});

	/** El botón que se venía usando ("Crear API Key") se desmonta al cambiar de
	 *  vista, y con él se va el foco. Sin esto, quien navega con teclado o con
	 *  lector de pantalla no se entera de que apareció un secret. */
	$effect(() => {
		if (vista === 'creada') botonCopiar?.focus();
	});
</script>

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
				class="w-82.5 shrink-0 overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
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
			</aside>

			<!-- El pie vive DENTRO de esta columna, no debajo del modal entero: en las
			     capturas su línea divisoria arranca donde termina el sidebar. -->
			<div class="flex min-h-0 flex-1 flex-col">
				<div class="flex-1 overflow-y-auto p-8">
					{#if vista === 'vacio'}
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
								onclick={() => (vista = 'nueva')}
							>
								Nueva API Key
							</Button>
						</div>
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

				{#if vista === 'nueva'}
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
