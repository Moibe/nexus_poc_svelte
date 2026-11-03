<script lang="ts">
	/**
	 * Ejecuciones · correr un expediente virtual contra un proceso del motor de reglas (2026-10-30, pedido de Moibe; 2026-11-03: «es la
	 * combinación de ambas lo que se ejecuta», así que se elige también el proceso; y «adelante, házlo»: ya se ejecuta de verdad).
	 *
	 * Tercera sección del módulo de uso. Las ejecuciones son MANUALES, y la pantalla tiene dos partes:
	 *   · Arriba, «Ejecutar»: se elige el EXPEDIENTE, luego el PROCESO (los activos que corren sobre el tipo de alguno de sus expedientes
	 *     virtuales) y, solo si el expediente tiene más de un expediente virtual de ese tipo, cuál. Con todo elegido, un resumen dice qué se va a
	 *     ejecutar sobre qué y el botón corre el proceso con los datos REALES de los documentos (`POST /api/ejecuciones`). Lo que sale se enseña
	 *     enseguida: la palabra con la que terminó el proceso y, aparte, el detalle.
	 *   · Abajo, el historial: una fila por ejecución, con Fecha de ejecución, Expediente, Expediente virtual, Proceso y Resultado; picar una
	 *     fila la abre (la lista de valores finales, cómo salió cada regla y de qué documento se tomó cada dato). De la más reciente a la más
	 *     antigua, de 50 en 50. Se puede filtrar por fecha, proceso, estado y persona (2026-11-03, Moibe: «agrega dichos filtros»): una barra bajo
	 *     el título, con los controles del listado de expedientes, y es el servidor quien filtra (ver `$lib/ejecuciones/filtros`).
	 *
	 * Si el expediente virtual trae DOS O MÁS documentos de un tipo que el proceso usa, el proceso NO se ejecuta: no se sabe cuál es «el INE»
	 * (Moibe). La pantalla lo avisa, dice cuáles son y lleva al expediente virtual, donde esos documentos quedan marcados «Duplicado».
	 *
	 * Un proceso se ofrece aunque no se pueda ejecutar todavía (los de antes de que el Resultado fuera obligatorio no lo traen), con su razón y
	 * el botón apagado. Ejecutar es de quien organiza (Administrador, Supervisor, Analista y Operador); los demás roles ven el historial y no el
	 * botón, y nexus_back es quien manda: contesta 403 a cualquier otro rol.
	 */
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import BarraFiltrosEjecuciones from '$lib/components/ejecuciones/BarraFiltrosEjecuciones.svelte';
	import EjecucionModal from '$lib/components/ejecuciones/EjecucionModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		CLASE_DEL_CASO,
		ETIQUETA_DE_ESTADO,
		TEXTO_DEL_CASO,
		fechaYHora,
		rutaDelVirtual,
		type EjecucionCompleta,
		type EjecucionResumen,
		type Historial,
		type NoSeEjecuto
	} from '$lib/ejecuciones/ejecuciones';
	import {
		MENSAJE_SIN_RESULTADOS,
		consultaDeFiltros,
		cuentaDeFiltrado,
		hayFiltrosHistorial,
		sinFiltrosHistorial,
		type FiltrosHistorial
	} from '$lib/ejecuciones/filtros';

	let { data } = $props();

	const COLUMNAS_HISTORIAL = ['Fecha de ejecución', 'Expediente', 'Expediente virtual', 'Proceso', 'Resultado'];

	/**
	 * Elegir es navegar: la dirección lleva la elección y el servidor arma lo que se ofrece. Cambiar de expediente borra el proceso y el
	 * virtual; cambiar de proceso borra el virtual (los de otro proceso pueden ser otros).
	 */
	function ir(expediente: string, proceso = '', virtual = '') {
		const q = new URLSearchParams({ expediente });
		if (proceso) q.set('proceso', proceso);
		if (virtual) q.set('virtual', virtual);
		goto(`/ejecuciones?${q}`, { noScroll: true, keepFocus: true });
	}
	function elegirExpediente(id: string) {
		if (id && id !== data.elegido?.id) ir(id);
	}
	function elegirProceso(id: string) {
		if (data.elegido && id && id !== data.procesoElegido?.id) ir(data.elegido.id, id);
	}
	function elegirVirtual(id: string) {
		if (data.elegido && data.procesoElegido && id && id !== data.virtualElegido?.id) ir(data.elegido.id, data.procesoElegido.id, id);
	}

	/** Hay un expediente con expedientes virtuales y procesos que ofrecerle. */
	const hayProcesos = $derived(Boolean(data.elegido) && data.virtuales > 0 && data.procesos.length > 0);

	// ── Ejecutar ─────────────────────────────────────────────────────────────

	let ejecutando = $state(false);
	/** Lo que acaba de salir de ejecutar (con su detalle), para enseñarlo enseguida. */
	let ultima = $state<EjecucionCompleta | null>(null);
	/** Por qué NO se ejecutó, con sus palabras (y, con duplicados, cuáles). */
	let noSeEjecuto = $state<NoSeEjecuto | null>(null);

	// Lo que salió (o por qué no) es de ESA elección: al cambiarla se quita. La llave es un texto (`$derived` solo avisa si CAMBIA): después de
	// ejecutar, la carga vuelve a traer `data` entero con la misma elección, y eso no debe borrar lo que acaba de salir.
	const eleccion = $derived(`${data.elegido?.id ?? ''}|${data.procesoElegido?.id ?? ''}|${data.virtualElegido?.id ?? ''}`);
	$effect(() => {
		void eleccion;
		untrack(() => {
			ultima = null;
			noSeEjecuto = null;
		});
	});

	/** Por qué el botón está apagado, si lo está. */
	const motivoApagado = $derived(
		!data.puedeEjecutar
			? 'Tu rol puede consultar las ejecuciones, pero no ejecutar procesos'
			: data.procesoElegido && !data.procesoElegido.ejecutable
				? 'Este proceso todavía no se puede ejecutar: le falta su Resultado'
				: null
	);

	async function ejecutar() {
		if (!data.elegido || !data.procesoElegido || !data.virtualElegido || ejecutando || motivoApagado) return;
		ejecutando = true;
		ultima = null;
		noSeEjecuto = null;
		try {
			const respuesta = await fetch('/api/ejecuciones', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ expedienteId: data.elegido.id, virtualId: data.virtualElegido.id, procesoId: data.procesoElegido.id })
			});
			const cuerpo = await respuesta.json().catch(() => null);
			if (respuesta.ok) {
				ultima = cuerpo as EjecucionCompleta;
				await invalidateAll();
			} else {
				noSeEjecuto = { mensaje: cuerpo?.mensaje ?? 'No se pudo ejecutar el proceso.', codigo: cuerpo?.codigo, duplicados: cuerpo?.duplicados };
			}
		} catch {
			noSeEjecuto = { mensaje: 'No se pudo contactar al servidor. Intenta de nuevo.' };
		} finally {
			ejecutando = false;
		}
	}

	// ── El historial ─────────────────────────────────────────────────────────

	// Los filtros los aplica el servidor: el historial va de 50 en 50, y filtrar lo que ya se ve dejaría fuera lo que todavía no se ha pedido (y el total no
	// sería el de lo que cumple). Viven en la página y no en la dirección, a diferencia de lo que se elige para ejecutar: filtrar no cambia lo que se ofrece
	// arriba, y no vale la pena volver a leer expedientes y procesos con cada clic.
	let filtros = $state<FiltrosHistorial>(sinFiltrosHistorial());
	const filtrando = $derived(hayFiltrosHistorial(filtros));
	/** La primera página con los filtros puestos; `null` mientras nada filtra, o hasta que llega la primera respuesta. */
	let filtrado = $state<Historial | null>(null);
	let buscando = $state(false);
	let falloFiltro = $state('');
	/** Cuenta cada vez que cambia lo que se pregunta (los filtros, o que haya más ejecuciones): una respuesta que llega con una cuenta vieja ya no es de lo que se mira. */
	let pedido = 0;
	/** Cuántas ejecuciones hay en total: si cambia (se ejecutó algo), lo filtrado se pregunta otra vez. Es un `$derived` para no volver a preguntar cada vez que `data` se recarga igual. */
	const totalVisto = $derived(data.historial.total);

	$effect(() => {
		const consulta = filtrando ? consultaDeFiltros(filtros).toString() : '';
		void totalVisto;
		untrack(() => {
			const mio = ++pedido;
			falloFiltro = '';
			if (!consulta) {
				filtrado = null;
				buscando = false;
				return;
			}
			buscando = true;
			fetch(`/api/ejecuciones?${consulta}&limite=50`)
				.then(async (respuesta) => {
					const cuerpo = await respuesta.json().catch(() => null);
					if (!respuesta.ok) throw new Error(cuerpo?.mensaje ?? 'No se pudieron aplicar los filtros.');
					if (mio !== pedido) return;
					filtrado = { ejecuciones: (cuerpo?.ejecuciones ?? []) as EjecucionResumen[], total: typeof cuerpo?.total === 'number' ? cuerpo.total : 0, hayMas: cuerpo?.hayMas === true };
				})
				.catch((e) => {
					if (mio === pedido) falloFiltro = e instanceof Error ? e.message : 'No se pudieron aplicar los filtros.';
				})
				.finally(() => {
					if (mio === pedido) buscando = false;
				});
		});
	});

	/** Las páginas siguientes que se pidieron con «Ver más»; las primeras vienen de la carga, o de los filtros. */
	let extra = $state<EjecucionResumen[]>([]);
	let hayMasExtra = $state<boolean | null>(null);
	let cargandoMas = $state(false);
	let falloMas = $state('');
	const fuente = $derived(filtrando && filtrado ? filtrado : data.historial);
	const filas = $derived([...fuente.ejecuciones, ...extra]);
	const hayMas = $derived(hayMasExtra ?? fuente.hayMas);
	const cuenta = $derived(!filtrando ? '' : buscando ? 'Buscando…' : filtrado ? cuentaDeFiltrado(filtrado.total, data.historial.total) : '');

	// Una carga nueva del historial (después de ejecutar), o una respuesta nueva de los filtros, trae las primeras otra vez: lo de «Ver más» ya no vale.
	$effect(() => {
		void data.historial;
		void filtrado;
		untrack(() => {
			extra = [];
			hayMasExtra = null;
			falloMas = '';
		});
	});

	async function verMas() {
		const ultimaVista = filas.at(-1);
		if (!ultimaVista || cargandoMas || buscando) return;
		const mio = pedido;
		cargandoMas = true;
		falloMas = '';
		try {
			const consulta = filtrando ? consultaDeFiltros(filtros) : new URLSearchParams();
			consulta.set('antes', ultimaVista.id);
			consulta.set('limite', '50');
			const respuesta = await fetch(`/api/ejecuciones?${consulta}`);
			const cuerpo = await respuesta.json().catch(() => null);
			if (!respuesta.ok) throw new Error(cuerpo?.mensaje ?? 'No se pudieron cargar más ejecuciones.');
			// Si mientras tanto cambiaron los filtros, esto es de los de antes: no se suma a lo que ahora se mira.
			if (mio !== pedido) return;
			extra = [...extra, ...((cuerpo?.ejecuciones ?? []) as EjecucionResumen[])];
			hayMasExtra = cuerpo?.hayMas === true;
		} catch (e) {
			falloMas = e instanceof Error ? e.message : 'No se pudieron cargar más ejecuciones.';
		} finally {
			cargandoMas = false;
		}
	}

	// ── Abrir una ejecución ──────────────────────────────────────────────────

	let modalAbierto = $state(false);
	let modalEjecucion = $state<EjecucionCompleta | null>(null);
	let modalError = $state('');

	/** Un renglón del historial no trae la foto pesada: se pide al abrirlo. */
	async function abrir(id: string) {
		modalEjecucion = null;
		modalError = '';
		modalAbierto = true;
		try {
			const respuesta = await fetch(`/api/ejecuciones/${encodeURIComponent(id)}`);
			const cuerpo = await respuesta.json().catch(() => null);
			if (!respuesta.ok) throw new Error(cuerpo?.mensaje ?? 'No se pudo abrir la ejecución.');
			modalEjecucion = cuerpo as EjecucionCompleta;
		} catch (e) {
			modalError = e instanceof Error ? e.message : 'No se pudo abrir la ejecución.';
		}
	}
	function abrirLaUltima() {
		if (!ultima) return;
		modalEjecucion = ultima;
		modalError = '';
		modalAbierto = true;
	}
</script>

<svelte:head><title>Biblioratum — Ejecuciones</title></svelte:head>

<p class="text-xs text-muted-foreground">Uso / Ejecuciones</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Ejecuciones</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Corre un expediente virtual contra un proceso del motor de reglas.
	</p>
</div>

<section class="mt-8 rounded-xl border border-border bg-background p-6" data-testid="seccion-ejecutables" aria-labelledby="titulo-ejecutables">
	<h2 id="titulo-ejecutables" class="text-base font-medium text-foreground">Ejecutar</h2>
	<p class="mt-1 text-sm text-muted-foreground">
		Elige el expediente y el proceso que quieres correr sobre él: es la combinación de los dos lo que se ejecuta.
	</p>

	<div class="mt-5 grid max-w-3xl gap-5 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="expediente-ejecucion">Expediente</Label>
			<Select.Root type="single" value={data.elegido?.id ?? ''} onValueChange={elegirExpediente} disabled={data.expedientes.length === 0}>
				<Select.Trigger id="expediente-ejecucion" class="h-10 w-full" data-testid="selector-expediente">
					{data.elegido?.nombre ?? (data.expedientes.length === 0 ? 'Todavía no hay expedientes' : 'Elige un expediente')}
				</Select.Trigger>
				<Select.Content>
					{#each data.expedientes as e (e.id)}
						<Select.Item value={e.id} label={e.nombre} data-testid="opcion-expediente" />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div class="space-y-2">
			<Label for="proceso-ejecucion">Proceso</Label>
			<Select.Root type="single" value={data.procesoElegido?.id ?? ''} onValueChange={elegirProceso} disabled={!hayProcesos}>
				<Select.Trigger id="proceso-ejecucion" class="h-10 w-full" data-testid="selector-proceso">
					{data.procesoElegido?.nombre ?? (!data.elegido ? 'Elige primero un expediente' : hayProcesos ? 'Elige un proceso' : 'Sin procesos que ofrecer')}
				</Select.Trigger>
				<Select.Content>
					{#each data.procesos as pr (pr.id)}
						<Select.Item value={pr.id} label={pr.ejecutable ? pr.nombre : `${pr.nombre} (sin Resultado)`} data-testid="opcion-proceso" />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<!-- Solo si el proceso elegido corre sobre MÁS DE UN expediente virtual del expediente (dos «Solicitud de crédito», por ejemplo). -->
		{#if data.procesoElegido && data.virtualesDelProceso.length > 1}
			<div class="space-y-2">
				<Label for="virtual-ejecucion">Expediente virtual</Label>
				<Select.Root type="single" value={data.virtualElegido?.id ?? ''} onValueChange={elegirVirtual}>
					<Select.Trigger id="virtual-ejecucion" class="h-10 w-full" data-testid="selector-virtual">
						{data.virtualElegido?.nombre ?? 'Elige un expediente virtual'}
					</Select.Trigger>
					<Select.Content>
						{#each data.virtualesDelProceso as v (v.id)}
							<Select.Item value={v.id} label={v.nombre} data-testid="opcion-virtual" />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
	</div>

	<div class="mt-6" data-testid="ejecutables" aria-live="polite">
		{#if data.expedienteAusente}
			<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">Ese expediente ya no existe. Elige otro de la lista.</p>
		{:else if !data.elegido}
			<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">Elige un expediente para ver qué procesos se le pueden correr.</p>
		{:else if data.virtuales === 0}
			<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">
				«{data.elegido.nombre}» no tiene expedientes virtuales. Se arman dentro del
				<a href="/expediente/{encodeURIComponent(data.elegido.id)}" class="text-primary underline-offset-2 hover:underline">expediente</a>.
			</p>
		{:else}
			{#if data.procesos.length === 0}
				<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">
					Ningún proceso activo corre sobre el tipo de los expedientes virtuales de «{data.elegido.nombre}».
				</p>
			{:else if data.procesoAusente}
				<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">Ese proceso ya no se ofrece para «{data.elegido.nombre}». Elige otro de la lista.</p>
			{:else if !data.procesoElegido}
				<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">Elige el proceso que quieres correr sobre «{data.elegido.nombre}».</p>
			{:else if !data.virtualElegido}
				<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">
					{data.virtualAusente ? 'Ese expediente virtual ya no se ofrece. ' : ''}«{data.procesoElegido.nombre}» corre sobre {data.virtualesDelProceso.length} expedientes virtuales de «{data.elegido.nombre}»: elige cuál.
				</p>
			{:else}
				<div class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3" data-testid="ejecucion-lista" data-virtual={data.virtualElegido.id} data-proceso={data.procesoElegido.id}>
					<p class="min-w-0 flex-1 text-sm text-foreground" data-testid="ejecucion-resumen">
						Se ejecutará <span class="font-medium">«{data.procesoElegido.nombre}»</span> sobre el expediente virtual
						<span class="font-medium">«{data.virtualElegido.nombre}»</span> ({data.virtualElegido.tipoNombre}) de «{data.elegido.nombre}».
					</p>
					<Button
						size="sm"
						class="h-9.5 shrink-0 px-4 {motivoApagado ? 'cursor-not-allowed opacity-50' : ''}"
						disabled={ejecutando}
						aria-disabled={Boolean(motivoApagado) || ejecutando}
						data-testid="ejecutar"
						title={motivoApagado ?? 'Ejecutar el proceso con los datos de los documentos'}
						onclick={ejecutar}
					>
						{#if ejecutando}
							<LoaderCircle class="animate-spin" />
							Ejecutando…
						{:else}
							Ejecutar
						{/if}
					</Button>
				</div>

				{#if motivoApagado}
					<p class="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400" data-testid="no-se-puede-ejecutar" data-motivo={data.puedeEjecutar ? 'sin_resultado' : 'rol'}>
						<TriangleAlert class="mt-0.5 size-4 shrink-0" />
						<span>
							{#if !data.puedeEjecutar}
								Tu rol puede consultar las ejecuciones, pero no ejecutar procesos.
							{:else}
								«{data.procesoElegido.nombre}» todavía no se puede ejecutar: no tiene su nodo de Resultado, o su Resultado no tiene ninguna regla conectada. Ábrelo en el motor de reglas
								(Configuración › Motor de reglas) y agrégalo para poder ejecutarlo.
							{/if}
						</span>
					</p>
				{/if}

				<!-- Por qué NO se ejecutó. Con duplicados, cuáles son y a dónde ir a verlos. -->
				{#if noSeEjecuto}
					<div
						class="mt-4 rounded-xl border px-4 py-3 text-sm {noSeEjecuto.codigo === 'duplicados' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'border-red-200 bg-red-50 text-red-800'}"
						role="alert"
						data-testid={noSeEjecuto.codigo === 'duplicados' ? 'aviso-duplicados' : 'no-se-ejecuto'}
						data-codigo={noSeEjecuto.codigo ?? ''}
					>
						<p class="font-medium">{noSeEjecuto.codigo === 'duplicados' ? 'No se ejecutó: hay documentos duplicados' : 'No se pudo ejecutar'}</p>
						<p class="mt-1">{noSeEjecuto.mensaje}</p>
						{#if noSeEjecuto.duplicados?.length}
							<ul class="mt-2 list-disc pl-5">
								{#each noSeEjecuto.duplicados as d (d.tipoId)}
									<li data-testid="duplicado-de-ejecucion" data-tipo={d.tipoId}>
										<span class="font-medium">{d.tipoNombre}</span>: {d.documentos.map((x) => x.nombre ?? 'sin nombre').join(', ')}
									</li>
								{/each}
							</ul>
							<p class="mt-2">
								<a href={rutaDelVirtual(data.elegido.id, data.virtualElegido.id)} class="font-medium underline underline-offset-2" data-testid="ir-al-virtual">Abrir el expediente virtual</a>
								para dejar uno de cada tipo: los duplicados están marcados.
							</p>
						{/if}
					</div>
				{/if}

				<!-- Lo que acaba de salir. -->
				{#if ultima}
					<div class="mt-4 rounded-xl border border-border bg-card px-4 py-3" data-testid="ejecucion-terminada" data-caso={ultima.resultado.caso} data-estado={ultima.estado} role="status">
						<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Resultado de esta ejecución</p>
						<div class="mt-1.5 flex flex-wrap items-center gap-3">
							<span class="rounded-md px-3 py-1 text-base font-semibold {CLASE_DEL_CASO[ultima.resultado.caso]}" data-testid="ejecucion-terminada-palabra">{ultima.resultado.texto}</span>
							<span class="text-sm text-muted-foreground">{TEXTO_DEL_CASO[ultima.resultado.caso]}</span>
							<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{ETIQUETA_DE_ESTADO[ultima.estado]}</span>
							<Button variant="outline" size="sm" class="ml-auto" data-testid="ver-detalle" onclick={abrirLaUltima}>Ver el detalle</Button>
						</div>
					</div>
				{/if}
			{/if}
			{#if data.sinLeer.length > 0}
				<p class="mt-3 text-sm text-destructive" data-testid="ejecutables-sin-leer">
					No se pudieron leer los procesos de: {data.sinLeer.join(', ')}.
				</p>
			{/if}
		{/if}
	</div>
</section>

<section class="mt-6 rounded-xl border border-border bg-background p-6" data-testid="seccion-historial" aria-labelledby="titulo-historial">
	<div class="flex items-baseline gap-3">
		<h2 id="titulo-historial" class="text-base font-medium text-foreground">Historial de ejecuciones</h2>
		{#if data.historial.total > 0}
			<span class="text-xs text-muted-foreground" data-testid="historial-total">{data.historial.total} {data.historial.total === 1 ? 'ejecución' : 'ejecuciones'}</span>
		{/if}
	</div>
	<!-- Sin ejecuciones (o sin poder leerlas) no hay nada que filtrar. -->
	{#if data.historial.total > 0 && !data.historialFallo}
		<BarraFiltrosEjecuciones bind:filtros opciones={data.opciones} {filtrando} {cuenta} alLimpiar={() => (filtros = sinFiltrosHistorial())} />
	{/if}
	<div class="mt-3 overflow-x-auto">
		<table class="w-full min-w-3xl table-fixed text-left text-sm" data-testid="historial" aria-busy={buscando}>
			<caption class="sr-only">Ejecuciones de procesos sobre expedientes virtuales</caption>
			<thead>
				<tr class="border-y border-border text-xs text-muted-foreground" data-testid="columnas-historial">
					{#each COLUMNAS_HISTORIAL as columna (columna)}
						<th scope="col" class="py-2.5 pr-4 font-normal first:pl-2">{columna}</th>
					{/each}
				</tr>
			</thead>
			<tbody class="transition-opacity {buscando ? 'opacity-60' : ''}">
				{#if data.historialFallo}
					<tr>
						<td colspan={COLUMNAS_HISTORIAL.length} class="py-10 text-center text-sm text-destructive" data-testid="historial-fallo">
							<span role="alert">No se pudo cargar el historial de ejecuciones. Recarga la página para intentarlo otra vez.</span>
						</td>
					</tr>
				{:else if falloFiltro}
					<tr>
						<td colspan={COLUMNAS_HISTORIAL.length} class="py-10 text-center text-sm text-destructive" data-testid="historial-filtro-fallo">
							<span role="alert">{falloFiltro}</span>
						</td>
					</tr>
				{:else if filas.length === 0}
					<tr>
						<td colspan={COLUMNAS_HISTORIAL.length} class="py-10 text-center text-sm text-muted-foreground" data-testid={filtrando ? 'historial-sin-resultados' : 'historial-vacio'}>
							{filtrando ? MENSAJE_SIN_RESULTADOS : 'Todavía no hay ejecuciones.'}
						</td>
					</tr>
				{:else}
					{#each filas as e (e.id)}
						<tr
							class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50"
							data-testid="fila-ejecucion"
							data-ejecucion-id={e.id}
							data-caso={e.resultado.caso}
							data-estado={e.estado}
							onclick={() => abrir(e.id)}
						>
							<td class="py-3 pr-4 pl-2">
								<button
									type="button"
									class="text-left text-foreground underline-offset-2 hover:text-primary hover:underline"
									data-testid="abrir-ejecucion"
									onclick={(ev) => {
										ev.stopPropagation();
										abrir(e.id);
									}}>{fechaYHora(e.ejecutadaEn)}</button
								>
							</td>
							<td class="truncate py-3 pr-4" title={e.expediente.nombre} data-testid="celda-expediente">{e.expediente.nombre}</td>
							<td class="truncate py-3 pr-4" title={e.virtual.nombre} data-testid="celda-virtual">{e.virtual.nombre}</td>
							<td class="truncate py-3 pr-4" title={e.proceso.nombre} data-testid="celda-proceso">{e.proceso.nombre}</td>
							<td class="py-3 pr-4" data-testid="celda-resultado">
								<span class="inline-block max-w-full truncate rounded-md px-2 py-0.5 text-xs font-medium align-middle {CLASE_DEL_CASO[e.resultado.caso]}" title={e.resultado.texto}>{e.resultado.texto}</span>
								{#if e.estado === 'incompleta'}<span class="ml-1.5 text-xs text-muted-foreground">Incompleta</span>{/if}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
	{#if hayMas && !data.historialFallo && !falloFiltro}
		<div class="mt-3 flex items-center gap-3">
			<Button variant="outline" size="sm" data-testid="ver-mas" disabled={cargandoMas || buscando} onclick={verMas}>
				{#if cargandoMas}<LoaderCircle class="animate-spin" />{/if}
				Ver más ejecuciones
			</Button>
			{#if falloMas}<span class="text-sm text-destructive" role="alert" data-testid="ver-mas-fallo">{falloMas}</span>{/if}
		</div>
	{/if}
</section>

<EjecucionModal bind:abierto={modalAbierto} ejecucion={modalEjecucion} error={modalError} />
