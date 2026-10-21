<script lang="ts" generics="T extends string">
	/**
	 * Un desplegable de elección MÚLTIPLE con casillas, como los de «Filtrar documentos» del Figma (Estado y Canal): el botón dice
	 * lo elegido (o el marcador) y la lista lleva una casilla por opción y, si se pide, una insignia roja con un conteo
	 * (el «1» de Duplicado).
	 *
	 * Es un `Popover` y no un `Select`: el `Select` de bits-ui pinta la marca de elegido a la derecha y cierra la lista al
	 * elegir; aquí se eligen varias y la casilla va a la izquierda, como el diseño.
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
		testid
	}: {
		id: string;
		marcador: string;
		opciones: { valor: T; etiqueta: string }[];
		valor?: T[];
		/** Insignia roja con el número, por opción. Solo sale si es mayor que 0. */
		conteos?: Partial<Record<T, number>>;
		testid: string;
	} = $props();

	let abierto = $state(false);

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
		class="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
	>
		<span class="truncate {resumen ? 'text-foreground' : 'text-muted-foreground'}">{resumen || marcador}</span>
		<ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			align="start"
			sideOffset={4}
			data-testid="{testid}-lista"
			class="z-70 w-(--bits-popover-anchor-width) min-w-52 rounded-xl border border-border bg-popover p-1.5 shadow-lg"
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
