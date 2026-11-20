<script lang="ts" module>
	import type { Ubicacion } from '$lib/documentos/ubicaciones';

	/** Cómo va la ubicación de los campos en UN documento (las ubicaciones mismas viajan aparte: se pueden editar a mano aunque la búsqueda falle). */
	export type EstadoUbicacion = { fase: 'cargando' } | { fase: 'listo' } | { fase: 'error'; mensaje: string } | { fase: 'no-soportado' };

	/** `dibujar`: un recuadro nuevo (el valor que se había leído ya no aplica); `ajustar`: el mismo, movido o de otro tamaño. */
	export type CambioDeCaja = { documento: number; campo: string; pagina: number; caja: Ubicacion['caja']; modo: 'dibujar' | 'ajustar' };

	/** Un recuadro dibujado con «Dibujar un campo», antes de ser campo: dónde está y qué etiqueta lleva mientras se revisa. */
	export type RecuadroNuevo = { documento: number; pagina: number; caja: Ubicacion['caja']; etiqueta: string };
</script>

<script lang="ts">
	/**
	 * Un documento de ejemplo con los campos ELEGIDOS marcados encima (2026-11-11, Moibe: «cuando hacemos la creación de los campos de extracción
	 * con un documento, que a un lado mostremos el documento y marcados etiquetados los campos seleccionados»). Va a un lado de la lista de
	 * `GenerarCamposDesdeDocumento.svelte`: cada campo marcado en la lista es un recuadro con su nombre sobre el documento; al pasar el puntero por un
	 * renglón (o por un recuadro) ese campo se resalta y, si está en otra página, la vista salta a ella.
	 *
	 * **Editar el recuadro (2026-11-11, Moibe: «la herramienta de dibujo me tiene que permitir editar campos existentes»; eligió datos Y recuadro).**
	 * Un clic en un recuadro abre ese campo para editarlo (`onElegir`). Mientras se edita (`editando`), su recuadro se arrastra para moverlo, se jala
	 * de una esquina para cambiar su tamaño (o con las flechas del teclado), se dibuja de nuevo arrastrando sobre la página, o se quita. Si el campo
	 * no está marcado en este documento, la página queda lista para dibujarlo. Cada cambio sale por `onCaja`; aquí solo se dibuja.
	 *
	 * **Dibujar un campo nuevo (2026-11-12, Moibe eligió «Dibujar crea el campo»).** Con `dibujarNuevo`, la página espera un recuadro que todavía no
	 * es de ningún campo; al soltarlo sale por `onNuevo` y quien abrió esto propone el campo con lo que hay dentro. Mientras se revisa, `nuevo` se
	 * pinta punteado con su etiqueta.
	 *
	 * **Las etiquetas no tapan lo marcado (2026-11-12).** En renglones seguidos, la etiqueta de cada recuadro (que iba siempre arriba) tapaba el
	 * renglón de arriba y se encimaba con la vecina. Ahora cada una va arriba, a la derecha, abajo o a la izquierda, donde no pise otro recuadro ni
	 * otra etiqueta (`colocarEtiquetas`).
	 *
	 * Las ubicaciones las da Gemini (`/api/procesadores/ubicar-campos`) o la persona. Lo que hay dentro de cada recuadro completa su campo (la
	 * descripción, el tipo y la estructura: lo hace `GenerarCamposDesdeDocumento`); el recuadro mismo no se guarda ni viaja a Google. Un PDF se pinta
	 * página por página con pdf.js (`abrirPdf`); una imagen, tal cual. El TIFF no se puede pintar en el navegador. Nada sale de la pestaña: los
	 * documentos se pintan desde la memoria.
	 */
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	import { Button } from '$lib/components/ui/button/index.js';
	import { colocarEtiquetas, type Lado } from '$lib/documentos/etiquetas';
	import { abrirPdf, type PdfAbierto } from '$lib/documentos/paginasPdf';
	import { cajaEnPorcentaje, esPdf } from '$lib/documentos/ubicaciones';

	type Caja = Ubicacion['caja'];
	type Modo = 'mover' | 'nw' | 'ne' | 'sw' | 'se' | 'dibujar';

	let {
		documentos,
		estados,
		ubicaciones: ubicacionesPorDocumento,
		visibles,
		resaltado = null,
		editando = null,
		onResaltar,
		onElegir,
		onCaja,
		onQuitar,
		dibujarNuevo = false,
		nuevo = null,
		onNuevo,
		onCancelarDibujo,
		indice = $bindable(0)
	}: {
		documentos: File[];
		/** Uno por documento, en el mismo orden. */
		estados: EstadoUbicacion[];
		/** Uno por documento: dónde está cada campo (de la búsqueda o puesto a mano). */
		ubicaciones: Ubicacion[][];
		/** Los nombres de los campos elegidos: solo esos se marcan (y el que se edita). */
		visibles: string[];
		resaltado?: string | null;
		/** El campo que se está editando: su recuadro se puede mover, cambiar de tamaño, dibujar de nuevo o quitar. */
		editando?: string | null;
		onResaltar?: (campo: string | null) => void;
		/** Clic en un recuadro: editar ese campo. */
		onElegir?: (campo: string) => void;
		onCaja?: (cambio: CambioDeCaja) => void;
		onQuitar?: (documento: number, campo: string) => void;
		/** «Dibujar un campo»: la página espera un recuadro nuevo, que no es de ningún campo todavía. */
		dibujarNuevo?: boolean;
		/** El recuadro dibujado para el campo nuevo, mientras se revisa (se pinta punteado). */
		nuevo?: RecuadroNuevo | null;
		/** Se soltó el recuadro del campo nuevo. */
		onNuevo?: (dibujo: { documento: number; pagina: number; caja: Ubicacion['caja'] }) => void;
		onCancelarDibujo?: () => void;
		/** El documento que se está enseñando (la pestaña elegida). */
		indice?: number;
	} = $props();

	let pagina = $state(1);
	let numPaginas = $state(1);
	let urlPagina = $state<string | null>(null);
	let cargandoPagina = $state(false);
	let errorPagina = $state('');
	let pdf: PdfAbierto | null = null;

	const actual = $derived(Math.min(indice, documentos.length - 1));
	const archivoActual = $derived(documentos[actual]);
	const estado = $derived(estados[actual] ?? { fase: 'cargando' });
	const ubicaciones = $derived(ubicacionesPorDocumento[actual] ?? []);
	const marcables = $derived(ubicaciones.filter((u) => visibles.includes(u.campo) || u.campo === editando));
	const enEstaPagina = $derived(marcables.filter((u) => u.pagina === pagina));
	const contadas = $derived(ubicaciones.filter((u) => visibles.includes(u.campo)));
	const sinUbicar = $derived(visibles.filter((n) => !ubicaciones.some((u) => u.campo === n)));

	// ── Edición del recuadro ──────────────────────────────────────────────────────────────────────────────
	/** El tamaño mínimo de un recuadro (en milésimas de la página): uno más chico es un clic, no un dibujo. */
	const MINIMO = 8;
	let lienzo = $state<HTMLDivElement | null>(null);
	/** «Dibujar de nuevo» pulsado (sin recuadro, dibujar es lo único que se puede hacer). */
	let redibujar = $state(false);
	let arrastre = $state<{ modo: Modo; y0: number; x0: number; inicio: Caja; caja: Caja } | null>(null);
	const cajaEditada = $derived(editando ? ubicaciones.find((u) => u.campo === editando) : undefined);
	/** Hay página pintada en la que se puede marcar (no un TIFF ni un PDF que no abrió). */
	const puedeMarcar = $derived(!!urlPagina && !errorPagina && estado.fase !== 'no-soportado');
	const sePuedeEditar = $derived(!!editando && puedeMarcar);
	const dibujando = $derived((sePuedeEditar && (redibujar || !cajaEditada)) || (dibujarNuevo && puedeMarcar));
	/** El recuadro del campo nuevo, si está en el documento y la página que se ven. */
	const nuevoAqui = $derived(nuevo && nuevo.documento === actual && nuevo.pagina === pagina ? nuevo : null);

	// ── Dónde va cada etiqueta (2026-11-12): donde no tape otro recuadro ni otra etiqueta ─────────────────────────
	let anchoLienzo = $state(0);
	let altoLienzo = $state(0);
	let medidor: CanvasRenderingContext2D | null = null;
	/** El ancho en píxeles de una etiqueta (texto de 10 px más su relleno), medido con la letra de la página. */
	function anchoDeEtiqueta(texto: string): number {
		if (!medidor && typeof document !== 'undefined') {
			medidor = document.createElement('canvas').getContext('2d');
			if (medidor) medidor.font = `500 10px ${getComputedStyle(document.body).fontFamily}`;
		}
		return (medidor ? medidor.measureText(texto).width : texto.length * 6) + 10;
	}
	const CLAVE_NUEVO = '\u0000nuevo';
	const lados = $derived(
		colocarEtiquetas(
			[
				...enEstaPagina.map((u) => ({
					clave: u.campo,
					caja: u.caja,
					anchoPx: anchoDeEtiqueta(u.campo),
					altoPx: 15,
					// La del que se edita va más lejos: sus esquinas salen 11 px por fuera.
					separacionPx: u.campo === editando && !dibujando ? 14 : 4
				})),
				...(nuevoAqui ? [{ clave: CLAVE_NUEVO, caja: nuevoAqui.caja, anchoPx: anchoDeEtiqueta(nuevoAqui.etiqueta), altoPx: 15, separacionPx: 4 }] : [])
			],
			{ anchoPx: anchoLienzo, altoPx: altoLienzo }
		)
	);
	/**
	 * Las clases que ponen la etiqueta de un recuadro en su lado. `bottom-full`/`top-full` cuentan desde DENTRO del borde (2 px): con 3 px de margen la
	 * etiqueta queda 1 px fuera del recuadro, sin pisar su borde (con 1 px lo pisaba, y en renglones seguidos tapaba el dato de arriba).
	 */
	function claseDeLado(lado: Lado, lejos: boolean): string {
		switch (lado) {
			case 'arriba':
				return `bottom-full left-[-2px] ${lejos ? 'mb-3' : 'mb-[3px]'}`;
			case 'abajo':
				return `top-full left-[-2px] ${lejos ? 'mt-3' : 'mt-[3px]'}`;
			case 'derecha':
				return `left-full top-1/2 -translate-y-1/2 ${lejos ? 'ml-3.5' : 'ml-1'}`;
			case 'izquierda':
				return `right-full top-1/2 -translate-y-1/2 ${lejos ? 'mr-3.5' : 'mr-1'}`;
		}
	}

	// Otro campo, otro documento, o se entra o sale de «Dibujar un campo»: se empieza sin «Dibujar de nuevo» y sin arrastre a medias.
	$effect(() => {
		void editando;
		void actual;
		void dibujarNuevo;
		redibujar = false;
		arrastre = null;
	});

	const limitar = (n: number, min = 0, max = 1000) => Math.min(max, Math.max(min, n));

	/** El punto del puntero en milésimas de la página: `[y, x]`. */
	function punto(e: PointerEvent): [number, number] {
		const r = lienzo!.getBoundingClientRect();
		return [limitar(((e.clientY - r.top) / r.height) * 1000), limitar(((e.clientX - r.left) / r.width) * 1000)];
	}

	function calcular(a: NonNullable<typeof arrastre>, y: number, x: number): Caja {
		const [ymin, xmin, ymax, xmax] = a.inicio;
		if (a.modo === 'dibujar') return [Math.min(a.y0, y), Math.min(a.x0, x), Math.max(a.y0, y), Math.max(a.x0, x)];
		const dy = y - a.y0;
		const dx = x - a.x0;
		if (a.modo === 'mover') {
			const my = limitar(dy, -ymin, 1000 - ymax);
			const mx = limitar(dx, -xmin, 1000 - xmax);
			return [ymin + my, xmin + mx, ymax + my, xmax + mx];
		}
		const arriba = a.modo === 'nw' || a.modo === 'ne';
		const izquierda = a.modo === 'nw' || a.modo === 'sw';
		return [
			arriba ? limitar(ymin + dy, 0, ymax - MINIMO) : ymin,
			izquierda ? limitar(xmin + dx, 0, xmax - MINIMO) : xmin,
			arriba ? ymax : limitar(ymax + dy, ymin + MINIMO, 1000),
			izquierda ? xmax : limitar(xmax + dx, xmin + MINIMO, 1000)
		];
	}

	function empezar(e: PointerEvent, modo: Modo, inicio: Caja) {
		if (e.button !== 0 || !lienzo) return;
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		const [y, x] = punto(e);
		arrastre = { modo, y0: y, x0: x, inicio, caja: modo === 'dibujar' ? [y, x, y, x] : inicio };
	}

	function seguir(e: PointerEvent) {
		if (!arrastre || !lienzo) return;
		const [y, x] = punto(e);
		arrastre.caja = calcular(arrastre, y, x);
	}

	function soltar() {
		const a = arrastre;
		arrastre = null;
		if (!a) return;
		const caja = a.caja.map((n) => Math.round(n)) as Caja;
		if (caja[2] - caja[0] < MINIMO || caja[3] - caja[1] < MINIMO) return; // un clic suelto, no un recuadro
		// El recuadro de un campo que todavía no existe: quien abrió esto propone el campo con lo que hay dentro.
		if (a.modo === 'dibujar' && dibujarNuevo) {
			onNuevo?.({ documento: actual, pagina, caja });
			return;
		}
		if (!editando) return;
		if (a.modo !== 'dibujar' && caja.every((n, i) => n === Math.round(a.inicio[i]))) return;
		const dibujado = a.modo === 'dibujar';
		redibujar = false;
		onCaja?.({ documento: actual, campo: editando, pagina: dibujado ? pagina : (cajaEditada?.pagina ?? pagina), caja, modo: dibujado ? 'dibujar' : 'ajustar' });
	}

	/** Las flechas mueven el recuadro que se edita (con Mayús, más rápido; con Alt, cambian su tamaño). */
	function teclas(e: KeyboardEvent, u: Ubicacion) {
		const paso = e.shiftKey ? 25 : 5;
		const d = { ArrowUp: [-paso, 0], ArrowDown: [paso, 0], ArrowLeft: [0, -paso], ArrowRight: [0, paso] }[e.key];
		if (!d) return;
		e.preventDefault();
		const [ymin, xmin, ymax, xmax] = u.caja;
		const caja: Caja = e.altKey
			? [ymin, xmin, limitar(ymax + d[0], ymin + MINIMO, 1000), limitar(xmax + d[1], xmin + MINIMO, 1000)]
			: (() => {
					const my = limitar(d[0], -ymin, 1000 - ymax);
					const mx = limitar(d[1], -xmin, 1000 - xmax);
					return [ymin + my, xmin + mx, ymax + my, xmax + mx] as Caja;
				})();
		onCaja?.({ documento: actual, campo: u.campo, pagina: u.pagina, caja, modo: 'ajustar' });
	}

	const ESQUINAS: { modo: Modo; clase: string }[] = [
		{ modo: 'nw', clase: '-top-[11px] -left-[11px] cursor-nwse-resize' },
		{ modo: 'ne', clase: '-top-[11px] -right-[11px] cursor-nesw-resize' },
		{ modo: 'sw', clase: '-bottom-[11px] -left-[11px] cursor-nesw-resize' },
		{ modo: 'se', clase: '-bottom-[11px] -right-[11px] cursor-nwse-resize' }
	];
	// Las esquinas van POR FUERA del recuadro: dentro taparían uno chico (un «Sexo» mide ~8 px) y ya no se podría arrastrar.

	// ── Pintar el documento ───────────────────────────────────────────────────────────────────────────────
	// Abrir el documento elegido: una imagen se enseña tal cual; un PDF se abre con pdf.js y se pinta la página que toque.
	$effect(() => {
		const archivo = archivoActual;
		if (!archivo) return;
		let vivo = true;
		let url: string | null = null;
		pagina = 1;
		numPaginas = 1;
		errorPagina = '';
		urlPagina = null;
		if (!esPdf(archivo)) {
			url = URL.createObjectURL(archivo);
			urlPagina = url;
		} else {
			cargandoPagina = true;
			void archivo
				.arrayBuffer()
				.then((bytes) => abrirPdf(bytes))
				.then((abierto) => {
					if (!vivo) return void abierto.cerrar();
					pdf = abierto;
					numPaginas = abierto.numPaginas;
					pintar(1);
				})
				.catch(() => {
					if (vivo) {
						errorPagina = 'No se pudo abrir este PDF para enseñarlo.';
						cargandoPagina = false;
					}
				});
		}
		return () => {
			vivo = false;
			if (url) URL.revokeObjectURL(url);
			if (pdf) void pdf.cerrar().catch(() => undefined);
			pdf = null;
		};
	});

	// La imagen de la página que se está enseñando de un PDF; se revoca al cambiar.
	let urlPdf: string | null = null;
	let turno = 0;
	function pintar(n: number) {
		if (!pdf) return;
		const mio = ++turno;
		cargandoPagina = true;
		pdf.renderizar(n)
			.then((blob) => {
				if (mio !== turno) return;
				if (urlPdf) URL.revokeObjectURL(urlPdf);
				urlPdf = URL.createObjectURL(blob);
				urlPagina = urlPdf;
				pagina = n;
			})
			.catch(() => {
				if (mio === turno) errorPagina = 'No se pudo pintar esta página.';
			})
			.finally(() => {
				if (mio === turno) cargandoPagina = false;
			});
	}
	$effect(() => () => {
		if (urlPdf) URL.revokeObjectURL(urlPdf);
	});

	// Al resaltar un campo (desde la lista) que está en otra página, se salta a esa página.
	$effect(() => {
		const u = resaltado ? marcables.find((x) => x.campo === resaltado) : undefined;
		if (u && u.pagina !== pagina && pdf && u.pagina <= numPaginas) pintar(u.pagina);
	});
</script>

<div class="flex min-h-0 flex-col gap-3" data-testid="documento-con-campos">
	{#if documentos.length > 1}
		<div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Documentos de ejemplo">
			{#each documentos as d, i (i)}
				<button
					type="button"
					role="tab"
					aria-selected={i === actual}
					data-testid="documento-con-campos-pestana"
					class={[
						'max-w-48 truncate rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
						i === actual ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
					]}
					onclick={() => (indice = i)}
				>
					{d.name}
				</button>
			{/each}
		</div>
	{/if}

	{#snippet barraDeEdicion()}
		<!-- Qué se puede hacer con el recuadro del campo que se edita, en este documento. Va DEBAJO del documento: arriba lo empujaría al aparecer. -->
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground" data-testid="documento-con-campos-edicion" aria-live="polite">
			<p class="min-w-0 flex-1">
				{#if dibujando}
					Arrastra sobre la página para dibujar el recuadro de <span class="font-medium">«{editando}»</span>.
				{:else}
					Arrastra el recuadro de <span class="font-medium">«{editando}»</span> para moverlo, o jala una esquina para cambiar su tamaño.
				{/if}
			</p>
			<div class="flex shrink-0 items-center gap-1">
				{#if cajaEditada}
					{#if redibujar}
						<Button variant="ghost" size="sm" data-testid="documento-con-campos-cancelar-dibujo" onclick={() => (redibujar = false)}>Cancelar</Button>
					{:else}
						<Button variant="outline" size="sm" data-testid="documento-con-campos-redibujar" onclick={() => (redibujar = true)}>Dibujar de nuevo</Button>
						<Button
							variant="ghost"
							size="sm"
							class="text-destructive hover:text-destructive"
							data-testid="documento-con-campos-quitar"
							onclick={() => editando && onQuitar?.(actual, editando)}
						>
							Quitar recuadro
						</Button>
					{/if}
				{/if}
			</div>
		</div>
	{/snippet}

	<div class="relative min-h-64 overflow-auto rounded-lg border border-border bg-muted/40 lg:max-h-[62vh]">
		{#if estado.fase === 'no-soportado'}
			<p class="p-6 text-center text-sm text-muted-foreground" data-testid="documento-con-campos-tiff">
				Este formato (TIFF) no se puede enseñar en el navegador. Los campos se proponen igual.
			</p>
		{:else if errorPagina}
			<p class="p-6 text-center text-sm text-muted-foreground">{errorPagina}</p>
		{:else if urlPagina}
			<div class="relative" bind:this={lienzo} bind:clientWidth={anchoLienzo} bind:clientHeight={altoLienzo}>
				<img
					src={urlPagina}
					alt="Página {pagina} de «{archivoActual.name}»"
					class="block h-auto w-full select-none"
					draggable="false"
					data-testid="documento-con-campos-imagen"
				/>
				{#each enEstaPagina as u (u.campo)}
					{@const editable = u.campo === editando && !dibujando}
					{@const enArrastre = editable && arrastre !== null && arrastre.modo !== 'dibujar'}
					{@const c = cajaEnPorcentaje(enArrastre && arrastre ? arrastre.caja : u.caja)}
					{@const activo = resaltado === u.campo || u.campo === editando}
					<div
						class={[
							'absolute rounded-[3px] border-2 transition-opacity outline-none',
							activo ? 'z-20 border-amber-500 bg-amber-400/25' : 'z-10 border-primary bg-primary/10',
							(resaltado || editando) && !activo && 'opacity-35',
							editable ? 'cursor-move touch-none focus-visible:ring-3 focus-visible:ring-amber-500/50' : 'cursor-pointer',
							u.campo === editando && dibujando && 'opacity-40'
						]}
						style="top:{c.top}%;left:{c.left}%;width:{c.width}%;height:{c.height}%"
						title={editable ? undefined : u.valor ? `${u.campo}: ${u.valor} (clic para editar)` : `${u.campo} (clic para editar)`}
						role="button"
						tabindex="0"
						aria-label={editable ? `Recuadro de ${u.campo}: arrástralo o muévelo con las flechas` : `Editar ${u.campo}`}
						data-testid="marca-campo"
						data-campo={u.campo}
						data-editando={u.campo === editando ? '' : undefined}
						onpointerenter={() => onResaltar?.(u.campo)}
						onpointerleave={() => onResaltar?.(null)}
						onpointerdown={(e) => editable && empezar(e, 'mover', u.caja)}
						onpointermove={seguir}
						onpointerup={soltar}
						onpointercancel={() => (arrastre = null)}
						onclick={() => !editable && u.campo !== editando && onElegir?.(u.campo)}
						onkeydown={(e) => {
							if (editable) teclas(e, u);
							else if ((e.key === 'Enter' || e.key === ' ') && u.campo !== editando) {
								e.preventDefault();
								onElegir?.(u.campo);
							}
						}}
					>
						<span
							class={[
								'pointer-events-none absolute rounded-sm px-1 py-px text-[10px] leading-tight font-medium whitespace-nowrap',
								// Del lado donde no tapa otro recuadro ni otra etiqueta; la del que se edita, un poco más lejos, para que sus esquinas no la tapen.
								claseDeLado(lados[u.campo] ?? 'arriba', editable),
								activo ? 'bg-amber-500 text-black' : 'bg-primary text-primary-foreground'
							]}
							data-testid="marca-campo-etiqueta"
							data-lado={lados[u.campo] ?? 'arriba'}
						>
							{u.campo}
						</span>
						{#if editable}
							{#each ESQUINAS as esquina (esquina.modo)}
								<!-- Las esquinas son para el puntero; con el teclado, Alt + flechas cambia el tamaño. -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="absolute size-2.5 touch-none rounded-[2px] border-2 border-amber-500 bg-background {esquina.clase}"
									data-testid="marca-campo-esquina"
									data-esquina={esquina.modo}
									onpointerdown={(e) => empezar(e, esquina.modo, u.caja)}
									onpointermove={seguir}
									onpointerup={soltar}
									onpointercancel={() => (arrastre = null)}
								></span>
							{/each}
						{/if}
					</div>
				{/each}
				{#if nuevoAqui}
					<!-- El recuadro del campo nuevo, mientras se revisa lo que propone Biblioratum con él. -->
					{@const c = cajaEnPorcentaje(nuevoAqui.caja)}
					<div
						class="pointer-events-none absolute z-20 rounded-[3px] border-2 border-dashed border-amber-500 bg-amber-400/20"
						style="top:{c.top}%;left:{c.left}%;width:{c.width}%;height:{c.height}%"
						data-testid="marca-campo-nuevo"
					>
						<span
							class="absolute rounded-sm bg-amber-500 px-1 py-px text-[10px] leading-tight font-medium whitespace-nowrap text-black {claseDeLado(lados[CLAVE_NUEVO] ?? 'arriba', false)}"
						>
							{nuevoAqui.etiqueta}
						</span>
					</div>
				{/if}
				{#if dibujando}
					<!-- La superficie para dibujar: tapa la página entera mientras se dibuja el recuadro del campo que se edita (o el de uno nuevo). -->
					<div
						class="absolute inset-0 z-30 cursor-crosshair touch-none"
						data-testid="documento-con-campos-lienzo"
						aria-hidden="true"
						onpointerdown={(e) => empezar(e, 'dibujar', [0, 0, 0, 0])}
						onpointermove={seguir}
						onpointerup={soltar}
						onpointercancel={() => (arrastre = null)}
					>
						{#if arrastre?.modo === 'dibujar'}
							{@const c = cajaEnPorcentaje(arrastre.caja)}
							<div class="absolute rounded-[3px] border-2 border-dashed border-amber-500 bg-amber-400/20" style="top:{c.top}%;left:{c.left}%;width:{c.width}%;height:{c.height}%"></div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
		{#if cargandoPagina || (estado.fase === 'cargando' && urlPagina)}
			<div class="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center p-2">
				<span class="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs text-foreground shadow-sm" data-testid="documento-con-campos-ubicando">
					<LoaderCircle class="size-3.5 animate-spin text-primary" />
					{cargandoPagina ? 'Abriendo…' : 'Marcando los campos en el documento…'}
				</span>
			</div>
		{/if}
	</div>

	{#if dibujarNuevo}
		<!-- «Dibujar un campo»: qué hacer, y cómo salir. Debajo del documento, como la barra de edición. -->
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground" data-testid="documento-con-campos-dibujo-nuevo" aria-live="polite">
			<p class="min-w-0 flex-1">
				{puedeMarcar
					? 'Arrastra sobre la página para marcar el dato del campo nuevo. Biblioratum lo leerá y te propondrá el campo.'
					: 'Este documento no se puede marcar: elige otro para dibujar.'}
			</p>
			<Button variant="ghost" size="sm" class="shrink-0" data-testid="documento-con-campos-cancelar-nuevo" onclick={() => onCancelarDibujo?.()}>Cancelar</Button>
		</div>
	{:else if sePuedeEditar && editando}
		{@render barraDeEdicion()}
	{/if}

	<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
		<p data-testid="documento-con-campos-resumen" aria-live="polite">
			{#if estado.fase === 'listo'}
				{contadas.length === 1 ? '1 campo marcado' : `${contadas.length} campos marcados`}{sinUbicar.length > 0
					? ` · ${sinUbicar.length === 1 ? '1 no se encontró' : `${sinUbicar.length} no se encontraron`} en este documento`
					: ''}. De cada recuadro salen la descripción, el tipo y la estructura de su campo.
			{:else if estado.fase === 'error'}
				{estado.mensaje}
				{contadas.length > 0
					? `${contadas.length === 1 ? '1 campo marcado' : `${contadas.length} campos marcados`} a mano.`
					: 'Para marcar un campo, edítalo y dibuja su recuadro, o usa «Dibujar un campo».'}
			{/if}
		</p>
		{#if numPaginas > 1}
			<div class="flex items-center gap-1" data-testid="documento-con-campos-paginas">
				<button type="button" class="rounded-md p-1 hover:bg-muted disabled:opacity-40" aria-label="Página anterior" disabled={pagina <= 1 || cargandoPagina} onclick={() => pintar(pagina - 1)}>
					<ChevronLeft class="size-4" />
				</button>
				<span>Página {pagina} de {numPaginas}</span>
				<button type="button" class="rounded-md p-1 hover:bg-muted disabled:opacity-40" aria-label="Página siguiente" disabled={pagina >= numPaginas || cargandoPagina} onclick={() => pintar(pagina + 1)}>
					<ChevronRight class="size-4" />
				</button>
			</div>
		{/if}
	</div>
</div>
