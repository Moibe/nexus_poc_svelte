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
	import { getLocalTimeZone, today } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import EmptyState from '$lib/components/home/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SelectorPeriodo from './SelectorPeriodo.svelte';
	import { limitesDelPeriodo } from '$lib/metricas/periodo';
	import { rotuloAnterior, tendencia as calcularTendencia, type Tendencia } from '$lib/metricas/tendencia';
	import { cargarMetricas, type MetricasApiKey } from '$lib/state/apiKeys.svelte';

	let { id, nombre, onCerrar }: { id: string; nombre: string; onCerrar: () => void } = $props();

	const hoy = today(getLocalTimeZone());
	let rango = $state<DateRange>({ start: hoy.subtract({ days: 29 }), end: hoy });

	let metricas = $state<MetricasApiKey | null>(null);
	let cargando = $state(false);
	let error = $state('');

	async function cargar() {
		// El periodo viaja como instantes con la zona del navegador, no como
		// fechas: ver `$lib/metricas/periodo`.
		const limites = limitesDelPeriodo(rango);
		if (!limites) return;
		cargando = true;
		error = '';
		try {
			metricas = await cargarMetricas(id, limites.desde, limites.hasta);
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudieron traer las métricas.';
		} finally {
			cargando = false;
		}
	}

	onMount(cargar);

	const num = (n: number) => n.toLocaleString('es-MX');

	/** "▴ 12% vs. semana anterior": la lógica es compartida con los Webhooks
	 *  (`$lib/metricas/tendencia`); aquí solo se le pasa el rótulo del periodo. */
	const tendencia = (actual: number | null, anterior: number | null, opciones: { pp?: boolean; menorEsMejor?: boolean } = {}) =>
		calcularTendencia(actual, anterior, rotuloAnterior(rango), opciones);

	const consumo = $derived(metricas?.limiteSemanal ?? null);
	const restantes = $derived(consumo ? Math.max(0, consumo.limite - consumo.consumo) : 0);
	const enAviso = $derived(consumo !== null && consumo.fraccion >= consumo.avisoDesde);
	const alTope = $derived(consumo !== null && consumo.consumo >= consumo.limite);
	const hayDatos = $derived(metricas !== null && metricas.actual.solicitudes > 0);
</script>

{#snippet cifra(rotulo: string, valor: string, t: Tendencia, linea = false)}
	<div class="min-w-0 {linea ? 'sm:border-l sm:border-border sm:pl-6' : ''}">
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

			<!-- El selector de periodo: el botón con el rango y el calendario de rango,
			     como en la captura (componente compartido con los Webhooks). -->
			<SelectorPeriodo bind:rango onCambio={cargar} />
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
						tendencia(a.porcentajeExito, b.porcentajeExito, { pp: true }),
						true
					)}
					{@render cifra('Errores', num(a.errores), tendencia(a.errores, b.errores, { menorEsMejor: true }), true)}
					{@render cifra(
						'Latencia P50 (Prom.)',
						a.latenciaP50Ms === null ? '—' : `${num(a.latenciaP50Ms)} ms`,
						tendencia(a.latenciaP50Ms, b.latenciaP50Ms, { menorEsMejor: true })
					)}
					{#if consumo}
						<div class="min-w-0 sm:col-span-2 sm:border-l sm:border-border sm:pl-6">
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
