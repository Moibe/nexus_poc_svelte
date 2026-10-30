<script lang="ts">
	/**
	 * Los DATOS EXTRAÍDOS de un documento (2026-10-29, Moibe: «una cosa es el file y otra los datos que se extrajeron»): lo que se guardó al
	 * procesarlo en el Pipeline (migración 0007). Enseña su tipo documental, su última corrida (cuándo, con qué confianza, cuántas lleva) y
	 * sus campos VIGENTES, uno por renglón: valor, confianza y página; lo que el esquema pedía y no apareció sale como «No apareció».
	 *
	 * Solo lee. Corregir un dato ya existe en el servidor (`POST …/datos/correcciones`) pero todavía no tiene pantalla, y la capa de OCR
	 * (de qué bloque salió cada valor) quedó para después.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import ScanText from '@lucide/svelte/icons/scan-text';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { fechaCorta } from '$lib/expedientes/expedientes';

	type Campo = {
		ruta: string;
		nombre: string;
		registro: number | null;
		valor: string | null;
		valorCrudo: string | null;
		motivoSinValor: string | null;
		confianza: number | null;
		pagina: number | null;
		corregido: boolean;
	};
	type Datos = {
		clasificacion: { categoria: string | null; tipoDocumental: { id: string; nombre: string } | null; confianza: number | null } | null;
		extraccion: {
			tipoDocumental: { id: string; nombre: string | null; revision: number | null };
			estado: 'ok' | 'no_reconocido' | 'error';
			error: string | null;
			confianzaPromedio: number | null;
			terminadaEn: string | null;
			totalCorridas: number;
		} | null;
		campos: Campo[];
	};

	let { documento = $bindable() }: { documento: { id: string; nombre: string } | null } = $props();

	let datos = $state<Datos | null>(null);
	let error = $state('');
	let abierto = $state(false);

	$effect(() => {
		const doc = documento;
		abierto = doc !== null;
		datos = null;
		error = '';
		if (!doc) return;
		let vigente = true;
		fetch(`/api/documentos/${encodeURIComponent(doc.id)}/datos`)
			.then(async (r) => {
				const cuerpo = await r.json().catch(() => null);
				if (!vigente) return;
				if (!r.ok || !cuerpo) error = cuerpo?.message ?? cuerpo?.mensaje ?? 'No se pudieron leer los datos del documento.';
				else datos = cuerpo as Datos;
			})
			.catch(() => {
				if (vigente) error = 'No se pudieron leer los datos del documento.';
			});
		return () => {
			vigente = false;
		};
	});

	const MOTIVOS: Record<string, string> = {
		not_present: 'No apareció',
		illegible: 'Ilegible',
		below_threshold: 'Confianza insuficiente',
		extraction_error: 'Falló la extracción'
	};

	/** `socios[2].nombre` → «socios 2 · nombre»: la ruta se lee mejor sin corchetes. */
	const legible = (ruta: string) => ruta.replace(/\[(\d+)\]/g, ' $1').replaceAll('.', ' · ').replaceAll('_', ' ');
	const tono = (c: number | null) => (c === null ? 'text-muted-foreground' : c >= 85 ? 'text-green-700' : c >= 60 ? 'text-amber-700' : 'text-red-700');
</script>

<DialogPrimitive.Root bind:open={abierto} onOpenChange={(v) => !v && (documento = null)}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-datos-extraidos"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">Archivos procesados / {documento?.nombre}</p>
				<DialogPrimitive.Close class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground">
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</DialogPrimitive.Close>
			</div>

			<div class="flex h-16 shrink-0 items-center gap-3">
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
					<ScanText class="size-4" />
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">Datos extraídos</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
						{#if datos?.extraccion}
							{datos.extraccion.tipoDocumental.nombre ?? 'Tipo documental eliminado'} · {fechaCorta(datos.extraccion.terminadaEn)}
							{#if datos.extraccion.confianzaPromedio !== null}· confianza {datos.extraccion.confianzaPromedio.toFixed(0)}%{/if}
							{#if datos.extraccion.totalCorridas > 1}· procesado {datos.extraccion.totalCorridas} veces{/if}
						{:else if datos?.clasificacion?.tipoDocumental}
							Clasificado como {datos.clasificacion.tipoDocumental.nombre}, sin datos extraídos todavía
						{:else}
							Lo que Document AI leyó del documento
						{/if}
					</DialogPrimitive.Description>
				</div>
			</div>

			<div class="px-1 pb-2">
				{#if error}
					<p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>
				{:else if !datos}
					<p class="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
				{:else}
					{#if datos.extraccion?.estado === 'error'}
						<p class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="ultima-corrida-fallo">
							El último intento de extracción falló: {datos.extraccion.error}{datos.campos.length ? ' Abajo, los datos de la extracción anterior.' : ''}
						</p>
					{:else if datos.extraccion?.estado === 'no_reconocido'}
						<p class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">El extractor no reconoció los campos de este documento.</p>
					{/if}
					{#if datos.campos.length === 0}
						<p class="py-10 text-center text-sm text-muted-foreground" data-testid="sin-datos-extraidos">
							Este documento no tiene datos extraídos guardados. Se guardan desde que se procesa en el Pipeline.
						</p>
					{:else}
						<table class="w-full text-left text-sm" data-testid="tabla-datos-extraidos">
							<thead>
								<tr class="border-y border-border text-xs text-muted-foreground">
									<th scope="col" class="py-2 pr-3 font-normal">Campo</th>
									<th scope="col" class="py-2 pr-3 font-normal">Valor</th>
									<th scope="col" class="py-2 pr-3 text-right font-normal">Confianza</th>
									<th scope="col" class="py-2 text-right font-normal">Pág.</th>
								</tr>
							</thead>
							<tbody>
								{#each datos.campos as c (c.ruta)}
									<tr class="border-b border-border last:border-0" data-testid="dato-extraido">
										<td class="py-2 pr-3 align-top text-xs text-muted-foreground capitalize">{legible(c.ruta)}</td>
										<td class="py-2 pr-3 align-top break-words text-foreground">
											{#if c.valor === null}
												<span class="text-xs text-red-700" data-testid="dato-ausente">{MOTIVOS[c.motivoSinValor ?? ''] ?? 'Sin valor'}</span>
											{:else}
												<span title={c.valorCrudo && c.valorCrudo !== c.valor ? `Leído como: ${c.valorCrudo}` : undefined}>{c.valor}</span>
												{#if c.corregido}<span class="ml-1 text-xs text-muted-foreground">(corregido)</span>{/if}
											{/if}
										</td>
										<td class="py-2 pr-3 text-right align-top text-xs {tono(c.confianza)}">{c.confianza === null ? '—' : `${c.confianza.toFixed(0)}%`}</td>
										<td class="py-2 text-right align-top text-xs text-muted-foreground">{c.pagina ?? '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				{/if}
			</div>

			<div class="flex items-center justify-end border-t border-border p-2.5">
				<Button type="button" variant="link" class="h-9.5 px-4" onclick={() => (documento = null)}>Cerrar</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
