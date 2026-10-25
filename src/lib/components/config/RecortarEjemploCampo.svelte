<script lang="ts">
	import { untrack } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import Crop from '@lucide/svelte/icons/crop';
	import Save from '@lucide/svelte/icons/save';
	import NavegadorDePaginas from './NavegadorDePaginas.svelte';
	import { usarPaginaDeEjemplo } from '$lib/hooks/usarPaginaDeEjemplo.svelte';
	import {
		guardarRecorteEjemplo,
		colorParaCampo,
		paginaDeRecorte,
		type Recorte,
		type DocumentoEjemploInstancia
	} from '$lib/state/configuracion.svelte';

	let {
		abierto = false,
		tipoId = null,
		campoNombre = null,
		documento = null,
		recorteExistente = null,
		otrosRecortes = [],
		paginaInicial = 1,
		onCambioPagina,
		onCerrar
	}: {
		abierto?: boolean;
		/** A qué tipo documental y campo pertenece el recorte que "Guardar" va a
		 *  persistir. El campo se identifica por NOMBRE, no por id (ver
		 *  `guardarRecorteEjemplo`: el id de un campo no sobrevive un refresh). */
		tipoId?: string | null;
		campoNombre?: string | null;
		/** La instancia de documento YA SUBIDA sobre la que se recorta — un tipo
		 *  documental puede tener varias (2026-09-04); esta es la que esté
		 *  SELECCIONADA en Calibración en ese momento (`ModuloConfiguracion.svelte`
		 *  decide cuál). Este modal ya no sube nada, solo recorta sobre lo que
		 *  traiga. `null` no debería pasar en la práctica: el botón que abre
		 *  este modal viene deshabilitado sin ninguna instancia seleccionada. */
		documento?: DocumentoEjemploInstancia | null;
		/** El recorte YA GUARDADO para este (documento, campo), si "Editar" es
		 *  lo que abrió el modal (`null` cuando es la primera vez que se
		 *  recorta esa combinación). Se usa solo para PRECARGAR el rectángulo
		 *  al entrar — no para nada más. */
		recorteExistente?: Recorte | null;
		/** Los recortes YA GUARDADOS de los DEMÁS campos de este mismo
		 *  documento (nunca incluye el campo que se está editando aquí) — solo
		 *  para dar contexto visual mientras se recorta uno nuevo. De SOLO
		 *  LECTURA: se dibujan sin manijas ni arrastre, y no deben interferir
		 *  con el rectángulo activo (ver `pointer-events-none` en el markup). */
		otrosRecortes?: { nombreCampo: string; recorte: Recorte }[];
		/** La página con la que se abre (de 1 en adelante). Para un recorte ya guardado es la suya; para uno nuevo, la última
		 *  página en la que se estuvo trabajando ese documento, para no volver a la 1 cada vez en un acta de 20 páginas. */
		paginaInicial?: number;
		/** Se llama cada vez que se cambia de página, para que quien abre recuerde dónde se quedó. */
		onCambioPagina?: (pagina: number) => void;
		onCerrar: () => void;
	} = $props();

	// Al cerrar, se limpia todo — lo que se muestre la PRÓXIMA vez que se abra
	// lo decide el efecto de más abajo (en blanco si es la primera vez que se
	// recorta el campo, o con el rectángulo ya guardado si es "Editar").
	// `modoRecorte` se reinicia a `true`, no a `false` (cambio pedido): la
	// herramienta de recorte debe estar YA ACTIVA la próxima vez que se entre
	// a esta pantalla, para poder dibujar el rectángulo directo sobre el
	// documento sin picar antes "Recortar".
	function cerrar() {
		modoRecorte = true;
		recorte = null;
		zoom = 1;
		onCerrar();
	}

	// ── Zoom ─────────────────────────────────────────────────────────────────
	let zoom = $state(1);
	const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

	// ── Recorte: dibujar / mover / redimensionar un rectángulo ──────────────
	// Todo en PORCENTAJE del contenedor, no en píxeles: así el rectángulo se
	// mantiene correcto sin importar el zoom.
	// Arranca en `true` (cambio pedido): al entrar a recortar un campo, la
	// herramienta ya está lista para dibujar con el primer clic, sin tener
	// que activar "Recortar" a mano cada vez.
	let modoRecorte = $state(true);
	let recorte = $state<Recorte | null>(null);
	/** En qué página del documento se está mirando, y por tanto en cuál se dibuja: un recorte es de UNA página. */
	let pagina = $state(1);

	/**
	 * ¿La etiqueta de "otro" recorte (que vive pegada arriba de su rectángulo,
	 * ver el markup) queda tapada por el rectángulo ACTIVO que se está
	 * dibujando/moviendo/redimensionando ahora mismo? Pedido explícito
	 * 2026-09-05: "que las etiquetas que se crucen en el camino se muevan a
	 * otra orilla de su marcación". `MARGEN_ETIQUETA` extiende el borde
	 * superior de `otro` unos puntos porcentuales hacia arriba SOLO para esta
	 * comparación (no para el dibujo) — aproxima el alto real en píxeles de la
	 * etiqueta, que vive fuera de la caja. No es geometría exacta a propósito:
	 * ese detalle no importa para decidir si estorba o no.
	 */
	const MARGEN_ETIQUETA = 4;
	function etiquetaTapadaPorActivo(otro: Recorte): boolean {
		if (!recorte || recorte.w === 0 || recorte.h === 0) return false;
		return (
			recorte.x < otro.x + otro.w &&
			recorte.x + recorte.w > otro.x &&
			recorte.y < otro.y + otro.h &&
			recorte.y + recorte.h > otro.y - MARGEN_ETIQUETA
		);
	}

	// Precarga el rectángulo ya guardado al ABRIR — "Editar" (2026-09-04)
	// debe mostrar lo que había, no arrancar en blanco. Se dispara solo en la
	// transición false→true de `abierto` (por eso el `untrack` alrededor de
	// `recorteExistente`): si dependiera también de `recorteExistente`, un
	// recálculo de esa prop mientras el modal sigue abierto podría pisar un
	// rectángulo que el usuario ya esté arrastrando.
	$effect(() => {
		if (abierto) {
			untrack(() => {
				pagina = Math.max(1, Math.round(paginaInicial) || 1);
				// El guardado solo se muestra en SU página: abrir en otra y verlo dibujado donde no está sería mentir.
				recorte =
					recorteExistente && paginaDeRecorte(recorteExistente) === pagina ? { ...recorteExistente } : null;
			});
		}
	});

	// La fuente de la imagen se FIJA al abrir; no sigue al documento en vivo.
	// Recargar la biblioteca del servidor (al abrir Configuración, o al adoptar la
	// versión de otra persona) puede reemplazar el objeto de este documento con
	// el modal abierto, y si el `src` siguiera ese cambio el `<img>` recargaría
	// debajo del usuario mientras dibuja — y si esa lectura falla, el documento
	// desaparecería y no quedaría sobre qué recortar. Son los mismos bytes, así
	// que no hay nada que ganar cambiándola a media edición. `.pre` para que la
	// fuente ya esté puesta en el primer pintado.
	/**
	 * Si el documento de verdad se ve. Solo con 'listo' se puede dibujar y
	 * guardar un rectángulo.
	 *
	 * Antes esto lo cuidaba, de rebote, la copia PNG del pedazo: sin imagen
	 * cargada no había de dónde sacarla y "Guardar" no hacía nada. Desde que un
	 * recorte es solo coordenadas (2026-09-25) hace falta decirlo explícito —
	 * si no, con el almacén caído se dibujaba sobre el ícono de imagen rota y
	 * se guardaban porcentajes de ESE cuadrito como si fueran del documento.
	 */
	// Lo que dice el `<img>` (cargó o no). Lo que ve el resto del componente (`estadoDocumento`) lo combina con el de PINTAR la
	// página: un PDF cuya página no se pudo pintar tampoco se puede marcar.
	let estadoImagen = $state<'cargando' | 'listo' | 'fallo'>('cargando');

	// La imagen sale de la página pedida (`usarPaginaDeEjemplo`): la 1 es la imagen de siempre y las demás se pintan del PDF
	// original. Depende de valores simples del documento (ruta, id), no de su objeto, así que recargar la biblioteca con el modal
	// abierto —que reemplaza el objeto— no vuelve a pintar la imagen debajo de quien dibuja (ver el comentario de arriba).
	const vista = usarPaginaDeEjemplo(() => ({ doc: abierto ? documento : null, pagina, contar: true }));
	const totalPaginas = $derived(vista.numPaginas ?? 1);
	const fuente = $derived(vista.url);
	const estadoDocumento = $derived(vista.estado === 'listo' ? estadoImagen : vista.estado);

	// Otra imagen es otra carga.
	$effect.pre(() => {
		void fuente;
		untrack(() => {
			estadoImagen = 'cargando';
		});
	});

	/** De los recortes de los demás campos, los que están en la página que se ve (los de otras páginas no estorban aquí). */
	const otrosEnPagina = $derived(otrosRecortes.filter((o) => paginaDeRecorte(o.recorte) === pagina));

	function irAPagina(n: number) {
		const destino = clamp(Math.round(n), 1, totalPaginas);
		if (destino === pagina) return;
		pagina = destino;
		// Lo que se estaba arrastrando era de la otra página.
		arrastre = null;
		recorteAlIniciar = null;
		recorte = recorteExistente && paginaDeRecorte(recorteExistente) === destino ? { ...recorteExistente } : null;
		modoRecorte = true;
		onCambioPagina?.(destino);
	}

	// Una página recordada de más (o un recorte de una página que el documento ya no tiene) se acota en cuanto se sabe cuántas hay.
	$effect(() => {
		const n = vista.numPaginas;
		if (abierto && n && pagina > n) untrack(() => irAPagina(n));
	});

	/** RePág / AvPág pasan de página, salvo mientras se teclea en el cuadro del número. */
	function teclasDePagina(e: KeyboardEvent) {
		if (totalPaginas <= 1) return;
		const destino = e.target as HTMLElement | null;
		if (destino && (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA')) return;
		if (e.key === 'PageDown') {
			e.preventDefault();
			irAPagina(pagina + 1);
		} else if (e.key === 'PageUp') {
			e.preventDefault();
			irAPagina(pagina - 1);
		}
	}

	// El documento compartido ya es un raster (PNG del PDF renderizado, o la
	// imagen original tal cual) — a diferencia del modal de carga, aquí ya no
	// hace falta distinguir PDF de imagen: siempre se muestra como `<img>`.
	let imgEl = $state<HTMLImageElement>();

	// Un `<img>` que ya estaba cargado (misma fuente, desde caché) no vuelve a
	// disparar `load`: se mira su estado en cuanto existe.
	$effect(() => {
		const img = imgEl;
		if (!abierto || !img) return;
		untrack(() => {
			if (img.complete) estadoImagen = img.naturalWidth > 0 ? 'listo' : 'fallo';
		});
	});

	let contenedorEl = $state<HTMLDivElement>();
	let arrastre: 'nuevo' | 'mover' | 'nw' | 'ne' | 'sw' | 'se' | null = null;
	let inicioPuntero = { x: 0, y: 0 };
	let recorteAlIniciar: Recorte | null = null;

	// En porcentaje de la IMAGEN, no del contenedor: el contenedor suma su
	// borde, y el rectángulo (hijo absoluto del contenedor) y la miniatura de
	// Calibración (`RecorteDeDocumento`) se miden contra la imagen. Así los
	// tres —puntero, rectángulo y lo que se guarda— hablan del mismo marco.
	function puntoPct(e: PointerEvent) {
		const rect = (imgEl ?? contenedorEl!).getBoundingClientRect();
		return {
			x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
			y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100)
		};
	}

	/** "Recortar" ya NO alterna (cambio pedido el 2026-09-05): solo ACTIVA el
	 *  modo recorte, nunca lo apaga — picarlo de nuevo con el modo ya activo
	 *  no hace nada. Para salir del modo recorte (y borrar el rectángulo a
	 *  medias) está "Cancelar", que sigue siendo el único camino de apagarlo. */
	function activarRecorte() {
		modoRecorte = true;
	}
	function cancelarRecorte() {
		modoRecorte = false;
		recorte = null;
	}

	// Cerrar el modal al guardar es la confirmación: vuelve a la lista de
	// campos de "Calibración" de la que salió, mismo criterio que "Guardar
	// configuración" del wizard.
	//
	// Se guardan SOLO las 4 coordenadas (desde el 2026-09-25). Antes se
	// guardaba además una copia en PNG de los píxeles del pedazo, en base64
	// dentro de localStorage: la puerta que más cuota gastaba de todo el
	// módulo, para una imagen que se puede volver a sacar del documento cuando
	// haga falta. Calibración ahora la dibuja así: `RecorteDeDocumento.svelte`.
	function guardarCopia() {
		if (!tipoId || !documento || !campoNombre || !recorte || recorte.w === 0 || recorte.h === 0) return;
		if (estadoDocumento !== 'listo') return;
		const guardado = guardarRecorteEjemplo(tipoId, documento.id, campoNombre, { recorte: { ...recorte, pagina } });
		if (!guardado) return;
		cerrar();
	}

	function iniciarEnLienzo(e: PointerEvent) {
		if (!modoRecorte || estadoDocumento !== 'listo') return;
		arrastre = 'nuevo';
		inicioPuntero = puntoPct(e);
		recorte = { x: inicioPuntero.x, y: inicioPuntero.y, w: 0, h: 0 };
	}
	function iniciarMover(e: PointerEvent) {
		if (!modoRecorte || !recorte || estadoDocumento !== 'listo') return;
		e.stopPropagation();
		arrastre = 'mover';
		inicioPuntero = puntoPct(e);
		recorteAlIniciar = { ...recorte };
	}
	function iniciarRedimensionar(esquina: 'nw' | 'ne' | 'sw' | 'se', e: PointerEvent) {
		if (!recorte || estadoDocumento !== 'listo') return;
		e.stopPropagation();
		arrastre = esquina;
		inicioPuntero = puntoPct(e);
		recorteAlIniciar = { ...recorte };
	}

	function moverPuntero(e: PointerEvent) {
		if (!arrastre) return;
		const p = puntoPct(e);
		if (arrastre === 'nuevo') {
			recorte = {
				x: Math.min(inicioPuntero.x, p.x),
				y: Math.min(inicioPuntero.y, p.y),
				w: Math.abs(p.x - inicioPuntero.x),
				h: Math.abs(p.y - inicioPuntero.y)
			};
			return;
		}
		if (!recorteAlIniciar) return;
		const dx = p.x - inicioPuntero.x;
		const dy = p.y - inicioPuntero.y;
		if (arrastre === 'mover') {
			recorte = {
				...recorteAlIniciar,
				x: clamp(recorteAlIniciar.x + dx, 0, 100 - recorteAlIniciar.w),
				y: clamp(recorteAlIniciar.y + dy, 0, 100 - recorteAlIniciar.h)
			};
			return;
		}
		// Esquinas: cada una mueve solo sus dos bordes propios.
		let { x, y, w, h } = recorteAlIniciar;
		if (arrastre.includes('n')) {
			y = recorteAlIniciar.y + dy;
			h = recorteAlIniciar.h - dy;
		}
		if (arrastre.includes('s')) {
			h = recorteAlIniciar.h + dy;
		}
		if (arrastre.includes('w')) {
			x = recorteAlIniciar.x + dx;
			w = recorteAlIniciar.w - dx;
		}
		if (arrastre.includes('e')) {
			w = recorteAlIniciar.w + dx;
		}
		// Si arrastraste una esquina más allá de la opuesta, el ancho/alto se
		// vuelve negativo: se normaliza en vez de dejar un rectángulo invertido.
		if (w < 0) {
			x += w;
			w = -w;
		}
		if (h < 0) {
			y += h;
			h = -h;
		}
		recorte = { x: clamp(x, 0, 100), y: clamp(y, 0, 100), w: Math.min(w, 100), h: Math.min(h, 100) };
	}
	function terminarPuntero() {
		arrastre = null;
		recorteAlIniciar = null;
	}
</script>

<DialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) cerrar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/40"
		/>
		<DialogPrimitive.Content
			data-testid="modal-recortar-ejemplo"
			onkeydown={teclasDePagina}
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[88vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<div class="min-w-0 flex-1">
					<DialogPrimitive.Title class="truncate text-sm font-medium text-foreground">
						{documento?.nombre ?? 'Recortar ejemplo'}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="mt-1 text-xs text-muted-foreground">
						Utiliza la herramienta de recorte para seleccionar en el documento la información que
						se necesita extraer para "<span class="font-semibold text-foreground">{campoNombre}</span>".
					</DialogPrimitive.Description>
					{#if recorteExistente && paginaDeRecorte(recorteExistente) !== pagina}
						<!-- El campo ya tiene recorte, pero en OTRA página que la que se está viendo: sin este aviso parecería que no tiene
						     ninguno, y guardar aquí lo reemplazaría sin que se supiera. -->
						<p data-testid="recorte-en-otra-pagina" class="mt-1 text-xs text-muted-foreground">
							Este campo ya tiene un recorte en la página {paginaDeRecorte(recorteExistente)}.
							<button
								type="button"
								data-testid="ir-a-recorte-guardado"
								class="font-medium text-primary underline underline-offset-2"
								onclick={() => irAPagina(paginaDeRecorte(recorteExistente))}
							>
								Ir a esa página
							</button>
							· Si recortas aquí, lo reemplaza.
						</p>
					{/if}
				</div>
				<DialogPrimitive.Close aria-label="Cerrar" onclick={cerrar}>
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
				{#if documento && estadoDocumento === 'fallo'}
					<!-- Mismo aviso que la miniatura de Calibración: sin el documento a
					     la vista no hay sobre qué marcar, y dibujar sobre el ícono de
					     imagen rota guardaría coordenadas de nada. -->
					<p
						data-testid="recortador-sin-documento"
						class="mx-auto mt-10 max-w-md rounded-lg border border-dashed border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
					>
						{#if totalPaginas > 1}
							No se pudo cargar la página {pagina} del documento, así que por ahora no se puede marcar ni cambiar
							este recorte en ella. Puedes ir a otra página, o cerrar e intentar de nuevo en unos minutos.
						{:else}
							No se pudo cargar el documento, así que por ahora no se puede marcar ni cambiar este
							recorte. Lo ya guardado sigue igual; cierra e intenta de nuevo en unos minutos.
						{/if}
					</p>
				{:else if documento && !fuente}
					<!-- Pintando la página (la 2 en adelante sale del PDF original). La barra de abajo sigue a la vista: se puede cambiar
					     de página sin esperar. -->
					<p data-testid="recortador-cargando-pagina" class="mx-auto mt-10 text-center text-sm text-muted-foreground">
						Cargando la página {pagina}…
					</p>
				{:else if documento}
					<div class="flex justify-center pb-16">
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							bind:this={contenedorEl}
							class="relative inline-block touch-none border border-border bg-card shadow-sm"
							style="transform: scale({zoom}); transform-origin: top center;"
							onpointerdown={iniciarEnLienzo}
							onpointermove={moverPuntero}
							onpointerup={terminarPuntero}
							onpointercancel={terminarPuntero}
						>
							<img
								bind:this={imgEl}
								src={fuente}
								onload={(e) =>
									(estadoImagen =
										(e.currentTarget as HTMLImageElement).naturalWidth > 0 ? 'listo' : 'fallo')}
								onerror={() => (estadoImagen = 'fallo')}
								alt={totalPaginas > 1 ? `Página ${pagina} del documento de ejemplo` : 'Documento de ejemplo'}
								class="block max-w-full select-none"
								draggable="false"
							/>

							<!-- Recortes YA GUARDADOS de los OTROS campos de este mismo
							     documento — solo contexto visual, de SOLO LECTURA.
							     `pointer-events-none` es OBLIGATORIO: sin él, estos overlays
							     interceptarían los clics/arrastres del lienzo y del
							     rectángulo activo, rompiendo el dibujo/movimiento/
							     redimensionado de arriba. Va ANTES del bloque `{#if recorte}`
							     para que el rectángulo activo quede visualmente por encima. -->
							{#each otrosEnPagina as otro (otro.nombreCampo)}
								{@const color = colorParaCampo(otro.nombreCampo)}
								{@const tapada = etiquetaTapadaPorActivo(otro.recorte)}
								<div
									class="absolute pointer-events-none border-2 {color.borde} {color.relleno}"
									style="left:{otro.recorte.x}%; top:{otro.recorte.y}%; width:{otro.recorte.w}%; height:{otro.recorte.h}%;"
								>
									<!-- Se mueve a la orilla de ABAJO cuando el rectángulo
									     ACTIVO (el que se está dibujando ahora) le estorba
									     encima — pedido explícito 2026-09-05. -->
									<span
										class="absolute left-0 truncate rounded {color.etiqueta} px-1 py-0.5 text-[10px] leading-none whitespace-nowrap text-white {tapada
											? '-bottom-5'
											: '-top-5'}"
									>
										{otro.nombreCampo}
									</span>
								</div>
							{/each}

							{#if recorte}
								<!-- El rectángulo YA DIBUJADO se puede volver a arrastrar por su
								     cuerpo para reposicionarlo (`iniciarMover`, con
								     `stopPropagation()` para no disparar `iniciarEnLienzo` del
								     contenedor y empezar uno nuevo encima). `cursor-move` es solo
								     la señal visual de que se puede agarrar — a pedido explícito,
								     porque sin ella no era obvio que ya funcionaba. -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="absolute cursor-move border-2 border-primary bg-primary/10"
									style="left:{recorte.x}%; top:{recorte.y}%; width:{recorte.w}%; height:{recorte.h}%;"
									onpointerdown={iniciarMover}
								>
									{#each ['nw', 'ne', 'sw', 'se'] as const as esquina (esquina)}
										<span
											class="absolute size-3 rounded-full border-2 border-primary bg-background {esquina.includes(
												'n'
											)
												? '-top-1.5'
												: '-bottom-1.5'} {esquina.includes('w') ? '-left-1.5' : '-right-1.5'}"
											style="cursor: {esquina}-resize;"
											onpointerdown={(e) => iniciarRedimensionar(esquina, e)}
										></span>
									{/each}
								</div>
							{/if}
						</div>
					</div>

				{/if}

				{#if documento && (estadoDocumento !== 'fallo' || totalPaginas > 1)}
					<!-- Barra flotante: mismo lugar y forma que el resto del módulo. Con una sola página que no se pudo pintar no hay nada
					     que hacer con ella y se queda fuera, como siempre; con varias, SÍ: hay que poder irse a otra página. -->
					<div
						data-testid="barra-recortador"
						class="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#0f172a] px-2 py-2 text-white shadow-lg"
					>
						<button
							type="button"
							aria-label="Alejar"
							class="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-card/10 disabled:pointer-events-none disabled:opacity-40"
							disabled={zoom <= 0.5}
							onclick={() => (zoom = clamp(zoom - 0.25, 0.5, 2.5))}
						>
							<ZoomOut class="size-4" />
						</button>
						<button
							type="button"
							aria-label="Acercar"
							class="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-card/10 disabled:pointer-events-none disabled:opacity-40"
							disabled={zoom >= 2.5}
							onclick={() => (zoom = clamp(zoom + 0.25, 0.5, 2.5))}
						>
							<ZoomIn class="size-4" />
						</button>
						{#if totalPaginas > 1}
							<span class="mx-1 h-5 w-px bg-card/20"></span>
							<NavegadorDePaginas {pagina} total={totalPaginas} onCambio={irAPagina} />
						{/if}
						<span class="mx-1 h-5 w-px bg-card/20"></span>
						<button
							type="button"
							data-testid="boton-recortar"
							aria-pressed={modoRecorte}
							class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors {modoRecorte
								? 'bg-card/15'
								: 'hover:bg-card/10'}"
							onclick={activarRecorte}
						>
							<Crop class="size-4" />
							Recortar
						</button>
						{#if modoRecorte}
							<button
								type="button"
								class="rounded-full px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-card/10"
								onclick={cancelarRecorte}
							>
								Cancelar
							</button>
							<button
								type="button"
								data-testid="boton-guardar-recorte"
								disabled={!recorte || recorte.w === 0 || recorte.h === 0 || estadoDocumento !== 'listo'}
								class="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
								onclick={guardarCopia}
							>
								<Save class="size-4" />
								Guardar
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
