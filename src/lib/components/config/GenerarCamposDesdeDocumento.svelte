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
	 * **El documento a un lado, con los campos marcados (2026-11-11, Moibe: «que a un lado mostremos el documento y marcados etiquetados los campos
	 * seleccionados»).** Al llegar la propuesta, el modal se ensancha: a la izquierda el documento (`DocumentoConCampos`, con pestañas si son varios) y
	 * a la derecha la lista. Por cada documento se pregunta, en paralelo, dónde está cada campo propuesto (`/api/procesadores/ubicar-campos`, Gemini);
	 * los campos ELEGIDOS se marcan con un recuadro y su nombre, y pasar el puntero por un renglón resalta su recuadro. Si ubicar falla, la propuesta
	 * sirve igual y el documento se enseña sin marcas. Se pregunta una vez por documento con TODOS los propuestos: marcar y desmarcar no vuelve a llamar.
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
	import { unirPropuestas, type CampoUnido } from '$lib/documentos/unirPropuestas';
	import { imagenDerecha, leerUbicaciones, sePuedeMarcar } from '$lib/documentos/ubicaciones';
	import DocumentoConCampos, { type EstadoUbicacion } from './DocumentoConCampos.svelte';
	import { TIPOS_DE_DATO, type CampoPropuesto } from '$lib/state/configuracion.svelte';

	const MAX_MB = 20;
	/** Cuántos documentos de ejemplo se leen a la vez: con 3 ya se ve qué se repite, y cada lectura tarda hasta un minuto y cuenta como una llamada a Google. */
	const MAX_DOCUMENTOS = 3;
	const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];

	let {
		abierto = false,
		nombreTipo = '',
		descripcionTipo = '',
		existentes = [],
		ejemplosPrevios = [],
		onCerrar,
		onAgregar
	}: {
		abierto?: boolean;
		/** Lo capturado en el paso 1: viaja como contexto para el modelo. */
		nombreTipo?: string;
		descripcionTipo?: string;
		/** Los nombres de los campos que el tipo YA tiene: una propuesta con el mismo nombre no se puede elegir. */
		existentes?: string[];
		/** Los documentos que ya se dieron en el paso 1 (para «Sugerir descripción» con documentos): se ofrecen para no pedirlos otra vez. */
		ejemplosPrevios?: File[];
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
	/** Los documentos que se enseñan a un lado de la propuesta (los leídos) y, de cada uno, cómo va la ubicación de los campos. */
	let documentosVista = $state<File[]>([]);
	let estadosUbicacion = $state<EstadoUbicacion[]>([]);
	/** El campo que se resalta en el documento (el renglón o el recuadro bajo el puntero). */
	let resaltado = $state<string | null>(null);
	const visibles = $derived(propuestos.filter((_, i) => elegidos[i] && disponibles[i]).map((c) => c.nombre));
	let arrastrando = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	// Cada generación se numera: si se cierra el modal o se elige otro documento mientras Google lee, la respuesta vieja ya es de
	// nadie y no debe pintarse encima de lo nuevo.
	let vigente = 0;

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
		documentosVista = [];
		estadosUbicacion = [];
		resaltado = null;
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
		// Todos marcados de entrada (2026-11-10, Moibe: «que todos aparezcan seleccionados por default»), menos los que ya existen.
		elegidos = propuestos.map((c) => !yaExiste(c.nombre));
		fase = 'propuesta';
		// El documento a un lado, y en cada uno se buscan los campos (en paralelo; no se espera: la lista ya sirve).
		// Las fotos van ENDEREZADAS (`imagenDerecha`): lo que ve Gemini y lo que se pinta debajo de las marcas son los mismos píxeles.
		estadosUbicacion = leidos.map((a) => (sePuedeMarcar(a) ? { fase: 'cargando' } : { fase: 'no-soportado' }));
		const derechas = await Promise.all(leidos.map((a) => imagenDerecha(a)));
		if (turno !== vigente) return;
		documentosVista = derechas;
		const pedidos = JSON.stringify(propuestos.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion })));
		derechas.forEach((a, i) => {
			if (sePuedeMarcar(a)) void ubicar(a, i, pedidos, turno);
		});
	}

	/** Pregunta dónde está cada campo propuesto en UN documento. Nunca lanza: un fallo deja el documento sin marcas y lo dice. */
	async function ubicar(archivo: File, i: number, campos: string, turno: number) {
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		cuerpo.append('campos', campos);
		let estado: EstadoUbicacion;
		try {
			const r = await fetch('/api/procesadores/ubicar-campos', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			// El detalle técnico no le sirve a nadie aquí: la propuesta ya está y lo único que falló es la guía visual.
			estado = r.ok
				? { fase: 'listo', ubicaciones: leerUbicaciones(datos) }
				: { fase: 'error', mensaje: r.status === 429 ? 'Hay muchas solicitudes a la vez y no se marcaron los campos.' : 'No se pudieron marcar los campos sobre este documento.' };
		} catch {
			estado = { fase: 'error', mensaje: 'No se pudo contactar al servidor para marcar los campos.' };
		}
		if (turno === vigente) estadosUbicacion[i] = estado;
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
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[90vh] w-[92vw] {fase === 'propuesta' && documentosVista.length > 0 ? 'max-w-6xl' : 'max-w-2xl'} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
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
					<!-- Los documentos del paso 1 (2026-11-07): ya se leyeron para sugerir la descripción; aquí se pueden reutilizar en vez de pedirlos otra vez. -->
					{#if ejemplosPrevios.length > 0}
						<div class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3" data-testid="generar-campos-previos">
							<p class="min-w-0 flex-1 text-sm text-foreground">
								Ya elegiste {ejemplosPrevios.length === 1 ? 'un documento' : `${ejemplosPrevios.length} documentos`} en el paso 1:
								<span class="text-muted-foreground">{lista(ejemplosPrevios.map((a) => `«${a.name}»`))}</span>.
							</p>
							<Button size="sm" data-testid="generar-campos-usar-previos" onclick={() => void generar([...ejemplosPrevios])}>
								Usar {ejemplosPrevios.length === 1 ? 'este documento' : 'estos documentos'}
							</Button>
						</div>
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
					<div class={documentosVista.length > 0 ? 'grid items-start gap-6 lg:grid-cols-2' : 'contents'}>
						{#if documentosVista.length > 0}
							<div class="lg:sticky lg:top-0">
								<DocumentoConCampos
									documentos={documentosVista}
									estados={estadosUbicacion}
									{visibles}
									{resaltado}
									onResaltar={(campo) => (resaltado = campo)}
								/>
							</div>
						{/if}
						<div class="flex min-w-0 flex-col gap-5">
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

							<!-- Cada renglón: solo el campo y su tipo (2026-11-10, Moibe: «hay demasiado texto… evita la descripción y en cuántos documentos apareció»). La descripción se sigue agregando al campo. -->
							<ul class="flex flex-col divide-y divide-border rounded-lg border border-border" data-testid="generar-campos-lista">
								{#each propuestos as campo, i (i)}
									<li
										class={[
											'flex items-start gap-3 px-4 py-3 transition-colors',
											!disponibles[i] && 'opacity-60',
											resaltado === campo.nombre && elegidos[i] && 'bg-amber-50 dark:bg-amber-950/40'
										]}
										data-testid="campo-propuesto"
										onpointerenter={() => (resaltado = campo.nombre)}
										onpointerleave={() => (resaltado = null)}
									>
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
												{#if !disponibles[i]}
													<span class="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800" data-testid="campo-propuesto-existe">
														Ya existe un campo con este nombre
													</span>
												{/if}
											</span>
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
						</div>
					</div>
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
