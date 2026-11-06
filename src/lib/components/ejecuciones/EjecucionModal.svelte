<script lang="ts">
	/**
	 * UNA EJECUCIÓN abierta (2026-11-03, Moibe: «el listado de valores finales de la corrida»): con qué palabra terminó el proceso, la lista de valores
	 * finales, cómo salió cada regla y de qué documento y campo se tomó cada dato. Es la foto de cuando se corrió: aunque después se renombre o se
	 * edite el proceso, o se borre el expediente, aquí sigue diciendo lo que se corrió (HU-59: «el historial es inmutable»). Solo lee.
	 *
	 * Las ejecuciones NUEVAS se corren sobre el expediente completo y no traen expediente virtual (2026-11-05, Moibe: quitar los expedientes virtuales).
	 * Las VIEJAS sí: su virtual se nombra (en la descripción y en «Quién, sobre qué»), sin enlace, porque la pantalla del virtual ya no existe.
	 *
	 * Los renglones del historial no traen esta foto: se pide al abrirla (`/api/ejecuciones/<id>`), y quien lo abre le pasa `ejecucion` (o `null` mientras
	 * carga, o `error` si no se pudo).
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Flag from '@lucide/svelte/icons/flag';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { CLASE_DEL_CASO, ETIQUETA_DE_ESTADO, TEXTO_DEL_CASO, fechaYHora, valorParaVer, type EjecucionCompleta } from '$lib/ejecuciones/ejecuciones';

	let {
		abierto = $bindable(false),
		ejecucion,
		error = ''
	}: {
		abierto: boolean;
		/** La ejecución, o `null` mientras se lee. */
		ejecucion: EjecucionCompleta | null;
		/** Por qué no se pudo abrir; vacío si no hubo problema. */
		error?: string;
	} = $props();

	/** Sobre qué se corrió, para la descripción: el expediente y, solo en una ejecución VIEJA, su expediente virtual. En un texto, y no con un bloque `{#if}`, para no depender de cómo se recortan los espacios de ese bloque. */
	const sobreQue = $derived(
		ejecucion ? `el expediente «${ejecucion.expediente.nombre}»${ejecucion.virtual ? ` (expediente virtual «${ejecucion.virtual.nombre}»)` : ''}` : ''
	);

	const ESTADO_DE_REGLA: Record<string, { texto: string; clase: string }> = {
		pasa: { texto: 'Pasa', clase: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' },
		no_pasa: { texto: 'No pasa', clase: 'bg-destructive/10 text-destructive' },
		listo: { texto: 'Listo', clase: 'bg-muted text-foreground' },
		sin_valores: { texto: 'Sin valores', clase: 'bg-muted text-muted-foreground' },
		sin_conexion: { texto: 'Incompleta', clase: 'bg-muted text-muted-foreground' }
	};
</script>

<DialogPrimitive.Root bind:open={abierto}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-ejecucion"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg"
		>
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">Ejecuciones{ejecucion ? ` / ${ejecucion.proceso.nombre}` : ''}</p>
				<DialogPrimitive.Close class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground">
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</DialogPrimitive.Close>
			</div>

			{#if error}
				<DialogPrimitive.Title class="sr-only">Ejecución</DialogPrimitive.Title>
				<p class="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert" data-testid="ejecucion-error">{error}</p>
			{:else if !ejecucion}
				<DialogPrimitive.Title class="sr-only">Ejecución</DialogPrimitive.Title>
				<p class="py-10 text-center text-sm text-muted-foreground" data-testid="ejecucion-cargando">Cargando…</p>
			{:else}
				<div class="flex shrink-0 items-center gap-3 py-2">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
						<Flag class="size-4" />
					</span>
					<div class="min-w-0">
						<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">Ejecución del {fechaYHora(ejecucion.ejecutadaEn)}</DialogPrimitive.Title>
						<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
							{ejecucion.ejecutadaPor.nombre ?? 'Alguien'} ejecutó «{ejecucion.proceso.nombre}» (revisión {ejecucion.proceso.revision}) sobre {sobreQue}.
						</DialogPrimitive.Description>
					</div>
				</div>

				<!-- La palabra con la que terminó el proceso. -->
				<section class="rounded-lg border border-border px-4 py-3" data-testid="ejecucion-resultado" data-caso={ejecucion.resultado.caso} data-estado={ejecucion.estado}>
					<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Resultado</p>
					<div class="mt-1.5 flex flex-wrap items-center gap-3">
						<span class="rounded-md px-3 py-1 text-base font-semibold {CLASE_DEL_CASO[ejecucion.resultado.caso]}" data-testid="ejecucion-palabra">{ejecucion.resultado.texto}</span>
						<span class="text-sm text-muted-foreground">{TEXTO_DEL_CASO[ejecucion.resultado.caso]}</span>
						<span class="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground" data-testid="ejecucion-estado">{ETIQUETA_DE_ESTADO[ejecucion.estado]}</span>
					</div>
					{#if ejecucion.detalle.faltantes.length > 0}
						<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="ejecucion-faltantes">
							<p class="font-medium">Lo que faltó</p>
							<ul class="mt-1 list-disc pl-4">
								{#each ejecucion.detalle.faltantes as f (f)}
									<li>{f}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</section>

				<!-- Quién, sobre qué. -->
				<dl class="grid gap-x-6 gap-y-1.5 py-2 text-sm sm:grid-cols-2" data-testid="ejecucion-datos">
					<div><dt class="text-xs text-muted-foreground">Proceso</dt><dd class="text-foreground">{ejecucion.proceso.nombre}</dd></div>
					<div><dt class="text-xs text-muted-foreground">Expediente</dt><dd class="text-foreground">{ejecucion.expediente.nombre}</dd></div>
					<!-- Solo en una ejecución VIEJA: las nuevas no se corren sobre un expediente virtual. -->
					{#if ejecucion.virtual}
						<div>
							<dt class="text-xs text-muted-foreground">Expediente virtual</dt>
							<dd class="text-foreground" data-testid="ejecucion-virtual">
								{ejecucion.virtual.nombre}
								{#if ejecucion.virtual.tipoNombre}<span class="text-muted-foreground"> · {ejecucion.virtual.tipoNombre}</span>{/if}
							</dd>
						</div>
					{/if}
					<div><dt class="text-xs text-muted-foreground">Ejecutó</dt><dd class="text-foreground">{ejecucion.ejecutadaPor.nombre ?? '—'}</dd></div>
				</dl>

				<!-- La lista de valores finales de la corrida. -->
				<section class="pt-2" data-testid="ejecucion-valores-finales">
					<h3 class="text-sm font-medium text-foreground">Valores finales</h3>
					{#if ejecucion.valoresFinales.length === 0}
						<p class="mt-1 text-sm text-muted-foreground" data-testid="sin-valores-finales">Este proceso no entrega valores finales: solo termina con su palabra.</p>
					{:else}
						<table class="mt-1.5 w-full table-fixed text-left text-sm">
							<thead>
								<tr class="border-y border-border text-xs text-muted-foreground">
									<th scope="col" class="w-1/3 py-2 pr-3 font-normal">Nombre</th>
									<th scope="col" class="py-2 pr-3 font-normal">Valor</th>
									<th scope="col" class="w-1/4 py-2 font-normal">De dónde sale</th>
								</tr>
							</thead>
							<tbody>
								{#each ejecucion.valoresFinales as f (f.nodoId)}
									<tr class="border-b border-border last:border-0" data-testid="valor-final-de-corrida" data-nodo={f.nodoId} data-estado={f.estado}>
										<td class="py-2 pr-3 align-top font-medium break-words text-foreground">{f.nombre}</td>
										<td class="py-2 pr-3 align-top break-words {f.estado === 'listo' ? 'text-foreground' : 'text-muted-foreground italic'}" data-testid="valor-final-valor">{valorParaVer(f)}</td>
										<td class="py-2 align-top text-xs break-words text-muted-foreground">{f.origen ?? '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>

				<!-- Cómo salió cada regla. -->
				<section class="pt-3" data-testid="ejecucion-reglas">
					<h3 class="text-sm font-medium text-foreground">Cómo salió cada regla</h3>
					{#if ejecucion.detalle.reglas.length === 0}
						<p class="mt-1 text-sm text-muted-foreground">El proceso no tiene reglas.</p>
					{:else}
						<ul class="mt-1.5 divide-y divide-border rounded-lg border border-border">
							{#each ejecucion.detalle.reglas as r (r.id)}
								<li class="flex items-center gap-3 px-3 py-2 text-sm" data-testid="regla-de-corrida" data-regla={r.id} data-estado={r.estado}>
									<span class="min-w-0 flex-1">
										<span class="block font-medium text-foreground">{r.etiqueta}</span>
										<span class="block text-xs text-muted-foreground">{r.texto}</span>
									</span>
									<span class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium {ESTADO_DE_REGLA[r.estado]?.clase ?? 'bg-muted text-muted-foreground'}">{ESTADO_DE_REGLA[r.estado]?.texto ?? r.estado}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<!-- De qué documento y campo se tomó cada dato. -->
				<section class="pt-3 pb-1" data-testid="ejecucion-evidencia">
					<h3 class="text-sm font-medium text-foreground">De dónde salieron los datos</h3>
					{#each ejecucion.detalle.evidencia as e (e.tipoId)}
						<div class="mt-2 rounded-lg border border-border px-3 py-2" data-testid="evidencia-de-corrida" data-tipo={e.tipoId}>
							<p class="text-sm font-medium text-foreground">
								{e.tipoNombre}
								<span class="font-normal text-muted-foreground">
									·
									{#if e.documentoNombre}{e.documentoNombre}{:else}el expediente no traía este documento{/if}
									{#if e.origenTipo === 'clasificacion'}(solo clasificado: sin datos extraídos){/if}
								</span>
							</p>
							{#if e.campos.length > 0}
								<table class="mt-1 w-full table-fixed text-left text-xs">
									<tbody>
										{#each e.campos as c (c.campo)}
											<tr class="border-t border-border first:border-0">
												<td class="w-1/3 py-1 pr-3 align-top text-muted-foreground">{c.campo}</td>
												<td class="py-1 pr-3 align-top break-words text-foreground">{c.valores.length > 0 ? (c.forma === 'filas' ? `${c.valores.length} fila${c.valores.length === 1 ? '' : 's'}` : c.valores.join(', ')) : '—'}</td>
												<td class="w-24 py-1 text-right align-top text-muted-foreground">{[c.confianza !== null ? `${Math.round(c.confianza)}%` : '', c.pagina !== null ? `pág. ${c.pagina}` : ''].filter(Boolean).join(' · ')}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>
					{/each}
					{#if ejecucion.detalle.evidencia.length === 0}
						<p class="mt-1 text-sm text-muted-foreground">El proceso no lee ningún documento.</p>
					{/if}
				</section>

				<div class="flex shrink-0 justify-end pt-2">
					<DialogPrimitive.Close>
						{#snippet child({ props })}
							<Button {...props} variant="outline">Cerrar</Button>
						{/snippet}
					</DialogPrimitive.Close>
				</div>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
