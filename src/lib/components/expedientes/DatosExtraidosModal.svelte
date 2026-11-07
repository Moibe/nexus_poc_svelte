<script lang="ts">
	/**
	 * El DETALLE de un documento: los DATOS EXTRAÍDOS que se guardaron al procesarlo (2026-10-29, Moibe: «una cosa es el file y otra los datos que se
	 * extrajeron»; migración 0007). Enseña su tipo documental, su última corrida (cuándo, con qué confianza, cuántas lleva) y, en dos pestañas:
	 *
	 *   · «PDF»: lo que diría el informe en PDF de las bandejas —«Información», «Procesamiento OCR» y «Campos extraídos» (valor, confianza y página de cada campo; lo que
	 *     el esquema pedía y no apareció sale como «No apareció») y los avisos—, armado con `construirInformeDeDatos`: lo que se ve aquí es lo que se descarga.
	 *   · «JSON»: lo mismo que dice nexus_back, tal cual.
	 *
	 * Moibe, 2026-11-06: «Detalle nos llevará aquí. En lugar de decir Campos y JSON debe decir PDF y JSON, y mostrará la info acorde, ambos tendrán abajo un botón de
	 * descargar, y ahí sí los descargamos. Así como cuando consultamos los detalles en lo procesado en las bandejas». Por eso las pestañas se llaman PDF y JSON (antes «Campos» y
	 * «JSON») y el botón «Descargar» del pie baja lo que se está viendo: el PDF en la pestaña PDF y el `.json` en la JSON (igual que el «Descargar» del detalle de las
	 * bandejas). Ya no hay botones de PDF y JSON sueltos en la tarjeta del documento.
	 *
	 * Solo lee. Corregir un dato ya existe en el servidor (`POST …/datos/correcciones`) pero todavía no tiene pantalla, y la capa de OCR
	 * (de qué bloque salió cada valor) quedó para después.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Download from '@lucide/svelte/icons/download';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import ScanText from '@lucide/svelte/icons/scan-text';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { descargarBlob, descargarPdf, sinExtension } from '$lib/documentos/descargar';
	import { construirInformeDeDatos, type Datos } from '$lib/expedientes/datosExtraidos';
	import { fechaCorta, type DocumentoDeExpediente } from '$lib/expedientes/expedientes';

	/**
	 * `contexto` es de dónde se abrió, para la migaja de arriba («Archivos procesados» por omisión) y, si viene, el expediente que sale en el informe. `detalle` es el documento
	 * tal como lo trae la lista (su tamaño, su canal, su huella…): el informe lo dice; sin él se arma con lo único que hay, el nombre.
	 */
	let { documento = $bindable() }: { documento: { id: string; nombre: string; contexto?: string; detalle?: DocumentoDeExpediente } | null } = $props();

	let vista = $state<'pdf' | 'json'>('pdf');
	let datos = $state<Datos | null>(null);
	const json = $derived(datos ? JSON.stringify(datos, null, 2) : '');
	const informe = $derived(
		datos && documento
			? construirInformeDeDatos(
					documento.detalle ?? { id: documento.id, nombreOriginal: documento.nombre, mime: '', tamanoBytes: 0, canal: 'MANUAL', recibidoEn: null },
					datos,
					documento.contexto ?? null
				)
			: null
	);

	let descargando = $state(false);
	let errorDescarga = $state('');
	/** Baja LO QUE SE ESTÁ VIENDO: el PDF del informe en la pestaña PDF, el JSON en la JSON. */
	async function descargar() {
		if (!documento || !datos || descargando) return;
		errorDescarga = '';
		const base = sinExtension(documento.nombre) || 'documento';
		if (vista === 'json') {
			descargarBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), `${base}.datos.json`);
			return;
		}
		if (!informe) return;
		descargando = true;
		try {
			await descargarPdf(informe, `${base}-resultados.pdf`);
		} catch {
			errorDescarga = 'No se pudo armar el PDF. Intenta de nuevo.';
		} finally {
			descargando = false;
		}
	}

	let error = $state('');
	let abierto = $state(false);

	$effect(() => {
		const doc = documento;
		abierto = doc !== null;
		datos = null;
		error = '';
		errorDescarga = '';
		vista = 'pdf';
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
</script>

<DialogPrimitive.Root bind:open={abierto} onOpenChange={(v) => !v && (documento = null)}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-datos-extraidos"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">{documento?.contexto ?? 'Archivos procesados'} / {documento?.nombre}</p>
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
							Lo que Biblioratum leyó del documento
						{/if}
					</DialogPrimitive.Description>
				</div>
			</div>

			<!-- Dos pestañas: el PDF (lo que diría el informe) y el JSON. Sin datos no hay nada que cambiar. -->
			{#if datos}
				<div class="flex gap-1 border-b border-border px-1" role="tablist" aria-label="Cómo ver el detalle">
					{#each [['pdf', 'PDF'], ['json', 'JSON']] as const as [clave, texto] (clave)}
						<button
							type="button"
							role="tab"
							aria-selected={vista === clave}
							data-testid="datos-pestana-{clave}"
							class="-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors {vista === clave ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}"
							onclick={() => (vista = clave)}
						>
							{texto}
						</button>
					{/each}
				</div>
			{/if}

			<div class="px-1 pb-2">
				{#if error}
					<p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>
				{:else if !datos}
					<p class="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
				{:else if vista === 'json'}
					<pre class="mt-3 max-h-[50vh] overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground" data-testid="json-datos-extraidos">{json}</pre>
				{:else if informe}
					<!-- Lo mismo que lleva el PDF, en pantalla: secciones con renglones «etiqueta · valor» y los recuadros de aviso al final. -->
					<div class="mt-3 max-h-[50vh] overflow-auto" data-testid="informe-datos-extraidos">
						{#each informe.secciones as seccion (seccion.titulo)}
							<section class="mb-4">
								<h3 class="mb-1 text-sm font-semibold text-foreground">{seccion.titulo}</h3>
								<dl>
									{#each seccion.filas as fila, i (i)}
										<div class="flex gap-4 border-b border-border py-2 text-sm" data-testid="informe-fila">
											<dt class="w-44 shrink-0 text-xs text-muted-foreground">{fila.etiqueta}</dt>
											<dd class="min-w-0 flex-1 wrap-break-word text-foreground">{fila.valor}</dd>
										</div>
									{/each}
								</dl>
							</section>
						{/each}
						{#each informe.avisos ?? [] as aviso (aviso.titulo)}
							<div class="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="informe-aviso">
								<p class="font-medium">{aviso.titulo}</p>
								<p class="mt-0.5">{aviso.texto}</p>
							</div>
						{/each}
					</div>
				{/if}
				{#if errorDescarga}
					<p class="mt-2 text-xs text-destructive" role="alert" data-testid="error-descarga-datos">{errorDescarga}</p>
				{/if}
			</div>

			<!-- Abajo, «Descargar» baja lo que se está viendo (PDF o JSON), como en el detalle de las bandejas. -->
			<div class="flex items-center justify-end gap-2 border-t border-border p-2.5">
				<Button
					type="button"
					variant="outline"
					class="h-9.5 gap-2 px-4"
					data-testid="descargar-datos"
					disabled={!datos || descargando}
					title={vista === 'json' ? 'Descargar JSON' : 'Descargar PDF'}
					onclick={descargar}
				>
					{#if descargando}<LoaderCircle class="size-4 animate-spin" />{:else}<Download class="size-4" />{/if}
					Descargar
				</Button>
				<Button type="button" variant="link" class="h-9.5 px-4" onclick={() => (documento = null)}>Cerrar</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
