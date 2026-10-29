<script lang="ts">
	/**
	 * «Nuevo expediente» (2026-10-24): el alta de un expediente con su nombre y el tipo del que es instancia.
	 *
	 * Un expediente es la carpeta de UN caso (un paciente, un choque) y nace de un tipo de expediente de su organización: el tipo es
	 * obligatorio, y si la organización solo tiene uno, ya viene elegido. Dos expedientes pueden llamarse igual (un mismo cliente puede
	 * tener dos solicitudes), así que aquí no hay «ya existe».
	 *
	 * Es el mismo molde que «Nuevo tipo de expediente» (`TipoExpedienteModal`, que a su vez salió del «Registro de motivo»): modal
	 * centrado de 684 px con cabecera, título con su ícono, cuerpo con los campos y pie con «Cancelar» y el botón principal. El selector
	 * del tipo va en una capa MÁS ALTA que el modal (`z-70`): el contenido del selector sale por defecto en `z-50` y quedaría detrás.
	 *
	 * Nexus_back vuelve a comprobar todo, limpia los espacios de más del nombre, y rechaza un tipo que no sea de la organización (404)
	 * o a un rol que no organiza (403): lo que diga se muestra aquí mismo, sin cerrar el modal.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { MAX_NOMBRE_EXPEDIENTE } from '$lib/expedientes/expedientes';

	let {
		open = $bindable(false),
		tipos,
		alCrear
	}: {
		open?: boolean;
		/** Los tipos de expediente de la organización: de ahí se elige el del nuevo expediente. */
		tipos: { id: string; nombre: string }[];
		/** El expediente YA se creó y el modal ya se cerró; recibe el nombre con que quedó guardado. */
		alCrear: (nombre: string) => Promise<void> | void;
	} = $props();

	let nombre = $state('');
	let tipoId = $state('');
	let enviando = $state(false);
	let error = $state('');
	/** A qué campo se refiere el error, para pintar SOLO ese: un tipo que no existe no es culpa del nombre. */
	let campoConError = $state<'nombre' | 'tipo' | null>(null);
	let campo = $state<HTMLInputElement | null>(null);

	const elegido = $derived(tipos.find((t) => t.id === tipoId) ?? null);
	const completo = $derived(nombre.trim().length > 0 && elegido !== null);

	// Cada vez que se abre, el formulario arranca limpio; con un solo tipo posible, ya viene elegido.
	$effect(() => {
		if (!open) return;
		nombre = '';
		tipoId = tipos.length === 1 ? tipos[0].id : '';
		error = '';
		campoConError = null;
	});

	async function crear() {
		if (!completo || enviando) return;
		enviando = true;
		error = '';
		campoConError = null;
		try {
			const r = await fetch('/api/expedientes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre: nombre.trim(), tipoId })
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo crear el expediente. Intenta de nuevo.';
				// 400: el nombre no sirvió; 404: el tipo no existe (o no es de esta organización). Lo demás no es de un campo.
				campoConError = r.status === 400 ? 'nombre' : r.status === 404 ? 'tipo' : null;
				return;
			}
			open = false;
			await alCrear(typeof datos?.nombre === 'string' ? datos.nombre : nombre.trim());
		} finally {
			enviando = false;
		}
	}
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-expediente"
			onOpenAutoFocus={(e) => {
				// Quien abre el alta quiere escribir: el cursor va al nombre y no a la X.
				e.preventDefault();
				campo?.focus();
			}}
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<!-- header . navigation -->
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="flex-1 text-sm text-muted-foreground">Expediente / Expedientes</p>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
					data-testid="cerrar-expediente"
					onclick={() => (open = false)}
				>
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</button>
			</div>

			<!-- header.modal -->
			<div class="flex h-16 shrink-0 items-center gap-3">
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
					<FolderPlus class="size-4" />
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">Nuevo expediente</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
						Completa la información requerida.
					</DialogPrimitive.Description>
				</div>
			</div>

			<form
				class="contents"
				onsubmit={(e) => {
					e.preventDefault();
					crear();
				}}
			>
				<!-- body.modal -->
				<div class="flex flex-col gap-5 px-4 py-4">
					<div class="flex flex-col gap-2">
						<label for="nombre-expediente" class="text-base font-medium text-foreground">Nombre del expediente *</label>
						<input
							id="nombre-expediente"
							type="text"
							bind:this={campo}
							bind:value={nombre}
							maxlength={MAX_NOMBRE_EXPEDIENTE}
							autocomplete="off"
							data-testid="nombre-expediente"
							aria-invalid={campoConError === 'nombre' ? 'true' : undefined}
							aria-describedby="ayuda-expediente"
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
						/>
						<p id="ayuda-expediente" class="text-xs text-muted-foreground">
							Por ejemplo: «Juan Pérez» o «Choque del 12 de marzo». Dos expedientes pueden llamarse igual.
						</p>
					</div>

					<div class="flex flex-col gap-2">
						<label for="tipo-del-expediente" class="text-base font-medium text-foreground">Tipo de expediente *</label>
						<Select.Root type="single" bind:value={tipoId}>
							<Select.Trigger
								id="tipo-del-expediente"
								class="h-10 w-full"
								data-testid="tipo-del-expediente"
								aria-invalid={campoConError === 'tipo' ? 'true' : undefined}
							>
								{elegido?.nombre ?? 'Elige un tipo de expediente'}
							</Select.Trigger>
							<Select.Content class="z-70">
								{#each tipos as tipo (tipo.id)}
									<Select.Item value={tipo.id} label={tipo.nombre} data-testid="tipo-{tipo.id}" />
								{/each}
							</Select.Content>
						</Select.Root>
						<p class="text-xs text-muted-foreground">Cada expediente es una instancia de un tipo: el tipo es la clase y el expediente, el caso.</p>
					</div>

					{#if error}
						<p class="text-xs text-destructive" role="alert" data-testid="error-expediente">{error}</p>
					{/if}
				</div>

				<!-- footer.modal -->
				<div class="flex items-center justify-end gap-4 border-t border-border p-2.5">
					<Button type="button" variant="link" class="h-9.5 px-4 text-destructive" data-testid="cancelar-expediente" onclick={() => (open = false)}>
						Cancelar
					</Button>
					<Button type="submit" class="h-9.5 px-4" data-testid="crear-expediente" disabled={!completo || enviando}>
						{enviando ? 'Creando…' : 'Crear expediente'}
					</Button>
				</div>
			</form>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
