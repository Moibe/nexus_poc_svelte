<script lang="ts">
	/**
	 * "Configuración de webhook": el módulo del menú del engrane donde se
	 * registran los endpoints a los que NexusDoc avisa cuando un documento
	 * termina de procesarse o es rechazado (capturas del 2026-09-30).
	 *
	 * Mismo lenguaje y misma cáscara que el módulo de API Keys: la ventana lateral,
	 * el sidebar con la tarjeta de la sección y el botón de alta al pie, y la
	 * columna de tarjetas. Lo que trae el diseño —el listado y el panel de
	 * métricas— sale de las capturas; el alta y el estado vacío NO tenían
	 * frame, y se armaron con el mismo vocabulario del módulo hermano.
	 *
	 * DESDE EL 2026-10-01 VIVEN EN EL SERVIDOR, y cada uno nace con un secret de
	 * firma que se muestra UNA vez, en la vista `creado` (captura de ese día).
	 * Los avisos de eventos se envían desde ese mismo día, solo a webhooks
	 * validados y activos: ver el docstring de `$lib/state/webhooks.svelte`.
	 *
	 * VALIDADO ANTES DE USARSE (2026-10-01, a pedido con dos capturas). Una
	 * tarjeta sin validar muestra solo su URL, sus eventos y "Validar conexión";
	 * el chip de estado y las opciones de Métricas y Desactivar aparecen cuando
	 * su endpoint ya respondió al aviso de prueba. DESVIACIÓN DEL DISEÑO, a
	 * propósito: la tarjeta sin validar conserva un `⋮` con solo "Eliminar". Sin
	 * él, un webhook que nunca valida —una URL mal escrita, o una de ejemplo— se
	 * quedaría atorado en el listado para siempre.
	 */
	import { untrack } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Check from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ConfirmarAccion } from '$lib/components/ui/confirmar/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ArchiveIcon from '$lib/components/icons/ArchiveIcon.svelte';
	import ArrowRightIcon from '$lib/components/icons/ArrowRightIcon.svelte';
	import MoreVerticalIcon from '$lib/components/icons/MoreVerticalIcon.svelte';
	import EmptyState from '$lib/components/home/EmptyState.svelte';
	import Webhook from '@lucide/svelte/icons/webhook';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Power from '@lucide/svelte/icons/power';
	import PowerOff from '@lucide/svelte/icons/power-off';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import AvisoVerde from './AvisoVerde.svelte';
	import MetricasWebhook from './MetricasWebhook.svelte';
	import SecretUnaVez from './SecretUnaVez.svelte';
	import {
		webhooks,
		estadoWebhooks,
		EVENTOS_WEBHOOK,
		registrarWebhook,
		cambiarEstadoWebhook,
		eliminarWebhook,
		validarWebhook,
		cargarWebhooks,
		reconocerError,
		validarUrlWebhook,
		etiquetaEventos,
		LARGO_MAXIMO_URL,
		type EventoWebhook,
		type WebhookGuardado
	} from '$lib/state/webhooks.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// El listado vive en el servidor (desde el 2026-10-01): se pide cada vez que
	// se abre el módulo, así lo que se hizo en otro navegador ya aparece como
	// está. `untrack` para que el efecto dependa SOLO de `open`.
	$effect(() => {
		if (open) untrack(() => void cargarWebhooks());
	});

	/** La vista de entrada es el LISTADO, que por dentro decide si muestra las
	 *  tarjetas o el estado vacío. `creado` es la del secret recién generado. */
	let vista = $state<'lista' | 'nueva' | 'creado'>('lista');

	// El borrador del alta NO se limpia al cerrar el módulo —igual que en las API
	// Keys y en el Modulo de configuración—: quien cerró por accidente a media
	// captura no debería perder lo escrito. Se limpia al cancelar y al crear.
	let url = $state('');
	// Arranca VACÍO, como el diseño ("Selecciona uno o más eventos"). Antes
	// venían todos marcados; con cuatro, y uno sin nada que lo dispare todavía,
	// eso suscribiría a cosas que nadie eligió.
	let eventosElegidos = $state<EventoWebhook[]>([]);
	/** Igual que `urlTocada`: el "elige al menos uno" sale después de abrir y
	 *  cerrar el menú sin elegir (o de intentar crear), no al llegar. */
	let eventosTocados = $state(false);
	/** El error de la URL se muestra cuando ya se tocó el campo (o se intentó
	 *  crear): si no, "No parece una URL" saldría a media escritura. */
	let urlTocada = $state(false);
	/** Un rechazo del alta que el formulario sabe explicar (URL repetida, o una
	 *  que el servidor no aceptó). */
	let errorAlta = $state('');
	/** Registrando en el servidor: "Crear webhook" se apaga y el módulo no se deja
	 *  cerrar, como en las API Keys. */
	let creando = $state(false);
	/** El secret recién generado, mientras se muestra (vista `creado`). Se
	 *  destruye con "Listo" y al cerrar. */
	let secret = $state('');

	const resultadoUrl = $derived(validarUrlWebhook(url));
	/** Lo que muestra el campo "Protocolo", que es de solo lectura. Sale de la
	 *  URL y no es fijo: `validarUrlWebhook` exige https:// pero deja http://
	 *  para localhost, y con esa URL de prueba un "HTTPS" fijo mentiría. */
	const protocolo = $derived(resultadoUrl.ok && resultadoUrl.url.startsWith('http:') ? 'HTTP' : 'HTTPS');
	const formularioCompleto = $derived(resultadoUrl.ok && eventosElegidos.length > 0);
	const mensajeUrl = $derived(
		errorAlta !== '' ? errorAlta : urlTocada && !resultadoUrl.ok ? resultadoUrl.motivo : ''
	);

	function alternarEvento(valor: EventoWebhook, marcado: boolean) {
		eventosElegidos = marcado
			? [...eventosElegidos.filter((v) => v !== valor), valor]
			: eventosElegidos.filter((v) => v !== valor);
	}

	/** Lo que confirma el aviso verde: se prende al validar o eliminar y se apaga
	 *  al salir del listado o cerrar. No se auto-oculta con un temporizador: quien
	 *  hizo algo merece leerlo a su ritmo. (El alta no lo usa: la confirma la
	 *  vista del secret, "Webhook creado correctamente".) */
	let aviso = $state<'validado' | 'eliminado' | null>(null);

	/** Por qué falló la última validación de cada webhook, para decirlo en SU
	 *  tarjeta y no en un aviso general: el motivo es de ese endpoint. Se borra al
	 *  reintentar y al cerrar el módulo. */
	let errorValidacion = $state<Record<string, string>>({});

	async function validar(w: WebhookGuardado) {
		aviso = null;
		delete errorValidacion[w.id];
		const r = await validarWebhook(w.id);
		if (r.ok) aviso = 'validado';
		else errorValidacion[w.id] = r.motivo;
	}

	/** El webhook con "Métricas" desplegadas dentro de su tarjeta. Uno a la vez. */
	let metricasDeId = $state<string | null>(null);

	/** El webhook que el menú `⋮` quiere eliminar, esperando confirmación. */
	let webhookAEliminar = $state<WebhookGuardado | null>(null);

	function irANueva() {
		aviso = null;
		errorAlta = '';
		vista = 'nueva';
	}

	function cancelar() {
		url = '';
		eventosElegidos = [];
		eventosTocados = false;
		urlTocada = false;
		errorAlta = '';
		vista = 'lista';
	}

	async function crear() {
		urlTocada = true;
		eventosTocados = true;
		if (!formularioCompleto || creando) return;
		creando = true;
		let r: Awaited<ReturnType<typeof registrarWebhook>>;
		try {
			r = await registrarWebhook({ url, eventos: eventosElegidos });
		} finally {
			creando = false;
		}
		if (!r.ok) {
			// Un rechazo que el formulario sabe explicar se muestra bajo la URL; lo
			// demás ya prendió el aviso general. Se queda en el formulario con lo
			// capturado: no se perdió nada.
			if (r.mensaje) errorAlta = r.mensaje;
			return;
		}
		// El borrador se limpia en cuanto el webhook SE CREA: lo escrito ya se usó,
		// y el siguiente alta no debe nacer con la URL del anterior.
		cancelar();
		// Mientras se registra el módulo no se deja cerrar. Si aun así se cerró
		// —desde fuera de este componente—, el secret NO se guarda en el estado:
		// sobreviviría al cierre y aparecería la próxima vez que alguien abra el
		// módulo. Mismo criterio que las API Keys.
		if (!open) {
			estadoWebhooks.error =
				'El webhook se registró, pero la ventana se cerró antes de mostrar su secret, que ya no se puede recuperar. Elimínalo desde el listado y vuelve a crearlo.';
			return;
		}
		secret = r.secret;
		vista = 'creado';
	}

	/** "Listo" regresa al listado —donde el recién creado aparece Activo— y de
	 *  paso destruye el secret: si se quedara en memoria, volver a esta vista lo
	 *  mostraría otra vez. */
	function listo() {
		secret = '';
		vista = 'lista';
	}

	function alternarEstado(w: WebhookGuardado) {
		void cambiarEstadoWebhook(w.id, w.estado === 'activo' ? 'inactivo' : 'activo');
	}

	/** Cerrar el módulo no borra el borrador, pero sí vuelve al listado, apaga
	 *  el aviso y las métricas abiertas, y DESTRUYE el secret: sin eso, cerrar con
	 *  la X y reabrir mostraría el mismo secret otra vez, y la pantalla promete no
	 *  volver a mostrarlo. */
	$effect(() => {
		if (open) return;
		vista = 'lista';
		secret = '';
		aviso = null;
		metricasDeId = null;
		errorValidacion = {};
	});

	const ETIQUETA_ESTADO = {
		activo: { texto: 'Activo', clase: 'bg-green-50 text-green-700', punto: 'bg-green-500' },
		inactivo: { texto: 'Inactivo', clase: 'bg-muted text-muted-foreground', punto: 'bg-muted-foreground/60' }
	};
</script>

<Sheet.Root bind:open>
	<!-- Mismo ancho que el Modulo de configuración y el de API Key: la cáscara es
	     la misma y tres módulos hermanos que abren a distinto tamaño se sienten
	     como tres apps. -->
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-webhooks"
		escapeKeydownBehavior={vista === 'creado' || creando ? 'ignore' : 'close'}
		interactOutsideBehavior={vista === 'creado' || creando ? 'ignore' : 'close'}
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<!-- header . navigation -->
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Configuración de webhook
			</Sheet.Title>
			<!-- Con el secret en pantalla, Escape y el clic fuera se IGNORAN (ver
			     `escapeKeydownBehavior`): cerrar lo destruye para siempre. Quedan la
			     X y "Listo", que son salidas deliberadas. Mientras se registra, ni
			     la X: el secret llegaría a una ventana cerrada. -->
			<Sheet.Close
				disabled={creando}
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
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
				<Webhook class="size-4" />
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="text-lg font-medium text-foreground">Integra un Webhook</h2>
				<!-- Literal de la captura, con su "que se utilizará". -->
				<Sheet.Description class="text-sm">
					Configura el endpoint de destino y los eventos que se utilizará para notificar cambios
					automáticamente.
				</Sheet.Description>
			</div>
		</div>

		<div class="flex min-h-0 flex-1">
			<!-- statusbar: 330px, fondo y bordes de 2px, igual que el de los otros dos
			     módulos. -->
			<aside
				class="flex w-82.5 shrink-0 flex-col overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
			>
				<p class="text-xs text-foreground">Configuración</p>
				<!-- La tarjeta de la sección, con la forma de "Biblioteca" y de "API Keys"
				     (ícono en cuadro redondeado + título + descripción + flecha). Va
				     como <div>: hoy no navega a ningún lado. A diferencia de las API
				     Keys, la captura no dibuja un árbol debajo: no hay ramas. -->
				<div class="mt-6 flex w-full items-center gap-3" data-testid="seccion-webhooks">
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
					>
						<ArchiveIcon />
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-foreground">Webhooks</p>
						<p class="mt-2 text-xs text-muted-foreground">
							Localiza tu listado de Webhooks configurados
						</p>
					</div>
					<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />
				</div>

				<!-- Al PIE del sidebar, como en la captura. Solo con webhooks ya
				     registrados: en el estado vacío el acceso es el botón del centro, y
				     dos botones para lo mismo en la misma pantalla se leen como dos
				     cosas distintas (mismo criterio que las API Keys). -->
				{#if vista === 'lista' && webhooks.length > 0}
					<Button class="mt-auto w-full" data-testid="nuevo-webhook-sidebar" onclick={irANueva}>
						Nuevo webhook
					</Button>
				{/if}
			</aside>

			<!-- El pie vive DENTRO de esta columna, no debajo del modal entero: en las
			     capturas su línea divisoria arranca donde termina el sidebar. -->
			<!-- `min-w-0` es obligatorio: esta columna es un hijo flexible del renglón con
			     el sidebar, y sin él (min-width: auto) crece al ancho de su contenido.
			     Con un texto largo sin espacios —una URL de 800 caracteres, o un
			     nombre de 100 sin cortes— la tarjeta medía miles de píxeles y se
			     salía de la ventana, por más `truncate` que llevara adentro. -->
			<div class="flex min-h-0 min-w-0 flex-1 flex-col">
				<div class="flex-1 overflow-y-auto p-8">
					<!-- El contenedor con `aria-live` va SIEMPRE montado y la bandera controla
					     la tarjeta de adentro: una región que se monta junto con su texto no
					     se anuncia. Vacío no mide nada. -->
					<div role="status" aria-live="polite">
						{#if vista === 'lista' && aviso === 'validado'}
							<AvisoVerde
								testid="aviso-webhook-validado"
								titulo="Conexión validada correctamente"
								cuerpo="El endpoint respondió al aviso de prueba firmado. Ya puedes administrar el webhook desde su menú."
							/>
						{:else if vista === 'lista' && aviso === 'eliminado'}
							<AvisoVerde
								testid="aviso-webhook-eliminado"
								titulo="Webhook eliminado correctamente"
								cuerpo="El endpoint ya no está en tu listado."
							/>
						{/if}
					</div>

					{#if vista === 'lista'}
						{#if estadoWebhooks.errorCarga}
							<div
								data-testid="error-listado-webhooks"
								class="mb-4 flex items-center justify-between gap-4 rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive"
							>
								<span>No se pudo traer el listado de webhooks: {estadoWebhooks.errorCarga}</span>
								<Button variant="outline" size="sm" onclick={() => void cargarWebhooks()}>Reintentar</Button>
							</div>
						{/if}
						<!-- Sin datos todavía (cargando, o la carga falló): ni tarjetas ni
						     estado vacío, porque "Configura tu primer Webhook" afirmaría que no
						     hay ninguno cuando no se sabe. -->
						{#if webhooks.length === 0 && (estadoWebhooks.cargando || estadoWebhooks.errorCarga)}
							{#if estadoWebhooks.cargando}
								<p class="text-sm text-muted-foreground" data-testid="cargando-webhooks">Cargando webhooks…</p>
							{/if}
						{:else if webhooks.length > 0}
							<div class="flex flex-col gap-3">
								{#each webhooks as w (w.id)}
									{@const estado = ETIQUETA_ESTADO[w.estado]}
									{@const validado = w.validadoEn !== null}
									{@const validando = estadoWebhooks.enVuelo.includes(w.id)}
									<div
										data-testid="tarjeta-webhook"
										data-validado={validado}
										class="rounded-xl border border-border px-4 py-3"
									>
										<div class="flex items-center gap-3">
											<span
												class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card {w.estado ===
												'activo'
													? 'text-foreground'
													: 'text-muted-foreground'}"
											>
												<Webhook class="size-4" />
											</span>
											<div class="min-w-0 flex-1">
												<!-- La URL va como TEXTO, nunca como enlace: es lo que escribió
												     alguien, y `title` para verla completa si se corta. -->
												<p
													class="truncate text-sm font-medium {w.estado === 'activo'
														? 'text-foreground'
														: 'text-muted-foreground'}"
													title={w.url}
												>
													{w.url}
												</p>
												<p class="mt-0.5 truncate text-xs text-muted-foreground">
													{etiquetaEventos(w)}
												</p>
											</div>
											<!-- El chip, solo ya validado: antes, ni activo ni inactivo dicen nada. -->
											{#if validado}
												<span
													data-testid="chip-estado-webhook"
													class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium {estado.clase}"
												>
													<span class="size-1.5 rounded-full {estado.punto}"></span>
													{estado.texto}
												</span>
											{/if}
											<DropdownMenu.Root>
												<DropdownMenu.Trigger>
													{#snippet child({ props })}
														<button
															{...props}
															type="button"
															aria-label="Más opciones de {w.url}"
															class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted data-[state=open]:bg-muted"
														>
															<MoreVerticalIcon />
														</button>
													{/snippet}
												</DropdownMenu.Trigger>
												<DropdownMenu.Content align="end" class="w-56 p-3">
													<!-- Sin validar, solo "Eliminar": ver el docstring. -->
													{#if validado}
														<DropdownMenu.Item
															data-testid="metricas-webhook"
															class="h-11.5 gap-3 px-2 whitespace-nowrap"
															onSelect={() => (metricasDeId = metricasDeId === w.id ? null : w.id)}
														>
															<ChartLine class="size-4 text-muted-foreground" />
															<span>Métricas</span>
														</DropdownMenu.Item>
														<DropdownMenu.Item
															data-testid="estado-webhook"
															disabled={estadoWebhooks.enVuelo.includes(w.id)}
															class="h-11.5 gap-3 px-2 whitespace-nowrap"
															onSelect={() => alternarEstado(w)}
														>
															{#if w.estado === 'activo'}
																<PowerOff class="size-4 text-muted-foreground" />
																<span>Desactivar</span>
															{:else}
																<Power class="size-4 text-muted-foreground" />
																<span>Activar</span>
															{/if}
														</DropdownMenu.Item>
													{/if}
													<!-- Rojo porque es irreversible: pide confirmación. -->
													<DropdownMenu.Item
														data-testid="eliminar-webhook"
														disabled={estadoWebhooks.enVuelo.includes(w.id)}
														class="h-11.5 gap-3 px-2 whitespace-nowrap text-destructive data-highlighted:text-destructive"
														onSelect={() => (webhookAEliminar = w)}
													>
														<Trash2 class="size-4" />
														<span>Eliminar</span>
													</DropdownMenu.Item>
												</DropdownMenu.Content>
											</DropdownMenu.Root>
										</div>
										{#if !validado}
											<!-- Abajo a la derecha, como en la captura. Mientras valida se
											     apaga: el servidor espera hasta 10 s la respuesta del
											     endpoint, y un segundo clic no adelanta nada. -->
											<div class="mt-3 flex flex-col items-end gap-1.5">
												<Button
													variant="outline"
													size="sm"
													data-testid="validar-webhook"
													disabled={validando}
													onclick={() => validar(w)}
												>
													{#if validando}
														<LoaderCircle class="size-4 animate-spin" />
														Validando…
													{:else}
														Validar conexión
													{/if}
												</Button>
												{#if errorValidacion[w.id]}
													<p role="alert" data-testid="error-validacion-webhook" class="text-right text-xs text-destructive">
														{errorValidacion[w.id]}
													</p>
												{/if}
											</div>
										{/if}
										{#if metricasDeId === w.id}
											<MetricasWebhook id={w.id} onCerrar={() => (metricasDeId = null)} />
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<!-- Estado vacío. Sin frame en el diseño: mismo `EmptyState` de los
							     paneles del Home y del módulo de API Keys, con el botón debajo. -->
							<div class="flex h-full flex-col items-center justify-center gap-6">
								<EmptyState
									icon={Webhook}
									iconClass="text-primary"
									title="Configura tu primer Webhook"
									description="Registra un endpoint para que NexusDoc te avise cuando un documento termine de procesarse o sea rechazado."
								/>
								<Button class="w-60" data-testid="nuevo-webhook" onclick={irANueva}>
									Nuevo webhook
								</Button>
							</div>
						{/if}
					{:else if vista === 'nueva'}
						<p class="text-sm text-muted-foreground">Configuración de nuevo webhook</p>

						<div class="mt-4 rounded-xl border border-border p-6">
							<p class="text-sm text-muted-foreground">Completa la información requerida.</p>

							<div class="mt-6 space-y-6">
								<div class="space-y-2">
									<Label for="url-webhook">URL de destino *</Label>
									<Input
										id="url-webhook"
										bind:value={url}
										maxlength={LARGO_MAXIMO_URL}
										placeholder="https://api.empresa.com/webhooks/nexusdoc"
										aria-invalid={mensajeUrl !== ''}
										aria-describedby="error-url-webhook"
										oninput={() => (errorAlta = '')}
										onblur={() => (urlTocada = true)}
									/>
									<!-- Siempre montado para que el lector de pantalla lo anuncie al
									     aparecer; vacío no mide nada. -->
									<p
										id="error-url-webhook"
										role="status"
										aria-live="polite"
										data-testid="error-url-webhook"
										class="text-xs text-destructive"
									>
										{mensajeUrl}
									</p>
								</div>

								<!-- La línea que separa a dónde se avisa de cómo y de qué, como en el
								     diseño. -->
								<div class="border-t border-border"></div>

								<!-- Protocolo y eventos lado a lado: la misma rejilla que el alta de
								     API Keys, que en pantallas angostas los apila. -->
								<div class="grid gap-6 sm:grid-cols-2">
									<div class="space-y-2">
										<Label for="protocolo-webhook">Protocolo *</Label>
										<!-- Solo lectura: no hay nada que elegir. Ver `protocolo`. -->
										<Input
											id="protocolo-webhook"
											data-testid="protocolo-webhook"
											readonly
											value={protocolo}
											class="cursor-default bg-muted font-medium"
										/>
									</div>

									<div class="space-y-2">
										<!-- Con el estilo de `Label` (leading-none) para que los dos campos de
										     la fila arranquen a la misma altura. No es un <label>: lo que
										     nombra es un botón, que ya lo cita con `aria-labelledby`. -->
										<p class="text-sm leading-none font-medium text-foreground" id="titulo-eventos-webhook">
											Eventos de suscripción *
										</p>
										<!-- Desplegable con casillas, como el diseño, con el mismo aspecto que
										     el selector de "Expiración" del alta de API Keys. `closeOnSelect={false}`
										     es lo que permite marcar varios sin que el menú se cierre en
										     cada clic. El disparador repite lo elegido: cerrado, el menú
										     tiene que seguir diciendo a qué estás suscrito. -->
										<DropdownMenu.Root
											onOpenChange={(abierto) => {
												if (!abierto) eventosTocados = true;
											}}
										>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														type="button"
														aria-labelledby="titulo-eventos-webhook"
														data-testid="desplegable-eventos-webhook"
														data-invalido={eventosTocados && eventosElegidos.length === 0}
														class="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[invalido=true]:border-destructive data-[invalido=true]:ring-3 data-[invalido=true]:ring-destructive/20 data-[state=open]:[&>svg]:rotate-180"
													>
														<span
															class="min-w-0 truncate {eventosElegidos.length === 0
																? 'text-muted-foreground'
																: 'text-foreground'}"
														>
															{eventosElegidos.length === 0
																? 'Selecciona uno o más eventos'
																: etiquetaEventos({ eventos: eventosElegidos })}
														</span>
														<ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform" />
													</button>
												{/snippet}
											</DropdownMenu.Trigger>
											<DropdownMenu.Content
												align="start"
												class="w-(--bits-dropdown-menu-anchor-width) p-2"
											>
												{#each EVENTOS_WEBHOOK as e (e.valor)}
													<DropdownMenu.CheckboxItem
														data-testid="evento-{e.valor}"
														closeOnSelect={false}
														class="h-11 gap-3 pr-3 pl-3 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden"
														checked={eventosElegidos.includes(e.valor)}
														onCheckedChange={(v) => alternarEvento(e.valor, v === true)}
														title={e.descripcion}
													>
														<!-- La casilla a la IZQUIERDA, como el diseño, en vez de la
														     palomita a la derecha que trae el componente (oculta
														     arriba). Es solo dibujo: el renglón entero ya es el
														     `menuitemcheckbox`, y una casilla real adentro sería un
														     control dentro de otro. Mismas clases que `Checkbox`. -->
														<span
															aria-hidden="true"
															class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors {eventosElegidos.includes(
																e.valor
															)
																? 'border-primary bg-primary text-primary-foreground'
																: 'border-input'}"
														>
															{#if eventosElegidos.includes(e.valor)}
																<Check class="size-3.5" />
															{/if}
														</span>
														{e.etiqueta}
													</DropdownMenu.CheckboxItem>
												{/each}
											</DropdownMenu.Content>
										</DropdownMenu.Root>
										{#if eventosTocados && eventosElegidos.length === 0}
											<p class="text-xs text-destructive" data-testid="error-eventos-webhook">
												Elige al menos un evento de suscripción.
											</p>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{:else}
						<!-- El secret recién generado (captura del 2026-10-01). El diseño titula
						     "Key creada correctamente", copiado de la pantalla de las API Keys;
						     aquí dice "Webhook", que es lo que se creó. Importa: este secret NO
						     es una API Key. La API Key la usa el cliente para LLAMAR a NexusDoc;
						     este secret lo usa NexusDoc para FIRMAR lo que le manda al cliente. -->
						<p class="text-sm text-muted-foreground">Configuración de nuevo webhook</p>
						<div class="mt-4 rounded-xl border border-border p-6" data-testid="webhook-creado">
							<h3 class="text-base font-medium text-foreground">Webhook creado correctamente</h3>
							<p class="mt-2 text-sm text-muted-foreground">
								Guarda el secret en un lugar seguro. Por motivos de seguridad, no volveremos a
								mostrarlo después de cerrar esta vista.
							</p>
							<SecretUnaVez {secret} testid="secret-webhook" />
						</div>
					{/if}
				</div>

				{#if vista === 'lista' && webhooks.length > 0}
					<div class="flex items-center justify-end border-t border-border px-6 py-4">
						<Button data-testid="cerrar-webhooks" onclick={() => (open = false)}>Cerrar</Button>
					</div>
				{:else if vista === 'nueva'}
					<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
						<Button
							variant="link"
							class="h-auto p-0 text-destructive"
							data-testid="cancelar-webhook"
							onclick={cancelar}
						>
							Cancelar configuración
						</Button>
						<Button data-testid="crear-webhook" disabled={!formularioCompleto || creando} onclick={crear}>
							Crear webhook
						</Button>
					</div>
				{:else if vista === 'creado'}
					<div class="flex items-center justify-end border-t border-border px-6 py-4">
						<Button data-testid="listo-webhook" onclick={listo}>Listo</Button>
					</div>
				{/if}
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>

<!-- Eliminar es irreversible: va con `ConfirmarAccion`, el `AlertDialog` del
     proyecto — y NO con `confirm()` del navegador. -->
<ConfirmarAccion
	abierto={webhookAEliminar !== null}
	titulo="¿Eliminar este webhook?"
	mensaje={webhookAEliminar
		? `"${webhookAEliminar.url}" dejará de recibir avisos y desaparecerá de tu listado. Esta acción no se puede deshacer.`
		: ''}
	etiquetaConfirmar="Eliminar"
	onConfirmar={() => {
		// Se limpia AQUÍ, no solo en `onCerrar`: confirmando, el diálogo no dispara
		// `onCerrar` (mismo motivo que en el módulo de API Keys).
		const objetivo = webhookAEliminar;
		webhookAEliminar = null;
		if (!objetivo) return;
		if (metricasDeId === objetivo.id) metricasDeId = null;
		void eliminarWebhook(objetivo.id).then((ok) => {
			if (ok) aviso = 'eliminado';
		});
	}}
	onCerrar={() => (webhookAEliminar = null)}
/>

<!-- Un alta, un cambio de estado o una baja que no salió como se pidió, dicho tal
     cual. Mismo aviso que el módulo de API Keys: `soloAviso` porque el hecho ya
     ocurrió y no hay nada que cancelar. -->
<ConfirmarAccion
	abierto={estadoWebhooks.error !== ''}
	variante="destructivo"
	soloAviso
	titulo="No se pudo completar"
	mensaje={estadoWebhooks.error}
	etiquetaConfirmar="Entendido"
	onConfirmar={reconocerError}
	onCerrar={reconocerError}
/>
