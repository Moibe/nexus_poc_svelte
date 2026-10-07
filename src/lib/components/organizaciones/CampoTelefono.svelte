<script lang="ts">
	/**
	 * El campo de teléfono del diseño: la bandera con el prefijo a la izquierda
	 * y el número a la derecha, en una sola caja.
	 *
	 * DESVIACIÓN CONSCIENTE: el diseño dibuja un selector de país (+52 con una
	 * flecha). Solo hay México, así que el prefijo va fijo: un desplegable de
	 * un solo elemento promete elegir algo que no se puede. Cuando haya más
	 * países, aquí se convierte en selector.
	 */
	import BanderaMexico from '$lib/components/icons/BanderaMexico.svelte';

	let {
		value = $bindable(''),
		id,
		placeholder = 'Ingresa tu número celular'
	}: { value?: string; id: string; placeholder?: string } = $props();

	/** Solo dígitos y espacios: el prefijo lo pone el componente. */
	function limpiar(evento: Event) {
		const input = evento.currentTarget as HTMLInputElement;
		input.value = input.value.replace(/[^\d\s]/g, '').slice(0, 15);
		value = input.value;
	}
</script>

<div
	class="flex h-10 items-center rounded-lg border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
>
	<span class="flex shrink-0 items-center gap-1.5 border-r border-border px-2.5 text-sm text-foreground">
		<BanderaMexico class="h-3 w-[18px] rounded-[2px] ring-1 ring-black/10" />
		+52
	</span>
	<input
		{id}
		type="tel"
		inputmode="numeric"
		{placeholder}
		{value}
		oninput={limpiar}
		class="h-full min-w-0 flex-1 rounded-r-lg bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
	/>
</div>
