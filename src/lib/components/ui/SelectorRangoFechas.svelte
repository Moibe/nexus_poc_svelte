<script lang="ts">
	/**
	 * El campo «Fecha» de los filtros: un botón con el aspecto de los demás campos («Selecciona un rango de fechas» y el ícono de
	 * calendario) que abre un calendario de RANGO de DOS MESES lado a lado, cada uno con sus selectores de mes y de año y las
	 * flechas en los extremos, como el calendario del Figma (frame «calendar» de «Filtrar documentos»).
	 *
	 * `desde` y `hasta` son fechas locales (`Date`), o `null` si no hay tope. El rango no se guarda hasta que se eligen los dos
	 * extremos; no deja elegir el futuro. Al abrir, la vista arranca en el mes anterior y el actual (así «hoy» se ve).
	 */
	import { Popover, RangeCalendar } from 'bits-ui';
	import { CalendarDate, getLocalTimeZone, today, type DateValue } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		id,
		desde = $bindable(null),
		hasta = $bindable(null),
		testid
	}: { id: string; desde?: Date | null; hasta?: Date | null; testid: string } = $props();

	const hoy = today(getLocalTimeZone());
	let abierto = $state(false);
	/** El primer mes que se ve (el segundo es el siguiente). */
	let placeholder = $state<DateValue>(hoy.subtract({ months: 1 }));

	const aCalendario = (d: Date | null) => (d ? new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) : undefined);
	const aFecha = (d: { year: number; month: number; day: number } | undefined) => (d ? new Date(d.year, d.month - 1, d.day) : null);

	const rango = $derived<DateRange>({ start: aCalendario(desde), end: aCalendario(hasta) });

	const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
	const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
	const etiqueta = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
	const texto = $derived(desde && hasta ? `${etiqueta(desde)} – ${etiqueta(hasta)}` : '');

	const ANIOS = Array.from({ length: hoy.year - 2019 }, (_, i) => hoy.year - i);

	/** Pone la vista de modo que el mes `mes`/`anio` quede en la posición `posicion` (0 = izquierda, 1 = derecha). */
	function irA(mes: number, anio: number, posicion: number) {
		placeholder = new CalendarDate(anio, mes, 1).subtract({ months: posicion });
	}

	function alAbrir(valor: boolean) {
		abierto = valor;
		if (valor) placeholder = (rango.start ? aCalendario(desde)! : hoy).subtract({ months: rango.start ? 0 : 1 });
	}

	function alCambiar(nuevo: DateRange) {
		// Con un solo extremo elegido el rango no se guarda todavía: se espera al segundo clic.
		if (nuevo.start && nuevo.end) {
			desde = aFecha(nuevo.start);
			hasta = aFecha(nuevo.end);
			abierto = false;
		}
	}

	const claseSelector =
		'h-7 appearance-none rounded-md border border-border bg-card py-0 pr-6 pl-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';
</script>

<Popover.Root open={abierto} onOpenChange={alAbrir}>
	<Popover.Trigger
		{id}
		data-testid={testid}
		class="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
	>
		<span class="truncate {texto ? 'text-foreground' : 'text-muted-foreground'}">{texto || 'Selecciona un rango de fechas'}</span>
		<CalendarDays class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			align="start"
			sideOffset={6}
			data-testid="{testid}-calendario"
			class="z-70 rounded-xl border border-border bg-popover p-4 shadow-lg"
		>
			<RangeCalendar.Root
				value={rango}
				onValueChange={alCambiar}
				bind:placeholder
				numberOfMonths={2}
				maxValue={hoy}
				locale="es-MX"
				weekdayFormat="short"
				fixedWeeks
				class="select-none"
			>
				{#snippet children({ months, weekdays })}
					<div class="flex gap-6">
						{#each months as month, posicion (month.value.toString())}
							<div>
								<div class="flex items-center justify-between gap-2 pb-3">
									{#if posicion === 0}
										<RangeCalendar.PrevButton
											class="flex size-7 items-center justify-center rounded-md hover:bg-muted"
											aria-label="Mes anterior"
										>
											<ChevronLeft class="size-4" />
										</RangeCalendar.PrevButton>
									{:else}
										<span class="size-7"></span>
									{/if}
									<div class="flex items-center gap-1.5">
										<span class="relative">
											<select
												class={claseSelector}
												aria-label="Mes"
												data-testid="{testid}-mes-{posicion}"
												value={month.value.month}
												onchange={(e) => irA(Number(e.currentTarget.value), month.value.year, posicion)}
											>
												{#each MESES as nombre, i (nombre)}
													<option value={i + 1}>{nombre}</option>
												{/each}
											</select>
											<ChevronDown class="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-muted-foreground" />
										</span>
										<span class="relative">
											<select
												class={claseSelector}
												aria-label="Año"
												data-testid="{testid}-anio-{posicion}"
												value={month.value.year}
												onchange={(e) => irA(month.value.month, Number(e.currentTarget.value), posicion)}
											>
												{#each ANIOS as anio (anio)}
													<option value={anio}>{anio}</option>
												{/each}
											</select>
											<ChevronDown class="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-muted-foreground" />
										</span>
									</div>
									{#if posicion === months.length - 1}
										<RangeCalendar.NextButton
											class="flex size-7 items-center justify-center rounded-md hover:bg-muted"
											aria-label="Mes siguiente"
										>
											<ChevronRight class="size-4" />
										</RangeCalendar.NextButton>
									{:else}
										<span class="size-7"></span>
									{/if}
								</div>
								<RangeCalendar.Grid class="w-full border-collapse">
									<RangeCalendar.GridHead>
										<RangeCalendar.GridRow class="flex">
											{#each weekdays as day (day)}
												<RangeCalendar.HeadCell class="w-9 text-center text-xs font-normal text-muted-foreground capitalize">
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
							</div>
						{/each}
					</div>
				{/snippet}
			</RangeCalendar.Root>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
