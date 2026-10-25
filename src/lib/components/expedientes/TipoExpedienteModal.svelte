<script lang="ts">
	/**
	 * «Nuevo tipo de expediente» y «Editar tipo de expediente» (2026-10-24): el alta de un tipo con su ESQUEMA y el cambio de NOMBRE de uno
	 * ya creado, en el mismo modal.
	 *
	 * Un tipo de expediente es la clase de la que salen los expedientes («Expediente médico», «Expediente de un choque») y puede tener VARIOS
	 * tipos documentales: ese conjunto es su esquema. Desde 2026-10-25 el esquema se define AL CREAR el tipo: el alta pide el nombre y que se
	 * elija al menos un tipo documental de la biblioteca de la organización (`tiposDocumentales`, que pone la página). El esquema describe, no
	 * restringe: los expedientes del tipo reciben cualquier archivo. «Crear» no se enciende sin nombre y sin al menos un tipo documental.
	 * Si la organización todavía no tiene ninguno, o no se pudieron leer (`tiposDocumentalesFallo`), el modal lo dice y no deja crear. Los
	 * archivados no se ofrecen (la biblioteca tampoco los muestra); los borradores sí, con su etiqueta. Se mandan en el orden de la biblioteca,
	 * no en el que se fueron marcando.
	 *
	 * Sin `tipo` el modal da de alta uno. Con `tipo` EDITA su nombre (solo el nombre: cambiar el esquema de uno ya creado no está en pantalla):
	 * viene con el nombre actual ya seleccionado, «Guardar cambios» solo se enciende si el nombre cambió, y los expedientes del tipo ven el
	 * nombre nuevo sin tocarlos (guardan el id del tipo). Es el mismo modal porque es el mismo campo, la misma validación y el mismo «ya
	 * existe»: dos pantallas distintas dirían lo mismo de dos maneras.
	 *
	 * Es un modal centrado de 684 px con el molde del «Registro de motivo» (`MotivoModal`): `Dialog` de bits-ui en un portal, cabecera con
	 * su migaja y la X, título con su ícono, cuerpo con los campos y pie con «Cancelar» y el botón principal. El tipo de expediente NO existe
	 * en el Figma (se buscó en todo el Sprint 5 el 2026-10-24), así que no hay un diseño propio que copiar.
	 *
	 * El nombre es obligatorio y mide como mucho `MAX_NOMBRE_TIPO` caracteres. Nexus_back lo vuelve a comprobar, limpia los espacios de más
	 * y no deja repetir un nombre dentro de la organización (sin distinguir mayúsculas; cambiarle solo las mayúsculas al nombre propio sí se
	 * puede): ese caso se dice bajo el campo, sin cerrar el modal. Cualquier otro rechazo (el servidor, la red, un tipo documental que ya no
	 * existe) se dice sobre el pie.
	 */
	import { tick } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import FolderPen from '@lucide/svelte/icons/folder-pen';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { MAX_NOMBRE_TIPO, type TipoDocumentalOpcion } from '$lib/expedientes/tipos';

	let {
		open = $bindable(false),
		tipo = null,
		tiposDocumentales = [],
		tiposDocumentalesFallo = false,
		alCrear,
		alRenombrar
	}: {
		open?: boolean;
		/** Con un tipo, el modal EDITA su nombre; sin él (`null`), da de alta uno nuevo. */
		tipo?: { id: string; nombre: string } | null;
		/** Los tipos documentales de la organización entre los que se arma el esquema (solo el alta los usa), en el orden de la biblioteca. */
		tiposDocumentales?: TipoDocumentalOpcion[];
		/** No se pudieron leer los tipos documentales: el alta lo dice y no deja crear. */
		tiposDocumentalesFallo?: boolean;
		/** El tipo YA se creó y el modal ya se cerró; recibe el nombre con que quedó guardado y cuántos tipos documentales tiene su esquema. */
		alCrear?: (nombre: string, totalTiposDocumentales: number) => Promise<void> | void;
		/** El tipo YA se renombró y el modal ya se cerró; recibe el nombre con que quedó y si de verdad cambió (`false` si, ya limpio, era el mismo). */
		alRenombrar?: (nombre: string, cambiado: boolean) => Promise<void> | void;
	} = $props();

	let nombre = $state('');
	/** Los ids de los tipos documentales marcados, en el orden en que se marcaron (al enviar se reordenan como la biblioteca). */
	let elegidos = $state<string[]>([]);
	let enviando = $state(false);
	let error = $state('');
	/** El error es el del nombre repetido: se pinta bajo el campo del nombre; cualquier otro, sobre el pie. */
	let errorEnNombre = $state(false);
	let campo = $state<HTMLInputElement | null>(null);

	const editando = $derived(tipo !== null);
	/** Lo marcado que SIGUE existiendo en la lista, en el orden de la biblioteca: es lo que se manda. */
	const seleccionados = $derived(tiposDocumentales.filter((t) => elegidos.includes(t.id)).map((t) => t.id));
	// Al editar, dejar el nombre igual no es un cambio: no hay nada que guardar. Al crear hace falta el nombre Y al menos un tipo documental.
	const completo = $derived(
		tipo === null ? nombre.trim().length > 0 && seleccionados.length > 0 : nombre.trim().length > 0 && nombre.trim() !== tipo.nombre
	);

	// Cada vez que se abre, el formulario arranca limpio (o con el nombre actual, al editar).
	$effect(() => {
		if (!open) return;
		nombre = tipo?.nombre ?? '';
		elegidos = [];
		error = '';
		errorEnNombre = false;
	});

	function alternar(id: string) {
		elegidos = elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id];
	}

	async function pedir(): Promise<Response | null> {
		const cabeceras = { 'Content-Type': 'application/json' };
		try {
			return tipo
				? await fetch(`/api/tipos-expediente/${encodeURIComponent(tipo.id)}`, {
						method: 'PATCH',
						headers: cabeceras,
						body: JSON.stringify({ nombre: nombre.trim() })
					})
				: await fetch('/api/tipos-expediente', {
						method: 'POST',
						headers: cabeceras,
						body: JSON.stringify({ nombre: nombre.trim(), tiposDocumentales: seleccionados })
					});
		} catch {
			return null;
		}
	}

	async function guardar() {
		if (!completo || enviando) return;
		enviando = true;
		error = '';
		errorEnNombre = false;
		try {
			const r = await pedir();
			if (r === null) {
				error = 'No se pudo contactar al servidor. Intenta de nuevo.';
				return;
			}
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				errorEnNombre = datos?.codigo === 'ya_existe';
				error = errorEnNombre
					? 'Ya existe un tipo de expediente con ese nombre.'
					: (datos?.mensaje ?? (editando ? 'No se pudo guardar el cambio. Intenta de nuevo.' : 'No se pudo crear el tipo de expediente. Intenta de nuevo.'));
				return;
			}
			open = false;
			if (tipo) await alRenombrar?.(typeof datos?.tipo?.nombre === 'string' ? datos.tipo.nombre : nombre.trim(), datos?.cambiado !== false);
			else await alCrear?.(typeof datos?.nombre === 'string' ? datos.nombre : nombre.trim(), Array.isArray(datos?.tiposDocumentales) ? datos.tiposDocumentales.length : seleccionados.length);
		} finally {
			enviando = false;
		}
	}
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-tipo-expediente"
			onOpenAutoFocus={(e) => {
				// Quien abre el modal quiere escribir: el cursor va al campo y no a la X. Al editar, con el nombre actual seleccionado, para
				// reemplazarlo de un tirón; el nombre se pone en un efecto, así que se espera a que el campo ya lo tenga.
				e.preventDefault();
				tick().then(() => {
					campo?.focus();
					campo?.select();
				});
			}}
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<!-- header . navigation -->
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="flex-1 text-sm text-muted-foreground">Expediente / Tipos de expediente</p>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
					data-testid="cerrar-tipo-expediente"
					onclick={() => (open = false)}
				>
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</button>
			</div>

			<!-- header.modal -->
			<div class="flex h-16 shrink-0 items-center gap-3">
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
					{#if editando}
						<FolderPen class="size-4" />
					{:else}
						<FolderPlus class="size-4" />
					{/if}
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">
						{editando ? 'Editar tipo de expediente' : 'Nuevo tipo de expediente'}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
						{editando ? 'Cambia el nombre del tipo. Sus expedientes verán el nombre nuevo.' : 'Completa la información requerida.'}
					</DialogPrimitive.Description>
				</div>
			</div>

			<form
				class="contents"
				onsubmit={(e) => {
					e.preventDefault();
					guardar();
				}}
			>
				<!-- body.modal -->
				<div class="flex flex-col gap-5 px-4 py-4">
					<div class="flex flex-col gap-2">
						<label for="nombre-tipo-expediente" class="text-base font-medium text-foreground">Nombre del tipo de expediente *</label>
						<input
							id="nombre-tipo-expediente"
							type="text"
							bind:this={campo}
							bind:value={nombre}
							maxlength={MAX_NOMBRE_TIPO}
							autocomplete="off"
							data-testid="nombre-tipo-expediente"
							aria-invalid={error && errorEnNombre ? 'true' : undefined}
							aria-describedby="ayuda-tipo-expediente"
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
						/>
						<p id="ayuda-tipo-expediente" class="text-xs text-muted-foreground">
							{#if editando}
								Solo cambia el nombre: los expedientes de este tipo siguen siendo suyos y verán el nombre nuevo.
							{:else}
								Por ejemplo: «Expediente médico» o «Expediente de un choque». Cada expediente que crees después será una instancia de un tipo.
							{/if}
						</p>
						{#if error && errorEnNombre}
							<p class="text-xs text-destructive" role="alert" data-testid="error-tipo-expediente">{error}</p>
						{/if}
					</div>

					{#if !editando}
						<div class="flex flex-col gap-2" data-testid="esquema-tipo-expediente">
							<div class="flex items-baseline justify-between gap-3">
								<span id="etiqueta-esquema-tipo-expediente" class="text-base font-medium text-foreground">Tipos documentales del esquema *</span>
								{#if tiposDocumentales.length > 0}
									<span class="shrink-0 text-xs text-muted-foreground" aria-live="polite" data-testid="esquema-contador">
										{seleccionados.length} de {tiposDocumentales.length} seleccionados
									</span>
								{/if}
							</div>
							<p id="ayuda-esquema-tipo-expediente" class="text-xs text-muted-foreground">
								Elige los tipos documentales que lleva este tipo de expediente. Describen qué se espera de sus expedientes, pero no limitan los
								archivos que reciben.
							</p>
							{#if tiposDocumentalesFallo}
								<p
									class="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm text-destructive"
									role="alert"
									data-testid="esquema-fallo"
								>
									No se pudieron cargar los tipos documentales de tu organización. Cierra esta ventana y vuelve a intentarlo.
								</p>
							{:else if tiposDocumentales.length === 0}
								<p
									class="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground"
									data-testid="esquema-sin-tipos-documentales"
								>
									Tu organización todavía no tiene tipos documentales. Créalos primero en la biblioteca de tipos documentales, desde el menú del
									engrane, para poder definir el esquema.
								</p>
							{:else}
								<div
									role="group"
									aria-labelledby="etiqueta-esquema-tipo-expediente"
									aria-describedby="ayuda-esquema-tipo-expediente"
									class="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-input bg-card"
									data-testid="lista-tipos-documentales"
								>
									{#each tiposDocumentales as td (td.id)}
										<label
											class="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
											data-testid="esquema-opcion"
											data-tipo-documental-id={td.id}
										>
											<Checkbox checked={elegidos.includes(td.id)} onCheckedChange={() => alternar(td.id)} data-testid="esquema-casilla" />
											<span class="min-w-0 flex-1 truncate" title={td.nombre}>{td.nombre}</span>
											{#if td.estado === 'borrador'}
												<span class="shrink-0 rounded-sm border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground" data-testid="esquema-borrador">
													Borrador
												</span>
											{/if}
										</label>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					{#if error && !errorEnNombre}
						<p class="text-xs text-destructive" role="alert" data-testid="error-tipo-expediente">{error}</p>
					{/if}
				</div>

				<!-- footer.modal -->
				<div class="flex items-center justify-end gap-4 border-t border-border p-2.5">
					<Button
						type="button"
						variant="link"
						class="h-9.5 px-4 text-destructive"
						data-testid="cancelar-tipo-expediente"
						onclick={() => (open = false)}
					>
						Cancelar
					</Button>
					<Button
						type="submit"
						class="h-9.5 px-4"
						data-testid={editando ? 'guardar-tipo-expediente' : 'crear-tipo-expediente'}
						disabled={!completo || enviando}
					>
						{#if editando}
							{enviando ? 'Guardando…' : 'Guardar cambios'}
						{:else}
							{enviando ? 'Creando…' : 'Crear tipo de expediente'}
						{/if}
					</Button>
				</div>
			</form>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
