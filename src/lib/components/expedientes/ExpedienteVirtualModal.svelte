<script lang="ts">
	/**
	 * «Nuevo expediente virtual» (2026-10-29, decisión de Moibe): dentro de un expediente, armar un grupito de SUS documentos que sea
	 * instancia de un tipo de expediente virtual, por ejemplo «la solicitud de crédito de Juan Pérez». Se elige el tipo (debajo se ve su
	 * esquema: qué tipos documentales lleva, para saber qué documentos marcar), el nombre (de entrada, el del tipo) y los documentos del
	 * expediente con que nace (pueden ser ninguno: se agregan después).
	 *
	 * Los documentos se eligen A MANO porque todavía no guardan su tipo documental: no hay cómo repartirlos solos según el esquema. El
	 * esquema describe, no restringe.
	 *
	 * Mismo molde que «Nuevo expediente» (`ExpedienteModal`): modal centrado de 684 px con cabecera, título con su ícono, cuerpo y pie con
	 * «Cancelar» y el botón principal. El selector del tipo va en `z-70` para quedar sobre el modal. Sin tipos de expediente virtual en la
	 * organización no se puede crear nada: se dice, y a quien administra se le da el camino a Configuración.
	 *
	 * Nexus_back vuelve a comprobar todo (un documento que no es del expediente, un tipo que ya no existe, un rol que no organiza): lo que
	 * diga se muestra aquí mismo, sin cerrar el modal.
	 */
	import { untrack } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import FolderTree from '@lucide/svelte/icons/folder-tree';

	import ElegirDocumentos from '$lib/components/expedientes/ElegirDocumentos.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { MAX_NOMBRE_EXPEDIENTE, type DocumentoDeExpediente, type ExpedienteVirtual } from '$lib/expedientes/expedientes';
	import type { TipoDeExpediente } from '$lib/expedientes/tipos';

	let {
		open = $bindable(false),
		expediente,
		documentos,
		tipos,
		puedeCrearTipo = false,
		alCrear
	}: {
		open?: boolean;
		/** El expediente dentro del que se crea. */
		expediente: { id: string; nombre: string };
		/** Sus documentos: los únicos que puede tener el expediente virtual. */
		documentos: DocumentoDeExpediente[];
		/** Los tipos de expediente virtual de la organización, con su esquema. */
		tipos: TipoDeExpediente[];
		/** Quien mira administra: si no hay tipos, se le ofrece ir a crearlos. */
		puedeCrearTipo?: boolean;
		/** El virtual YA se creó y el modal ya se cerró. */
		alCrear: (virtual: ExpedienteVirtual) => Promise<void> | void;
	} = $props();

	let tipoId = $state('');
	let nombre = $state('');
	/** El nombre que puso el modal al elegir el tipo: mientras siga así, cambiar de tipo lo cambia también; si la persona lo editó, ya no. */
	let nombreSugerido = $state('');
	let elegidos = $state<string[]>([]);
	let enviando = $state(false);
	let error = $state('');

	const tipo = $derived(tipos.find((t) => t.id === tipoId) ?? null);
	const completo = $derived(tipo !== null && nombre.trim().length > 0);

	// Cada vez que se abre, el formulario arranca limpio; con un solo tipo posible, ya viene elegido. Solo depende de `open` (y de la lista de
	// tipos): todo lo demás va en `untrack`, o elegir un tipo —que cambia el nombre— volvería a correr este efecto y lo borraría todo.
	$effect(() => {
		if (!open) return;
		const unico = tipos.length === 1 ? tipos[0] : null;
		untrack(() => {
			tipoId = unico?.id ?? '';
			nombre = unico?.nombre ?? '';
			nombreSugerido = nombre;
			elegidos = [];
			error = '';
		});
	});

	function elegirTipo(id: string) {
		tipoId = id;
		const nuevo = tipos.find((t) => t.id === id);
		if (nuevo && (nombre.trim() === '' || nombre === nombreSugerido)) {
			nombre = nuevo.nombre;
			nombreSugerido = nuevo.nombre;
		}
	}

	async function crear() {
		if (!completo || enviando) return;
		enviando = true;
		error = '';
		try {
			// En el orden del expediente, no en el que se fueron marcando.
			const ids = documentos.filter((d) => elegidos.includes(d.id)).map((d) => d.id);
			const r = await fetch(`/api/expedientes/${encodeURIComponent(expediente.id)}/virtuales`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tipoId, nombre: nombre.trim(), documentos: ids })
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo crear el expediente virtual. Intenta de nuevo.';
				return;
			}
			open = false;
			await alCrear(datos as ExpedienteVirtual);
		} catch {
			error = 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.';
		} finally {
			enviando = false;
		}
	}
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-expediente-virtual"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">Expedientes / {expediente.nombre}</p>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
					data-testid="cerrar-expediente-virtual"
					onclick={() => (open = false)}
				>
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</button>
			</div>

			<div class="flex h-16 shrink-0 items-center gap-3">
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
					<FolderTree class="size-4" />
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">Nuevo expediente virtual</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
						Un grupo de documentos de este expediente, de un tipo, para usarlo en el motor de reglas.
					</DialogPrimitive.Description>
				</div>
			</div>

			{#if tipos.length === 0}
				<div class="mx-4 my-4 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground" data-testid="virtual-sin-tipos">
					Tu organización todavía no tiene tipos de expediente virtual, por ejemplo «Solicitud de crédito».
					{#if puedeCrearTipo}
						Créalos en <a href="/configuracion/tipos-expediente" class="text-primary underline-offset-2 hover:underline" data-testid="ir-a-tipos-virtuales">Configuración › Tipos de expediente virtual</a> y vuelve.
					{:else}
						Quien administra tu organización puede crearlos.
					{/if}
				</div>
				<div class="flex items-center justify-end border-t border-border p-2.5">
					<Button type="button" variant="link" class="h-9.5 px-4" onclick={() => (open = false)}>Cerrar</Button>
				</div>
			{:else}
				<form
					class="contents"
					onsubmit={(e) => {
						e.preventDefault();
						crear();
					}}
				>
					<div class="flex flex-col gap-5 px-4 py-4">
						<div class="flex flex-col gap-2">
							<label for="tipo-del-virtual" class="text-base font-medium text-foreground">Tipo de expediente virtual *</label>
							<Select.Root type="single" value={tipoId} onValueChange={elegirTipo}>
								<Select.Trigger id="tipo-del-virtual" class="h-10 w-full" data-testid="tipo-del-virtual">
									{tipo?.nombre ?? 'Elige un tipo'}
								</Select.Trigger>
								<Select.Content class="z-70">
									{#each tipos as t (t.id)}
										<Select.Item value={t.id} label={t.nombre} data-testid="opcion-tipo-virtual" />
									{/each}
								</Select.Content>
							</Select.Root>
							{#if tipo}
								<p class="text-xs text-muted-foreground" data-testid="esquema-del-tipo-virtual">
									{#if tipo.tiposDocumentales.length === 0}
										Este tipo no tiene esquema.
									{:else}
										Lleva: {tipo.tiposDocumentales.map((td) => td.nombre ?? 'Tipo documental eliminado').join(', ')}. Marca abajo los documentos que le corresponden.
									{/if}
								</p>
							{/if}
						</div>

						<div class="flex flex-col gap-2">
							<label for="nombre-virtual" class="text-base font-medium text-foreground">Nombre *</label>
							<input
								id="nombre-virtual"
								type="text"
								bind:value={nombre}
								maxlength={MAX_NOMBRE_EXPEDIENTE}
								autocomplete="off"
								data-testid="nombre-virtual"
								class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
							/>
							<p class="text-xs text-muted-foreground">Por ejemplo: «Crédito automotriz». Dos pueden llamarse igual.</p>
						</div>

						<div class="flex flex-col gap-2">
							<span id="etiqueta-documentos-virtual" class="text-base font-medium text-foreground">Documentos</span>
							{#if documentos.length === 0}
								<p class="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground" data-testid="virtual-sin-documentos-para-elegir">
									Este expediente todavía no tiene documentos. Puedes crear el expediente virtual vacío y agregarle documentos cuando el expediente
									los tenga.
								</p>
							{:else}
								<ElegirDocumentos {documentos} bind:elegidos etiquetaId="etiqueta-documentos-virtual" />
							{/if}
						</div>

						{#if error}
							<p class="text-xs text-destructive" role="alert" data-testid="error-expediente-virtual">{error}</p>
						{/if}
					</div>

					<div class="flex items-center justify-end gap-4 border-t border-border p-2.5">
						<Button type="button" variant="link" class="h-9.5 px-4 text-destructive" data-testid="cancelar-expediente-virtual" onclick={() => (open = false)}>
							Cancelar
						</Button>
						<Button type="submit" class="h-9.5 px-4" data-testid="crear-expediente-virtual" disabled={!completo || enviando}>
							{enviando ? 'Creando…' : 'Crear expediente virtual'}
						</Button>
					</div>
				</form>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
