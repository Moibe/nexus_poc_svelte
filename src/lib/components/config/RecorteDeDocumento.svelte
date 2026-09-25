<script lang="ts">
	/**
	 * Muestra UN recorte guardado dibujándolo sobre su documento, en vez de
	 * pintar una copia del pedazo.
	 *
	 * Hasta el 2026-09-25 cada recorte guardaba además sus píxeles como PNG en
	 * base64 (`imagenDataUrl`), dentro de localStorage: ~2.67 bytes de cuota por
	 * byte de imagen, por cada campo de cada ejemplo. Era una copia que sobraba —
	 * las coordenadas ya estaban guardadas y el documento ya vive en el almacén —
	 * así que ahora el recorte ES sus 4 coordenadas, y esto recorta con CSS: un
	 * contenedor con `overflow: hidden` del tamaño del pedazo, y el documento
	 * entero adentro, agrandado y corrido para que solo se vea esa región. Son
	 * los mismos píxeles que se seleccionaron, no una interpretación de ellos.
	 *
	 * Es también el formato en el que Document AI etiqueta ejemplos: cajas sobre
	 * el documento original.
	 */
	import type { Recorte } from '$lib/state/configuracion.svelte';

	let {
		fuente,
		recorte,
		alt
	}: {
		/** La URL del documento — `fuenteDeDocumento(doc)`, la misma sobre la
		 *  que se dibujó el recorte. */
		fuente: string;
		/** En PORCENTAJE del documento, igual que como se guardó. */
		recorte: Recorte;
		alt: string;
	} = $props();

	/** Tamaño real del documento, para sacar la proporción del pedazo. No se
	 *  conoce hasta que la imagen carga. */
	let natural = $state<{ ancho: number; alto: number } | null>(null);
	let fallo = $state(false);

	// Otra fuente es otra oportunidad de cargar. `natural` NO se reinicia: el
	// caso común es la migración cambiando `data:` por la URL del almacén —los
	// mismos bytes—, y reiniciarlo haría saltar la miniatura a la proporción
	// supuesta y de regreso. Si de verdad es otra imagen, su `load` lo corrige.
	$effect(() => {
		void fuente;
		fallo = false;
	});

	// Un recorte guardado siempre mide más de 0 (el recortador no deja guardar
	// uno vacío); el piso es solo para no dividir entre cero con datos raros.
	const w = $derived(Math.max(recorte.w, 0.01));
	const h = $derived(Math.max(recorte.h, 0.01));

	/** Ancho/alto del pedazo en píxeles REALES del documento. Antes de que
	 *  cargue la imagen se supone un documento cuadrado; se corrige en cuanto
	 *  se conoce el tamaño. */
	const proporcion = $derived(natural ? (w * natural.ancho) / (h * natural.alto) : w / h);

	/**
	 * Mismo tamaño que tenía la miniatura PNG (`max-h-40 max-w-full`, a tamaño
	 * natural): nunca más ancho que el contenedor, nunca más alto que 10rem, y
	 * nunca más grande que el pedazo real — agrandar un recorte chico solo lo
	 * pintaría borroso.
	 */
	const ancho = $derived.by(() => {
		const tope = `calc(10rem * ${proporcion})`;
		if (!natural) return `min(100%, ${tope})`;
		const real = (w / 100) * natural.ancho;
		return `min(100%, ${tope}, ${real}px)`;
	});
</script>

{#if fallo}
	<p
		data-testid="recorte-sin-documento"
		class="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
	>
		No se pudo cargar el documento para mostrar este recorte. Las coordenadas siguen guardadas;
		intenta de nuevo en unos minutos.
	</p>
{:else}
	<!-- El marco es `ring` y no `border` a propósito: un borde ocupa espacio
	     dentro de la caja (box-sizing: border-box), así que `aspect-ratio` se
	     aplicaría a la caja CON borde mientras el documento se acomoda en la
	     de SIN borde — y en un recorte bajo, el de un campo de una línea, el
	     texto salía hasta ~10% más ancho de lo real. `ring` es una sombra: no
	     ocupa espacio y la proporción queda exacta. -->
	<div
		data-testid="recorte-de-documento"
		class="relative overflow-hidden rounded-lg bg-white ring-1 ring-border"
		style="width: {ancho}; aspect-ratio: {proporcion};"
	>
		<img
			src={fuente}
			{alt}
			draggable="false"
			class="absolute max-w-none select-none"
			style="left: {(-recorte.x / w) * 100}%; top: {(-recorte.y / h) * 100}%; width: {(100 / w) *
				100}%; height: {(100 / h) * 100}%;"
			onload={(e) => {
				const img = e.currentTarget as HTMLImageElement;
				natural = { ancho: img.naturalWidth, alto: img.naturalHeight };
			}}
			onerror={() => (fallo = true)}
		/>
	</div>
{/if}
