<script lang="ts">
	/**
	 * «Generar a partir de un documento» — paso 2 del alta de un tipo documental (pedido el 2026-10-29, como el botón del mismo
	 * nombre de la consola de Document AI). La persona sube un documento de ejemplo, Document AI lo lee y PROPONE campos
	 * (`/api/procesadores/generar-campos`), y aquí se revisan: cada propuesta trae casilla y solo se agregan las elegidas. Lo
	 * agregado cae en «Campos agregados» y se edita como cualquier otro campo.
	 *
	 * **Hasta 3 documentos de ejemplo (2026-11-07, Moibe: «sí, me gusta esa propuesta, hazla así»).** Con uno solo la propuesta de Google cambia de corrida a
	 * corrida y juzga todo desde ese ejemplo; con dos o tres se lee cada uno por separado (en paralelo) y se UNEN las propuestas (`unirPropuestas`): cada campo
	 * dice en cuántos documentos salió; los que salieron en más de la mitad vienen marcados y los que salieron en pocos, sin marcar, y todo el que no salió en
	 * todos se agrega como OPCIONAL (un documento válido que no lo trae no debe fallar). Si un documento no se puede leer, los demás siguen y se dice cuál falló.
	 * Los documentos leídos se entregan a quien abrió el modal (`onAgregar`) para que pueda PROBAR la extracción con ellos al activar el tipo; aquí no se guardan.
	 *
	 * Es un `Dialog` normal (como lo era `GenerarPrompts.svelte`, quitado el 2026-11-06 con «Calibrar») y no `ConfirmarAccion`: no se destruye nada, así que Escape y el clic
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
	import { sugeridoPorOmision, textoDeApariciones, unirPropuestas, type CampoUnido } from '$lib/documentos/unirPropuestas';
	import { TIPOS_DE_DATO, type CampoPropuesto } from '$lib/state/configuracion.svelte';

	const MAX_MB = 20;
	/** Cuántos documentos de ejemplo se leen a la vez: con 3 ya se ve qué se repite, y cada lectura tarda hasta un minuto y cuenta como una llamada a Google. */
	const MAX_DOCUMENTOS = 3;
	const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];

	let {
		abierto = false,
		nombreTipo = '',
		descripcionTipo = '',
		instruccionesTipo = '',
		existentes = [],
		onCerrar,
		onAgregar
	}: {
		abierto?: boolean;
		/** Lo capturado en el paso 1: viaja como contexto para el modelo. */
		nombreTipo?: string;
		descripcionTipo?: string;
		/**
		 * Las «instrucciones para la extracción» del tipo (paso 2), tal como estén al elegir el documento. Además de contexto, ORIENTAN la
		 * propuesta: medido contra Google el 2026-11-05, con «la persona que interesa es el titular, no el beneficiario» el generador deja
		 * fuera el campo del beneficiario. Por eso se avisa cuando se usan, y de nuevo en la propuesta (si falta un campo, ahí está el porqué).
		 */
		instruccionesTipo?: string;
		/** Los nombres de los campos que el tipo YA tiene: una propuesta con el mismo nombre no se puede elegir. */
		existentes?: string[];
		onCerrar: () => void;
		/** Los campos elegidos y los documentos de ejemplo que se LEYERON (los que sí dieron propuesta), para probar la extracción con ellos después. */
		onAgregar: (elegidos: CampoPropuesto[], ejemplos: File[]) => void;
	} = $props();

	let fase = $state<'elegir' | 'generando' | 'propuesta' | 'error'>('elegir');
	/** Los nombres de los documentos que se están leyendo o se leyeron, para decirlo en pantalla. */
	let nombresArchivos = $state<string[]>([]);
	/** Cuántos de los que se están leyendo ya terminaron (bien o mal). */
	let terminados = $state(0);
	/** Los documentos que NO se pudieron leer (formato, tamaño o un fallo de Google), cada uno con su motivo. */
	let fallos = $state<{ nombre: string; mensaje: string }[]>([]);
	/** Cuántos archivos se soltaron de más (solo se leen los primeros `MAX_DOCUMENTOS`). */
	let sobrantes = $state(0);
	/** Los documentos que sí dieron propuesta: no se pintan, se le entregan a quien abrió el modal al agregar. */
	let leidos: File[] = [];
	let error = $state('');
	let propuestos = $state<CampoUnido[]>([]);
	let elegidos = $state<boolean[]>([]);
	let arrastrando = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	// Cada generación se numera: si se cierra el modal o se elige otro documento mientras Google lee, la respuesta vieja ya es de
	// nadie y no debe pintarse encima de lo nuevo.
	let vigente = 0;
	// ¿La propuesta que se está mostrando se pidió CON instrucciones? Se fija al pedirla: si después se editan las instrucciones, esa
	// propuesta sigue siendo la de las que había entonces.
	let propuestaConInstrucciones = $state(false);
	const hayInstrucciones = $derived(instruccionesTipo.trim() !== '');

	/** «a», «a y b», «a, b y c». */
	const lista = (nombres: string[]) => (nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);
	const nombresEntreComillas = $derived(lista(nombresArchivos.map((n) => `«${n}»`)));

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
		nombresArchivos = [];
		terminados = 0;
		fallos = [];
		sobrantes = 0;
		leidos = [];
		error = '';
		propuestos = [];
		elegidos = [];
		propuestaConInstrucciones = false;
	}

	function cerrar() {
		vigente += 1;
		onCerrar();
	}

	function manejarDrop(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		const soltados = [...(evento.dataTransfer?.files ?? [])];
		if (soltados.length > 0) void generar(soltados);
	}

	function alElegir(evento: Event) {
		const input = evento.currentTarget as HTMLInputElement;
		const elegidosDelInput = [...(input.files ?? [])];
		input.value = ''; // para que volver a elegir el MISMO archivo dispare el cambio
		if (elegidosDelInput.length > 0) void generar(elegidosDelInput);
	}

	/** Por qué un archivo no se puede leer ANTES de mandarlo, o `null` si está bien. */
	function motivoDeRechazo(archivo: File): string | null {
		const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
		if (!EXTENSIONES.includes(extension)) return 'Ese formato no se puede leer. Usa un PDF o una imagen (JPG, PNG o TIFF).';
		if (archivo.size > MAX_MB * 1024 * 1024) return `El archivo excede el límite de ${MAX_MB} MB.`;
		return null;
	}

	/** Lee UN documento: sus campos propuestos, o por qué no se pudo. Nunca lanza. */
	async function leer(archivo: File, turno: number): Promise<{ ok: true; campos: CampoPropuesto[] } | { ok: false; mensaje: string }> {
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		if (nombreTipo.trim()) cuerpo.append('nombre', nombreTipo.trim());
		if (descripcionTipo.trim()) cuerpo.append('descripcion', descripcionTipo.trim());
		if (instruccionesTipo.trim() !== '') cuerpo.append('instrucciones', instruccionesTipo.trim());
		try {
			const r = await fetch('/api/procesadores/generar-campos', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			if (!r.ok) return { ok: false, mensaje: mensajeDeFallo(datos, r.status, 'al proponer los campos') };
			const campos: CampoPropuesto[] = Array.isArray(datos?.campos) ? datos.campos : [];
			if (campos.length === 0) return { ok: false, mensaje: 'Biblioratum no encontró campos que proponer en este documento. Prueba con otro ejemplo.' };
			return { ok: true, campos };
		} catch {
			return { ok: false, mensaje: 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.' };
		} finally {
			if (turno === vigente) terminados += 1;
		}
	}

	async function generar(archivos: File[]) {
		const aLeer = archivos.slice(0, MAX_DOCUMENTOS);
		const turno = ++vigente;
		nombresArchivos = aLeer.map((a) => a.name);
		sobrantes = archivos.length - aLeer.length;
		terminados = 0;
		fallos = [];
		leidos = [];
		error = '';
		const rechazos = aLeer.map((a) => motivoDeRechazo(a));
		const validos = aLeer.filter((_, i) => rechazos[i] === null);
		if (validos.length === 0) {
			// Nada que mandar: se dice por qué (con uno solo, con las mismas palabras de siempre).
			fase = 'error';
			fallos = aLeer.map((a, i) => ({ nombre: a.name, mensaje: rechazos[i] ?? '' }));
			error = aLeer.length === 1 ? (rechazos[0] ?? '') : 'Ninguno de esos archivos se puede leer.';
			return;
		}
		fase = 'generando';
		// Se leen EN PARALELO: cada uno tarda hasta un minuto y esperar uno tras otro sumaría hasta tres.
		const resultados = await Promise.all(validos.map((a) => leer(a, turno)));
		if (turno !== vigente) return;
		const propuestasPorDocumento: CampoPropuesto[][] = [];
		const fallidos: { nombre: string; mensaje: string }[] = aLeer.flatMap((a, i) => (rechazos[i] !== null ? [{ nombre: a.name, mensaje: rechazos[i] as string }] : []));
		resultados.forEach((resultado, i) => {
			if (resultado.ok) {
				propuestasPorDocumento.push(resultado.campos);
				leidos.push(validos[i]);
			} else {
				fallidos.push({ nombre: validos[i].name, mensaje: resultado.mensaje });
			}
		});
		fallos = fallidos;
		if (propuestasPorDocumento.length === 0) {
			fase = 'error';
			error = fallidos.length === 1 ? fallidos[0].mensaje : 'No se pudo leer ninguno de los documentos.';
			return;
		}
		// Los nombres que se muestran son los de los que SÍ dieron propuesta (los que fallaron se dicen aparte).
		nombresArchivos = leidos.map((a) => a.name);
		propuestos = unirPropuestas(propuestasPorDocumento);
		elegidos = propuestos.map((c) => !yaExiste(c.nombre) && sugeridoPorOmision(c));
		propuestaConInstrucciones = instruccionesTipo.trim() !== '';
		fase = 'propuesta';
	}

	function alternarTodos(marcar: boolean) {
		elegidos = propuestos.map((_, i) => marcar && disponibles[i]);
	}

	function agregar() {
		const seleccion = propuestos.filter((_, i) => elegidos[i] && disponibles[i]);
		if (seleccion.length === 0) return;
		vigente += 1;
		onAgregar(seleccion, [...leidos]);
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
							Sube hasta {MAX_DOCUMENTOS} documentos de ejemplo y Biblioratum propondrá los campos a extraer. Con dos o tres se ve qué
							campos se repiten en todos y cuáles no. Tú eliges cuáles agregar; los que después no te sirvan, los puedes quitar.
						</DialogPrimitive.Description>
					</div>
				</div>

				{#if fase === 'elegir'}
					<!-- Solo cuando se van a usar: sin instrucciones no se dice nada (no es un regaño por no escribirlas). -->
					{#if hayInstrucciones}
						<p class="-mt-2 text-xs text-muted-foreground" data-testid="generar-campos-usa-instrucciones">
							Se tendrán en cuenta tus instrucciones para la extracción: orientan qué campos se proponen.
						</p>
					{/if}
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
								Arrastra y suelta tus documentos de ejemplo aquí o selecciona hasta {MAX_DOCUMENTOS} archivos
							</p>
							<p class="text-xs text-muted-foreground">PDF, JPG, JPEG, PNG, TIFF | Max {MAX_MB} MB cada uno</p>
						</div>
						<span class="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-secondary-foreground">
							Buscar archivo
						</span>
					</button>
					<input
						bind:this={fileInput}
						data-testid="generar-campos-archivo"
						type="file"
						multiple
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
						<p class="text-sm font-medium text-foreground">
							{nombresArchivos.length === 1 ? `Leyendo «${nombresArchivos[0]}» y proponiendo campos…` : `Leyendo ${nombresArchivos.length} documentos y proponiendo campos…`}
						</p>
						<!-- Medido el 2026-10-29 con una factura de una página: de 12 a 50 s según la corrida. Con varios se leen a la vez, así que no suma. -->
						<p class="text-xs text-muted-foreground" data-testid="generar-campos-progreso">
							{nombresArchivos.length > 1 ? `${terminados} de ${nombresArchivos.length} listos. ` : ''}Puede tardar hasta un minuto.
						</p>
					</div>
				{:else if fase === 'error'}
					<div
						class="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
						data-testid="generar-campos-error"
						role="alert"
					>
						<AlertCircle class="mt-0.5 size-4 shrink-0 text-destructive" />
						<div class="min-w-0 text-sm">
							<p class="font-medium text-destructive">No se pudieron proponer campos{nombresArchivos.length === 1 ? ` para «${nombresArchivos[0]}»` : ''}.</p>
							<p class="mt-1 text-muted-foreground">{error}</p>
							{#if fallos.length > 1}
								<ul class="mt-2 list-disc pl-5 text-xs text-muted-foreground" data-testid="generar-campos-fallos">
									{#each fallos as f (f.nombre)}
										<li><span class="font-medium">{f.nombre}</span>: {f.mensaje}</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm text-muted-foreground" data-testid="generar-campos-resumen">
							{propuestos.length === 1 ? 'Se propuso 1 campo' : `Se propusieron ${propuestos.length} campos`} a partir de
							{nombresEntreComillas}.
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
					<!-- Si la propuesta se pidió con instrucciones, se dice: un campo que ellas mandan ignorar (p. ej. el beneficiario) no sale, y
					     sin esta línea parecería que Document AI no lo encontró. -->
					{#if propuestaConInstrucciones}
						<p class="-mt-3 text-xs text-muted-foreground" data-testid="generar-campos-con-instrucciones">
							Propuesta con tus instrucciones para la extracción: si falta un campo que esperabas, revísalas.
						</p>
					{/if}
					<!-- Lo que no se pudo leer, o lo que sobró, se dice: sin esto la propuesta parecería hecha con todos los documentos. -->
					{#if fallos.length > 0}
						<div class="-mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="generar-campos-fallos" role="status">
							<p class="font-medium">{fallos.length === 1 ? 'Un documento no se pudo leer y no cuenta en la propuesta:' : `${fallos.length} documentos no se pudieron leer y no cuentan en la propuesta:`}</p>
							<ul class="mt-1 list-disc pl-5">
								{#each fallos as f (f.nombre)}
									<li><span class="font-medium">{f.nombre}</span>: {f.mensaje}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if sobrantes > 0}
						<p class="-mt-2 text-xs text-muted-foreground" data-testid="generar-campos-sobrantes">
							Solo se leyeron los primeros {MAX_DOCUMENTOS} archivos; {sobrantes === 1 ? 'el otro se dejó fuera' : `los otros ${sobrantes} se dejaron fuera`}.
						</p>
					{/if}

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
											<span class="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary dark:text-blue-300">Se repite</span>
										{/if}
										<!-- Con varios documentos: en cuántos salió. Un campo que no salió en todos se agrega como opcional. -->
										{#if campo.total > 1}
											<span
												class={[
													'rounded-md px-1.5 py-0.5 text-xs',
													campo.apariciones === campo.total ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-muted text-muted-foreground'
												]}
												data-testid="campo-propuesto-apariciones"
												data-apariciones={campo.apariciones}
											>
												{textoDeApariciones(campo)}
											</span>
											{#if campo.opcionalSugerido}
												<span class="text-xs text-muted-foreground" data-testid="campo-propuesto-opcional">· se agrega como opcional</span>
											{/if}
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
						{nombresArchivos.length > 1 ? 'Usar otros documentos' : 'Usar otro documento'}
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
