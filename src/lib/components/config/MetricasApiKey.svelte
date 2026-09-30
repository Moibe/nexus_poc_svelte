<script lang="ts">
	/**
	 * "Métricas de consumo" de UNA API Key, desplegado dentro de su tarjeta en
	 * el módulo API Key (capturas del 2026-09-30, tres frames: el aviso amarillo
	 * del límite, el estado vacío, y las cifras con su comparación).
	 *
	 * Todo viene del servidor (`cargarMetricas`): solicitudes, éxito, errores y
	 * latencia del periodo comparados con el periodo anterior de la misma
	 * duración, y el consumo de la semana contra el tope. El periodo se elige
	 * con un calendario de rango (bits-ui, ya en el proyecto); arranca en los
	 * últimos 30 días.
	 *
	 * El aviso amarillo sale desde el 80% del tope semanal —lo dice el propio
	 * servidor en `avisoDesde`— y muestra cuántas solicitudes quedan. Al 100%
	 * la API responde 429 a esa llave, y aquí se dice así.
	 */
	import { onMount } from 'svelte';
	import { Popover, RangeCalendar } from 'bits-ui';
	import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import EmptyState from '$lib/components/home/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cargarMetricas, type MetricasApiKey } from '$lib/state/apiKeys.svelte';

	let { id, nombre, onCerrar }: { id: string; nombre: string; onCerrar: () => void } = $props();

	const hoy = today(getLocalTimeZone());
	let rango = $state<DateRange>({ start: hoy.subtract({ days: 29 }), end: hoy });
	let calendarioAbierto = $state(false);

	let metricas = $state<MetricasApiKey | null>(null);
	let cargando = $state(false);
	let error = $state('');

	const iso = (d: CalendarDate) => d.toString();

	async function cargar() {
		if (!rango.start || !rango.end) return;
		cargando = true;
		error = '';
		try {
			metricas = await cargarMetricas(id, iso(rango.start as CalendarDate), iso(rango.end as CalendarDate));
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudieron traer las métricas.';
		} finally {
			cargando = false;
		}
	}

	onMount(cargar);

	/** Al elegir los dos extremos se cierra el calendario y se recarga. */
	function alCambiarRango(nuevo: DateRange) {
		rango = nuevo;
		if (nuevo.start && nuevo.end) {
			calendarioAbierto = false;
			void cargar();
		}
	}

	const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
	function etiquetaFecha(d: CalendarDate | undefined): string {
		if (!d) return '…';
		const mes = MESES[d.month - 1];
		return `${mes[0].toUpperCase()}${mes.slice(1)} ${String(d.day).padStart(2, '0')}, ${d.year}`;
	}

	const num = (n: number) => n.toLocaleString('es-MX');

	/**
	 * "▴ 12% vs. semana anterior". El servidor compara contra el periodo
	 * anterior de la MISMA duración; el rótulo dice "semana" solo cuando el
	 * periodo dura 7 días, que es lo que dibuja el diseño; si no, "periodo".
	 * Para el % de éxito se muestran puntos porcentuales (pp), como el diseño.
	 * Sin datos anteriores no se inventa una tendencia: se deja en blanco.
	 */
	const rotuloAnterior = $derived.by(() => {
		if (!rango.start || !rango.end) return 'periodo anterior';
		const dias = (rango.end as CalendarDate).compare(rango.start as CalendarDate) + 1;
		return dias === 7 ? 'semana anterior' : 'periodo anterior';
	});

	type Tendencia = { texto: string; buena: boolean } | null;
	function tendencia(actual: number | null, anterior: number | null, opciones: { pp?: boolean; menorEsMejor?: boolean } = {}): Tendencia {
		if (actual === null || anterior === null) return null;
		let delta: number;
		let texto: string;
		if (opciones.pp) {
			delta = actual - anterior;
			texto = `${Math.abs(delta).toFixed(1)} pp`;
		} else {
			if (anterior === 0) return null;
			delta = ((actual - anterior) / anterior) * 100;
			texto = `${Math.abs(Math.round(delta))}%`;
		}
		if (Math.abs(delta) < 0.05) return { texto: `sin cambio vs. ${rotuloAnterior}`, buena: true };
		const sube = delta > 0;
		return {
			texto: `${sube ? '▴' : '▾'} ${texto} vs. ${rotuloAnterior}`,
			buena: opciones.menorEsMejor ? !sube : sube
		};
	}

	const consumo = $derived(metricas?.limiteSemanal ?? null);
	const restantes = $derived(consumo ? Math.max(0, consumo.limite - consumo.consumo) : 0);
	const enAviso = $derived(consumo !== null && consumo.fraccion >= consumo.avisoDesde);
	const alTope = $derived(consumo !== null && consumo.consumo >= consumo.limite);
	const hayDatos = $derived(metricas !== null && metricas.actual.solicitudes > 0);
</script>

{#snippet cifra(rotulo: string, valor: string, t: Tendencia)}
	<div class="min-w-0">
		<p class="text-xs text-muted-foreground">{rotulo}</p>
		<p class="mt-0.5 text-base font-semibold text-foreground">{valor}</p>
		{#if t}
			<p class="mt-0.5 text-xs {t.buena ? 'text-green-600' : 'text-red-500'}">{t.texto}</p>
		{/if}
	</div>
{/snippet}

<div class="mt-3 flex flex-col gap-3" data-testid="metricas-api-key-panel">
	{#if enAviso && consumo}
		<!-- El aviso del límite, tal como lo dibuja la captura: borde y fondo
		     amarillos, ícono de alerta, el nombre de la llave y cuánto queda. -->
		<div
			data-testid="aviso-limite-api-key"
			class="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
		>
			<TriangleAlert class="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
			<div class="min-w-0 text-xs text-amber-800">
				<p class="text-sm font-medium">{nombre}</p>
				<p class="mt-1">
					{#if alTope}
						Alcanzó su límite de consumo semanal ({num(consumo.limite)} solicitudes). Las llamadas con
						esta llave se rechazan hasta que empiece la siguiente semana.
					{:else}
						Está al {Math.round(consumo.fraccion * 100)}% de su límite de consumo semanal. Quedan
						aproximadamente {num(restantes)} solicitudes antes de alcanzar el límite.
					{/if}
				</p>
			</div>
		</div>
	{/if}

	<div class="rounded-lg border border-border bg-background">
		<div class="flex items-start justify-between gap-4 px-4 py-3">
			<div class="min-w-0">
				<p class="text-sm font-medium text-foreground">Métricas de consumo</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Consulta el uso de tus APIs para monitorear solicitudes, respuestas y comportamiento
					durante un periodo determinado.
				</p>
			</div>

			<!-- El selector de periodo: el botón con el rango y el ícono de
			     calendario, como en la captura, que abre el calendario de rango. -->
			<Popover.Root bind:open={calendarioAbierto}>
				<Popover.Trigger
					data-testid="periodo-metricas"
					class="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
				>
					<span>{etiquetaFecha(rango.start as CalendarDate | undefined)}</span>
					<span class="text-muted-foreground">–</span>
					<span>{etiquetaFecha(rango.end as CalendarDate | undefined)}</span>
					<CalendarDays class="size-4 text-muted-foreground" aria-hidden="true" />
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content
						align="end"
						sideOffset={6}
						class="z-70 rounded-xl border border-border bg-popover p-4 shadow-lg"
					>
						<RangeCalendar.Root
							value={rango}
							onValueChange={alCambiarRango}
							maxValue={hoy}
							locale="es-MX"
							weekdayFormat="short"
							class="select-none"
						>
							{#snippet children({ months, weekdays })}
								<RangeCalendar.Header class="flex items-center justify-between pb-3">
									<RangeCalendar.PrevButton
										class="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
									>
										<ChevronLeft class="size-4" />
									</RangeCalendar.PrevButton>
									<RangeCalendar.Heading class="text-sm font-medium text-foreground" />
									<RangeCalendar.NextButton
										class="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
									>
										<ChevronRight class="size-4" />
									</RangeCalendar.NextButton>
								</RangeCalendar.Header>
								{#each months as month (month.value)}
									<RangeCalendar.Grid class="w-full border-collapse">
										<RangeCalendar.GridHead>
											<RangeCalendar.GridRow class="flex">
												{#each weekdays as day (day)}
													<RangeCalendar.HeadCell
														class="w-9 text-center text-xs font-normal text-muted-foreground"
													>
														{day.slice(0, 2)}
													</RangeCalendar.HeadCell>
												{/each}
											</RangeCalendar.GridRow>
										</RangeCalendar.GridHead>
										<RangeCalendar.GridBody>
											{#each month.weeks as weekDates (weekDates)}
												<RangeCalendar.GridRow class="flex">
													{#each weekDates as date (date)}
														<RangeCalendar.Cell {date} month={month.value} class="p-0">
															<RangeCalendar.Day
																class="flex size-9 items-center justify-center text-sm text-foreground hover:bg-muted data-disabled:opacity-30 data-outside-month:opacity-0 data-selected:bg-primary/15 data-selection-end:rounded-r-lg data-selection-end:bg-primary data-selection-end:text-primary-foreground data-selection-start:rounded-l-lg data-selection-start:bg-primary data-selection-start:text-primary-foreground data-today:font-semibold"
															/>
														</RangeCalendar.Cell>
													{/each}
												</RangeCalendar.GridRow>
											{/each}
										</RangeCalendar.GridBody>
									</RangeCalendar.Grid>
								{/each}
							{/snippet}
						</RangeCalendar.Root>
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		</div>

		<div class="border-t border-border px-4 py-4">
			{#if cargando && !metricas}
				<p class="text-sm text-muted-foreground" data-testid="metricas-cargando">Cargando métricas…</p>
			{:else if error}
				<div class="flex items-center justify-between gap-4 text-sm text-destructive" data-testid="metricas-error">
					<span>No se pudieron traer las métricas: {error}</span>
					<Button variant="outline" size="sm" onclick={cargar}>Reintentar</Button>
				</div>
			{:else if !hayDatos}
				<!-- El estado vacío de la captura: mismo `EmptyState` de los paneles
				     del Home, con el reloj. -->
				<div class="py-4" data-testid="metricas-vacias">
					<EmptyState
						icon={ClockBadgeIcon}
						title="No hay información disponible"
						description="No se han registrado solicitudes o actividad en tus APIs y endpoints durante el periodo seleccionado. Cuando haya actividad, aquí podrás consultar sus métricas de consumo."
					/>
				</div>
			{:else if metricas}
				{@const a = metricas.actual}
				{@const b = metricas.anterior}
				<!-- Las cinco cifras, en la misma rejilla de la captura: tres arriba,
				     dos abajo, la última con la barra del consumo semanal. -->
				<div class="grid gap-x-6 gap-y-5 sm:grid-cols-3" data-testid="metricas-cifras">
					{@render cifra('Vol. de solicitudes', num(a.solicitudes), tendencia(a.solicitudes, b.solicitudes))}
					{@render cifra(
						'% de Éxito',
						a.porcentajeExito === null ? '—' : `${a.porcentajeExito.toFixed(1)}%`,
						tendencia(a.porcentajeExito, b.porcentajeExito, { pp: true })
					)}
					{@render cifra('Errores', num(a.errores), tendencia(a.errores, b.errores, { menorEsMejor: true }))}
					{@render cifra(
						'Latencia P50 (Prom.)',
						a.latenciaP50Ms === null ? '—' : `${num(a.latenciaP50Ms)} ms`,
						tendencia(a.latenciaP50Ms, b.latenciaP50Ms, { menorEsMejor: true })
					)}
					{#if consumo}
						<div class="min-w-0 sm:col-span-2">
							<p class="text-xs text-muted-foreground">Consumo del límite semanal</p>
							<div class="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
								<div
									class="h-full rounded-full {alTope ? 'bg-red-500' : enAviso ? 'bg-amber-400' : 'bg-primary'}"
									style="width: {Math.min(100, consumo.fraccion * 100)}%"
								></div>
							</div>
							<p class="mt-1 text-xs text-muted-foreground">
								{Math.round(consumo.fraccion * 100)}% · {num(consumo.consumo)} de {num(consumo.limite)}
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="flex justify-end">
		<Button data-testid="cerrar-metricas" onclick={onCerrar}>Cerrar visualización</Button>
	</div>
</div>
