<script lang="ts">
	/**
	 * El SELLO de un veredicto en el lienzo del motor de reglas (2026-11-04, Moibe: «que la palomota sea más prominente: círculo verde y paloma
	 * amarilla; el tache, círculo rojo y tache blanco»). Lo comparten el pie de cada regla (`NodoOperador`), el del nodo «Resultado» y la insignia
	 * «Pasa / No pasa» de las entradas (`OrigenDeEntrada`), para que el mismo veredicto se vea igual en todos lados.
	 *
	 *   · `pasa`     — círculo verde con la paloma amarilla.
	 *   · `no_pasa`  — círculo rojo con el tache blanco.
	 *   · `sin_dato` — círculo gris con un signo de pregunta blanco: no se puede saber (el caso «faltan datos» del Resultado).
	 *
	 * `chico` es la versión de la insignia (16 px); la normal es de 24 px. Es decorativo: el veredicto lo dice el texto de al lado, así que no
	 * se anuncia (`aria-hidden`).
	 */
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';

	let { tipo, chico = false }: { tipo: 'pasa' | 'no_pasa' | 'sin_dato'; chico?: boolean } = $props();
</script>

<span
	data-testid="sello-veredicto"
	data-sello={tipo}
	aria-hidden="true"
	class="flex shrink-0 items-center justify-center rounded-full shadow-sm {chico ? 'size-4' : 'size-6'} {tipo === 'pasa'
		? 'bg-green-600 text-yellow-300'
		: tipo === 'no_pasa'
			? 'bg-red-600 text-white'
			: 'bg-slate-500 text-white'}"
>
	{#if tipo === 'pasa'}
		<Check class={chico ? 'size-2.5' : 'size-4'} strokeWidth={4} />
	{:else if tipo === 'no_pasa'}
		<X class={chico ? 'size-2.5' : 'size-4'} strokeWidth={4} />
	{:else}
		<span class="leading-none font-extrabold {chico ? 'text-[10px]' : 'text-sm'}">?</span>
	{/if}
</span>
