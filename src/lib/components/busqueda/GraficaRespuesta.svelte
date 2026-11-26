<script lang="ts">
	/**
	 * La respuesta de la búsqueda como gráfica (NEX-610, 2026-11-26): barras para categorías, línea para fechas. La arma Biblioratum con las MISMAS
	 * filas de la tabla (`$lib/busqueda/grafica`): el modelo no la dibuja, y cambiar de vista, de columna o bajar la imagen no le pregunta nada.
	 *
	 * Una sola serie, así que no lleva leyenda: el título dice qué se grafica («Documentos por tipo documental»). Barras en el orden de la tabla si trae
	 * uno con sentido (Q1…Q4, de más a menos) y si no de mayor a menor, cada una con su número en la punta (por eso no hay eje de valores); «Otras», en
	 * gris, junta lo que pasa de 12. Línea: eje de valores con rejilla fina,
	 * fechas abajo, el número del último punto y cortes donde un periodo no tiene renglón. Al pasar el puntero (o con las flechas, con el foco en la
	 * gráfica) un aviso dice el valor y la categoría o fecha completa; nunca es la única forma de leerlo: los números están en la tabla.
	 *
	 * Colores: `--grafica-*` de `app.css`, uno para claro y otro para oscuro. «Descargar imagen» baja esta misma gráfica como PNG (`$lib/busqueda/png`).
	 */
	import ImageDown from '@lucide/svelte/icons/image-down';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import { MESES, formatearNumero, nombreDeArchivo } from '$lib/busqueda/busqueda';
	import {
		BARRAS,
		LINEA,
		barrasDe,
		descripcionDeGrafica,
		disponerBarras,
		disponerLinea,
		esSumable,
		lineaDe,
		notasDeBarras,
		notasDeLinea,
		tituloDeGrafica,
		type Medir,
		type Plan
	} from '$lib/busqueda/grafica';
	import { graficaComoPng } from '$lib/busqueda/png';
	import { descargarBlob } from '$lib/documentos/descargar';

	/** `elegida`: la columna de números que eligió la persona (si hay varias); `null`, la primera. La guarda la página, para que no se pierda al ir a
	 *  la tabla y volver. */
	let {
		columnas,
		filas,
		plan,
		pregunta,
		elegida = $bindable(null)
	}: { columnas: string[]; filas: unknown[][]; plan: Plan; pregunta: string; elegida?: number | null } = $props();
	const id = $props.id();

	const medida = $derived(elegida !== null && plan.medidas.includes(elegida) ? elegida : plan.medidas[0]);
	let ancho = $state(0);
	/** La barra o el punto bajo el puntero (o el que se recorre con las flechas). */
	let activo = $state<number | null>(null);
	/** Antes de montar se mide «a ojo»; ya en el navegador, con la letra de la página (y otra vez cuando termina de cargar). */
	let medir = $state<Medir>((t) => t.length * 7);
	let svg = $state<SVGSVGElement>();
	let bajando = $state(false);
	let errorImagen = $state('');

	onMount(() => {
		const contexto = document.createElement('canvas').getContext('2d');
		if (!contexto) return;
		const familia = getComputedStyle(document.body).fontFamily;
		const medidor = (): Medir => (texto, peso = 400) => {
			contexto.font = `${peso} 12px ${familia}`;
			return contexto.measureText(texto).width;
		};
		medir = medidor();
		Promise.all([document.fonts?.load(`400 12px ${familia}`), document.fonts?.load(`500 12px ${familia}`)]).then(
			() => (medir = medidor()),
			() => undefined
		);
	});

	const titulo = $derived(tituloDeGrafica(columnas, plan, medida));
	const barras = $derived(plan.forma === 'barras' ? barrasDe(columnas, filas, plan, medida) : null);
	const linea = $derived(plan.forma === 'linea' ? lineaDe(filas, plan, medida) : null);
	const dibujoBarras = $derived(barras && ancho > 0 ? disponerBarras(barras.barras, ancho, medir) : null);
	const dibujoLinea = $derived(
		linea && plan.escala && ancho > 0 && linea.puntos.length > 0 ? disponerLinea(linea, plan.escala, esSumable(columnas[medida] ?? ''), ancho, medir) : null
	);
	const notas = $derived(barras ? notasDeBarras(barras) : linea && plan.escala ? notasDeLinea(linea, plan.escala) : []);
	const descripcion = $derived(
		barras
			? descripcionDeGrafica(titulo, 'barras', barras.barras.length)
			: descripcionDeGrafica(titulo, 'linea', linea?.puntos.length ?? 0, linea?.puntos[0]?.etiqueta, linea?.puntos.at(-1)?.etiqueta)
	);
	const cuantos = $derived(dibujoBarras?.filas.length ?? dibujoLinea?.puntos.length ?? 0);

	/** Lo que dice el aviso flotante y dónde va (junto a la punta de la barra o sobre el punto). */
	const aviso = $derived.by(() => {
		if (activo === null) return null;
		if (dibujoBarras) {
			const f = dibujoBarras.filas[activo];
			if (!f) return null;
			const detalle = f.juntas > 0 ? `Suma de ${formatearNumero(f.juntas)} categorías` : '';
			return { valor: f.valorTexto, etiqueta: f.etiqueta, detalle, x: Math.max(f.xFin, dibujoBarras.xCero), arriba: f.arriba, abajo: f.arriba + BARRAS.grosor };
		}
		if (dibujoLinea) {
			const p = dibujoLinea.puntos[activo];
			if (!p) return null;
			return { valor: formatearNumero(p.valor), etiqueta: p.etiqueta, detalle: '', x: p.x, arriba: p.y - 6, abajo: p.y + 6 };
		}
		return null;
	});
	const anuncio = $derived(aviso ? `${aviso.etiqueta}: ${aviso.valor}${aviso.detalle ? ` (${aviso.detalle})` : ''}` : '');

	function posicion(a: { x: number; arriba: number; abajo: number }): string {
		const horizontal = a.x > ancho / 2 ? `right: ${Math.max(0, ancho - a.x + 10)}px;` : `left: ${Math.max(0, a.x + 10)}px;`;
		// Arriba de la marca; si no hay lugar (los primeros renglones, los puntos altos), abajo.
		return a.arriba > 64 ? `${horizontal} top: ${a.arriba - 6}px; transform: translateY(-100%);` : `${horizontal} top: ${a.abajo + 6}px;`;
	}

	function alMover(e: PointerEvent) {
		if (!svg) return;
		const caja = svg.getBoundingClientRect();
		const x = e.clientX - caja.left;
		const y = e.clientY - caja.top;
		if (dibujoBarras) {
			const i = Math.floor(y / BARRAS.fila);
			activo = i >= 0 && i < dibujoBarras.filas.length ? i : null;
		} else if (dibujoLinea && dibujoLinea.puntos.length) {
			// La cruz encuentra la fecha: el punto más cercano en horizontal, no hace falta atinarle a la línea.
			const ps = dibujoLinea.puntos;
			let mejor = 0;
			for (let i = 1; i < ps.length; i++) if (Math.abs(ps[i].x - x) < Math.abs(ps[mejor].x - x)) mejor = i;
			activo = mejor;
		}
	}

	function alTeclear(e: KeyboardEvent) {
		if (!cuantos) return;
		const siguiente = dibujoBarras ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight'];
		const anterior = dibujoBarras ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft'];
		if (siguiente.includes(e.key)) activo = activo === null ? 0 : Math.min(cuantos - 1, activo + 1);
		else if (anterior.includes(e.key)) activo = activo === null ? cuantos - 1 : Math.max(0, activo - 1);
		else if (e.key === 'Home') activo = 0;
		else if (e.key === 'End') activo = cuantos - 1;
		else if (e.key === 'Escape') activo = null;
		else return;
		e.preventDefault();
	}

	async function bajarImagen() {
		if (!svg || bajando) return;
		bajando = true;
		errorImagen = '';
		try {
			const hoy = new Date();
			const archivo = await graficaComoPng(svg, {
				titulo,
				subtitulo: `Pregunta: «${pregunta}»`,
				notas,
				pie: `Biblioratum · ${hoy.getDate()} ${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`
			});
			descargarBlob(archivo, nombreDeArchivo(pregunta, 'png', hoy));
		} catch {
			errorImagen = 'No se pudo armar la imagen. Intenta de nuevo.';
		} finally {
			bajando = false;
		}
	}
</script>

<figure class="mt-3 rounded-2xl border-2 border-border bg-card p-4" aria-labelledby="{id}-titulo" data-testid="grafica-respuesta" data-forma={plan.forma}>
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<p id="{id}-titulo" class="text-sm font-medium text-foreground" data-testid="titulo-grafica">{titulo}</p>
		<div class="flex flex-wrap items-center gap-2">
			{#if plan.medidas.length > 1}
				<label class="flex items-center gap-1.5 text-xs text-muted-foreground">
					Graficar
					<select
						data-testid="medida-grafica"
						value={medida}
						onchange={(e) => {
							elegida = Number(e.currentTarget.value);
							activo = null;
						}}
						class="h-8 max-w-48 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						{#each plan.medidas as m (m)}
							<option value={m}>{columnas[m] || `Columna ${m + 1}`}</option>
						{/each}
					</select>
				</label>
			{/if}
			<Button
				variant="outline"
				size="sm"
				class="gap-1.5"
				disabled={bajando || !svg}
				title="Descargar la gráfica como imagen (PNG)"
				data-testid="descargar-png"
				onclick={bajarImagen}
			>
				{#if bajando}
					<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
				{:else}
					<ImageDown class="size-3.5" aria-hidden="true" />
				{/if}
				Descargar imagen
			</Button>
		</div>
	</div>

	<!-- Con el foco aquí, las flechas recorren las barras o los puntos y el aviso dice cada valor (también en voz, por la región viva).
	     `application` a propósito: es la zona que maneja sus propias flechas (Svelte no la cuenta como interactiva, de ahí los dos avisos
	     silenciados). La forma accesible de leer TODOS los números sin recorrerlos es la tabla, a un clic. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="relative mt-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
		bind:clientWidth={ancho}
		tabindex="0"
		role="application"
		aria-roledescription="gráfica"
		aria-label="{descripcion} Con las flechas se recorren los valores; la tabla tiene los mismos números."
		data-testid="lienzo-grafica"
		onkeydown={alTeclear}
		onblur={() => (activo = null)}
	>
		{#if dibujoBarras}
			<svg
				bind:this={svg}
				width={dibujoBarras.ancho}
				height={dibujoBarras.alto}
				viewBox="0 0 {dibujoBarras.ancho} {dibujoBarras.alto}"
				font-size="12"
				class="block"
				aria-hidden="true"
				data-testid="svg-grafica"
				onpointermove={alMover}
				onpointerleave={() => (activo = null)}
			>
				{#if activo !== null && dibujoBarras.filas[activo]}
					<rect data-solo-pantalla x="0" y={activo * BARRAS.fila} width={dibujoBarras.ancho} height={BARRAS.fila} rx="6" style:fill="var(--grafica-resalte)" />
				{/if}
				<line
					x1={dibujoBarras.xCero}
					x2={dibujoBarras.xCero}
					y1="0"
					y2={dibujoBarras.alto}
					stroke-width="1"
					shape-rendering="crispEdges"
					style:stroke="var(--grafica-eje)"
				/>
				{#each dibujoBarras.filas as f, i (i)}
					<g data-testid="barra" data-etiqueta={f.etiqueta} data-valor={f.valor} data-juntas={f.juntas}>
						<text x={dibujoBarras.xEtiquetas} y={f.centro} dy="0.35em" text-anchor="end" style:fill="var(--foreground)">{f.etiquetaVisible}</text>
						{#if f.d}
							<path d={f.d} style:fill={f.juntas > 0 ? 'var(--grafica-otras)' : 'var(--grafica-serie)'} />
						{/if}
						<text
							x={f.xValor}
							y={f.centro}
							dy="0.35em"
							text-anchor={f.anclaValor}
							font-weight="500"
							style:fill="var(--foreground)"
							data-testid="valor-barra">{f.valorTexto}</text
						>
					</g>
				{/each}
			</svg>
		{:else if dibujoLinea}
			{@const d = dibujoLinea}
			<svg
				bind:this={svg}
				width={d.ancho}
				height={d.alto}
				viewBox="0 0 {d.ancho} {d.alto}"
				font-size="12"
				class="block"
				aria-hidden="true"
				data-testid="svg-grafica"
				onpointermove={alMover}
				onpointerleave={() => (activo = null)}
			>
				{#each d.marcasY as m, i (i)}
					<line
						x1={d.plot.x0}
						x2={d.plot.x1}
						y1={m.y}
						y2={m.y}
						stroke-width="1"
						shape-rendering="crispEdges"
						style:stroke={m.base ? 'var(--grafica-eje)' : 'var(--grafica-rejilla)'}
					/>
					<text x={d.plot.x0 - 8} y={m.y} dy="0.35em" text-anchor="end" style:fill="var(--muted-foreground)" data-testid="marca-y">{m.texto}</text>
				{/each}
				{#each d.marcasX as m, i (i)}
					<text x={m.izquierda} y={d.alto - 8} style:fill="var(--muted-foreground)" data-testid="marca-x">{m.texto}</text>
				{/each}
				{#each d.tramos as t, i (i)}
					<path d={t.area} style:fill="var(--grafica-serie-area)" />
					<path d={t.linea} fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" style:stroke="var(--grafica-serie)" />
				{/each}
				{#if activo !== null && d.puntos[activo]}
					{@const p = d.puntos[activo]}
					<line data-solo-pantalla x1={p.x} x2={p.x} y1={d.plot.y0} y2={d.plot.y1} stroke-width="1" style:stroke="var(--grafica-eje)" />
				{/if}
				{#each d.puntos as p, i (i)}
					{#if p.visible}
						<circle
							cx={p.x}
							cy={p.y}
							r={LINEA.radio}
							stroke-width="2"
							style:fill="var(--grafica-serie)"
							style:stroke="var(--card)"
							data-testid="punto"
							data-etiqueta={p.etiqueta}
							data-valor={p.valor}
						/>
					{/if}
				{/each}
				{#if activo !== null && d.puntos[activo]}
					{@const p = d.puntos[activo]}
					<circle data-solo-pantalla cx={p.x} cy={p.y} r={LINEA.radio + 1.5} stroke-width="2" style:fill="var(--grafica-serie)" style:stroke="var(--card)" />
				{/if}
				{#if d.final}
					<text x={d.final.x} y={d.final.y} text-anchor={d.final.ancla} font-weight="500" style:fill="var(--foreground)" data-testid="valor-final"
						>{d.final.texto}</text
					>
				{/if}
			</svg>
		{/if}

		{#if aviso}
			<div
				class="pointer-events-none absolute z-10 w-max max-w-64 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
				style={posicion(aviso)}
				aria-hidden="true"
				data-testid="aviso-grafica"
			>
				<p class="text-sm font-semibold text-popover-foreground">{aviso.valor}</p>
				<p class="text-muted-foreground">{aviso.etiqueta}</p>
				{#if aviso.detalle}
					<p class="text-muted-foreground">{aviso.detalle}</p>
				{/if}
			</div>
		{/if}
		<p class="sr-only" aria-live="polite">{anuncio}</p>
	</div>

	{#if notas.length}
		<ul class="mt-3 space-y-0.5 text-xs text-muted-foreground" data-testid="notas-grafica">
			{#each notas as nota (nota)}
				<li>{nota}</li>
			{/each}
		</ul>
	{/if}
	{#if errorImagen}
		<p class="mt-2 text-xs text-red-700 dark:text-red-400" role="alert" data-testid="error-imagen">{errorImagen}</p>
	{/if}
</figure>
