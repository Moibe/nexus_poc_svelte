<script lang="ts">
	/**
	 * La caja de un secret que se muestra UNA sola vez, con su botón de copiar.
	 *
	 * Nació dentro de `ApiKeySheet.svelte` y se sacó aquí el 2026-10-01, cuando
	 * los Webhooks necesitaron exactamente lo mismo para su secret de firma. Se
	 * extrajo en vez de copiarse por la misma razón que `usarVistaPrevia`: su
	 * valor está en decisiones sutiles —por qué copiar tiene tres escalones, por
	 * qué el plan B selecciona el nodo y no un <textarea>— que en una copia se
	 * pierden en cuanto alguien toca una pantalla y no la otra.
	 *
	 * Vive lo que vive la vista que lo muestra: se monta cuando aparece el secret
	 * y se desmonta al salir, y con eso se van el "Copiado" y su temporizador sin
	 * que nadie tenga que limpiarlos. Al montarse lleva el foco a "Copiar": el
	 * botón que se venía usando (el de crear) se desmontó al cambiar de vista, y
	 * sin esto quien navega con teclado o con lector de pantalla no se entera de
	 * que apareció un secret.
	 */
	import { onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';

	let {
		secret,
		testid
	}: {
		secret: string;
		/** El `data-testid` del secret, para que cada pantalla conserve el suyo. */
		testid: string;
	} = $props();

	let copiado = $state(false);
	let errorCopiado = $state('');
	let botonCopiar = $state<HTMLElement | null>(null);
	let nodoSecret = $state<HTMLElement | null>(null);

	/** Cuánto dura el "Copiado" antes de que el ícono vuelva a su forma normal. */
	const DURACION_COPIADO_MS = 2000;
	let temporizadorCopiado: ReturnType<typeof setTimeout> | null = null;

	function limpiarTemporizador() {
		if (temporizadorCopiado !== null) {
			clearTimeout(temporizadorCopiado);
			temporizadorCopiado = null;
		}
	}

	/** Copiar, en tres escalones.
	 *
	 *  El repo tiene una regla escrita de NO poner botones de copiar (VistaJson,
	 *  el ID del procesador en ConfigSheet, docs/pendientes-ux.md) porque
	 *  `navigator.clipboard` es API de contexto seguro y el server de CSI sirve por
	 *  HTTP plano, donde no existe. Aquí el botón SÍ va, y es la excepción: en las
	 *  otras pantallas copiar es comodidad y el texto seleccionable alcanza; en
	 *  ésta el secret se muestra UNA vez, así que copiar es la función principal
	 *  de la pantalla. Lo que no se hace es llamar a `navigator.clipboard` a
	 *  secas: eso no haría nada en producción, sin error visible, justo donde
	 *  perderlo cuesta la llave.
	 *
	 *   1. `navigator.clipboard` cuando existe (HTTPS o localhost). El `?.` es
	 *      obligatorio y el `catch` también: puede RECHAZAR por permiso denegado o
	 *      por documento sin foco aunque la API esté ahí.
	 *   2. `execCommand` sobre una selección temporal, que sí corre en HTTP plano.
	 *      Está deprecado y DEVUELVE `false` en vez de lanzar, por eso se revisa el
	 *      booleano y no basta con el try.
	 *   3. Si los dos fallan se dice en la misma tarjeta, sin `alert()`. La caja es
	 *      siempre seleccionable, que es la red de seguridad heredada de VistaJson. */
	async function copiar() {
		let ok = false;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(secret);
				ok = true;
			}
		} catch {
			ok = false;
		}

		if (!ok) ok = copiarSeleccionandoElNodo();

		limpiarTemporizador();
		copiado = ok;
		errorCopiado = ok
			? ''
			: 'No se pudo copiar automáticamente. El secret quedó seleccionado: cópialo con Ctrl+C (Cmd+C en Mac).';
		if (ok) {
			temporizadorCopiado = setTimeout(() => {
				copiado = false;
				temporizadorCopiado = null;
			}, DURACION_COPIADO_MS);
		}
	}

	/** El plan B, que en producción es el ÚNICO camino.
	 *
	 *  NO crea un <textarea> aparte, que es el truco de manual: ese elemento
	 *  viviría fuera del Sheet, y el `FocusScope` de bits-ui (trampa de foco del
	 *  Dialog, prendida por default) escucha `focusin` en captura y DEVUELVE el
	 *  foco al instante. `select()` dispara ese `focusin` de forma síncrona, así
	 *  que para cuando corre `execCommand` la selección del documento ya está
	 *  vacía y copiar devuelve `false`. Medido en Chrome real, no deducido.
	 *
	 *  En vez de eso se selecciona el <code> que YA está dentro del panel, con un
	 *  `Range`: `execCommand` opera sobre la selección del documento y no
	 *  necesita mover el foco, así que la trampa ni se entera. Apagar la trampa
	 *  (`trapFocus={false}`) arreglaría el síntoma rompiendo la accesibilidad del
	 *  modal, que es peor. */
	function copiarSeleccionandoElNodo(): boolean {
		const seleccion = window.getSelection();
		if (!nodoSecret || !seleccion) return false;

		const rango = document.createRange();
		rango.selectNodeContents(nodoSecret);
		seleccion.removeAllRanges();
		seleccion.addRange(rango);

		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}

		// Si copió, se suelta la selección (ya cumplió). Si NO copió, se DEJA
		// seleccionado a propósito: es lo que promete el aviso, y con eso Ctrl+C
		// basta — el atajo copia la selección del documento sin importar dónde
		// quedó el foco, así que también sirve a quien navega con teclado.
		if (ok) seleccion.removeAllRanges();
		return ok;
	}

	$effect(() => {
		botonCopiar?.focus();
	});

	onDestroy(limpiarTemporizador);
</script>

<!-- `break-all` y `min-w-0`, nunca `truncate`: un secret cortado se
     copia mal y no hay segunda oportunidad de verlo. `select-text`
     siempre, pase lo que pase con el botón: es la red de seguridad. -->
<div class="mt-6 flex items-center gap-3 rounded-lg border border-border px-4 py-3">
	<!-- Se queda como <code> plano, sin `tabindex`: cuando copiar falla,
	     el secret queda SELECCIONADO (ver `copiarSeleccionandoElNodo`) y
	     Ctrl+C copia la selección del documento sin importar dónde esté
	     el foco — así que quien usa teclado no necesita poder tabular
	     hasta aquí. Hacerlo enfocable exigiría un rol interactivo que un
	     <code> no tiene, y prometería una edición que no existe. -->
	<code
		bind:this={nodoSecret}
		data-testid={testid}
		class="min-w-0 flex-1 font-mono text-sm break-all text-foreground select-text"
	>{secret}</code>
	<Button
		bind:ref={botonCopiar}
		variant="ghost"
		size="icon"
		class="shrink-0 text-muted-foreground"
		data-testid="copiar-secret"
		onclick={copiar}
	>
		{#if copiado}
			<Check class="size-4" />
		{:else}
			<Copy class="size-4" />
		{/if}
		<span class="sr-only">Copiar secret</span>
	</Button>
</div>

<!-- El contenedor con `aria-live` va SIEMPRE montado, aunque esté
     vacío: una región que se monta junto con su texto no se anuncia
     —el lector tiene que estar observándola de antes—. Misma razón
     que el aviso de éxito de ConfigSheet. Vacío no mide nada. -->
<div
	role="status"
	aria-live="polite"
	data-testid="aviso-copiado"
	class="text-xs {errorCopiado ? 'text-destructive' : 'text-muted-foreground'}"
>
	<!-- El margen va en el texto y no en el contenedor: el contenedor
	     está SIEMPRE montado, y con `mt-2` metía 8px de aire bajo el
	     secret aun estando vacío. -->
	{#if copiado}
		<p class="mt-2">Secret copiado al portapapeles.</p>
	{:else if errorCopiado}
		<p class="mt-2">{errorCopiado}</p>
	{/if}
</div>
