<script lang="ts" generics="T extends string">
	/**
	 * «Ordenar» (2026-10-24): el botón del diseño (Figma, Sprint 5, HUN2) con las opciones que la pantalla sabe resolver. Es un menú de
	 * una sola elección, con la vigente marcada. Sirve igual al listado de expedientes y a los documentos de uno abierto: cada pantalla
	 * le pasa SUS opciones y recibe la elegida.
	 */
	import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	let {
		valor,
		opciones,
		alCambiar,
		testid = 'ordenar'
	}: {
		valor: T;
		opciones: { valor: T; etiqueta: string }[];
		alCambiar: (valor: T) => void;
		testid?: string;
	} = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" class="h-9 px-3" data-testid={testid}>
				<ArrowDownUp />
				Ordenar
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-56">
		<DropdownMenu.RadioGroup value={valor} onValueChange={(nuevo) => alCambiar(nuevo as T)}>
			{#each opciones as opcion (opcion.valor)}
				<DropdownMenu.RadioItem value={opcion.valor} data-testid={`${testid}-${opcion.valor}`}>
					{opcion.etiqueta}
				</DropdownMenu.RadioItem>
			{/each}
		</DropdownMenu.RadioGroup>
	</DropdownMenu.Content>
</DropdownMenu.Root>
