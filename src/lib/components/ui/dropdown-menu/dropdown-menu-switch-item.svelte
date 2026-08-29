<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		class: className,
		children: childrenProp,
		...restProps
	}: WithoutChildrenOrChild<DropdownMenuPrimitive.CheckboxItemProps> & {
		children?: Snippet;
	} = $props();
</script>

<!--
	Renglón de menú con interruptor. Es el patrón que usa el diseño en el menú de
	la tarjeta de un modelo documental ("Ejemplo documental").

	Por qué existe en vez de resolverlo en el sitio de uso:

	1. Tiene que ser un CheckboxItem de bits-ui, no un Item con `role` puesto a
	   mano. bits-ui FIJA `role="menuitem"` e ignora el override, y `aria-checked`
	   sobre un `menuitem` es ARIA inválido — el lector de pantalla lo descarta y
	   el estado del interruptor deja de anunciarse. El CheckboxItem sí emite
	   `role="menuitemcheckbox"`.

	2. El interruptor es el INDICADOR del renglón, no un control aparte. Un
	   <button> de verdad aquí dentro volvería a anidar interactivos y se saldría
	   de la navegación por flechas del menú. Así el renglón entero es el control:
	   se pica donde sea y funciona, con teclado incluido.

	Se hereda todo el estilo del CheckboxItem hermano de este directorio salvo el
	`pr-8` que ese reserva para su palomita: aquí el ancho lo ocupa el
	interruptor, que va en el flujo normal empujado con `ml-auto`.
-->
<DropdownMenuPrimitive.CheckboxItem
	bind:ref
	bind:checked
	data-slot="dropdown-menu-switch-item"
	class={cn(
		"relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-1.5 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-inset:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
>
	{#snippet children({ checked })}
		{@render childrenProp?.()}
		<span
			data-slot="dropdown-menu-switch-item-indicator"
			class={cn(
				'ml-auto inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
				checked ? 'bg-primary' : 'bg-input'
			)}
		>
			<span
				class={cn(
					'size-4 rounded-full bg-background shadow-sm transition-transform',
					checked ? 'translate-x-4.5' : 'translate-x-0.5'
				)}
			></span>
		</span>
	{/snippet}
</DropdownMenuPrimitive.CheckboxItem>
