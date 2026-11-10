<script lang="ts">
	/**
	 * «Probar con documentos» — ver qué extrae un tipo documental ACTIVO con documentos de ejemplo, antes de confiar en él (2026-11-07, Moibe: «sí, me gusta esa
	 * propuesta, hazla así»). Document AI le pone confianza a todo, también a lo que se equivoca (en las actas, con errores en 1.00 y aciertos en 0.41), así que
	 * el porcentaje solo no dice si el tipo sirve: lo que sirve es VER, documento por documento, qué valor salió en cada campo y qué campo no apareció.
	 *
	 * Se abre de dos maneras: (1) justo después de activar un tipo cuyos campos se generaron con documentos de ejemplo (`ejemplosDeTipo`): vienen elegidos ya
	 * y solo falta el «Probar»; (2) desde el menú ⋮ de cualquier tipo activo, donde se eligen hasta 3 archivos. Nunca corre sola: cada documento es una
	 * extracción más, así que pide la confirmación de un botón.
	 *
	 * NO guarda nada: llama a `/api/pipeline/extraer` SIN `documento`, que es la extracción en seco (no crea documento, ni corrida, ni aparece en ninguna bandeja
	 * ni expediente). Los archivos se leen en la memoria de la pestaña y se descartan al cerrar. Si algo sale mal, la salida es «Crear nueva versión» del menú ⋮.
	 */
	import { untrack } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import AlertCircle from '@lucide/svelte/icons/circle-alert';
	import X from '@lucide/svelte/icons/x';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';
	import { calidadDe, camposDe, textoDeAusentes, type ResultadoIne } from '$lib/types/ine';

	const MAX_MB = 20;
	const MAX_DOCUMENTOS = 3;
	const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];

	let {
		abierto = false,
		tipo = null,
		archivosIniciales = [],
		onCerrar
	}: {
		abierto?: boolean;
		/** El tipo que se prueba: su procesador y versión son los que extraen. */
		tipo?: { nombre: string; procesadorId: string; procesadorVersion: string } | null;
		/** Los documentos de ejemplo con que se generaron sus campos, si todavía están en memoria. */
		archivosIniciales?: File[];
		onCerrar: () => void;
	} = $props();

	type Resultado = {
		nombre: string;
		error: string | null;
		/** Cada campo que salió, con su ruta (`socios[2].nombre`), valor y confianza (0-100). */
		campos: { ruta: string; valor: string; confianza: number | null }[];
		/** Rutas de campos obligatorios que no aparecieron (`_metadata.campos_ausentes`). */
		ausentes: string[];
		/** Google contestó pero no reconoció ningún campo. */
		sinReconocer: boolean;
		confianzaPromedio: number | null;
	};

	let fase = $state<'elegir' | 'probando' | 'resultado'>('elegir');
	let archivos = $state<File[]>([]);
	let avisoDeArchivos = $state('');
	let resultados = $state<Resultado[]>([]);
	let terminados = $state(0);
	let arrastrando = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	// Cada prueba se numera: si se cierra el modal mientras Google lee, lo que llegue después ya es de nadie.
	let vigente = 0;

	// Al abrir, siempre desde el principio, con los archivos de ejemplo que haya (una copia: quitar uno aquí no toca lo recordado).
	// Depende SOLO de `abierto` (el resto se lee dentro de `untrack`): que el padre vuelva a evaluar `archivosIniciales` con la ventana abierta no debe vaciar lo que
	// la persona ya eligió ni borrar un resultado (el mismo tropiezo de los formularios que se vaciaban solos, 2026-11-05).
	$effect(() => {
		if (abierto) {
			untrack(() => {
				vigente += 1;
				fase = 'elegir';
				archivos = [...archivosIniciales].slice(0, MAX_DOCUMENTOS);
				avisoDeArchivos = '';
				resultados = [];
				terminados = 0;
			});
		}
	});

	function cerrar() {
		vigente += 1;
		onCerrar();
	}

	const tamano = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

	function agregar(nuevos: File[]) {
		const avisos: string[] = [];
		const aceptados: File[] = [];
		for (const f of nuevos) {
			const extension = f.name.split('.').pop()?.toLowerCase() ?? '';
			if (!EXTENSIONES.includes(extension)) avisos.push(`«${f.name}» no es un PDF ni una imagen (JPG, PNG o TIFF).`);
			else if (f.size > MAX_MB * 1024 * 1024) avisos.push(`«${f.name}» excede el límite de ${MAX_MB} MB.`);
			else if (archivos.some((a) => a.name === f.name && a.size === f.size)) avisos.push(`«${f.name}» ya está en la lista.`);
			else aceptados.push(f);
		}
		const lugar = MAX_DOCUMENTOS - archivos.length;
		if (aceptados.length > lugar) avisos.push(`Solo caben ${MAX_DOCUMENTOS} documentos: ${lugar === 0 ? 'quita uno para agregar otro' : `se agregaron los primeros ${lugar}`}.`);
		archivos = [...archivos, ...aceptados.slice(0, Math.max(lugar, 0))];
		avisoDeArchivos = avisos.join(' ');
	}

	function alElegir(evento: Event) {
		const input = evento.currentTarget as HTMLInputElement;
		const elegidos = [...(input.files ?? [])];
		input.value = '';
		if (elegidos.length > 0) agregar(elegidos);
	}

	function alSoltar(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		agregar([...(evento.dataTransfer?.files ?? [])]);
	}

	function quitar(i: number) {
		archivos = archivos.filter((_, j) => j !== i);
		avisoDeArchivos = '';
	}

	/** Extrae UN documento con el procesador del tipo, en seco. Nunca lanza. */
	async function extraer(archivo: File, turno: number): Promise<Resultado> {
		const vacio = { nombre: archivo.name, campos: [], ausentes: [], sinReconocer: false, confianzaPromedio: null };
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		cuerpo.append('procesador', tipo?.procesadorId ?? '');
		if (tipo?.procesadorVersion) cuerpo.append('version', tipo.procesadorVersion);
		try {
			const r = await fetch('/api/pipeline/extraer', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			if (!r.ok) return { ...vacio, error: mensajeDeFallo(datos, r.status, 'al probar la extracción') };
			const resultado = datos as ResultadoIne;
			const campos = camposDe(resultado).map(([ruta, c]) => ({ ruta, valor: String(c.value_normalized ?? c.value_raw ?? ''), confianza: c.confianza }));
			const meta = (resultado._metadata ?? {}) as { campos_ausentes?: string[]; quality_alert?: boolean };
			return {
				...vacio,
				error: null,
				campos,
				ausentes: Array.isArray(meta.campos_ausentes) ? meta.campos_ausentes : [],
				sinReconocer: meta.quality_alert === true || campos.length === 0,
				confianzaPromedio: typeof resultado.confianza_promedio === 'number' ? resultado.confianza_promedio : null
			};
		} catch {
			return { ...vacio, error: 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.' };
		} finally {
			if (turno === vigente) terminados += 1;
		}
	}

	async function probar() {
		if (archivos.length === 0 || fase === 'probando' || !tipo) return;
		const turno = ++vigente;
		fase = 'probando';
		terminados = 0;
		// A la vez: son hasta tres y cada uno tarda unos segundos.
		const salida = await Promise.all(archivos.map((a) => extraer(a, turno)));
		if (turno !== vigente) return;
		resultados = salida;
		fase = 'resultado';
	}

	const confianzaTexto = (c: number | null) => (c === null ? '—' : `${c.toFixed(0)} %`);
	const CLASE_DE_CALIDAD = { Buena: 'text-green-700 dark:text-green-400', Media: 'text-amber-700 dark:text-amber-400', Baja: 'text-destructive dark:text-red-300' } as const;
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
			data-testid="modal-probar-extraccion"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[90vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<span class="min-w-0 flex-1 truncate text-sm text-muted-foreground">Modelos documentales{tipo ? ` / ${tipo.nombre}` : ''}</span>
				<DialogPrimitive.Close aria-label="Cerrar" onclick={cerrar} class="text-[#475569] dark:text-slate-300">
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
				<div class="flex items-start gap-4">
					<span class="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5 text-primary dark:text-blue-300">
						<FlaskConical class="size-6" />
					</span>
					<div class="min-w-0 flex-1">
						<DialogPrimitive.Title class="text-xl font-bold text-foreground">Probar con documentos</DialogPrimitive.Title>
						<DialogPrimitive.Description class="mt-1 text-sm text-muted-foreground">
							Mira qué extrae «{tipo?.nombre ?? ''}» de hasta {MAX_DOCUMENTOS} documentos de ejemplo y compáralo con el documento. Esta prueba no guarda nada:
							los archivos no quedan en ninguna bandeja ni expediente.
						</DialogPrimitive.Description>
					</div>
				</div>

				{#if fase === 'elegir'}
					{#if archivos.length > 0}
						<ul class="flex flex-col gap-2" data-testid="probar-lista-archivos">
							{#each archivos as archivo, i (archivo.name + archivo.size)}
								<li class="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5" data-testid="probar-archivo" data-nombre={archivo.name}>
									<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background"><FolderLibraryIcon /></span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-medium text-foreground" title={archivo.name}>{archivo.name}</span>
										<span class="block text-xs text-muted-foreground">{tamano(archivo.size)}</span>
									</span>
									<button
										type="button"
										class="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										aria-label="Quitar {archivo.name}"
										data-testid="probar-quitar"
										onclick={() => quitar(i)}
									>
										<X class="size-3.5" />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
					{#if archivos.length < MAX_DOCUMENTOS}
						<button
							type="button"
							data-testid="probar-zona"
							class={[
								'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors',
								archivos.length === 0 ? 'h-44' : 'h-24',
								arrastrando ? 'border-primary bg-muted' : 'border-border bg-background'
							]}
							onclick={() => fileInput?.click()}
							ondragover={(e) => {
								e.preventDefault();
								arrastrando = true;
							}}
							ondragleave={() => (arrastrando = false)}
							ondrop={alSoltar}
						>
							<p class="text-sm font-medium text-foreground">
								{archivos.length === 0 ? 'Arrastra y suelta tus documentos aquí o selecciona archivos' : 'Agregar otro documento'}
							</p>
							<p class="text-xs text-muted-foreground">PDF, JPG, JPEG, PNG, TIFF | Max {MAX_MB} MB cada uno | hasta {MAX_DOCUMENTOS}</p>
						</button>
					{/if}
					<input bind:this={fileInput} data-testid="probar-archivo-entrada" type="file" multiple class="hidden" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" onchange={alElegir} />
					{#if avisoDeArchivos}
						<p class="text-xs text-amber-700 dark:text-amber-400" role="status" data-testid="probar-aviso">{avisoDeArchivos}</p>
					{/if}
					<p class="text-xs text-muted-foreground" data-testid="probar-aviso-costo">Cada documento cuenta como una extracción.</p>
				{:else if fase === 'probando'}
					<div class="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-center" data-testid="probar-leyendo" aria-live="polite">
						<LoaderCircle class="size-7 animate-spin text-primary dark:text-blue-300" />
						<p class="text-sm font-medium text-foreground">Extrayendo datos de {archivos.length === 1 ? `«${archivos[0].name}»` : `${archivos.length} documentos`}…</p>
						<p class="text-xs text-muted-foreground">{archivos.length > 1 ? `${terminados} de ${archivos.length} listos. ` : ''}Puede tardar unos segundos.</p>
					</div>
				{:else}
					<div class="flex flex-col gap-4" data-testid="probar-resultados">
						{#each resultados as r (r.nombre)}
							{@const calidad = calidadDe(r.confianzaPromedio)}
							{@const ausentes = textoDeAusentes(r.ausentes)}
							<section class="rounded-lg border border-border" data-testid="probar-resultado" data-nombre={r.nombre} data-estado={r.error ? 'error' : r.sinReconocer ? 'sin_reconocer' : 'ok'}>
								<div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-4 py-2.5">
									<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={r.nombre}>{r.nombre}</span>
									{#if !r.error && !r.sinReconocer}
										<span class="text-xs text-muted-foreground" data-testid="probar-resumen">
											{r.campos.length} {r.campos.length === 1 ? 'dato encontrado' : 'datos encontrados'}
										</span>
										{#if r.confianzaPromedio !== null}
											<span class="text-xs text-muted-foreground">Confianza promedio {confianzaTexto(r.confianzaPromedio)}{calidad ? ` · ${calidad}` : ''}</span>
										{/if}
									{/if}
								</div>
								{#if r.error}
									<div class="flex items-start gap-3 p-4 text-sm" role="alert" data-testid="probar-error">
										<AlertCircle class="mt-0.5 size-4 shrink-0 text-destructive dark:text-red-300" />
										<p class="text-muted-foreground">No se pudo probar este documento. {r.error}</p>
									</div>
								{:else if r.sinReconocer}
									<p class="p-4 text-sm text-amber-700 dark:text-amber-400" data-testid="probar-sin-reconocer">
										No se reconocieron los campos de este documento. Revisa que sea de este tipo, o ajusta los campos con «Crear nueva versión».
									</p>
								{:else}
									<table class="w-full table-fixed text-left text-sm">
										<thead>
											<tr class="border-b border-border text-xs text-muted-foreground">
												<th scope="col" class="w-2/5 px-4 py-2 font-normal">Campo</th>
												<th scope="col" class="px-4 py-2 font-normal">Valor extraído</th>
												<th scope="col" class="w-24 px-4 py-2 font-normal">Confianza</th>
											</tr>
										</thead>
										<tbody>
											{#each r.campos as c (c.ruta)}
												{@const cal = calidadDe(c.confianza)}
												<tr class="border-b border-border last:border-0" data-testid="probar-campo" data-ruta={c.ruta}>
													<td class="truncate px-4 py-2 text-muted-foreground" title={c.ruta}>{c.ruta}</td>
													<td class="px-4 py-2 break-words text-foreground">{c.valor === '' ? '—' : c.valor}</td>
													<td class="px-4 py-2 text-xs {cal ? CLASE_DE_CALIDAD[cal] : 'text-muted-foreground'}">{confianzaTexto(c.confianza)}</td>
												</tr>
											{/each}
										</tbody>
									</table>
									{#if ausentes}
										<p class="border-t border-border px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400" data-testid="probar-ausentes">No apareció: {ausentes}.</p>
									{/if}
								{/if}
							</section>
						{/each}
						<!-- La confianza es lo que el modelo dice de sí mismo, no una medida de acierto: se dice, porque es lo que más se malinterpreta. -->
						<p class="text-xs text-muted-foreground" data-testid="probar-nota-confianza">
							La confianza es la que el modelo se da a sí mismo, no una garantía de acierto: compara los valores con el documento. Si falta un dato o está mal,
							abre el menú ⋮ del tipo y elige «Crear nueva versión» para ajustar los campos.
						</p>
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
				{#if fase === 'resultado'}
					<Button variant="link" class="h-auto p-0 dark:text-blue-300" data-testid="probar-otra-vez" onclick={() => (fase = 'elegir')}>Probar con otros documentos</Button>
				{:else}
					<span></span>
				{/if}
				<div class="flex items-center gap-4">
					<Button variant="link" class="h-auto p-0 {fase === 'resultado' ? 'dark:text-blue-300' : 'text-destructive dark:text-red-300'}" data-testid="probar-cerrar" onclick={cerrar}>
						{fase === 'resultado' ? 'Cerrar' : 'Ahora no'}
					</Button>
					{#if fase === 'elegir'}
						<Button size="lg" data-testid="probar-ejecutar" disabled={archivos.length === 0} onclick={probar}>
							{archivos.length === 1 ? 'Probar con 1 documento' : `Probar con ${archivos.length} documentos`}
						</Button>
					{/if}
				</div>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
