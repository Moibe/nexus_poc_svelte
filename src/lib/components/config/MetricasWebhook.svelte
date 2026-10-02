<script lang="ts">
	/**
	 * "Métricas de consumo" de UN webhook, desplegado dentro de su tarjeta en el
	 * módulo de Webhooks (capturas del 2026-09-30: el panel sin periodo, y con las
	 * cifras y su comparación).
	 *
	 * Son las cifras de las ENTREGAS al endpoint del cliente: volumen, tasa de
	 * error y latencia (P50, P90 y P99), cada una comparada con el periodo
	 * anterior de la misma duración. El periodo se elige con el mismo calendario
	 * de rango que las API Keys y arranca en los últimos 30 días.
	 *
	 * Las cifras salen de las entregas reales (desde el 2026-10-01): cada intento
	 * de entrega, incluidos los reintentos, es una solicitud. Un webhook al que
	 * todavía no le ha tocado ningún aviso muestra el estado vacío.
	 */
	import { onMount } from 'svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import EmptyState from '$lib/components/home/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SelectorPeriodo from './SelectorPeriodo.svelte';
	import { limitesDelPeriodo } from '$lib/metricas/periodo';
	import { rotuloAnterior, tendencia as calcularTendencia, type Tendencia } from '$lib/metricas/tendencia';
	import { cargarMetricasWebhook, type MetricasWebhook } from '$lib/state/webhooks.svelte';

	let { id, onCerrar }: { id: string; onCerrar: () => void } = $props();

	const hoy = today(getLocalTimeZone());
	let rango = $state<DateRange>({ start: hoy.subtract({ days: 29 }), end: hoy });

	let metricas = $state<MetricasWebhook | null>(null);
	let cargando = $state(false);
	let error = $state('');

	/** Qué carga es la vigente: si el periodo cambia mientras una respuesta
	 *  viaja, la vieja no puede pisar a la nueva. */
	let turno = 0;

	async function cargar() {
		// El periodo viaja como instantes con la zona del navegador, no como
		// fechas: ver `$lib/metricas/periodo`.
		const limites = limitesDelPeriodo(rango);
		if (!limites) return;
		const mio = ++turno;
		cargando = true;
		error = '';
		try {
			const r = await cargarMetricasWebhook(id, limites.desde, limites.hasta);
			if (mio === turno) metricas = r;
		} catch (e) {
			if (mio === turno) error = e instanceof Error ? e.message : 'No se pudieron traer las métricas.';
		} finally {
			if (mio === turno) cargando = false;
		}
	}

	onMount(cargar);

	const num = (n: number) => n.toLocaleString('es-MX');
	const ms = (n: number | null) => (n === null ? '—' : `${num(n)} ms`);

	const tendencia = (actual: number | null, anterior: number | null, opciones: { pp?: boolean; menorEsMejor?: boolean } = {}) =>
		calcularTendencia(actual, anterior, rotuloAnterior(rango), opciones);

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

<div class="mt-3 flex flex-col gap-3" data-testid="metricas-webhook-panel">
	<div class="rounded-lg border border-border bg-background">
		<div class="flex items-start justify-between gap-4 px-4 py-3">
			<div class="min-w-0">
				<p class="text-sm font-medium text-foreground">Métricas de consumo</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Consulta el uso de tu endpoint para monitorear solicitudes, respuestas y comportamiento
					durante un periodo determinado.
				</p>
			</div>
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
				<div class="py-4" data-testid="metricas-vacias">
					<EmptyState
						icon={ClockBadgeIcon}
						title="No hay información disponible"
						description="No se han registrado envíos a tu endpoint durante el periodo seleccionado. Cuando haya actividad, aquí podrás consultar sus métricas de consumo."
					/>
				</div>
			{:else if metricas}
				{@const a = metricas.actual}
				{@const b = metricas.anterior}
				<!-- Las cinco cifras, en la rejilla de la captura: tres arriba y dos
				     abajo, con la línea vertical entre columnas. -->
				<div class="grid gap-x-6 gap-y-5 sm:grid-cols-3" data-testid="metricas-cifras">
					{@render cifra('Vol. de solicitudes', num(a.solicitudes), tendencia(a.solicitudes, b.solicitudes))}
					{@render cifra(
						'Tasa de error',
						a.tasaError === null ? '—' : `${a.tasaError.toFixed(1)}%`,
						tendencia(a.tasaError, b.tasaError, { pp: true, menorEsMejor: true }),
						true
					)}
					{@render cifra('P50', ms(a.p50Ms), tendencia(a.p50Ms, b.p50Ms, { menorEsMejor: true }), true)}
					{@render cifra('P90', ms(a.p90Ms), tendencia(a.p90Ms, b.p90Ms, { menorEsMejor: true }))}
					{@render cifra('P99', ms(a.p99Ms), tendencia(a.p99Ms, b.p99Ms, { menorEsMejor: true }), true)}
				</div>
			{/if}
		</div>
	</div>

	<div class="flex justify-end">
		<Button data-testid="cerrar-metricas" onclick={onCerrar}>Cerrar visualización</Button>
	</div>
</div>
