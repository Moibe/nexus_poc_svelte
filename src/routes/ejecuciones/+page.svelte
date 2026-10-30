<script lang="ts">
	/**
	 * Ejecuciones · correr un expediente virtual contra un proceso del motor de reglas (2026-10-30, pedido de Moibe).
	 *
	 * Tercera sección del módulo de uso. Por ahora las ejecuciones son MANUALES, y la pantalla tiene dos listas:
	 *   · Arriba, lo que se puede ejecutar: se elige un expediente y de ahí salen sus expedientes virtuales; cada uno se junta con los
	 *     procesos activos que corren sobre su tipo. Esa unión es la «cosa ejecutable».
	 *   · Abajo, el historial: una fila por ejecución, con Fecha de ejecución, Expediente, Expediente virtual, Proceso y Resultado.
	 *
	 * El botón «Ejecutar» está apagado y el historial vacío a propósito: todavía no hay motor que corra un proceso sobre los datos de un
	 * expediente virtual ni dónde guardar el resultado. Lo que ya es real es la unión (los pares salen de los datos de la organización).
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

	/** Elegir otro expediente es navegar: la dirección lleva el expediente y el servidor arma lo que se puede ejecutar. */
	function elegir(id: string) {
		if (id && id !== data.elegido?.id) goto(`/ejecuciones?expediente=${encodeURIComponent(id)}`, { noScroll: true, keepFocus: true });
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
		Elige un expediente: sus expedientes virtuales se juntan con los procesos activos que corren sobre su tipo.
	</p>

	<div class="mt-5 max-w-md space-y-2">
		<Label for="expediente-ejecucion">Expediente</Label>
		<Select.Root type="single" value={data.elegido?.id ?? ''} onValueChange={elegir} disabled={data.expedientes.length === 0}>
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

	<div class="mt-6" data-testid="ejecutables" aria-live="polite">
		{#if data.expedienteAusente}
			<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">Ese expediente ya no existe. Elige otro de la lista.</p>
		{:else if !data.elegido}
			<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">Elige un expediente para ver qué se puede ejecutar.</p>
		{:else if data.virtuales === 0}
			<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">
				«{data.elegido.nombre}» no tiene expedientes virtuales. Se arman dentro del
				<a href="/expediente/{encodeURIComponent(data.elegido.id)}" class="text-primary underline-offset-2 hover:underline">expediente</a>.
			</p>
		{:else}
			{#if data.ejecutables.length === 0}
				<p class="text-sm text-muted-foreground" data-testid="ejecutables-aviso">
					Ningún proceso activo corre sobre el tipo de los expedientes virtuales de «{data.elegido.nombre}».
				</p>
			{:else}
				<ul class="flex flex-col gap-3">
					{#each data.ejecutables as e (e.virtualId + e.procesoId)}
						<li
							class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3"
							data-testid="ejecutable"
							data-virtual={e.virtualId}
							data-proceso={e.procesoId}
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-medium text-foreground">{e.virtualNombre}</span>
								<span class="block truncate text-xs text-muted-foreground">{e.tipoNombre}</span>
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-xs text-muted-foreground">Proceso</span>
								<span class="block truncate text-sm text-foreground">{e.procesoNombre}</span>
							</span>
							<Button size="sm" class="h-9.5 shrink-0 px-4" disabled data-testid="ejecutar" title="Todavía no se pueden ejecutar procesos">Ejecutar</Button>
						</li>
					{/each}
				</ul>
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
