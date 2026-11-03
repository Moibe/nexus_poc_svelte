<script lang="ts">
	/**
	 * «Nuevo expediente» (2026-10-24): el alta de un expediente con su nombre.
	 *
	 * Un expediente es la carpeta de un cliente o de un caso, un receptáculo de documentos. Hasta el 2026-10-29 nacía de un tipo de
	 * expediente y aquí se elegía; ese día el tipo pasó a los expedientes VIRTUALES (grupitos de documentos dentro de un expediente), así
	 * que el alta pide solo el nombre. Dos expedientes pueden llamarse igual (un mismo cliente puede tener dos solicitudes), así que aquí
	 * no hay «ya existe».
	 *
	 * Es el mismo molde que «Nuevo tipo de expediente virtual» (`TipoExpedienteModal`, que a su vez salió del «Registro de motivo»):
	 * modal centrado de 684 px con cabecera, título con su ícono, cuerpo con los campos y pie con «Cancelar» y el botón principal.
	 *
	 * Nexus_back vuelve a comprobar todo, limpia los espacios de más del nombre, y rechaza a un rol que no organiza (403): lo que diga se
	 * muestra aquí mismo, sin cerrar el modal.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { MAX_NOMBRE_EXPEDIENTE } from '$lib/expedientes/expedientes';

	let {
		open = $bindable(false),
		alCrear
	}: {
		open?: boolean;
		/** El expediente YA se creó y el modal ya se cerró; recibe el nombre con que quedó guardado. */
		alCrear: (nombre: string) => Promise<void> | void;
	} = $props();

	let nombre = $state('');
	let enviando = $state(false);
	let error = $state('');
	/** El error es del nombre (un 400): solo entonces se pinta el campo. */
	let errorEnNombre = $state(false);
	let campo = $state<HTMLInputElement | null>(null);

	const completo = $derived(nombre.trim().length > 0);

	// Cada vez que se abre, el formulario arranca limpio.
	$effect(() => {
		if (!open) return;
		nombre = '';
		error = '';
		errorEnNombre = false;
	});

	async function crear() {
		if (!completo || enviando) return;
		enviando = true;
		error = '';
		errorEnNombre = false;
		try {
			const r = await fetch('/api/expedientes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre: nombre.trim() })
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo crear el expediente. Intenta de nuevo.';
				// 400: el nombre no sirvió. Lo demás no es de un campo.
				errorEnNombre = r.status === 400;
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
							aria-invalid={errorEnNombre ? 'true' : undefined}
							aria-describedby="ayuda-expediente"
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
						/>
						<p id="ayuda-expediente" class="text-xs text-muted-foreground">
							Por ejemplo: «Juan Pérez» o «Choque del 12 de marzo». Dos expedientes pueden llamarse igual. Los grupos de documentos con
							un tipo (sus expedientes virtuales) se arman después, dentro del expediente.
						</p>
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
