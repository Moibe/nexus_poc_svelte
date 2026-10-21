<script lang="ts">
	/**
	 * Lo que se puede poner en el lienzo (motor de reglas, 2026-10-20): los tipos documentales, que son las entradas del proceso, los
	 * operadores, que son las reglas, y los valores fijos.
	 *
	 * Va en MENÚS RETRAÍBLES, uno por grupo (2026-10-21): con quince operadores la lista era tan larga que la paleta pedía desplazarse
	 * un buen rato. Son seis menús independientes —los tipos, los cuatro grupos de operadores y los valores—, abrir uno no cierra los
	 * demás, y TODOS arrancan retraídos: hay que abrir un grupo para ver lo que trae. Cada encabezado dice cuántos elementos tiene,
	 * para que se sepa qué hay detrás sin abrirlo. Lo abierto no se recuerda al salir de la página.
	 *
	 * De los tipos, solo los ACTIVOS: un borrador todavía no se puede procesar y uno archivado ya no está en la biblioteca, así que
	 * una regla sobre ellos no tendría de dónde sacar datos. Cada uno se arrastra al lienzo o se agrega con un clic (el clic es
	 * también el camino de quien no puede arrastrar). Un tipo que ya está en el lienzo no se duplica: su fila lo dice y al pulsarla
	 * lleva a él. Un operador sí se puede poner las veces que haga falta.
	 *
	 * Si la biblioteca no se pudo leer, o todavía está cargando, el encabezado de los tipos lo dice aunque el menú esté retraído
	 * («Error», «…»): un fallo escondido detrás de un menú cerrado se confundiría con «no hay tipos».
	 */
	import FileText from '@lucide/svelte/icons/file-text';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';

	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { GRUPOS_DE_OPERADORES, MIME_CONSTANTE, MIME_OPERADOR, MIME_TIPO_DOCUMENTAL, OPERADORES } from '$lib/reglas/reglas';
	import { estadoBiblioteca, tiposDocumentales } from '$lib/state/configuracion.svelte';

	let {
		enLienzo,
		alAgregar,
		alAgregarOperador,
		alAgregarConstante
	}: {
		/** Ids de los tipos que ya tienen su nodo. */
		enLienzo: ReadonlySet<string>;
		/** Un clic en un tipo: lo agrega o, si ya está, lo enfoca. */
		alAgregar: (tipoId: string) => void;
		/** Un clic en un operador: agrega uno nuevo. */
		alAgregarOperador: (clave: string) => void;
		/** Un clic en «Valor fijo»: agrega uno nuevo. */
		alAgregarConstante: () => void;
	} = $props();

	const activos = $derived(tiposDocumentales.filter((t) => t.estado === 'activo'));

	/** Los menús que están abiertos (por su `value`). Vacío = todos retraídos, que es como arranca la paleta. */
	let abiertos = $state<string[]>([]);

	/** Lo que dice el encabezado de los tipos a la derecha: cuántos hay, o por qué todavía no se sabe. */
	const cuentaDeTipos = $derived(
		estadoBiblioteca.errorCarga ? { texto: 'Error', malo: true } : !estadoBiblioteca.cargada ? { texto: '…', malo: false } : { texto: String(activos.length), malo: false }
	);

	function alArrastrar(e: DragEvent, mime: string, valor: string) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(mime, valor);
		e.dataTransfer.effectAllowed = 'copy';
	}
</script>

<!-- El botón de cada menú: el título y, a la derecha, cuántos trae (la flechita la pone el acordeón). -->
{#snippet disparador(grupo: string, titulo: string, texto: string, malo: boolean, nivel: 2 | 3)}
	<Accordion.Trigger
		level={nivel}
		data-testid="grupo-paleta-boton"
		data-grupo={grupo}
		class="items-center gap-2 rounded-none px-4 py-3 text-sm font-semibold hover:bg-muted/50 hover:no-underline"
	>
		<span class="min-w-0 flex-1 truncate">{titulo}</span>
		<span
			data-testid="grupo-paleta-cuenta"
			class="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-medium {malo ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}"
			>{texto}</span
		>
	</Accordion.Trigger>
{/snippet}

<aside class="flex w-64 shrink-0 flex-col border-r border-border bg-card" data-testid="paleta-tipos">
	<div class="flex-1 overflow-y-auto">
		<Accordion.Root type="multiple" bind:value={abiertos}>
			<!-- Los tipos documentales: las entradas del proceso -->
			<Accordion.Item value="tipos" class="border-border" data-testid="grupo-paleta" data-grupo="tipos">
				{@render disparador('tipos', 'Tipos documentales', cuentaDeTipos.texto, cuentaDeTipos.malo, 2)}
				<Accordion.Content class="px-0 pb-1 [&_p:not(:last-child)]:mb-0">
					<p class="px-4 pb-2 text-xs text-muted-foreground">Las entradas del proceso. Arrástralos al lienzo o pulsa para agregarlos.</p>
					<div class="px-2">
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
				</Accordion.Content>
			</Accordion.Item>

			<!-- Los operadores: las reglas. Esto NO es un menú: solo presenta a los cuatro grupos de abajo, y por eso se ve como una
			     etiqueta de sección (chica, en mayúsculas y sobre una franja) y no como los encabezados que se pulsan. -->
			<div class="border-b border-border bg-muted/40 px-4 py-2.5">
				<h2 class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Operadores</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">Las reglas. Conecta campos, valores o resultados a sus entradas.</p>
			</div>
			{#each GRUPOS_DE_OPERADORES as grupo (grupo.clave)}
				{@const delGrupo = OPERADORES.filter((o) => o.grupo === grupo.clave)}
				<Accordion.Item value={`operadores-${grupo.clave}`} class="border-border" data-testid="grupo-paleta" data-grupo={grupo.clave}>
					{@render disparador(grupo.clave, grupo.titulo, String(delGrupo.length), false, 3)}
					<Accordion.Content class="px-2 pb-1">
						<ul class="flex flex-col gap-1.5">
							{#each delGrupo as operador (operador.clave)}
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
										<span class="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">{operador.simbolo}</span>
										<span class="min-w-0 flex-1">
											<span class="block truncate text-sm font-medium text-foreground">{operador.etiqueta}</span>
											<span class="block text-xs text-muted-foreground">{operador.descripcion}</span>
										</span>
									</button>
								</li>
							{/each}
						</ul>
					</Accordion.Content>
				</Accordion.Item>
			{/each}

			<!-- Los valores fijos -->
			<Accordion.Item value="valores" class="border-border" data-testid="grupo-paleta" data-grupo="valores">
				{@render disparador('valores', 'Valores', '1', false, 2)}
				<Accordion.Content class="px-0 pb-1 [&_p:not(:last-child)]:mb-0">
					<p class="px-4 pb-2 text-xs text-muted-foreground">Un dato que escribes en la regla, como el «2» de «más de 2 socios».</p>
					<ul class="flex flex-col gap-1.5 px-2">
						<li>
							<button
								type="button"
								draggable="true"
								data-testid="constante-de-paleta"
								title="Arrástralo al lienzo o pulsa para agregarlo"
								class="flex w-full cursor-grab items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 text-left transition-colors hover:bg-muted active:cursor-grabbing"
								ondragstart={(e) => alArrastrar(e, MIME_CONSTANTE, 'constante')}
								onclick={alAgregarConstante}
							>
								<GripVertical class="size-4 shrink-0 text-muted-foreground/60" />
								<span class="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">K</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium text-foreground">Valor fijo</span>
									<span class="block text-xs text-muted-foreground">Un texto, un número, una fecha o un sí/no.</span>
								</span>
							</button>
						</li>
					</ul>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	</div>
</aside>
