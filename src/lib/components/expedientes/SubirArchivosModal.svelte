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
	 * Mismo molde que «Nuevo expediente virtual» (`ExpedienteVirtualModal`): modal centrado de 684 px con cabecera, título con su ícono,
	 * cuerpo y pie con «Cancelar» y el botón principal.
	 */
	import { untrack } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatearTamano } from '$lib/expedientes/expedientes';
	import { ACEPTAR_ATRIBUTO, MAX_MB_SUBIDA, cuantosArchivos, motivoDeRechazo } from '$lib/expedientes/subida';

	type Estado = 'espera' | 'subiendo' | 'listo' | 'error' | 'rechazado';
	type Fila = { id: number; archivo: File; estado: Estado; mensaje: string };

	let {
		open = $bindable(false),
		expediente,
		alTerminar
	}: {
		open?: boolean;
		/** El expediente al que se sube. */
		expediente: { id: string; nombre: string };
		/** Se cierra la ventana y entró al menos un archivo: la página se pone al día y avisa. */
		alTerminar: (resultado: { subidos: number; fallidos: number }) => Promise<void> | void;
	} = $props();

	let filas = $state<Fila[]>([]);
	let subiendo = $state(false);
	let arrastrando = $state(false);
	let entrada = $state<HTMLInputElement | null>(null);
	let contador = 0;

	/** Lo que todavía hay que mandar: lo nuevo y lo que falló. */
	const porSubir = $derived(filas.filter((f) => f.estado === 'espera' || f.estado === 'error'));
	const hayNuevos = $derived(filas.some((f) => f.estado === 'espera'));
	const subidos = $derived(filas.filter((f) => f.estado === 'listo').length);
	const conError = $derived(filas.filter((f) => f.estado === 'error').length);
	const rechazados = $derived(filas.filter((f) => f.estado === 'rechazado').length);
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
			if (entrada) entrada.value = '';
		});
	});

	function agregar(archivos: FileList | File[] | null | undefined) {
		if (!archivos || subiendo) return;
		for (const archivo of Array.from(archivos)) {
			const motivo = motivoDeRechazo(archivo);
			filas.push({ id: ++contador, archivo, estado: motivo ? 'rechazado' : 'espera', mensaje: motivo ?? '' });
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
	}

	async function subir() {
		if (subiendo || porSubir.length === 0) return;
		subiendo = true;
		try {
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
		const resultado = { subidos, fallidos: conError };
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
		if (rechazados > 0) partes.push(`${cuantosArchivos(rechazados)} no ${rechazados === 1 ? 'válido' : 'válidos'}`);
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
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">Expedientes / {expediente.nombre}</p>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground disabled:opacity-40"
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
									'flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5',
									fila.estado === 'error' || fila.estado === 'rechazado' ? 'border-destructive/40' : 'border-border'
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
								</div>
								<span class="flex shrink-0 items-center gap-1.5 text-xs" data-testid="archivo-subida-estado">
									{#if fila.estado === 'subiendo'}
										<LoaderCircle class="size-3.5 animate-spin text-primary" />
										<span class="text-muted-foreground">Subiendo…</span>
									{:else if fila.estado === 'listo'}
										<Check class="size-3.5 text-green-600" />
										<span class="font-medium text-green-700">Subido</span>
									{:else if fila.estado === 'error'}
										<span class="font-medium text-destructive">No se subió</span>
									{:else if fila.estado === 'rechazado'}
										<span class="font-medium text-destructive">No válido</span>
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
				<Button type="button" variant="link" class="h-9.5 px-4 text-destructive" data-testid="cancelar-subir-archivos" disabled={subiendo} onclick={cerrar}>
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
						{:else}
							Subir {cuantosArchivos(porSubir.length)}
						{/if}
					</Button>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
