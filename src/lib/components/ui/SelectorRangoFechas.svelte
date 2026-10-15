<script lang="ts">
	/**
	 * El campo «Fecha» de los filtros: un botón con el aspecto de los demás campos («Selecciona un rango de fechas» y el ícono de
	 * calendario) que abre un calendario de RANGO. Mismo calendario que el de las métricas (`SelectorPeriodo`), pero sin su
	 * etiqueta fija ni su tope a «hoy» de ese módulo: aquí el rango puede quedar vacío y se limpia con «Limpiar filtros».
	 *
	 * `desde` y `hasta` son fechas locales (`Date`), o `null` si no hay tope. El rango no se guarda hasta que se eligen los dos
	 * extremos.
	 */
	import { Popover, RangeCalendar } from 'bits-ui';
	import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let {
		id,
		desde = $bindable(null),
		hasta = $bindable(null),
		testid
	}: { id: string; desde?: Date | null; hasta?: Date | null; testid: string } = $props();

	const hoy = today(getLocalTimeZone());
	let abierto = $state(false);

	const aCalendario = (d: Date | null) => (d ? new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) : undefined);
	const aFecha = (d: { year: number; month: number; day: number } | undefined) => (d ? new Date(d.year, d.month - 1, d.day) : null);

	const rango = $derived<DateRange>({ start: aCalendario(desde), end: aCalendario(hasta) });

	const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
	const etiqueta = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
	const texto = $derived(desde && hasta ? `${etiqueta(desde)} – ${etiqueta(hasta)}` : '');

	function alCambiar(nuevo: DateRange) {
		// Con un solo extremo elegido el rango no se guarda todavía: se espera al segundo clic.
		if (nuevo.start && nuevo.end) {
			desde = aFecha(nuevo.start);
			hasta = aFecha(nuevo.end);
			abierto = false;
		}
	}
</script>

<Popover.Root bind:open={abierto}>
	<Popover.Trigger
		{id}
		data-testid={testid}
		class="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
	>
		<span class="truncate {texto ? 'text-foreground' : 'text-muted-foreground'}">{texto || 'Selecciona un rango de fechas'}</span>
		<CalendarDays class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content align="start" sideOffset={6} class="z-70 rounded-xl border border-border bg-popover p-4 shadow-lg">
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
						<RangeCalendar.PrevButton class="flex size-8 items-center justify-center rounded-lg hover:bg-muted">
							<ChevronLeft class="size-4" />
						</RangeCalendar.PrevButton>
						<RangeCalendar.Heading class="text-sm font-medium text-foreground" />
						<RangeCalendar.NextButton class="flex size-8 items-center justify-center rounded-lg hover:bg-muted">
							<ChevronRight class="size-4" />
						</RangeCalendar.NextButton>
					</RangeCalendar.Header>
					{#each months as month (month.value)}
						<RangeCalendar.Grid class="w-full border-collapse">
							<RangeCalendar.GridHead>
								<RangeCalendar.GridRow class="flex">
									{#each weekdays as day (day)}
										<RangeCalendar.HeadCell class="w-9 text-center text-xs font-normal text-muted-foreground">
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
