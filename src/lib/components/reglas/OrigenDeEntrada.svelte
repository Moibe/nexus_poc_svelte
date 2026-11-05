<script lang="ts">
	/**
	 * Lo que se ve bajo el rótulo de una entrada de un nodo del lienzo (2026-11-03: se sacó de `NodoOperador` para que lo compartan los nodos
	 * finales): de dónde viene lo que le llega y, si viene de un CAMPO, dónde se escribe el valor de ejemplo con el que se prueba.
	 *
	 *   · un CAMPO: su nombre y su documento, y la caja del ejemplo (una línea si es un valor; un renglón por elemento si es una lista o las
	 *     filas de un grupo; una elección sí/no si es el documento entero, que no es un dato sino la pregunta de si el expediente lo trae);
	 *   · un VALOR FIJO: su número y su valor, sin caja (el valor ya está escrito en el valor fijo);
	 *   · una REGLA: cuál es y su veredicto o su valor, en vivo;
	 *   · nada: lo que falta conectar (`sinOrigen`, o lo que acepta la entrada).
	 *
	 * Lo que se escribe sube con `alEscribir`: el ejemplo vive en el nodo, no en el campo.
	 */
	import SelloDeVeredicto from '$lib/components/reglas/SelloDeVeredicto.svelte';
	import type { Acepta, Estado, OrigenDeEntrada } from '$lib/reglas/reglas';

	let {
		entrada,
		origen,
		ejemplo,
		alEscribir,
		sinOrigen
	}: {
		entrada: { id: string; etiqueta: string; acepta: Acepta };
		origen: OrigenDeEntrada | null;
		/** El valor de ejemplo que ya trae el nodo para esta entrada. */
		ejemplo: string;
		alEscribir: (texto: string) => void;
		/** Lo que se dice cuando no hay nada conectado; sin esto, lo que acepta la entrada. */
		sinOrigen?: string;
	} = $props();

	const ESTADO_CORTO: Record<Estado, string> = { pasa: 'Pasa', no_pasa: 'No pasa', sin_valores: 'Sin valores', sin_conexion: 'Incompleta', listo: 'Listo' };

	const textoSinOrigen = $derived(
		sinOrigen ??
			(entrada.acepta === 'veredicto'
				? 'Conecta el resultado de una regla'
				: entrada.acepta === 'documento'
					? 'Conecta el documento de un tipo documental'
					: entrada.acepta === 'lista'
						? 'Conecta una lista'
						: 'Conecta un campo o un valor fijo')
	);
</script>

{#if origen?.clase === 'campo'}
	<p class="mt-0.5 truncate text-xs font-medium" data-testid="origen-entrada" title="{origen.salida.campo} · {origen.salida.tipo}">
		{origen.salida.campo} <span class="font-normal text-muted-foreground">· {origen.salida.tipo}</span>
	</p>
	{#if origen.salida.forma === 'documento'}
		<!-- Lo que se prueba aquí no es un texto sino una elección: si el expediente de ejemplo trae el documento o no. -->
		<select
			data-testid="ejemplo-documento"
			aria-label="Ejemplo: ¿el expediente trae este documento?"
			value={ejemplo}
			class="nodrag nowheel mt-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
			onchange={(e) => alEscribir(e.currentTarget.value)}
			onkeydown={(e) => e.stopPropagation()}
		>
			<option value="">Elige un ejemplo…</option>
			<option value="si">Sí: el expediente lo trae</option>
			<option value="no">No: el expediente no lo trae</option>
		</select>
	{:else if origen.salida.forma === 'valor'}
		<input
			type="text"
			data-testid="valor-de-ejemplo"
			aria-label="Valor de ejemplo de «{entrada.etiqueta}»"
			placeholder="Valor de ejemplo"
			autocomplete="off"
			value={ejemplo}
			class="nodrag nowheel mt-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
			oninput={(e) => alEscribir(e.currentTarget.value)}
			onkeydown={(e) => e.stopPropagation()}
		/>
	{:else}
		<textarea
			data-testid="valor-de-ejemplo"
			aria-label="Valores de ejemplo de «{entrada.etiqueta}»"
			placeholder={origen.salida.forma === 'filas' ? 'Una fila por renglón' : 'Un elemento por renglón'}
			rows="3"
			value={ejemplo}
			class="nodrag nowheel mt-1.5 min-h-16 w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
			oninput={(e) => alEscribir(e.currentTarget.value)}
			onkeydown={(e) => e.stopPropagation()}
		></textarea>
	{/if}
{:else if origen?.clase === 'fijo'}
	<p class="mt-0.5 flex items-center justify-between gap-2 text-xs font-medium" data-testid="origen-entrada">
		<span class="truncate">Valor fijo #{origen.numero}</span>
		<span class="max-w-32 shrink-0 truncate rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium" data-testid="valor-de-origen" title={origen.valor}>{origen.valor || '—'}</span>
	</p>
{:else if origen?.clase === 'regla'}
	<p class="mt-0.5 flex items-center justify-between gap-2 text-xs font-medium" data-testid="origen-entrada">
		<span class="truncate">{origen.nombre}</span>
		{#if origen.entrega === 'valor'}
			<span
				class="max-w-32 shrink-0 truncate rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium"
				data-testid="valor-de-origen"
				data-estado={origen.estado}
				title={origen.valor ?? ''}>{origen.valor !== undefined ? `= ${origen.valor}` : 'Sin valor'}</span
			>
		{:else}
			<!-- La insignia del veredicto de la regla conectada (2026-11-04, Moibe: el mismo trato que el pie de la regla): texto de 12 px (antes 10) y,
			     cuando pasa o no pasa, el sello chico —círculo verde con paloma amarilla, círculo rojo con tache blanco— al principio. -->
			<span
				class="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 text-xs font-semibold {origen.estado === 'pasa' || origen.estado === 'no_pasa'
					? 'pr-2 pl-0.5'
					: 'px-2'} {origen.estado === 'pasa'
					? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
					: origen.estado === 'no_pasa'
						? 'bg-destructive/10 text-destructive'
						: 'bg-muted text-muted-foreground'}"
				data-testid="veredicto-de-origen"
				data-estado={origen.estado}
			>
				{#if origen.estado === 'pasa'}
					<SelloDeVeredicto tipo="pasa" chico />
				{:else if origen.estado === 'no_pasa'}
					<SelloDeVeredicto tipo="no_pasa" chico />
				{/if}
				{ESTADO_CORTO[origen.estado]}
			</span>
		{/if}
	</p>
{:else}
	<p class="mt-0.5 text-xs text-muted-foreground italic" data-testid="entrada-sin-conexion">{textoSinOrigen}</p>
{/if}
