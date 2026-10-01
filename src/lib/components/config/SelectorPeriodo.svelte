<script lang="ts">
	/**
	 * El selector de periodo de "Métricas de consumo": un botón con el rango
	 * elegido y el ícono de calendario, que abre un calendario de RANGO (bits-ui,
	 * ya en el proyecto). Es el mismo en las métricas de las API Keys y de los
	 * Webhooks, por eso vive aparte.
	 *
	 * Al elegir los dos extremos el calendario se cierra y avisa con `onCambio`;
	 * quien lo use vuelve a pedir sus cifras. No deja elegir el futuro.
	 */
	import { Popover, RangeCalendar } from 'bits-ui';
	import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let {
		rango = $bindable(),
		onCambio
	}: {
		rango: DateRange;
		/** Se llama cuando el usuario completó un rango nuevo (inicio Y fin). */
		onCambio: () => void;
	} = $props();

	const hoy = today(getLocalTimeZone());
	let abierto = $state(false);

	const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
	function etiquetaFecha(d: CalendarDate | undefined): string {
		if (!d) return '…';
		const mes = MESES[d.month - 1];
		return `${mes[0].toUpperCase()}${mes.slice(1)} ${String(d.day).padStart(2, '0')}, ${d.year}`;
	}

	function alCambiar(nuevo: DateRange) {
		rango = nuevo;
		if (nuevo.start && nuevo.end) {
			abierto = false;
			onCambio();
		}
	}
</script>

<Popover.Root bind:open={abierto}>
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
				onValueChange={alCambiar}
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
