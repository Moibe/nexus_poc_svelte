<script lang="ts">
	/**
	 * «Subir archivos» de un expediente abierto (2026-10-30, pedido de Moibe: «al picar un expediente, poderle subir archivos»). Se arrastran
	 * o se eligen archivos, se ve la lista con lo que se va a subir (lo que no sirve se marca con su motivo, sin tirar a los demás) y
	 * «Subir» los manda UNO POR UNO a `/api/expedientes/[id]/documentos`, que los guarda como documentos de la organización (carga manual) y los
	 * mete a este expediente en la misma llamada. Cada fila dice cómo le fue; lo que falle se puede reintentar sin volver a subir lo que ya
	 * se subió.
	 *
	 * Los límites son los de siempre (PDF, JPG, PNG y TIFF, hasta 20 MB; ver `$lib/expedientes/subida`). El servidor los vuelve a
	 * comprobar, igual que el rol: quien solo lee ni siquiera ve el botón, y si llegara por otro lado, nexus_back responde 403.
	 *
	 * Mientras se sube no se puede cerrar ni quitar nada (cerrar a medias dejaría la pantalla sin enterarse de lo que ya entró). Al cerrar
	 * con al menos un archivo subido se llama `alTerminar` para que la página se ponga al día y diga cuántos entraron.
	 *
	 * **Duplicados (2026-11-02, Moibe: «avísame de duplicados»).** Al elegir cada archivo se calcula su huella (SHA-256, en el navegador) y se
	 * compara con la de los documentos que YA están en este expediente y con la de lo demás que se eligió o se subió en esta ventana: se compara
	 * el contenido, no el nombre. Un duplicado se marca en ámbar diciendo de cuál es y NO se sube, a menos que la persona lo decida con
	 * «Subir de todos modos» (una segunda copia a propósito es posible, por eso no se prohíbe). Solo se compara contra este expediente: el mismo
	 * documento en otro expediente es legítimo. La comparación es contra lo que la página cargó; si otra persona acaba de subir lo mismo, no
	 * se entera.
	 *
	 * **Clasificar al subir (2026-11-02, Moibe: «los dos clasifican»; sin confianza mínima: basta con ser de ese tipo).** nexus_back clasifica cada
	 * archivo en la misma llamada con que lo sube (la fila dice «Subiendo y clasificando…») y guarda el tipo que reconoció: es lo que dice de qué
	 * tipo es el documento y por lo que lo encuentran los procesos del motor de reglas. Cada archivo subido dice qué pasó
	 * (`lineaDeClasificacion`), y una nota fija sobre la lista dice la regla. Clasificar nunca tumba la subida: si no se pudo, el archivo queda
	 * subido y la fila lo dice. (Hasta el 2026-11-05 además lo metía solo a los expedientes virtuales que esperaban ese tipo; Moibe los quitó.)
	 *
	 * Mismo molde que «Nuevo expediente» (`ExpedienteModal`): modal centrado de 684 px con cabecera, título con su ícono, cuerpo y pie con
	 * «Cancelar» y el botón principal.
	 */
	import { untrack } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatearTamano } from '$lib/expedientes/expedientes';
	import { huellaDe } from '$lib/expedientes/huella';
	import { leerClasificacion, leerExtraccion, lineaDeClasificacion, lineaDeExtraccion, notaDeSubida, type ClasificacionDeSubida, type ExtraccionDeSubida } from '$lib/expedientes/clasificador';
	import { ACEPTAR_ATRIBUTO, MAX_MB_SUBIDA, cuantosArchivos, duplicadoDe, motivoDeRechazo, textoDeDuplicado, type Huella } from '$lib/expedientes/subida';

	/** `duplicado`: se marcó como repetido y NO se sube (a menos que la persona lo permita). */
	type Estado = 'espera' | 'subiendo' | 'listo' | 'error' | 'rechazado' | 'duplicado';
	type Fila = {
		id: number;
		archivo: File;
		estado: Estado;
		/** Por qué no sirve (rechazado) o por qué falló (error): sale en rojo. */
		mensaje: string;
		/** Su huella SHA-256, cuando ya se calculó (o `null` si no se pudo). */
		huella: string | null;
		/** De cuál es duplicado, si lo es: sale en ámbar. */
		duplicado: string;
		/** La persona decidió subirlo aunque sea duplicado. */
		permitirDuplicado: boolean;
		/** Lo que dijo el clasificador al subirlo (`null` si el servidor no lo dijo). */
		clasificacion: ClasificacionDeSubida | null;
		/** Lo que pasó al extraer sus datos justo después de clasificarlo (`null` si el servidor no lo dijo). */
		extraccion: ExtraccionDeSubida | null;
	};

	let {
		open = $bindable(false),
		expediente,
		existentes = [],
		alTerminar
	}: {
		open?: boolean;
		/** El expediente al que se sube. */
		expediente: { id: string; nombre: string };
		/** Los documentos que YA están en el expediente (nombre y huella), para avisar de duplicados. */
		existentes?: { nombre: string; sha256?: string }[];
		/** Se cierra la ventana y entró al menos un archivo: la página se pone al día y avisa. `omitidos` son los duplicados que no se subieron. */
		alTerminar: (resultado: { subidos: number; fallidos: number; omitidos: number }) => Promise<void> | void;
	} = $props();

	let filas = $state<Fila[]>([]);
	let subiendo = $state(false);
	let arrastrando = $state(false);
	let entrada = $state<HTMLInputElement | null>(null);
	let contador = 0;
	/** Cuántas huellas se están calculando (para decirlo, y para no subir antes de saber qué es duplicado). */
	let revisando = $state(0);
	let huellasEnCurso: Promise<unknown>[] = [];

	/** Lo que todavía hay que mandar: lo nuevo y lo que falló. */
	const porSubir = $derived(filas.filter((f) => f.estado === 'espera' || f.estado === 'error'));
	const hayNuevos = $derived(filas.some((f) => f.estado === 'espera'));
	const subidos = $derived(filas.filter((f) => f.estado === 'listo').length);
	const conError = $derived(filas.filter((f) => f.estado === 'error').length);
	const rechazados = $derived(filas.filter((f) => f.estado === 'rechazado').length);
	const duplicados = $derived(filas.filter((f) => f.estado === 'duplicado').length);
	/** La huella y el nombre de lo que ya estaba en el expediente. */
	const huellasExistentes = $derived(existentes.filter((e): e is { nombre: string; sha256: string } => typeof e.sha256 === 'string' && e.sha256 !== '').map((e) => ({ nombre: e.nombre, sha256: e.sha256 })));
	/** Cuántos van, para «Subiendo 2 de 5…». */
	const enTanda = $derived(filas.filter((f) => f.estado === 'subiendo' || f.estado === 'listo' || f.estado === 'error').length);
	const terminado = $derived(!subiendo && porSubir.length === 0 && subidos > 0);

	// Cada vez que se abre, la lista arranca vacía. Solo depende de `open`: lo demás va en `untrack`.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			filas = [];
			subiendo = false;
			arrastrando = false;
			revisando = 0;
			huellasEnCurso = [];
			if (entrada) entrada.value = '';
		});
	});

	/**
	 * Marca (o desmarca) los duplicados de lo que todavía no se sube, en el orden de la lista: contra lo que ya estaba en el expediente y contra
	 * lo que quedó antes en la lista (elegido o ya subido). Se vuelve a correr cada vez que algo cambia: quitar el primero de dos iguales deja
	 * al segundo de nuevo como un archivo normal. Un archivo que la persona permitió se queda como «en espera», con su aviso.
	 */
	function reevaluar() {
		const vistos: Huella[] = [];
		for (const fila of filas) {
			if (fila.estado === 'rechazado') continue;
			if ((fila.estado === 'espera' || fila.estado === 'duplicado') && fila.huella) {
				const d = duplicadoDe(fila.huella, huellasExistentes, vistos);
				fila.duplicado = d ? textoDeDuplicado(d) : '';
				fila.estado = d && !fila.permitirDuplicado ? 'duplicado' : 'espera';
			}
			if (fila.huella) vistos.push({ nombre: fila.archivo.name, sha256: fila.huella, subido: fila.estado === 'listo' });
		}
	}

	function agregar(archivos: FileList | File[] | null | undefined) {
		if (!archivos || subiendo) return;
		for (const archivo of Array.from(archivos)) {
			const motivo = motivoDeRechazo(archivo);
			filas.push({
				id: ++contador,
				archivo,
				estado: motivo ? 'rechazado' : 'espera',
				mensaje: motivo ?? '',
				huella: null,
				duplicado: '',
				permitirDuplicado: false,
				clasificacion: null,
				extraccion: null
			});
			if (motivo) continue;
			// La fila reactiva (la que quedó en la lista), no el objeto suelto: es la que hay que mutar cuando termine la huella.
			const fila = filas[filas.length - 1];
			revisando++;
			huellasEnCurso.push(
				huellaDe(archivo)
					.then((huella) => {
						fila.huella = huella;
						reevaluar();
					})
					.finally(() => revisando--)
			);
		}
		// Sin esto, volver a elegir el mismo archivo no dispara nada: el input sigue "viendo" el anterior.
		if (entrada) entrada.value = '';
	}

	function soltar(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		agregar(evento.dataTransfer?.files);
	}

	function quitar(id: number) {
		if (subiendo) return;
		const i = filas.findIndex((f) => f.id === id);
		if (i >= 0) filas.splice(i, 1);
		reevaluar();
	}

	/** «Subir de todos modos»: la persona decidió que ese duplicado sí se sube (una segunda copia a propósito). */
	function permitir(id: number) {
		if (subiendo) return;
		const fila = filas.find((f) => f.id === id);
		if (!fila) return;
		fila.permitirDuplicado = true;
		reevaluar();
	}

	async function subir() {
		if (subiendo || porSubir.length === 0) return;
		subiendo = true;
		try {
			// Antes de mandar nada se sabe qué es duplicado: si se pica «Subir» con una huella todavía en cuenta, se espera a que termine.
			await Promise.all(huellasEnCurso);
			reevaluar();
			// Una por una: un lote grande no satura al servidor y cada fila dice su propio resultado.
			for (const fila of filas.filter((f) => f.estado === 'espera' || f.estado === 'error')) {
				fila.estado = 'subiendo';
				fila.mensaje = '';
				try {
					const cuerpo = new FormData();
					cuerpo.append('archivo', fila.archivo, fila.archivo.name);
					const r = await fetch(`/api/expedientes/${encodeURIComponent(expediente.id)}/documentos`, { method: 'POST', body: cuerpo });
					const datos = await r.json().catch(() => null);
					if (r.ok) {
						// Lo que dijo el clasificador viaja en la misma respuesta; un servidor sin él deja la fila sin esa línea.
						fila.clasificacion = leerClasificacion(datos?.clasificacion);
						fila.extraccion = leerExtraccion(datos?.extraccion);
						fila.estado = 'listo';
					} else {
						fila.estado = 'error';
						fila.mensaje = datos?.mensaje ?? 'No se pudo subir el archivo. Intenta de nuevo.';
					}
				} catch {
					fila.estado = 'error';
					fila.mensaje = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
				}
			}
		} finally {
			subiendo = false;
		}
	}

	async function cerrar() {
		if (subiendo) return;
		const resultado = { subidos, fallidos: conError, omitidos: duplicados };
		open = false;
		if (resultado.subidos > 0) await alTerminar(resultado);
	}

	const extension = (nombre: string) => (nombre.includes('.') ? (nombre.split('.').pop() ?? '').toUpperCase() : '');
	const esImagen = (nombre: string) => ['JPG', 'JPEG', 'PNG', 'TIF', 'TIFF'].includes(extension(nombre));

	const resumen = $derived.by(() => {
		if (subiendo) return `Subiendo ${enTanda} de ${enTanda + filas.filter((f) => f.estado === 'espera').length}…`;
		if (filas.length === 0) return '';
		const partes: string[] = [];
		if (subidos > 0) partes.push(`${cuantosArchivos(subidos)} ${subidos === 1 ? 'subido' : 'subidos'}`);
		if (conError > 0) partes.push(`${cuantosArchivos(conError)} sin subir`);
		const pendientes = filas.filter((f) => f.estado === 'espera').length;
		if (pendientes > 0) partes.push(`${cuantosArchivos(pendientes)} por subir`);
		if (duplicados > 0) partes.push(`${cuantosArchivos(duplicados)} ${duplicados === 1 ? 'duplicado' : 'duplicados'}`);
		if (rechazados > 0) partes.push(`${cuantosArchivos(rechazados)} no ${rechazados === 1 ? 'válido' : 'válidos'}`);
		if (revisando > 0) partes.push('revisando duplicados…');
		return partes.join(' · ');
	});
</script>

<DialogPrimitive.Root
	{open}
	onOpenChange={(abierto) => {
		if (abierto) open = true;
		else void cerrar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-subir-archivos"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg"
		>
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">Expedientes / {expediente.nombre}</p>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground dark:text-slate-300 disabled:opacity-40"
					data-testid="cerrar-subir-archivos"
					disabled={subiendo}
					onclick={cerrar}
				>
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</button>
			</div>

			<div class="flex h-16 shrink-0 items-center gap-3">
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
					<Upload class="size-4" />
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">Subir archivos</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
						Los archivos se guardan en este expediente. PDF, JPG, PNG o TIFF, de hasta {MAX_MB_SUBIDA} MB cada uno.
					</DialogPrimitive.Description>
				</div>
			</div>

			<div class="flex flex-col gap-3 px-4 py-4">
				<button
					type="button"
					data-testid="zona-soltar-archivos"
					disabled={subiendo}
					class={[
						'flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
						arrastrando ? 'border-primary bg-muted' : 'border-border bg-background'
					]}
					onclick={() => entrada?.click()}
					ondragover={(evento) => {
						evento.preventDefault();
						if (!subiendo) arrastrando = true;
					}}
					ondragleave={() => (arrastrando = false)}
					ondrop={soltar}
				>
					<span class="flex size-8 items-center justify-center rounded-lg border border-border bg-card">
						<FolderLibraryIcon />
					</span>
					<span class="text-sm font-medium text-foreground">Arrastra y suelta tus archivos aquí o selecciónalos desde tu equipo</span>
					<span class="text-xs text-muted-foreground">PDF, JPG, JPEG, PNG, TIFF | Max {MAX_MB_SUBIDA} MB</span>
				</button>
				<!-- Lo que hace el clasificador al subir, dicho donde se sube (2026-11-02). -->
				<p class="flex items-start gap-2 text-xs text-muted-foreground" data-testid="nota-clasificacion">
					<Sparkles class="mt-0.5 size-3.5 shrink-0 text-primary" />
					<span>{notaDeSubida()}</span>
				</p>
				<input
					bind:this={entrada}
					type="file"
					multiple
					class="hidden"
					accept={ACEPTAR_ATRIBUTO}
					data-testid="entrada-archivos"
					onchange={(e) => agregar(e.currentTarget.files)}
				/>

				{#if filas.length > 0}
					<ul class="flex max-h-64 flex-col gap-2 overflow-y-auto" data-testid="lista-archivos-por-subir">
						{#each filas as fila (fila.id)}
							<li
								data-testid="archivo-subida"
								data-nombre={fila.archivo.name}
								data-estado={fila.estado}
								class={[
									'flex items-center gap-3 rounded-lg border px-3 py-2.5',
									fila.estado === 'error' || fila.estado === 'rechazado'
										? 'border-destructive/40 bg-background'
										: fila.duplicado
											? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
											: 'border-border bg-background'
								]}
							>
								<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
									{#if esImagen(fila.archivo.name)}<ImageIcon />{:else}<FileIcon />{/if}
								</span>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-foreground" title={fila.archivo.name}>{fila.archivo.name}</p>
									<p class="text-xs text-muted-foreground">{extension(fila.archivo.name)} · {formatearTamano(fila.archivo.size)}</p>
									{#if fila.mensaje}
										<p class="mt-0.5 text-xs text-destructive" data-testid="archivo-subida-mensaje">{fila.mensaje}</p>
									{/if}
									<!-- Lo que dijo el clasificador de un archivo ya subido: verde si reconoció su tipo, ámbar si pide atención (no se pudo clasificar),
									     gris si solo informa. -->
									{#if fila.estado === 'listo' && fila.clasificacion}
										{@const linea = lineaDeClasificacion(fila.clasificacion)}
										<p
											class={['mt-0.5 text-xs', linea.tono === 'bien' ? 'text-green-700 dark:text-green-400' : linea.tono === 'aviso' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground']}
											data-testid="archivo-subida-clasificacion"
											data-clasificacion={fila.clasificacion.estado}
										>
											{linea.texto}
										</p>
									{/if}
									<!-- Y lo de la extracción de sus datos (2026-11-06), debajo: verde si se extrajeron, ámbar si no se pudo; sin tipo no dice nada. -->
									{#if fila.estado === 'listo' && fila.extraccion}
										{@const extraccion = lineaDeExtraccion(fila.extraccion)}
										{#if extraccion}
											<p
												class={['mt-0.5 text-xs', extraccion.tono === 'bien' ? 'text-green-700 dark:text-green-400' : extraccion.tono === 'aviso' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground']}
												data-testid="archivo-subida-extraccion"
												data-extraccion={fila.extraccion.estado}
											>
												{extraccion.texto}
											</p>
										{/if}
									{/if}
									<!-- Un duplicado se dice en ámbar (no es un error: el archivo está bien, solo que ya está) y, si no se permitió, ofrece subirlo igual. -->
									{#if fila.duplicado && fila.estado !== 'listo'}
										<p class="mt-0.5 text-xs text-amber-700 dark:text-amber-400" data-testid="archivo-subida-duplicado">
											{fila.duplicado}{fila.permitirDuplicado ? ' Se subirá de todos modos.' : ''}
										</p>
										{#if fila.estado === 'duplicado' && !subiendo}
											<button
												type="button"
												class="mt-0.5 text-xs font-medium text-primary underline-offset-2 hover:underline dark:text-blue-300"
												data-testid="subir-de-todos-modos"
												onclick={() => permitir(fila.id)}
											>
												Subir de todos modos
											</button>
										{/if}
									{/if}
								</div>
								<span class="flex shrink-0 items-center gap-1.5 text-xs" data-testid="archivo-subida-estado">
									{#if fila.estado === 'subiendo'}
										<LoaderCircle class="size-3.5 animate-spin text-primary" />
										<span class="text-muted-foreground">Subiendo y clasificando…</span>
									{:else if fila.estado === 'listo'}
										<Check class="size-3.5 text-green-600" />
										<span class="font-medium text-green-700 dark:text-green-400">Subido</span>
									{:else if fila.estado === 'error'}
										<span class="font-medium text-destructive">No se subió</span>
									{:else if fila.estado === 'rechazado'}
										<span class="font-medium text-destructive">No válido</span>
									{:else if fila.estado === 'duplicado'}
										<span class="font-medium text-amber-700 dark:text-amber-400">Duplicado</span>
									{:else}
										<span class="text-muted-foreground">En espera</span>
									{/if}
								</span>
								{#if !subiendo && fila.estado !== 'listo'}
									<button
										type="button"
										aria-label={`Quitar ${fila.archivo.name}`}
										class="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										data-testid="quitar-archivo-por-subir"
										onclick={() => quitar(fila.id)}
									>
										<X class="size-3.5" />
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				<p class="min-h-4 text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="resumen-subida">{resumen}</p>
			</div>

			<div class="flex items-center justify-end gap-4 border-t border-border p-2.5">
				<Button type="button" variant="link" class="h-9.5 px-4 text-destructive dark:text-red-300" data-testid="cancelar-subir-archivos" disabled={subiendo} onclick={cerrar}>
					{subidos > 0 ? 'Cerrar' : 'Cancelar'}
				</Button>
				{#if terminado}
					<Button type="button" class="h-9.5 px-4" data-testid="listo-subir-archivos" onclick={cerrar}>Listo</Button>
				{:else}
					<Button type="button" class="h-9.5 px-4" data-testid="subir-archivos" disabled={porSubir.length === 0 || subiendo} onclick={subir}>
						{#if subiendo}
							<LoaderCircle class="size-4 animate-spin" />
							Subiendo…
						{:else if !hayNuevos && conError > 0}
							Reintentar {cuantosArchivos(conError)}
						{:else if porSubir.length === 0}
							Subir archivos
						{:else}
							Subir {cuantosArchivos(porSubir.length)}
						{/if}
					</Button>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
