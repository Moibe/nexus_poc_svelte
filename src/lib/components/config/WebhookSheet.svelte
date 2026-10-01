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
	 * PRIMERA ETAPA: todo vive en este navegador y todavía no se envía nada (ver
	 * el docstring de `$lib/state/webhooks.svelte`).
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
	import AvisoVerde from './AvisoVerde.svelte';
	import MetricasWebhook from './MetricasWebhook.svelte';
	import {
		webhooks,
		estadoWebhooks,
		EVENTOS_WEBHOOK,
		agregarWebhook,
		cambiarEstadoWebhook,
		eliminarWebhook,
		recargarWebhooks,
		reconocerFallaDeGuardado,
		validarUrlWebhook,
		etiquetaEventos,
		LARGO_MAXIMO_URL,
		type EventoWebhook,
		type WebhookGuardado
	} from '$lib/state/webhooks.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// Cada vez que se abre, la lista se pone al día con el disco: otra pestaña
	// pudo haber cambiado algo. `untrack` para que el efecto dependa SOLO de `open`.
	$effect(() => {
		if (open) untrack(() => recargarWebhooks());
	});

	/** La vista de entrada es el LISTADO, que por dentro decide si muestra las
	 *  tarjetas o el estado vacío. */
	let vista = $state<'lista' | 'nueva'>('lista');

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
	/** Un rechazo del alta que no es de forma (URL repetida, o no se guardó). */
	let errorAlta = $state('');

	const resultadoUrl = $derived(validarUrlWebhook(url));
	const formularioCompleto = $derived(resultadoUrl.ok && eventosElegidos.length > 0);
	const mensajeUrl = $derived(
		errorAlta !== '' ? errorAlta : urlTocada && !resultadoUrl.ok ? resultadoUrl.motivo : ''
	);

	function alternarEvento(valor: EventoWebhook, marcado: boolean) {
		eventosElegidos = marcado
			? [...eventosElegidos.filter((v) => v !== valor), valor]
			: eventosElegidos.filter((v) => v !== valor);
	}

	/** Lo que confirma el aviso verde: se prende al crear o eliminar y se apaga
	 *  al salir del listado o cerrar. No se auto-oculta con un temporizador: quien
	 *  hizo algo irreversible merece leerlo a su ritmo. */
	let aviso = $state<'creado' | 'eliminado' | null>(null);

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

	function crear() {
		urlTocada = true;
		eventosTocados = true;
		if (!formularioCompleto) return;
		const r = agregarWebhook({ url, eventos: eventosElegidos });
		if (!r.ok) {
			// "No se guardó" ya prendió su propio aviso: aquí solo quedan los rechazos
			// que el formulario puede explicar. Se queda en el formulario con lo
			// capturado; no se perdió nada.
			if (r.motivo !== 'guardado') errorAlta = r.mensaje;
			return;
		}
		cancelar();
		aviso = 'creado';
	}

	function alternarEstado(w: WebhookGuardado) {
		cambiarEstadoWebhook(w.id, w.estado === 'activo' ? 'inactivo' : 'activo');
	}

	/** Cerrar el módulo no borra el borrador, pero sí vuelve al listado y apaga
	 *  el aviso y las métricas abiertas. */
	$effect(() => {
		if (open) return;
		vista = 'lista';
		aviso = null;
		metricasDeId = null;
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
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<!-- header . navigation -->
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Configuración de webhook
			</Sheet.Title>
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
						{#if vista === 'lista' && aviso === 'creado'}
							<AvisoVerde
								testid="aviso-webhook-creado"
								titulo="Webhook registrado correctamente"
								cuerpo="El endpoint quedó guardado con los eventos que elegiste."
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
						{#if webhooks.length > 0}
							<div class="flex flex-col gap-3">
								{#each webhooks as w (w.id)}
									{@const estado = ETIQUETA_ESTADO[w.estado]}
									<div data-testid="tarjeta-webhook" class="rounded-xl border border-border px-4 py-3">
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
											<span
												data-testid="chip-estado-webhook"
												class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium {estado.clase}"
											>
												<span class="size-1.5 rounded-full {estado.punto}"></span>
												{estado.texto}
											</span>
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
													<!-- Rojo porque es irreversible: pide confirmación. -->
													<DropdownMenu.Item
														data-testid="eliminar-webhook"
														class="h-11.5 gap-3 px-2 whitespace-nowrap text-destructive data-highlighted:text-destructive"
														onSelect={() => (webhookAEliminar = w)}
													>
														<Trash2 class="size-4" />
														<span>Eliminar</span>
													</DropdownMenu.Item>
												</DropdownMenu.Content>
											</DropdownMenu.Root>
										</div>
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
					{:else}
						<p class="text-sm text-muted-foreground">Configuración de nuevo webhook</p>

						<div class="mt-4 rounded-xl border border-border p-6">
							<p class="text-sm text-muted-foreground">Completa la información requerida.</p>

							<div class="mt-6 space-y-6">
								<div class="space-y-2">
									<Label for="url-webhook">URL del endpoint *</Label>
									<Input
										id="url-webhook"
										bind:value={url}
										maxlength={LARGO_MAXIMO_URL}
										placeholder="https://servicios.empresa.com/api/v1/webhooks/documentos"
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

								<div class="space-y-2">
									<p class="text-sm font-medium text-foreground" id="titulo-eventos-webhook">
										Eventos de suscripción *
									</p>
									<p class="text-xs text-muted-foreground">
										Elige de qué quieres que NexusDoc te avise.
									</p>
									<!-- Desplegable con casillas, como el diseño. `closeOnSelect={false}`
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
													class="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-muted/40 data-[state=open]:[&>svg]:rotate-180"
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
						<Button data-testid="crear-webhook" disabled={!formularioCompleto} onclick={crear}>
							Crear webhook
						</Button>
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
		if (eliminarWebhook(objetivo.id)) aviso = 'eliminado';
	}}
	onCerrar={() => (webhookAEliminar = null)}
/>

<!-- El aviso de que el navegador no aceptó la escritura. Mismo componente y mismo
     criterio que en la Biblioteca: `soloAviso` porque el hecho ya ocurrió y no
     hay nada que cancelar. -->
<ConfirmarAccion
	abierto={estadoWebhooks.falloAlGuardar}
	variante="destructivo"
	soloAviso
	titulo="No se pudo guardar en este navegador"
	mensaje="El cambio no quedó guardado (almacenamiento lleno o bloqueado). Sigue como estaba. Inténtalo de nuevo; si persiste, libera espacio o revisa que el navegador permita guardar datos de este sitio."
	etiquetaConfirmar="Entendido"
	onConfirmar={reconocerFallaDeGuardado}
	onCerrar={reconocerFallaDeGuardado}
/>
