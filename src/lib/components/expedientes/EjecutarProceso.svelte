<script lang="ts">
	/**
	 * «Ejecutar un proceso» DENTRO del expediente (2026-11-06, Moibe: «Ejecuciones ahora existirá dentro del Expediente [...] ahora ya no requerimos seleccionar
	 * el Expediente porque efectivamente ya estamos en el Expediente, por lo tanto solo tenemos que escoger el proceso y darle Play. Ubícalo en un lugar que
	 * tú consideres apropiado del Expediente»).
	 *
	 * Es la tarjeta «Ejecutar» de la pantalla de Ejecuciones sin el selector de expediente: un selector con los procesos ACTIVOS de la organización y el
	 * botón Play, que corre el proceso elegido con los datos REALES de los documentos de ESTE expediente (`POST /api/ejecuciones`, el mismo puente de
	 * siempre) y lo guarda en el historial. Lo que sale se enseña ahí mismo: la palabra con la que terminó el proceso, su estado y «Ver el detalle» (la misma
	 * ventana de Ejecuciones); o por qué NO se ejecutó (con tipos documentales repetidos: cuáles son; en este expediente quedan marcados).
	 *
	 * Va debajo del encabezado del expediente y antes de sus avisos y de los documentos: es una acción de TODO el expediente, no de un documento, y ahí queda
	 * siempre en el mismo sitio aunque los avisos aparezcan y desaparezcan. Solo la ve quien organiza (la página la monta con `puedeOrganizar`; Administrador,
	 * Supervisor, Analista y Operador) y nexus_back es quien manda: contesta 403 a cualquier otro rol. La pantalla de Ejecuciones sigue siendo el historial.
	 *
	 * La elección y lo que salió viven aquí y NO se tiran con la recarga periódica del layout (cada 20 s vuelve a pedir `data`, y un `$effect` que lee props
	 * para «arrancar limpio» vació formularios el 2026-11-05): lo que salió se quita solo cuando se elige OTRO proceso o cuando los documentos del expediente
	 * cambian (`huella`, un texto: solo avisa si CAMBIA), porque era el resultado de lo que había. Mientras corre, el selector se apaga: así lo que llega es
	 * siempre de lo que se eligió.
	 */
	import { untrack } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Play from '@lucide/svelte/icons/play';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import EjecucionModal from '$lib/components/ejecuciones/EjecucionModal.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		CLASE_DEL_CASO,
		ETIQUETA_DE_ESTADO,
		TEXTO_DEL_CASO,
		motivoSinEjecutar,
		type EjecucionCompleta,
		type NoSeEjecuto,
		type ProcesoOfrecido
	} from '$lib/ejecuciones/ejecuciones';

	let {
		expedienteId,
		expedienteNombre,
		procesos,
		procesosFallo = false,
		huella = ''
	}: {
		expedienteId: string;
		expedienteNombre: string;
		/** Los procesos activos de la organización que se ofrecen (`leerProcesosOfrecidos`). */
		procesos: ProcesoOfrecido[];
		/** No se pudieron leer: no se afirma que «no hay procesos». */
		procesosFallo?: boolean;
		/** Qué documentos tiene el expediente ahora (sus ids juntos): si cambia, lo que salió de la última ejecución ya no es de lo que hay. */
		huella?: string;
	} = $props();

	let procesoId = $state('');
	const elegido = $derived(procesos.find((p) => p.id === procesoId) ?? null);
	/** Había uno elegido y ya no se ofrece (se desactivó o se borró mientras tanto). Con los procesos sin poder leerse no se sabe: no se dice. */
	const procesoAusente = $derived(procesoId !== '' && !elegido && !procesosFallo);
	const motivoApagado = $derived(motivoSinEjecutar(elegido));

	let ejecutando = $state(false);
	/** Lo que acaba de salir de ejecutar (con su detalle), para enseñarlo enseguida. */
	let ultima = $state<EjecucionCompleta | null>(null);
	/** Por qué NO se ejecutó, con sus palabras (y, con tipos repetidos, cuáles). */
	let noSeEjecuto = $state<NoSeEjecuto | null>(null);

	// Lo que salió (o por qué no) es de ESA elección y de ESOS documentos: al cambiar alguno se quita. Las dos llaves son texto: la recarga del layout trae `data`
	// entero con lo mismo y eso no debe borrar lo que acaba de salir.
	$effect(() => {
		void procesoId;
		void huella;
		untrack(() => {
			ultima = null;
			noSeEjecuto = null;
		});
	});

	/** Se picó Play sin haber elegido proceso: se dice qué falta en vez de no hacer nada (se quita en cuanto se elige uno). */
	let faltaElegir = $state(false);
	$effect(() => {
		if (procesoId) untrack(() => (faltaElegir = false));
	});

	async function ejecutar() {
		if (ejecutando) return;
		if (!elegido) {
			if (procesos.length > 0) faltaElegir = true;
			return;
		}
		if (motivoApagado) return;
		ejecutando = true;
		ultima = null;
		noSeEjecuto = null;
		try {
			const respuesta = await fetch('/api/ejecuciones', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ expedienteId, procesoId: elegido.id })
			});
			const cuerpo = await respuesta.json().catch(() => null);
			if (respuesta.ok) {
				ultima = cuerpo as EjecucionCompleta;
			} else {
				noSeEjecuto = { mensaje: cuerpo?.mensaje ?? 'No se pudo ejecutar el proceso.', codigo: cuerpo?.codigo, duplicados: cuerpo?.duplicados };
			}
		} catch {
			noSeEjecuto = { mensaje: 'No se pudo contactar al servidor. Intenta de nuevo.' };
		} finally {
			ejecutando = false;
		}
	}

	let modalAbierto = $state(false);
	/** El resultado que la ventana enseña: una COPIA del de la última ejecución al abrirla, para que la ventana no se quede «leyendo» si ese resultado se quita con ella abierta. */
	let enLaVentana = $state<EjecucionCompleta | null>(null);
	function verElDetalle() {
		if (!ultima) return;
		enLaVentana = ultima;
		modalAbierto = true;
	}

	/** Lo que dice el selector cerrado. */
	const textoDelSelector = $derived(elegido?.nombre ?? (procesosFallo ? 'No se pudieron leer los procesos' : procesos.length === 0 ? 'Sin procesos que ofrecer' : 'Elige un proceso'));
</script>

<section class="mt-3 rounded-lg border border-border bg-background px-4 py-3" data-testid="ejecutar-seccion" aria-labelledby="titulo-ejecutar-proceso">
	<div class="flex flex-wrap items-center gap-3">
		<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary" aria-hidden="true">
			<Play class="size-4" />
		</span>
		<div class="min-w-0 flex-1 basis-56">
			<h3 id="titulo-ejecutar-proceso" class="text-sm font-medium text-foreground">Ejecutar un proceso</h3>
			<p class="text-xs text-muted-foreground">Elige un proceso y córrelo con los documentos de este expediente.</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Select.Root type="single" value={procesoId} onValueChange={(v) => (procesoId = v)} disabled={procesos.length === 0 || ejecutando}>
				<Select.Trigger class="h-9.5 w-64" data-testid="ejecutar-selector-proceso" aria-label="Proceso que se va a ejecutar">
					{textoDelSelector}
				</Select.Trigger>
				<Select.Content>
					{#each procesos as pr (pr.id)}
						<Select.Item value={pr.id} label={pr.ejecutable ? pr.nombre : `${pr.nombre} (sin Resultado)`} data-testid="ejecutar-opcion-proceso" />
					{/each}
				</Select.Content>
			</Select.Root>
			<Button
				size="sm"
				class="h-9.5 shrink-0 gap-2 px-4 {!elegido || motivoApagado ? 'cursor-not-allowed opacity-50' : ''}"
				disabled={ejecutando}
				aria-disabled={!elegido || Boolean(motivoApagado) || ejecutando}
				data-testid="ejecutar-proceso"
				title={!elegido ? 'Elige primero el proceso que quieres ejecutar' : (motivoApagado ?? 'Ejecutar el proceso con los datos de los documentos de este expediente')}
				onclick={ejecutar}
			>
				{#if ejecutando}
					<LoaderCircle class="size-4 animate-spin" />
					Ejecutando…
				{:else}
					<Play class="size-4" />
					Ejecutar
				{/if}
			</Button>
		</div>
	</div>

	<div aria-live="polite">
		{#if procesosFallo}
			<p class="mt-3 text-sm text-destructive" data-testid="ejecutar-sin-leer">No se pudieron leer los procesos. Recarga la página para intentarlo otra vez.</p>
		{:else if procesos.length === 0}
			<p class="mt-3 text-sm text-muted-foreground" data-testid="ejecutar-aviso">No hay procesos activos para ejecutar. Quien administra los crea en Configuración › Procesos.</p>
		{:else if procesoAusente}
			<p class="mt-3 text-sm text-muted-foreground" data-testid="ejecutar-aviso">Ese proceso ya no se ofrece. Elige otro de la lista.</p>
		{:else if faltaElegir}
			<p class="mt-3 text-sm text-muted-foreground" data-testid="ejecutar-aviso">Elige primero el proceso que quieres ejecutar en «{expedienteNombre}».</p>
		{/if}

		{#if motivoApagado}
			<p class="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400" data-testid="ejecutar-no-se-puede" data-motivo="sin_resultado">
				<TriangleAlert class="mt-0.5 size-4 shrink-0" />
				<span>{motivoApagado}</span>
			</p>
		{/if}

		<!-- Por qué NO se ejecutó. Con tipos repetidos, cuáles son: el expediente ya los trae marcados. -->
		{#if noSeEjecuto}
			<div
				class="mt-3 rounded-lg border px-4 py-3 text-sm {noSeEjecuto.codigo === 'duplicados' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'}"
				role="alert"
				data-testid={noSeEjecuto.codigo === 'duplicados' ? 'ejecutar-aviso-duplicados' : 'ejecutar-no-se-ejecuto'}
				data-codigo={noSeEjecuto.codigo ?? ''}
			>
				<p class="font-medium">{noSeEjecuto.codigo === 'duplicados' ? 'No se ejecutó: hay tipos documentales repetidos' : 'No se pudo ejecutar'}</p>
				<p class="mt-1">{noSeEjecuto.mensaje}</p>
				{#if noSeEjecuto.duplicados?.length}
					<ul class="mt-2 list-disc pl-5">
						{#each noSeEjecuto.duplicados as d (d.tipoId)}
							<li data-testid="ejecutar-duplicado" data-tipo={d.tipoId}>
								<span class="font-medium">{d.tipoNombre}</span>: {d.documentos.map((x) => x.nombre ?? 'sin nombre').join(', ')}
							</li>
						{/each}
					</ul>
					<p class="mt-2">Quita de «{expedienteNombre}» los documentos que sobren —los que tienen el tipo repetido están marcados abajo— y vuelve a ejecutar.</p>
				{/if}
			</div>
		{/if}

		<!-- Lo que acaba de salir. -->
		{#if ultima}
			<div class="mt-3 rounded-lg border border-border bg-card px-4 py-3" data-testid="ejecutar-resultado" data-caso={ultima.resultado.caso} data-estado={ultima.estado} role="status">
				<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Resultado de esta ejecución</p>
				<div class="mt-1.5 flex flex-wrap items-center gap-3">
					<span class="rounded-md px-3 py-1 text-base font-semibold {CLASE_DEL_CASO[ultima.resultado.caso]}" data-testid="ejecutar-resultado-palabra">{ultima.resultado.texto}</span>
					<span class="text-sm text-muted-foreground">{TEXTO_DEL_CASO[ultima.resultado.caso]}</span>
					<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{ETIQUETA_DE_ESTADO[ultima.estado]}</span>
					<span class="ml-auto flex items-center gap-3">
						<a href="/ejecuciones" class="text-sm text-primary underline-offset-2 hover:underline dark:text-blue-300" data-testid="ejecutar-ver-historial">Ver el historial</a>
						<Button variant="outline" size="sm" data-testid="ejecutar-ver-detalle" onclick={verElDetalle}>Ver el detalle</Button>
					</span>
				</div>
			</div>
		{/if}
	</div>
</section>

<EjecucionModal bind:abierto={modalAbierto} ejecucion={enLaVentana} />
