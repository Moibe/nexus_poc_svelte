<script lang="ts">
	/**
	 * El cuerpo de un panel, en JSON (2026-09-10, a pedido explícito: "tanto el
	 * Detalle como el Registro OT quiero presentarlos en forma normal y en forma
	 * de json").
	 *
	 * Lo comparten las dos ventanas. Es la única pieza del modo JSON que se
	 * comparte: el botón que lo enciende vive en cada panel, junto a los otros
	 * íconos de su banda, porque ahí es donde tiene sentido leerlo.
	 *
	 * QUÉ SE SERIALIZA. Cada panel arma su propio objeto y lo que trae es lo que
	 * ESE panel muestra, ni más ni menos, más `resultado` VERBATIM: la respuesta
	 * del extractor tal como llegó, sin re-empaquetar. Esa es la parte que sirve
	 * para pegar en un reporte o comparar dos corridas, y re-escribirla aquí con
	 * otros nombres la volvería inútil justo para eso.
	 *
	 * El `File` NO va: `JSON.stringify` de un File devuelve `{}` y ensuciaría la
	 * salida con una llave vacía que parece un error. Los bytes no son
	 * serializables y no tienen por qué estarlo.
	 *
	 * SIN BOTÓN DE COPIAR, a propósito. `navigator.clipboard` es API de contexto
	 * seguro y el server de CSI sirve por HTTP plano, así que ahí no existe —
	 * misma razón por la que no se usa en ninguna otra pantalla. El texto es
	 * seleccionable, que es el camino que sí funciona en los dos ambientes.
	 */
	let { datos, testid }: { datos: unknown; testid?: string } = $props();

	// `null` y `undefined` se distinguen a propósito en el objeto que arma cada
	// panel (un `error: null` dice "no hubo error"), así que aquí no se filtra
	// nada: se pinta lo que le pasen.
	const texto = $derived(JSON.stringify(datos, null, 2));
</script>

<!-- `break-words` y no scroll horizontal: el panel mide 590px y un valor largo
     —un hash, una URL de procesador— se saldría de cuadro. Envolver es
     preferible a esconder, aunque rompa la sangría de esa línea. -->
<pre
	data-testid={testid}
	class="mt-2 rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground select-text">{texto}</pre>
