<script lang="ts">
	/**
	 * Ejecuciones · correr un expediente virtual contra un proceso del motor de reglas (2026-10-30, pedido de Moibe; 2026-11-03: «es la
	 * combinación de ambas lo que se ejecuta», así que se elige también el proceso).
	 *
	 * Tercera sección del módulo de uso. Por ahora las ejecuciones son MANUALES, y la pantalla tiene dos partes:
	 *   · Arriba, «Ejecutar»: se elige el EXPEDIENTE, luego el PROCESO (los activos que corren sobre el tipo de alguno de sus expedientes
	 *     virtuales) y, solo si el expediente tiene más de un expediente virtual de ese tipo, cuál. Con todo elegido, un resumen dice qué se va a
	 *     ejecutar sobre qué.
	 *   · Abajo, el historial: una fila por ejecución, con Fecha de ejecución, Expediente, Expediente virtual, Proceso y Resultado.
	 *
	 * El botón «Ejecutar» está apagado y el historial vacío a propósito: todavía no hay motor que corra un proceso sobre los datos de un
	 * expediente virtual ni dónde guardar el resultado. Lo que ya es real es la elección (sale de los datos de la organización).
	 *
	 * No decide permisos todavía (como el resto del módulo de uso, la ven todos los roles): cuando se pueda ejecutar habrá que decidir
	 * quién puede hacerlo.
	 */
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select/index.js';

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
						<Select.Item value={pr.id} label={pr.nombre} data-testid="opcion-proceso" />
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
					<Button size="sm" class="h-9.5 shrink-0 px-4" disabled data-testid="ejecutar" title="Todavía no se pueden ejecutar procesos">Ejecutar</Button>
				</div>
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
	<h2 id="titulo-historial" class="text-base font-medium text-foreground">Historial de ejecuciones</h2>
	<div class="mt-3 overflow-x-auto">
		<table class="w-full min-w-3xl table-fixed text-left text-sm" data-testid="historial">
			<caption class="sr-only">Ejecuciones de procesos sobre expedientes virtuales</caption>
			<thead>
				<tr class="border-y border-border text-xs text-muted-foreground" data-testid="columnas-historial">
					{#each COLUMNAS_HISTORIAL as columna (columna)}
						<th scope="col" class="py-2.5 pr-4 font-normal first:pl-2">{columna}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				<tr>
					<td colspan={COLUMNAS_HISTORIAL.length} class="py-10 text-center text-sm text-muted-foreground" data-testid="historial-vacio">
						Todavía no hay ejecuciones.
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</section>
