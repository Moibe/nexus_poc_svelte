<script lang="ts" generics="T extends string">
	/**
	 * Un desplegable de elección MÚLTIPLE con casillas, como los de «Filtrar documentos» del Figma (Estado y Canal): el botón dice
	 * lo elegido (o el marcador) y la lista lleva una casilla por opción y, si se pide, una insignia roja con un conteo
	 * (el «1» de Duplicado).
	 *
	 * Es un `Popover` y no un `Select`: el `Select` de bits-ui pinta la marca de elegido a la derecha y cierra la lista al
	 * elegir; aquí se eligen varias y la casilla va a la izquierda, como el diseño.
	 *
	 * La lista tiene un tope de alto (20 rem) y se desplaza por dentro (2026-11-03): los filtros del historial de ejecuciones
	 * (quitados el 2026-11-07 con esa pantalla) la alimentaban con las personas y los procesos de una organización, que pueden ser decenas, y
	 * otras listas largas (los tipos documentales de «Nuevo proceso») la siguen necesitando; sin tope, la lista salía de la pantalla. Con las pocas
	 * opciones de los demás filtros no cambia nada.
	 */
	import { Popover } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';

	let {
		id,
		marcador,
		opciones,
		valor = $bindable([]),
		conteos = {},
		compacto = false,
		alto = '',
		testid
	}: {
		id: string;
		marcador: string;
		opciones: { valor: T; etiqueta: string }[];
		valor?: T[];
		/** Insignia roja con el número, por opción. Solo sale si es mayor que 0. */
		conteos?: Partial<Record<T, number>>;
		/** Más bajo y con letra chica (h-9, la altura del buscador y de «Ordenar»), para una barra de filtros en vez de un formulario. */
		compacto?: boolean;
		/** Alto y letra del botón si no son los de siempre (p. ej. `h-11.5 text-sm` en un formulario del tamaño del diseño); gana sobre `compacto`. */
		alto?: string;
		testid: string;
	} = $props();

	let abierto = $state(false);
	// Al cerrarse, el Popover devuelve el foco al botón. Si se cerró porque la persona hizo clic en OTRA cosa (el campo de al lado), ese clic ya
	// puso el foco donde quería y devolverlo al botón le robaba lo que tecleaba después (2026-11-06, prueba en navegador): en ese caso no se devuelve.
	// Con Escape o al elegir sí, que es lo que ayuda a quien navega con el teclado.
	let cerroPorClicFuera = false;
	let contenido = $state<HTMLElement | null>(null);

	/**
	 * Sin la trampa de foco, la lista (que cuelga al final del `body`) no está en el orden de tabulación de la página: con Tab desde su última casilla el
	 * foco se iba a los enlaces del encabezado con la lista abierta flotando, y con Shift+Tab desde la primera saltaba a otro lado (prueba en navegador,
	 * 2026-11-06). Al intentar salir de ella con Tab se cierra y el foco vuelve al botón: de ahí el siguiente Tab sigue el orden normal de la página.
	 * Entre las casillas, Tab sigue siendo Tab.
	 */
	function alTeclear(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !contenido) return;
		const enfocables = [...contenido.querySelectorAll<HTMLElement>('button, [role="checkbox"], input, a[href]')].filter((el) => !el.hasAttribute('disabled'));
		const sale = e.shiftKey ? document.activeElement === enfocables[0] : document.activeElement === enfocables[enfocables.length - 1];
		if (!sale) return;
		e.preventDefault();
		abierto = false;
		document.getElementById(id)?.focus();
	}
	// Y la lista NO atrapa el foco (`trapFocus={false}` abajo): con la trampa, el clic en un campo de al lado le daba el foco un instante y la trampa se
	// lo jalaba de vuelta a la lista antes de que se cerrara, así que el foco terminaba en el `body` y lo que se tecleaba se perdía (medido con eventos
	// en la prueba en navegador). Es una lista de casillas, no un diálogo modal: no necesita encerrar el foco.

	const resumen = $derived(
		valor.length === 0
			? ''
			: opciones
					.filter((o) => valor.includes(o.valor))
					.map((o) => o.etiqueta)
					.join(', ')
	);

	function alternar(v: T) {
		valor = valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v];
	}
</script>

<Popover.Root bind:open={abierto}>
	<Popover.Trigger
		{id}
		data-testid={testid}
		class="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 {alto ||
			(compacto ? 'h-9 text-xs' : 'h-10 text-sm')}"
	>
		<span class="truncate {resumen ? 'text-foreground' : 'text-muted-foreground'}">{resumen || marcador}</span>
		<ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			align="start"
			sideOffset={4}
			trapFocus={false}
			bind:ref={contenido}
			onkeydown={alTeclear}
			onInteractOutside={() => (cerroPorClicFuera = true)}
			onCloseAutoFocus={(e) => {
				if (cerroPorClicFuera) e.preventDefault();
				cerroPorClicFuera = false;
			}}
			data-testid="{testid}-lista"
			class="z-70 max-h-80 w-max max-w-80 min-w-[max(13rem,var(--bits-popover-anchor-width))] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg"
		>
			{#each opciones as opcion (opcion.valor)}
				{@const cuantos = conteos[opcion.valor] ?? 0}
				<label class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-muted">
					<Checkbox
						checked={valor.includes(opcion.valor)}
						onCheckedChange={() => alternar(opcion.valor)}
						data-testid="{testid}-{opcion.valor}"
					/>
					<span class="flex-1">{opcion.etiqueta}</span>
					{#if cuantos > 0}
						<span
							class="flex min-w-5 items-center justify-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600"
							data-testid="{testid}-{opcion.valor}-conteo"
						>
							{cuantos}
						</span>
					{/if}
				</label>
			{/each}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
