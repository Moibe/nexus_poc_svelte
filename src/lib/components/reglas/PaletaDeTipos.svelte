<script lang="ts">
	/**
	 * Lo que se puede poner en el lienzo (motor de reglas, 2026-10-20): arriba los tipos documentales, que son las entradas del
	 * proceso, y debajo los operadores, que son las reglas.
	 *
	 * De los tipos, solo los ACTIVOS: un borrador todavía no se puede procesar y uno archivado ya no está en la biblioteca, así que
	 * una regla sobre ellos no tendría de dónde sacar datos. Cada uno se arrastra al lienzo o se agrega con un clic (el clic es
	 * también el camino de quien no puede arrastrar). Un tipo que ya está en el lienzo no se duplica: su fila lo dice y al pulsarla
	 * lleva a él. Un operador sí se puede poner las veces que haga falta.
	 */
	import Equal from '@lucide/svelte/icons/equal';
	import FileText from '@lucide/svelte/icons/file-text';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';

	import { MIME_OPERADOR, MIME_TIPO_DOCUMENTAL, OPERADORES } from '$lib/reglas/reglas';
	import { estadoBiblioteca, tiposDocumentales } from '$lib/state/configuracion.svelte';

	let {
		enLienzo,
		alAgregar,
		alAgregarOperador
	}: {
		/** Ids de los tipos que ya tienen su nodo. */
		enLienzo: ReadonlySet<string>;
		/** Un clic en un tipo: lo agrega o, si ya está, lo enfoca. */
		alAgregar: (tipoId: string) => void;
		/** Un clic en un operador: agrega uno nuevo. */
		alAgregarOperador: (clave: string) => void;
	} = $props();

	const activos = $derived(tiposDocumentales.filter((t) => t.estado === 'activo'));

	function alArrastrar(e: DragEvent, mime: string, valor: string) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(mime, valor);
		e.dataTransfer.effectAllowed = 'copy';
	}
</script>

<aside class="flex w-64 shrink-0 flex-col border-r border-border bg-card" data-testid="paleta-tipos">
	<div class="flex-1 overflow-y-auto">
		<div class="border-b border-border px-4 py-3">
			<h2 class="text-sm font-semibold text-foreground">Tipos documentales</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">Las entradas del proceso. Arrástralos al lienzo o pulsa para agregarlos.</p>
		</div>

		<div class="p-2">
			{#if estadoBiblioteca.errorCarga}
				<p class="px-2 py-3 text-xs text-destructive" data-testid="paleta-error">
					No se pudo leer la biblioteca: {estadoBiblioteca.errorCarga}
				</p>
			{:else if !estadoBiblioteca.cargada}
				<p class="px-2 py-3 text-xs text-muted-foreground" data-testid="paleta-cargando">Cargando…</p>
			{:else if activos.length === 0}
				<p class="px-2 py-3 text-xs text-muted-foreground" data-testid="paleta-vacia">
					No hay tipos documentales activos. Se activan en el Módulo de configuración.
				</p>
			{:else}
				<ul class="flex flex-col gap-1.5">
					{#each activos as tipo (tipo.id)}
						{@const puesto = enLienzo.has(tipo.id)}
						<li>
							<button
								type="button"
								draggable="true"
								data-testid="tipo-de-paleta"
								data-tipo-id={tipo.id}
								data-en-lienzo={puesto}
								title={puesto ? 'Ya está en el lienzo: pulsa para ir a él' : 'Arrástralo al lienzo o pulsa para agregarlo'}
								class="flex w-full cursor-grab items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors active:cursor-grabbing {puesto
									? 'border-primary/40 bg-primary/5'
									: 'border-border bg-card hover:bg-muted'}"
								ondragstart={(e) => alArrastrar(e, MIME_TIPO_DOCUMENTAL, tipo.id)}
								onclick={() => alAgregar(tipo.id)}
							>
								<GripVertical class="size-4 shrink-0 text-muted-foreground/60" />
								<FileText class="size-4 shrink-0 text-primary" />
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium text-foreground">{tipo.nombre}</span>
									<span class="block text-xs text-muted-foreground">
										{#if puesto}En el lienzo · {/if}{tipo.campos.length}
										{tipo.campos.length === 1 ? 'campo' : 'campos'}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="border-y border-border px-4 py-3">
			<h2 class="text-sm font-semibold text-foreground">Operadores</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">Las reglas. Conecta campos a sus entradas.</p>
		</div>
		<ul class="flex flex-col gap-1.5 p-2">
			{#each OPERADORES as operador (operador.clave)}
				<li>
					<button
						type="button"
						draggable="true"
						data-testid="operador-de-paleta"
						data-operador={operador.clave}
						title="Arrástralo al lienzo o pulsa para agregarlo"
						class="flex w-full cursor-grab items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 text-left transition-colors hover:bg-muted active:cursor-grabbing"
						ondragstart={(e) => alArrastrar(e, MIME_OPERADOR, operador.clave)}
						onclick={() => alAgregarOperador(operador.clave)}
					>
						<GripVertical class="size-4 shrink-0 text-muted-foreground/60" />
						<Equal class="size-4 shrink-0 text-primary" />
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-medium text-foreground">{operador.etiqueta}</span>
							<span class="block text-xs text-muted-foreground">{operador.descripcion}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
</aside>
