<script lang="ts">
	/**
	 * El historial de ejecuciones de ESTE expediente, dentro del expediente (2026-11-07, Moibe: «quita ejecuciones de la sección aparte»). Hasta ese día el historial
	 * vivía en la pantalla de Ejecuciones, con las de todos los expedientes y sus filtros (fecha, proceso, estado y persona); al desaparecer esa pantalla se mudó aquí,
	 * ya acotado a lo que se corrió sobre este expediente, así que el filtro por expediente sobra y los demás se quitaron con ella (nexus_back los sigue entendiendo).
	 *
	 * Una fila por ejecución, de la más reciente a la más antigua: Fecha de ejecución, Proceso y Resultado (la palabra con la que terminó, con sus colores, y
	 * «Incompleta» si faltaron datos). Picar una fila la abre en la misma ventana de detalle de siempre (`EjecucionModal`): la lista de valores finales, cómo salió cada
	 * regla y de qué documento se tomó cada dato; la foto pesada se pide al abrirla (`/api/ejecuciones/<id>`). Las primeras 50 vienen con la página y «Ver más»
	 * pide las siguientes. Es el historial inmutable (HU-59): aunque después se renombre el proceso, aquí sigue diciendo lo que se corrió.
	 *
	 * Lo ven todos los roles que ven el expediente (nexus_back se lo da a todos); ejecutar, en cambio, es de quien organiza (`EjecutarProceso`). La página lo monta
	 * solo si hay ejecuciones, o si no se pudieron leer (para decirlo en vez de callar). Las ejecuciones VIEJAS (de antes del 2026-11-05, cuando se quitaron los
	 * expedientes virtuales) nombran su virtual como una segunda línea tenue bajo el proceso: es un dato de la foto.
	 *
	 * Lo que se pidió con «Ver más» NO se tira con la recarga periódica del layout (cada 20 s vuelve a traer `data`, con objetos nuevos aunque digan lo mismo): se
	 * reinicia solo cuando CAMBIA lo de arriba (la ejecución más reciente o el total), que es cuando se ejecutó algo.
	 */
	import { untrack } from 'svelte';
	import History from '@lucide/svelte/icons/history';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	import EjecucionModal from '$lib/components/ejecuciones/EjecucionModal.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { CLASE_DEL_CASO, fechaYHora, type EjecucionCompleta, type EjecucionResumen, type Historial } from '$lib/ejecuciones/ejecuciones';

	let {
		expedienteId,
		historial,
		fallo = false
	}: {
		expedienteId: string;
		/** Las primeras ejecuciones de este expediente, como las lee el servidor. */
		historial: Historial;
		/** No se pudo leer el historial: se dice, en vez de afirmar que no hay ejecuciones. */
		fallo?: boolean;
	} = $props();

	const COLUMNAS = ['Fecha de ejecución', 'Proceso', 'Resultado'];

	// ── «Ver más» ────────────────────────────────────────────────────────────
	let extra = $state<EjecucionResumen[]>([]);
	let hayMasExtra = $state<boolean | null>(null);
	let cargandoMas = $state(false);
	let falloMas = $state('');
	/** Cambia solo cuando se ejecutó algo (otra es la más reciente, o hay más en total): un texto, para que la recarga del layout con lo mismo no lo mueva. */
	const llave = $derived(`${historial.ejecuciones[0]?.id ?? ''}|${historial.total}`);
	$effect(() => {
		void llave;
		untrack(() => {
			extra = [];
			hayMasExtra = null;
			falloMas = '';
		});
	});

	const filas = $derived([...historial.ejecuciones, ...extra]);
	const hayMas = $derived(hayMasExtra ?? historial.hayMas);

	async function verMas() {
		const ultimaVista = filas.at(-1);
		if (!ultimaVista || cargandoMas) return;
		const mia = llave;
		cargandoMas = true;
		falloMas = '';
		try {
			const consulta = new URLSearchParams({ expediente: expedienteId, antes: ultimaVista.id, limite: '50' });
			const respuesta = await fetch(`/api/ejecuciones?${consulta}`);
			const cuerpo = await respuesta.json().catch(() => null);
			if (!respuesta.ok) throw new Error(cuerpo?.mensaje ?? 'No se pudieron cargar más ejecuciones.');
			// Si mientras tanto se ejecutó algo, lo de arriba ya es otro y esto es de lo de antes: no se suma.
			if (mia !== llave) return;
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
</script>

<section id="historial-ejecuciones" class="mt-6 scroll-mt-4 rounded-lg border border-border bg-background px-4 py-3" data-testid="historial-seccion" aria-labelledby="titulo-historial-ejecuciones">
	<div class="flex items-center gap-3">
		<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary" aria-hidden="true">
			<History class="size-4" />
		</span>
		<h3 id="titulo-historial-ejecuciones" class="text-sm font-medium text-foreground">Historial de ejecuciones</h3>
		{#if historial.total > 0}
			<span class="text-xs text-muted-foreground" data-testid="historial-total">{historial.total} {historial.total === 1 ? 'ejecución' : 'ejecuciones'}</span>
		{/if}
	</div>

	<div class="mt-3 overflow-x-auto">
		<table class="w-full min-w-xl table-fixed text-left text-sm" data-testid="historial-ejecuciones">
			<caption class="sr-only">Ejecuciones de procesos sobre este expediente</caption>
			<thead>
				<tr class="border-y border-border text-xs text-muted-foreground" data-testid="columnas-historial">
					{#each COLUMNAS as columna (columna)}
						<th scope="col" class="py-2.5 pr-4 font-normal first:pl-2">{columna}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#if fallo}
					<tr>
						<td colspan={COLUMNAS.length} class="py-8 text-center text-sm text-destructive" data-testid="historial-fallo">
							<span role="alert">No se pudo cargar el historial de ejecuciones. Recarga la página para intentarlo otra vez.</span>
						</td>
					</tr>
				{:else if filas.length === 0}
					<tr>
						<td colspan={COLUMNAS.length} class="py-8 text-center text-sm text-muted-foreground" data-testid="historial-vacio">Todavía no hay ejecuciones.</td>
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
									class="text-left text-foreground underline-offset-2 hover:text-primary hover:underline dark:hover:text-blue-300"
									data-testid="abrir-ejecucion"
									onclick={(ev) => {
										ev.stopPropagation();
										abrir(e.id);
									}}>{fechaYHora(e.ejecutadaEn)}</button
								>
							</td>
							<td class="truncate py-3 pr-4" title={e.proceso.nombre} data-testid="celda-proceso">
								{e.proceso.nombre}
								<!-- Solo una ejecución VIEJA (de antes del 2026-11-05) trae su expediente virtual: se nombra, tenue, como segunda línea. -->
								{#if e.virtual}
									<span class="block truncate text-xs text-muted-foreground" title="Expediente virtual: «{e.virtual.nombre}»" data-testid="celda-virtual-viejo">Expediente virtual: «{e.virtual.nombre}»</span>
								{/if}
							</td>
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

	{#if hayMas && !fallo}
		<div class="mt-3 flex items-center gap-3">
			<Button variant="outline" size="sm" data-testid="ver-mas" disabled={cargandoMas} onclick={verMas}>
				{#if cargandoMas}<LoaderCircle class="animate-spin" />{/if}
				Ver más ejecuciones
			</Button>
			{#if falloMas}<span class="text-sm text-destructive dark:text-red-300" role="alert" data-testid="ver-mas-fallo">{falloMas}</span>{/if}
		</div>
	{/if}
</section>

<EjecucionModal bind:abierto={modalAbierto} ejecucion={modalEjecucion} error={modalError} />
