<script lang="ts">
	/**
	 * El listado de expedientes COMO LISTA (2026-10-25, pedido de Moibe): una fila por expediente y una columna por cada cosa que se
	 * quiere ver de él. La que más pesa es el TIPO de expediente, y por eso va justo después del nombre y con su etiqueta resaltada.
	 *
	 * Cada encabezado es un botón que ordena por esa columna y, picado otra vez, invierte la dirección: `aria-sort` dice por cuál va
	 * (para quien no ve la flecha). Qué orden sale de cada clic lo decide `ordenAlPicar`; aquí solo se pinta. La fila entera es un
	 * enlace al detalle —el del nombre, estirado sobre toda la fila—, así que también se abre con el teclado, con clic medio y con
	 * «abrir en una pestaña nueva».
	 *
	 * Recibe los expedientes YA filtrados y ordenados. «Creado por» no es una columna: el servidor solo guarda el id de quien lo creó.
	 */
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';

	import {
		COLUMNAS_EXPEDIENTES,
		columnaDeOrden,
		fechaCorta,
		formatearTamano,
		type ColumnaExpedientes,
		type Expediente,
		type OrdenExpedientes
	} from '$lib/expedientes/expedientes';

	let {
		expedientes,
		orden,
		alPicar
	}: { expedientes: Expediente[]; orden: OrdenExpedientes; alPicar: (columna: ColumnaExpedientes) => void } = $props();

	const activa = $derived(columnaDeOrden(orden));

	/** Cuánto ocupa cada columna (la tabla es de ancho fijo para que un nombre largo se corte con «…» en vez de ensanchar la lista). */
	const ANCHO: Record<ColumnaExpedientes, string> = {
		nombre: 'w-[32%]',
		tipo: 'w-[26%]',
		archivos: 'w-[11%]',
		peso: 'w-[12%]',
		creado: 'w-[19%]'
	};
</script>

<div class="mt-3 overflow-x-auto">
	<table class="w-full min-w-3xl table-fixed text-left text-sm" data-testid="tabla-expedientes">
		<caption class="sr-only">Expedientes de tu organización, ordenados por la columna marcada</caption>
		<thead>
			<tr class="border-y border-border text-xs text-muted-foreground">
				{#each COLUMNAS_EXPEDIENTES as c (c.columna)}
					{@const esta = activa.columna === c.columna}
					<th
						scope="col"
						class="py-1.5 pr-4 font-normal first:pl-2 {ANCHO[c.columna]}"
						aria-sort={esta ? (activa.direccion === 'asc' ? 'ascending' : 'descending') : undefined}
					>
						<button
							type="button"
							title="Ordenar por {c.etiqueta.toLowerCase()}"
							data-testid="ordenar-columna-{c.columna}"
							class="-ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-left whitespace-nowrap transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 {esta
								? 'font-medium text-foreground'
								: ''}"
							onclick={() => alPicar(c.columna)}
						>
							{c.etiqueta}
							{#if !esta}
								<ChevronsUpDown class="size-3.5 shrink-0 opacity-40" aria-hidden="true" />
							{:else if activa.direccion === 'asc'}
								<ArrowUp class="size-3.5 shrink-0" aria-hidden="true" />
							{:else}
								<ArrowDown class="size-3.5 shrink-0" aria-hidden="true" />
							{/if}
						</button>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody data-testid="filas-expedientes">
			{#each expedientes as expediente (expediente.id)}
				<tr
					class="relative border-b border-border transition-colors last:border-0 focus-within:bg-muted/50 hover:bg-muted/50"
					data-testid="fila-expediente"
				>
					<td class="py-3 pr-4 pl-2">
						<a
							href={`/expediente/${expediente.id}`}
							class="block outline-none after:absolute after:inset-0 focus-visible:after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
						>
							<span class="block truncate font-medium text-foreground" data-testid="expediente-nombre" title={expediente.nombre}>
								{expediente.nombre}
							</span>
						</a>
					</td>
					<td class="py-3 pr-4">
						{#if expediente.tipo?.nombre}
							<span
								class="inline-block max-w-full truncate rounded-sm border border-primary/20 bg-primary/10 px-2 py-0.5 align-middle text-xs font-medium text-primary"
								data-testid="expediente-tipo"
								title={expediente.tipo.nombre}
							>
								{expediente.tipo.nombre}
							</span>
						{:else}
							<!-- Solo los guardados antes de que el tipo fuera obligatorio, o los de un tipo que ya no está. -->
							<span class="text-xs text-muted-foreground" data-testid="expediente-sin-tipo">Sin tipo</span>
						{/if}
					</td>
					<td class="py-3 pr-4 text-foreground tabular-nums" data-testid="expediente-archivos">{expediente.totalDocumentos}</td>
					<!-- Un servidor anterior al peso no lo manda: sin dato se calla, en vez de decir «0 MB» de algo que sí tiene documentos. -->
					<td class="py-3 pr-4 text-foreground tabular-nums" data-testid="expediente-peso">
						{expediente.tamanoBytes === undefined ? '—' : formatearTamano(expediente.tamanoBytes)}
					</td>
					<td class="py-3 pr-2 text-xs text-muted-foreground" data-testid="expediente-creado">{fechaCorta(expediente.creadoEn)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
