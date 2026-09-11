/**
 * Descargar lo que un panel de detalle está mostrando: PDF si está en modo
 * documento, JSON si está en modo JSON (2026-09-11, a pedido explícito).
 *
 * La regla es que se baja LO QUE SE VE, no el archivo original. Bajar el
 * archivo original ya existió —fue el `descargar()` que se quitó el
 * 2026-09-11— y hacía otra cosa: entregaba los bytes que el usuario ya tenía.
 * Lo que sirve de un panel de detalle es el resultado del procesamiento, y de
 * eso no hay copia en ninguna parte hasta que se baja de aquí.
 *
 * POR QUÉ UN `Informe` Y NO EL DOCUMENTO. Este módulo no sabe qué es un
 * documento ni una OT: recibe secciones y renglones ya formateados. Así el
 * panel sigue siendo el dueño de cómo se lee cada dato (fechas en hora local,
 * confianza a dos decimales, tamaño legible) y el PDF no puede divergir de la
 * pantalla por tener su propio formateo. El segundo panel —"Registro de OT",
 * que muestra lo mismo con otros campos— entra aquí armando su `Informe`, sin
 * tocar una línea de esto.
 *
 * NADA DE CONTEXTO SEGURO. Igual que en el resto del proyecto: el server de
 * CSI sirve por HTTP plano, así que aquí no se usa `crypto.subtle` ni
 * `navigator.clipboard` ni ninguna API que sólo exista en HTTPS.
 * `URL.createObjectURL` y el `<a download>` sí funcionan en HTTP plano, que es
 * la razón de que la descarga se arme a mano en vez de con algo más moderno.
 *
 * POR QUÉ NO `window.print()`. Sería PDF gratis, pero abre el diálogo de
 * impresión en vez de descargar, imprime la aplicación entera (no el panel) y
 * el resultado depende de la configuración del navegador de cada quien. Se
 * pidió una descarga, y una descarga tiene que producir un archivo.
 */

/** Un renglón "etiqueta: valor", los mismos que pinta el snippet `dato()` de
 *  cada panel. `valor` llega YA formateado: este módulo no formatea nada. */
export type FilaInforme = { etiqueta: string; valor: string };

/** Un bloque con encabezado ("Información", "Procesamiento OCR"). */
export type SeccionInforme = { titulo: string; filas: FilaInforme[] };

/** Los recuadros de aviso del panel (error, campos no reconocidos, tipo no
 *  configurado, pendiente de revisión). Van al final, como en pantalla. */
export type AvisoInforme = { titulo: string; texto: string };

export type Informe = {
	titulo: string;
	subtitulo?: string;
	secciones: SeccionInforme[];
	avisos?: AvisoInforme[];
};

/**
 * Dispara la descarga de un blob con el nombre dado.
 *
 * Dos detalles que parecen de más y no lo son (vienen del `descargar()`
 * original, donde ya se habían pagado):
 *  - El <a> se INSERTA en el DOM. Firefox ignora el click() de un elemento que
 *    no está en el documento, así que sin esto la descarga no arranca.
 *  - La URL se revoca en el siguiente tick, no en este. revokeObjectURL() es
 *    inmediato: si se llama en el mismo tick del click, el navegador todavía
 *    no empezó a leer el blob y la descarga sale vacía o falla.
 */
export function descargarBlob(blob: Blob, nombre: string): void {
	const url = URL.createObjectURL(blob);
	const enlace = document.createElement('a');
	enlace.href = url;
	enlace.download = nombre;
	document.body.appendChild(enlace);
	enlace.click();
	enlace.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** El mismo texto que `VistaJson` pinta en pantalla —`stringify` con sangría
 *  de 2— para que el archivo y lo que se está viendo sean idénticos. */
export function descargarJson(datos: unknown, nombre: string): void {
	const texto = JSON.stringify(datos, null, 2);
	descargarBlob(new Blob([texto], { type: 'application/json' }), nombre);
}

/** Quita la extensión para poder componer nombres de descarga a partir del
 *  archivo: "ine_frente.jpg" -> "ine_frente". */
export function sinExtension(nombreArchivo: string): string {
	const punto = nombreArchivo.lastIndexOf('.');
	return punto > 0 ? nombreArchivo.slice(0, punto) : nombreArchivo;
}

// Medidas en puntos (1/72"), que es la unidad nativa del PDF: usarla evita
// conversiones y que los redondeos corran los renglones.
const MARGEN = 48;
const ANCHO_ETIQUETA = 190;
const SALTO_RENGLON = 13;

// Grises equivalentes a los del panel: el texto fuerte casi negro, la etiqueta
// y el subtítulo en el gris apagado, y las líneas divisorias muy claras.
const TINTA = [15, 23, 42] as const;
const TINTA_TENUE = [100, 116, 139] as const;
const LINEA = [226, 232, 240] as const;

/**
 * Arma el PDF del informe y lo descarga.
 *
 * jsPDF se carga con `import()` dinámico a propósito: son ~400 KB que sólo
 * hacen falta cuando alguien oprime "Descargar", y cargarlos de entrada le
 * costaría el arranque a todo el mundo por una acción que la mayoría no va a
 * usar. Por eso esta función es async y el botón la espera.
 *
 * Los acentos salen bien sin incrustar ninguna tipografía: las fuentes
 * estándar de jsPDF se codifican en WinAnsi, que cubre el español completo
 * (á é í ó ú ñ Ñ ü ¿ ¡ °). Incrustar una fuente Unicode serían cientos de KB
 * más para ganar caracteres que este informe no usa.
 */
export async function descargarPdf(informe: Informe, nombre: string): Promise<void> {
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ unit: 'pt', format: 'a4' });

	const anchoPagina = doc.internal.pageSize.getWidth();
	const altoPagina = doc.internal.pageSize.getHeight();
	const anchoValor = anchoPagina - MARGEN * 2 - ANCHO_ETIQUETA;
	let y = MARGEN;

	/** Abre página nueva si lo que sigue no cabe. Se llama ANTES de dibujar
	 *  cada pieza con el alto que esa pieza va a ocupar, que es lo que evita
	 *  renglones partidos a la mitad del corte. */
	function asegurarEspacio(alto: number): void {
		if (y + alto <= altoPagina - MARGEN) return;
		doc.addPage();
		y = MARGEN;
	}

	function escribir(texto: string, x: number, tamano: number, negrita = false, tenue = false) {
		doc.setFont('helvetica', negrita ? 'bold' : 'normal');
		doc.setFontSize(tamano);
		const [r, g, b] = tenue ? TINTA_TENUE : TINTA;
		doc.setTextColor(r, g, b);
		doc.text(texto, x, y);
	}

	escribir(informe.titulo, MARGEN, 16, true);
	y += 20;

	if (informe.subtitulo) {
		// El nombre del archivo puede ser largo; se parte en varias líneas en
		// vez de salirse de la hoja.
		for (const linea of doc.splitTextToSize(informe.subtitulo, anchoPagina - MARGEN * 2)) {
			escribir(linea, MARGEN, 10, false, true);
			y += 13;
		}
	}
	y += 8;

	for (const seccion of informe.secciones) {
		asegurarEspacio(40);
		escribir(seccion.titulo, MARGEN, 12, true);
		y += 18;

		for (const fila of seccion.filas) {
			// El valor manda el alto del renglón: la etiqueta siempre es corta,
			// pero un hash SHA-256 o un mensaje de error ocupan varias líneas.
			const lineas: string[] = doc.splitTextToSize(fila.valor, anchoValor);
			const alto = Math.max(SALTO_RENGLON, lineas.length * SALTO_RENGLON) + 8;
			asegurarEspacio(alto);

			escribir(fila.etiqueta, MARGEN, 9.5, false, true);
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9.5);
			doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
			doc.text(lineas, MARGEN + ANCHO_ETIQUETA, y);

			y += alto - 4;
			// La divisoria de cada renglón, igual que el `border-b` del panel.
			doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]);
			doc.setLineWidth(0.5);
			doc.line(MARGEN, y, anchoPagina - MARGEN, y);
			y += 8;
		}

		y += 10;
	}

	for (const aviso of informe.avisos ?? []) {
		const lineas: string[] = doc.splitTextToSize(aviso.texto, anchoPagina - MARGEN * 2 - 20);
		const alto = 26 + lineas.length * 12;
		asegurarEspacio(alto + 10);

		// Recuadro en gris, no en el ámbar/rojo de la pantalla: el informe se
		// imprime y muchas impresoras son monocromáticas, donde un fondo de
		// color se vuelve una mancha que estorba para leer. El aviso se
		// distingue por estar enmarcado y titulado, que sobrevive al blanco y
		// negro.
		doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]);
		doc.setLineWidth(0.5);
		doc.roundedRect(MARGEN, y - 2, anchoPagina - MARGEN * 2, alto, 4, 4);

		y += 14;
		escribir(aviso.titulo, MARGEN + 10, 10, true);
		y += 13;
		for (const linea of lineas) {
			escribir(linea, MARGEN + 10, 9, false, true);
			y += 12;
		}
		y += 12;
	}

	descargarBlob(doc.output('blob'), nombre);
}
