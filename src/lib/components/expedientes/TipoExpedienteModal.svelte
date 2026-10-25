<script lang="ts">
	/**
	 * «Nuevo tipo de expediente» y «Editar tipo de expediente» (2026-10-24): el alta de un tipo con su ESQUEMA y la edición de uno ya creado
	 * (su nombre y su esquema), en el mismo modal.
	 *
	 * Un tipo de expediente es la clase de la que salen los expedientes («Expediente médico», «Expediente de un choque») y puede tener VARIOS
	 * tipos documentales: ese conjunto es su esquema. Desde 2026-10-25 el esquema se define AL CREAR el tipo: el alta pide el nombre y que se
	 * elija al menos un tipo documental de la biblioteca de la organización (`tiposDocumentales`, que pone la página). El esquema describe, no
	 * restringe: los expedientes del tipo reciben cualquier archivo. «Crear» no se enciende sin nombre y sin al menos un tipo documental.
	 * Si la organización todavía no tiene ninguno, o no se pudieron leer (`tiposDocumentalesFallo`), el modal lo dice y no deja crear. Los
	 * archivados no se ofrecen (la biblioteca tampoco los muestra); los borradores sí, con su etiqueta. Se mandan en el orden de la biblioteca,
	 * no en el que se fueron marcando.
	 *
	 * Sin `tipo` el modal da de alta uno. Con `tipo` EDITA ese tipo (2026-10-25: «un tipo ya creado debe poder ser editable»): viene con el
	 * nombre actual ya seleccionado y con marcados los tipos documentales de su esquema actual. «Guardar cambios» solo se enciende si algo
	 * cambió (el nombre, o cuáles están marcados: el orden no cuenta) y, como al crear, con al menos un tipo documental marcado: un esquema
	 * nunca se deja vacío. Solo viaja lo que cambió, y nexus_back lo guarda junto: si el nombre se repite o un tipo documental ya no existe,
	 * no cambia ni lo uno ni lo otro. Los expedientes del tipo siguen siendo suyos y ven el nombre nuevo sin tocarlos (guardan el id del
	 * tipo), y cambiar el esquema no toca sus documentos (describe, no restringe).
	 *
	 * Un tipo anterior a la regla, sin esquema, pide elegir uno para guardar, aunque solo se le cambie el nombre. Si el esquema no se puede
	 * editar —la lista no se leyó, o la organización ya no tiene tipos documentales—, el nombre sí se puede cambiar y el modal lo dice. Los
	 * tipos documentales del esquema que la lista ya no ofrece (se eliminaron o se archivaron) no se pueden conservar: se avisa, y al cambiar
	 * el esquema se quitan (cambiar solo el nombre no los toca). Es el mismo modal porque es el mismo campo, la misma validación y el mismo
	 * «ya existe»: dos pantallas distintas dirían lo mismo de dos maneras.
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
	import { MAX_NOMBRE_TIPO, type ResultadoEdicionTipo, type TipoDocumentalOpcion } from '$lib/expedientes/tipos';

	let {
		open = $bindable(false),
		tipo = null,
		tiposDocumentales = [],
		tiposDocumentalesFallo = false,
		alCrear,
		alEditar
	}: {
		open?: boolean;
		/** Con un tipo (y los tipos documentales de su esquema actual), el modal lo EDITA; sin él (`null`), da de alta uno nuevo. */
		tipo?: { id: string; nombre: string; tiposDocumentales: { id: string }[] } | null;
		/** Los tipos documentales de la organización entre los que se arma el esquema, en el orden de la biblioteca. */
		tiposDocumentales?: TipoDocumentalOpcion[];
		/** No se pudieron leer los tipos documentales: el alta lo dice y no deja crear; la edición solo deja cambiar el nombre. */
		tiposDocumentalesFallo?: boolean;
		/** El tipo YA se creó y el modal ya se cerró; recibe el nombre con que quedó guardado y cuántos tipos documentales tiene su esquema. */
		alCrear?: (nombre: string, totalTiposDocumentales: number) => Promise<void> | void;
		/** El tipo YA se editó y el modal ya se cerró; recibe qué cambió de verdad (nada, si lo mandado ya era lo guardado). */
		alEditar?: (resultado: ResultadoEdicionTipo) => Promise<void> | void;
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
	const nombreLimpio = $derived(nombre.trim());
	/** Lo marcado que SIGUE existiendo en la lista, en el orden de la biblioteca: es lo que se manda. */
	const seleccionados = $derived(tiposDocumentales.filter((t) => elegidos.includes(t.id)).map((t) => t.id));
	/** Se puede ELEGIR el esquema: la lista se leyó y trae al menos un tipo documental. Si no, al crear no se puede nada y al editar solo el nombre. */
	const puedeElegir = $derived(!tiposDocumentalesFallo && tiposDocumentales.length > 0);
	/** Los ids del esquema con que se abrió la edición (vacío al crear). */
	const idsDelEsquema = $derived(tipo ? tipo.tiposDocumentales.map((t) => t.id) : []);
	/** Los del esquema actual que la lista todavía ofrece, en el orden de la biblioteca: lo marcado al abrir. */
	const actuales = $derived(tiposDocumentales.filter((t) => idsDelEsquema.includes(t.id)).map((t) => t.id));
	/** Cuántos del esquema actual la lista ya no ofrece (se eliminaron o se archivaron): al cambiar el esquema se quitan. */
	const fuera = $derived(idsDelEsquema.length - actuales.length);
	const nombreCambio = $derived(tipo !== null && nombreLimpio !== tipo.nombre);
	// Qué esté marcado cuenta, no el orden: abrir y guardar sin tocar nada no puede reordenar un esquema.
	const esquemaCambio = $derived(
		tipo !== null && puedeElegir && (seleccionados.length !== actuales.length || seleccionados.some((id) => !actuales.includes(id)))
	);
	// Al crear hace falta el nombre Y al menos un tipo documental. Al editar, que algo cambie (dejar todo igual no es un cambio) y, si el
	// esquema se puede elegir, que quede al menos un tipo documental: un esquema nunca se deja vacío (ni al renombrar un tipo sin esquema).
	const completo = $derived(
		nombreLimpio.length > 0 &&
			(tipo === null ? seleccionados.length > 0 : (nombreCambio || esquemaCambio) && (!puedeElegir || seleccionados.length > 0))
	);

	// Cada vez que se abre, el formulario arranca limpio (o con el nombre y el esquema actuales, al editar).
	$effect(() => {
		if (!open) return;
		nombre = tipo?.nombre ?? '';
		elegidos = tipo ? tipo.tiposDocumentales.map((t) => t.id) : [];
		error = '';
		errorEnNombre = false;
	});

	function alternar(id: string) {
		elegidos = elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id];
	}

	/** Lo que se va a mandar, tomado en este instante: la respuesta se lee después y lo escrito mientras tanto no debe colarse. */
	type Envio = { nombre: string; mandaNombre: boolean; mandaEsquema: boolean; esquema: string[] };

	async function pedir(envio: Envio): Promise<Response | null> {
		const cabeceras = { 'Content-Type': 'application/json' };
		try {
			if (!tipo) {
				return await fetch('/api/tipos-expediente', {
					method: 'POST',
					headers: cabeceras,
					body: JSON.stringify({ nombre: envio.nombre, tiposDocumentales: envio.esquema })
				});
			}
			// Al editar solo viaja lo que cambió; nexus_back lo guarda junto (o no guarda nada).
			const cambios: { nombre?: string; tiposDocumentales?: string[] } = {};
			if (envio.mandaNombre) cambios.nombre = envio.nombre;
			if (envio.mandaEsquema) cambios.tiposDocumentales = envio.esquema;
			return await fetch(`/api/tipos-expediente/${encodeURIComponent(tipo.id)}`, {
				method: 'PATCH',
				headers: cabeceras,
				body: JSON.stringify(cambios)
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
		const envio: Envio = { nombre: nombreLimpio, mandaNombre: nombreCambio, mandaEsquema: esquemaCambio, esquema: [...seleccionados] };
		try {
			const r = await pedir(envio);
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
			if (tipo) {
				await alEditar?.({
					nombre: typeof datos?.tipo?.nombre === 'string' ? datos.tipo.nombre : envio.nombre,
					nombreCambiado: typeof datos?.nombreCambiado === 'boolean' ? datos.nombreCambiado : envio.mandaNombre,
					esquemaCambiado: typeof datos?.esquemaCambiado === 'boolean' ? datos.esquemaCambiado : envio.mandaEsquema,
					totalTiposDocumentales: Array.isArray(datos?.tipo?.tiposDocumentales) ? datos.tipo.tiposDocumentales.length : envio.esquema.length
				});
			} else {
				await alCrear?.(typeof datos?.nombre === 'string' ? datos.nombre : envio.nombre, Array.isArray(datos?.tiposDocumentales) ? datos.tiposDocumentales.length : envio.esquema.length);
			}
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
				<p class="flex-1 text-sm text-muted-foreground">Configuración / Tipos de expediente</p>
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
						{editando ? 'Cambia el nombre del tipo o los tipos documentales de su esquema. Sus expedientes seguirán siendo suyos.' : 'Completa la información requerida.'}
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
								Los expedientes de este tipo siguen siendo suyos y verán el nombre nuevo.
							{:else}
								Por ejemplo: «Expediente médico» o «Expediente de un choque». Cada expediente que crees después será una instancia de un tipo.
							{/if}
						</p>
						{#if error && errorEnNombre}
							<p class="text-xs text-destructive" role="alert" data-testid="error-tipo-expediente">{error}</p>
						{/if}
					</div>

					<div class="flex flex-col gap-2" data-testid="esquema-tipo-expediente">
						<div class="flex items-baseline justify-between gap-3">
							<span id="etiqueta-esquema-tipo-expediente" class="text-base font-medium text-foreground">
								Tipos documentales del esquema{!editando || puedeElegir ? ' *' : ''}
							</span>
							{#if tiposDocumentales.length > 0}
								<span class="shrink-0 text-xs text-muted-foreground" aria-live="polite" data-testid="esquema-contador">
									{seleccionados.length} de {tiposDocumentales.length} seleccionados
								</span>
							{/if}
						</div>
						<p id="ayuda-esquema-tipo-expediente" class="text-xs text-muted-foreground">
							Elige los tipos documentales que lleva este tipo de expediente. Describen qué se espera de sus expedientes, pero no limitan los
							archivos que reciben.{editando ? ' Cambiarlos no toca los documentos de los expedientes que ya tiene.' : ''}
						</p>
						{#if tiposDocumentalesFallo}
							<p
								class="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm text-destructive"
								role="alert"
								data-testid="esquema-fallo"
							>
								{#if editando}
									No se pudieron cargar los tipos documentales de tu organización: por ahora solo puedes cambiar el nombre. Para editar el esquema,
									cierra esta ventana y vuelve a intentarlo.
								{:else}
									No se pudieron cargar los tipos documentales de tu organización. Cierra esta ventana y vuelve a intentarlo.
								{/if}
							</p>
						{:else if tiposDocumentales.length === 0}
							<p
								class="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground"
								data-testid="esquema-sin-tipos-documentales"
							>
								{#if editando}
									Tu organización ya no tiene tipos documentales en la biblioteca: por ahora solo puedes cambiar el nombre. Para editar el esquema,
									crea tipos documentales primero en la biblioteca, desde el menú del engrane.
								{:else}
									Tu organización todavía no tiene tipos documentales. Créalos primero en la biblioteca de tipos documentales, desde el menú del
									engrane, para poder definir el esquema.
								{/if}
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
							{#if editando && idsDelEsquema.length === 0}
								<p class="text-xs text-muted-foreground" data-testid="esquema-legado">
									Este tipo se creó antes de que el esquema fuera obligatorio: elige al menos un tipo documental para poder guardar los cambios.
								</p>
							{/if}
							{#if fuera > 0}
								<p class="text-xs text-muted-foreground" data-testid="esquema-fuera-biblioteca">
									{#if fuera === 1}
										1 tipo documental de este esquema ya no está disponible en la biblioteca (se eliminó o se archivó): si cambias el esquema, se quitará.
									{:else}
										{fuera} tipos documentales de este esquema ya no están disponibles en la biblioteca (se eliminaron o se archivaron): si cambias el esquema,
										se quitarán.
									{/if}
									{#if actuales.length === 0}
										Ninguno de este esquema sigue en la biblioteca: elige al menos uno para poder guardar los cambios.
									{/if}
								</p>
							{/if}
						{/if}
					</div>

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
