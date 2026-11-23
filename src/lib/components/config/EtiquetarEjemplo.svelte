<script lang="ts">
	/**
	 * Etiquetar UN documento de ejemplo de un tipo (2026-11-23, Moibe: «el propósito sí es que nos sirva de entrenamiento» → «arranca con el
	 * punto 1, la medición»). Reemplaza los recortes a mano de «Ejemplo documental», que no guardaban el valor y nadie usaba.
	 *
	 * «Leer con Biblioratum» extrae el documento con la definición ACTUAL del tipo (también en borrador) y lo enseña a un lado con cada campo
	 * marcado (`DocumentoConCampos`). La persona revisa campo por campo: lo CONFIRMA tal cual, lo CORRIGE escribiendo lo que de verdad dice, o lo
	 * marca «No aparece». Un clic en el nombre de un campo resalta su recuadro y deja moverlo o dibujarlo de nuevo. «Guardar etiquetas» guarda esa
	 * «respuesta buena»; con ella se mide la precisión del tipo (`MedicionDeTipo`). Volver a leer un documento ya etiquetado conserva lo que la
	 * persona había dicho de cada campo.
	 */
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import ScanLine from '@lucide/svelte/icons/scan-line';

	import DocumentoConCampos, { type CambioDeCaja, type EstadoUbicacion } from '$lib/components/config/DocumentoConCampos.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Ubicacion } from '$lib/documentos/ubicaciones';
	import type { EstadoEtiquetado } from '$lib/etiquetado/estado.svelte';
	import { agrupar, costoDeMedir, cuentasDeRevision, origenDe, TEXTO_ORIGEN, type FilaDeRevision, type Origen } from '$lib/etiquetado/etiquetado';
	import { fechaHoraDe } from '$lib/expedientes/datosExtraidos';
	import type { DocumentoEjemploInstancia } from '$lib/state/configuracion.svelte';

	let { estado, doc }: { estado: EstadoEtiquetado; doc: DocumentoEjemploInstancia } = $props();

	const MIME_POR_TIPO: Record<string, string> = { PDF: 'application/pdf', JPEG: 'image/jpeg', JPG: 'image/jpeg', PNG: 'image/png', TIFF: 'image/tiff', TIF: 'image/tiff' };

	const actual = $derived(estado.estadoDe(doc.id));
	const guardadas = $derived(estado.etiquetas[doc.id] ?? null);
	const pendiente = $derived(estado.sinGuardar(doc.id));
	const filas = $derived(actual.fase === 'revision' ? actual.filas : []);
	const grupos = $derived(agrupar(filas));
	const cuentas = $derived(cuentasDeRevision(filas));
	const textoDeCuentas = $derived(
		[
			`${cuentas.confirmado} ${cuentas.confirmado === 1 ? 'confirmado' : 'confirmados'}`,
			`${cuentas.corregido} ${cuentas.corregido === 1 ? 'corregido' : 'corregidos'}`,
			...(cuentas.agregado ? [`${cuentas.agregado} ${cuentas.agregado === 1 ? 'agregado' : 'agregados'}`] : []),
			`${cuentas.ausente} ${cuentas.ausente === 1 ? 'no aparece' : 'no aparecen'}`
		].join(' · ')
	);
	const lectura = $derived(costoDeMedir([doc.paginas ?? 1]));

	// ── El documento, para enseñarlo con sus recuadros ──
	// El mismo archivo que lee nexus_back: el original si está (un PDF se pinta página por página), o la vista de la página 1 de un PDF viejo.
	const ruta = $derived(doc.rutaRelativa || doc.rutaVista || '');
	const mime = $derived(
		doc.rutaRelativa ? doc.mime || MIME_POR_TIPO[(doc.tipo || '').toUpperCase()] || 'application/octet-stream' : doc.mimeVista || 'image/png'
	);
	let archivo = $state<File | null>(null);
	let errorArchivo = $state('');
	$effect(() => {
		const [r, m, nombre] = [ruta, mime, doc.nombre];
		archivo = null;
		errorArchivo = '';
		if (!r) {
			errorArchivo = 'Este documento no está en el almacén.';
			return;
		}
		let vigente = true;
		fetch(`/api/archivos/${r}?mime=${encodeURIComponent(m)}`)
			.then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
			.then((blob) => {
				if (vigente) archivo = new File([blob], nombre, { type: m });
			})
			.catch(() => {
				if (vigente) errorArchivo = 'No se pudo cargar el documento para enseñarlo.';
			});
		return () => {
			vigente = false;
		};
	});

	const estadoVista = $derived<EstadoUbicacion>(mime === 'image/tiff' ? { fase: 'no-soportado' } : { fase: 'listo' });
	/** Los recuadros: uno por campo que SÍ aparece y tiene caja. `DocumentoConCampos` los nombra por su rótulo. */
	const ubicaciones = $derived<Ubicacion[]>(
		filas
			.filter((f) => !f.ausente && !f.sinFilas && f.caja)
			.map((f) => ({ campo: f.etiqueta, pagina: f.pagina ?? 1, caja: f.caja as Ubicacion['caja'], valor: f.valor }))
	);
	const visibles = $derived(filas.filter((f) => !f.ausente && !f.sinFilas).map((f) => f.etiqueta));
	const rutaPorEtiqueta = $derived(new Map(filas.map((f) => [f.etiqueta, f.ruta])));
	let resaltado = $state<string | null>(null);
	let editando = $state<string | null>(null);
	$effect(() => {
		void doc.id;
		resaltado = null;
		editando = null;
	});

	function cambiarCaja(cambio: CambioDeCaja) {
		const r = rutaPorEtiqueta.get(cambio.campo);
		if (r) estado.editar(doc.id, r, { caja: cambio.caja, pagina: cambio.pagina });
	}

	function quitarCaja(_documento: number, campo: string) {
		const r = rutaPorEtiqueta.get(campo);
		if (r) estado.editar(doc.id, r, { caja: null });
	}

	function escribir(f: FilaDeRevision, valor: string) {
		estado.editar(doc.id, f.ruta, { valor, ausente: false });
	}

	function alternarAusente(f: FilaDeRevision) {
		if (f.ausente) estado.editar(doc.id, f.ruta, { ausente: false, valor: f.valor || f.leido || '' });
		else estado.editar(doc.id, f.ruta, { ausente: true });
	}

	const TONO_ORIGEN: Record<Origen, string> = {
		confirmado: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300',
		corregido: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
		agregado: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
		ausente: 'border-border bg-muted text-muted-foreground'
	};
</script>

<div class="mt-4" data-testid="etiquetar-ejemplo" data-ejemplo={doc.id}>
	{#if actual.fase === 'sin-leer'}
		<div class="rounded-lg border border-dashed border-border px-6 py-8 text-center" data-testid="ejemplo-sin-leer">
			<p class="text-sm font-medium text-foreground">Este documento todavía no está etiquetado</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
				Biblioratum lo lee con la definición actual del tipo y tú confirmas, corriges o marcas como «no aparece» cada campo. Eso es la respuesta
				buena del documento: con ella se mide la precisión.
			</p>
			<Button class="mt-4" data-testid="leer-ejemplo" onclick={() => estado.leer(doc.id)}>
				<ScanLine class="size-4" />
				Leer con Biblioratum
			</Button>
			<p class="mt-1.5 text-[11px] text-muted-foreground">Una lectura: {lectura.paginas} {lectura.paginas === 1 ? 'página' : 'páginas'}, {lectura.texto}</p>
		</div>
	{:else if actual.fase === 'leyendo'}
		<div class="flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-10 text-sm text-muted-foreground" data-testid="ejemplo-leyendo" aria-live="polite">
			<LoaderCircle class="size-4 animate-spin" />
			Leyendo «{doc.nombre}» con la definición actual del tipo…
		</div>
	{:else if actual.fase === 'error'}
		<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert" data-testid="ejemplo-error">
			<p>{actual.mensaje}</p>
			<Button variant="outline" size="sm" class="mt-2" onclick={() => estado.leer(doc.id)}>Intentar de nuevo</Button>
		</div>
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="flex items-center gap-1.5 text-xs" data-testid="ejemplo-estado">
				{#if pendiente}
					<span class="size-2 rounded-full bg-amber-500" aria-hidden="true"></span>
					<span class="font-medium text-amber-800 dark:text-amber-300">Sin guardar</span>
					{#if guardadas}<span class="text-muted-foreground">· la última etiqueta se guardó el {fechaHoraDe(guardadas.guardadoEn)}</span>{/if}
				{:else if guardadas}
					<Check class="size-3.5 text-green-600" aria-hidden="true" />
					<span class="font-medium text-foreground">Etiquetado</span>
					<span class="text-muted-foreground">· {fechaHoraDe(guardadas.guardadoEn)}</span>
				{/if}
			</p>
			<Button variant="outline" size="sm" data-testid="volver-a-leer" title="Vuelve a leerlo con la definición actual; lo que ya etiquetaste se conserva" onclick={() => estado.leer(doc.id)}>
				<RefreshCw class="size-3.5" />
				Volver a leer
			</Button>
		</div>

		{#if !actual.desdeLectura && guardadas?.camposSinEtiqueta?.length}
			<p class="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="campos-sin-etiqueta">
				<CircleAlert class="mt-px size-3.5 shrink-0" aria-hidden="true" />
				<span>
					Sin etiquetar en este documento: {guardadas.camposSinEtiqueta.join(', ')} (se agregaron al tipo después). Vuelve a leerlo para etiquetarlos.
				</span>
			</p>
		{/if}

		<div class="mt-3 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div class="min-w-0">
				{#if archivo}
					<DocumentoConCampos
						documentos={[archivo]}
						estados={[estadoVista]}
						ubicaciones={[ubicaciones]}
						{visibles}
						resaltado={editando ?? resaltado}
						{editando}
						onResaltar={(campo) => (resaltado = campo)}
						onElegir={(campo) => (editando = editando === campo ? null : campo)}
						onCaja={cambiarCaja}
						onQuitar={quitarCaja}
						explicacion="Un clic en un recuadro, o en el nombre de su campo, lo deja mover o dibujar de nuevo."
					/>
				{:else}
					<p class="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center text-xs text-muted-foreground">
						{errorArchivo || 'Cargando el documento…'}
					</p>
				{/if}
			</div>

			<div class="min-w-0">
				<ul class="divide-y divide-border rounded-lg border border-border" data-testid="filas-etiqueta">
					{#each grupos as g (g.grupo + (g.titulo ?? '') + g.filas[0].ruta)}
						{#if g.titulo}
							<li class="bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">{g.titulo}</li>
						{/if}
						{#each g.filas as f (f.ruta)}
							{@const origen = origenDe(f)}
							<li
								class="px-3 py-2 {(editando ?? resaltado) === f.etiqueta ? 'bg-amber-50/70 dark:bg-amber-950/30' : ''}"
								data-testid="fila-etiqueta"
								data-ruta={f.ruta}
								data-origen={origen}
								onmouseenter={() => (resaltado = f.etiqueta)}
								onmouseleave={() => (resaltado = null)}
							>
								<div class="flex items-center gap-2">
									<button
										type="button"
										class="w-36 shrink-0 truncate text-left text-sm text-foreground hover:text-primary {g.titulo ? 'pl-2' : ''}"
										title={f.caja ? `${f.etiqueta}: ver y ajustar su recuadro` : f.etiqueta}
										onclick={() => (editando = editando === f.etiqueta ? null : f.etiqueta)}
									>
										{g.titulo ? f.etiqueta.slice(g.titulo.length).replace(/^ · /, '').trim() || f.etiqueta : f.etiqueta}
									</button>
									{#if f.sinFilas}
										<span class="min-w-0 flex-1 text-xs text-muted-foreground" data-testid="sin-filas">No se leyó ninguna fila</span>
									{:else}
										<input
											type="text"
											class="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60"
											value={f.ausente ? '' : f.valor}
											placeholder={f.ausente ? 'No aparece' : f.tipoDato === 'fecha' ? 'AAAA-MM-DD' : ''}
											disabled={!f.vigente}
											aria-label="Valor de {f.etiqueta}"
											data-testid="valor-etiqueta"
											oninput={(e) => escribir(f, e.currentTarget.value)}
										/>
										<button
											type="button"
											class="flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors {f.ausente
												? 'border-foreground/30 bg-muted text-foreground'
												: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}"
											aria-pressed={f.ausente}
											aria-label="{f.etiqueta}: no aparece en el documento"
											title="No aparece en el documento"
											data-testid="no-aparece"
											disabled={!f.vigente}
											onclick={() => alternarAusente(f)}
										>
											<EyeOff class="size-3.5" />
										</button>
									{/if}
									<span class="w-22 shrink-0 rounded-full border px-2 py-0.5 text-center text-[11px] font-medium {TONO_ORIGEN[origen]}" data-testid="origen-etiqueta">
										{TEXTO_ORIGEN[origen]}
									</span>
								</div>
								{#if origen === 'corregido' && f.leido}
									<p class="mt-0.5 pl-38 text-[11px] text-muted-foreground" data-testid="leido-antes">
										Biblioratum leyó <span class="font-mono text-foreground">«{f.leido}»</span>
									</p>
								{:else if origen === 'ausente' && f.leido && !f.sinFilas}
									<p class="mt-0.5 pl-38 text-[11px] text-muted-foreground">
										Biblioratum leyó <span class="font-mono text-foreground">«{f.leido}»</span>, pero tú dices que no aparece
									</p>
								{/if}
								{#if !f.vigente}
									<p class="mt-0.5 pl-38 text-[11px] text-amber-700 dark:text-amber-300">Ya no es un campo del tipo: no se guarda.</p>
								{/if}
							</li>
						{/each}
					{/each}
				</ul>

				<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
					<p class="text-xs text-muted-foreground" data-testid="cuentas-etiqueta">
						{textoDeCuentas}
					</p>
					<div class="flex items-center gap-2">
						{#if pendiente}
							<Button variant="ghost" size="sm" data-testid="descartar-etiquetas" onclick={() => estado.descartar(doc.id)}>Descartar</Button>
						{/if}
						<Button size="sm" disabled={!pendiente || estado.guardando[doc.id]} data-testid="guardar-etiquetas" onclick={() => estado.guardar(doc.id)}>
							{#if estado.guardando[doc.id]}<LoaderCircle class="size-4 animate-spin" />{/if}
							Guardar etiquetas
						</Button>
					</div>
				</div>
				{#if estado.errorGuardar[doc.id]}
					<p class="mt-2 text-xs text-destructive" role="alert" data-testid="error-guardar-etiquetas">{estado.errorGuardar[doc.id]}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
