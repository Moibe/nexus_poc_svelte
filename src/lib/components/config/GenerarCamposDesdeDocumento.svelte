<script lang="ts">
	/**
	 * «Generar a partir de un documento» — paso 2 del alta de un tipo documental (pedido el 2026-10-29, como el botón del mismo
	 * nombre de la consola de Document AI). La persona sube un documento de ejemplo, Document AI lo lee y PROPONE campos
	 * (`/api/procesadores/generar-campos`), y aquí se revisan: cada propuesta trae casilla y solo se agregan las elegidas. Lo
	 * agregado cae en «Campos agregados» y se edita como cualquier otro campo.
	 *
	 * Es un `Dialog` normal (como `GenerarPrompts.svelte`) y no `ConfirmarAccion`: no se destruye nada, así que Escape y el clic
	 * fuera cierran. Si se cierra mientras Google está leyendo, la respuesta que llegue después se descarta.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import AlertCircle from '@lucide/svelte/icons/circle-alert';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';
	import { TIPOS_DE_DATO, type CampoPropuesto } from '$lib/state/configuracion.svelte';

	const MAX_MB = 20;
	const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];

	let {
		abierto = false,
		nombreTipo = '',
		descripcionTipo = '',
		existentes = [],
		onCerrar,
		onAgregar
	}: {
		abierto?: boolean;
		/** Lo capturado en el paso 1: viaja como contexto para el modelo. */
		nombreTipo?: string;
		descripcionTipo?: string;
		/** Los nombres de los campos que el tipo YA tiene: una propuesta con el mismo nombre no se puede elegir. */
		existentes?: string[];
		onCerrar: () => void;
		onAgregar: (elegidos: CampoPropuesto[]) => void;
	} = $props();

	let fase = $state<'elegir' | 'generando' | 'propuesta' | 'error'>('elegir');
	let nombreArchivo = $state('');
	let error = $state('');
	let propuestos = $state<CampoPropuesto[]>([]);
	let elegidos = $state<boolean[]>([]);
	let arrastrando = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	// Cada generación se numera: si se cierra el modal o se elige otro documento mientras Google lee, la respuesta vieja ya es de
	// nadie y no debe pintarse encima de lo nuevo.
	let vigente = 0;

	const etiquetaTipo = (valor: string) => TIPOS_DE_DATO.find((t) => t.value === valor)?.label ?? 'Texto';
	const yaExiste = (nombre: string) => existentes.some((e) => e.trim().toLowerCase() === nombre.trim().toLowerCase());
	const disponibles = $derived(propuestos.map((p) => !yaExiste(p.nombre)));
	const cuantosElegidos = $derived(elegidos.filter((e, i) => e && disponibles[i]).length);
	const todosElegidos = $derived(disponibles.some(Boolean) && disponibles.every((d, i) => !d || elegidos[i]));

	// Al abrir, siempre desde el principio: la propuesta de una vez anterior no es la de este momento.
	$effect(() => {
		if (abierto) reiniciar();
	});

	function reiniciar() {
		vigente += 1;
		fase = 'elegir';
		nombreArchivo = '';
		error = '';
		propuestos = [];
		elegidos = [];
	}

	function cerrar() {
		vigente += 1;
		onCerrar();
	}

	function manejarDrop(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		const soltado = evento.dataTransfer?.files?.[0];
		if (soltado) void generar(soltado);
	}

	function alElegir(evento: Event) {
		const input = evento.currentTarget as HTMLInputElement;
		const elegido = input.files?.[0];
		input.value = ''; // para que volver a elegir el MISMO archivo dispare el cambio
		if (elegido) void generar(elegido);
	}

	async function generar(archivo: File) {
		const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
		nombreArchivo = archivo.name;
		if (!EXTENSIONES.includes(extension)) {
			fase = 'error';
			error = 'Ese formato no se puede leer. Usa un PDF o una imagen (JPG, PNG o TIFF).';
			return;
		}
		if (archivo.size > MAX_MB * 1024 * 1024) {
			fase = 'error';
			error = `El archivo excede el límite de ${MAX_MB} MB.`;
			return;
		}
		const turno = ++vigente;
		fase = 'generando';
		error = '';
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		if (nombreTipo.trim()) cuerpo.append('nombre', nombreTipo.trim());
		if (descripcionTipo.trim()) cuerpo.append('descripcion', descripcionTipo.trim());
		try {
			const r = await fetch('/api/procesadores/generar-campos', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			if (turno !== vigente) return;
			if (!r.ok) {
				fase = 'error';
				error = mensajeDeFallo(datos, r.status, 'al proponer los campos');
				return;
			}
			const campos: CampoPropuesto[] = Array.isArray(datos?.campos) ? datos.campos : [];
			if (campos.length === 0) {
				fase = 'error';
				error = 'Document AI no encontró campos que proponer en este documento. Prueba con otro ejemplo.';
				return;
			}
			propuestos = campos;
			elegidos = campos.map((c) => !yaExiste(c.nombre));
			fase = 'propuesta';
		} catch {
			if (turno !== vigente) return;
			fase = 'error';
			error = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		}
	}

	function alternarTodos(marcar: boolean) {
		elegidos = propuestos.map((_, i) => marcar && disponibles[i]);
	}

	function agregar() {
		const seleccion = propuestos.filter((_, i) => elegidos[i] && disponibles[i]);
		if (seleccion.length === 0) return;
		vigente += 1;
		onAgregar(seleccion);
	}
</script>

<DialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) cerrar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-generar-campos"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[90vh] w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<span class="min-w-0 flex-1 text-sm text-muted-foreground">Campos de extracción</span>
				<DialogPrimitive.Close aria-label="Cerrar" onclick={cerrar}>
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
				<div class="flex items-start gap-4">
					<span class="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5 text-primary">
						<Sparkles class="size-6" />
					</span>
					<div class="min-w-0 flex-1">
						<DialogPrimitive.Title class="text-xl font-bold text-foreground">
							Generar a partir de un documento
						</DialogPrimitive.Title>
						<DialogPrimitive.Description class="mt-1 text-sm text-muted-foreground">
							Sube un documento de ejemplo y Document AI propondrá los campos a extraer. Tú eliges cuáles agregar;
							los que después no te sirvan, los puedes quitar.
						</DialogPrimitive.Description>
					</div>
				</div>

				{#if fase === 'elegir'}
					<button
						type="button"
						data-testid="generar-campos-zona"
						class={[
							'flex h-56 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors',
							arrastrando ? 'border-primary bg-muted' : 'border-border bg-background'
						]}
						onclick={() => fileInput?.click()}
						ondragover={(e) => {
							e.preventDefault();
							arrastrando = true;
						}}
						ondragleave={() => (arrastrando = false)}
						ondrop={manejarDrop}
					>
						<span class="flex size-8 items-center justify-center rounded-lg border border-border bg-card">
							<FolderLibraryIcon />
						</span>
						<div class="flex flex-col items-center gap-0.5 text-center">
							<p class="text-sm font-medium text-foreground">
								Arrastra y suelta tu documento de ejemplo aquí o selecciona un archivo
							</p>
							<p class="text-xs text-muted-foreground">PDF, JPG, JPEG, PNG, TIFF | Max {MAX_MB} MB</p>
						</div>
						<span class="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-secondary-foreground">
							Buscar archivo
						</span>
					</button>
					<input
						bind:this={fileInput}
						data-testid="generar-campos-archivo"
						type="file"
						class="hidden"
						accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
						onchange={alElegir}
					/>
				{:else if fase === 'generando'}
					<div
						class="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-center"
						data-testid="generar-campos-leyendo"
						aria-live="polite"
					>
						<LoaderCircle class="size-7 animate-spin text-primary" />
						<p class="text-sm font-medium text-foreground">Leyendo «{nombreArchivo}» y proponiendo campos…</p>
						<!-- Medido el 2026-10-29 con una factura de una página: de 12 a 50 s según la corrida. -->
						<p class="text-xs text-muted-foreground">Puede tardar hasta un minuto.</p>
					</div>
				{:else if fase === 'error'}
					<div
						class="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
						data-testid="generar-campos-error"
						role="alert"
					>
						<AlertCircle class="mt-0.5 size-4 shrink-0 text-destructive" />
						<div class="min-w-0 text-sm">
							<p class="font-medium text-destructive">No se pudieron proponer campos{nombreArchivo ? ` para «${nombreArchivo}»` : ''}.</p>
							<p class="mt-1 text-muted-foreground">{error}</p>
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm text-muted-foreground" data-testid="generar-campos-resumen">
							{propuestos.length === 1 ? 'Se propuso 1 campo' : `Se propusieron ${propuestos.length} campos`} a partir de
							«{nombreArchivo}».
						</p>
						<label class="flex shrink-0 items-center gap-2 text-sm text-foreground">
							<Checkbox
								data-testid="generar-campos-todos"
								checked={todosElegidos}
								disabled={!disponibles.some(Boolean)}
								onCheckedChange={(v) => alternarTodos(v === true)}
							/>
							Seleccionar todos
						</label>
					</div>

					<ul class="flex flex-col divide-y divide-border rounded-lg border border-border" data-testid="generar-campos-lista">
						{#each propuestos as campo, i (i)}
							<li class={['flex items-start gap-3 px-4 py-3', !disponibles[i] && 'opacity-60']} data-testid="campo-propuesto">
								<Checkbox
									id="propuesto-{i}"
									class="mt-0.5"
									checked={elegidos[i] && disponibles[i]}
									disabled={!disponibles[i]}
									onCheckedChange={(v) => (elegidos[i] = v === true)}
									aria-label="Agregar {campo.nombre}"
								/>
								<label for="propuesto-{i}" class="min-w-0 flex-1 cursor-pointer">
									<span class="flex flex-wrap items-center gap-2">
										<span class="text-sm font-medium text-foreground" data-testid="campo-propuesto-nombre">{campo.nombre}</span>
										<span class="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{etiquetaTipo(campo.tipoDato)}</span>
										{#if campo.cardinalidad === 'multiple'}
											<span class="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Se repite</span>
										{/if}
										{#if !disponibles[i]}
											<span class="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800" data-testid="campo-propuesto-existe">
												Ya existe un campo con este nombre
											</span>
										{/if}
									</span>
									{#if campo.descripcion}
										<span class="mt-0.5 block text-xs text-muted-foreground">{campo.descripcion}</span>
									{/if}
									{#if campo.tipoDato === 'grupo' && campo.subcampos.length}
										<span class="mt-1 block text-xs text-muted-foreground">
											Campos del grupo: {campo.subcampos.map((s) => `${s.nombre} (${etiquetaTipo(s.tipoDato)})`).join(' · ')}
										</span>
									{/if}
									{#if campo.tipoDato === 'lista' && campo.valoresLista.length}
										<span class="mt-1 block text-xs text-muted-foreground">Valores: {campo.valoresLista.join(' · ')}</span>
									{/if}
								</label>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
				{#if fase === 'propuesta' || fase === 'error'}
					<Button variant="link" class="h-auto p-0" data-testid="generar-campos-otro" onclick={reiniciar}>
						Usar otro documento
					</Button>
				{:else}
					<span></span>
				{/if}
				<div class="flex items-center gap-4">
					<Button variant="link" class="h-auto p-0 text-destructive" onclick={cerrar}>Cancelar</Button>
					{#if fase === 'propuesta'}
						<Button size="lg" data-testid="generar-campos-agregar" disabled={cuantosElegidos === 0} onclick={agregar}>
							{cuantosElegidos === 1 ? 'Agregar 1 campo' : `Agregar ${cuantosElegidos} campos`}
						</Button>
					{/if}
				</div>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
