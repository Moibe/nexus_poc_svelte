<script lang="ts">
	/**
	 * «Nuevo tipo de expediente» (2026-10-24): el alta de un tipo con SOLO su nombre.
	 *
	 * Un tipo de expediente es la clase de la que salen los expedientes («Expediente médico», «Expediente de un choque»). Por ahora lo
	 * único que se pide es el nombre; el esquema (los tipos documentales que lo describen) se agrega después.
	 *
	 * Es un modal centrado de 684 px con el molde del «Registro de motivo» (`MotivoModal`): `Dialog` de bits-ui en un portal, cabecera con
	 * su migaja y la X, título con su ícono, cuerpo con el campo y pie con «Cancelar» y el botón principal. NO salió de un frame de
	 * Figma: se agotó la cuota de lectura del archivo y el Sprint 5 no se pudo abrir, así que si el diseño trae otra cosa, hay que
	 * ajustar esto contra él.
	 *
	 * El nombre es obligatorio y mide como mucho `MAX_NOMBRE_TIPO` caracteres. Nexus_back lo vuelve a comprobar, limpia los espacios de más
	 * y no deja repetir un nombre dentro de la organización (sin distinguir mayúsculas): ese caso se dice aquí mismo, sin cerrar el modal.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { MAX_NOMBRE_TIPO } from '$lib/expedientes/tipos';

	let {
		open = $bindable(false),
		alCrear
	}: {
		open?: boolean;
		/** El tipo YA se creó y el modal ya se cerró; recibe el nombre con que quedó guardado. */
		alCrear: (nombre: string) => Promise<void> | void;
	} = $props();

	let nombre = $state('');
	let enviando = $state(false);
	let error = $state('');
	let campo = $state<HTMLInputElement | null>(null);

	const completo = $derived(nombre.trim().length > 0);

	// Cada vez que se abre, el formulario arranca limpio.
	$effect(() => {
		if (!open) return;
		nombre = '';
		error = '';
	});

	async function crear() {
		if (!completo || enviando) return;
		enviando = true;
		error = '';
		try {
			const r = await fetch('/api/tipos-expediente', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre: nombre.trim() })
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error =
					datos?.codigo === 'ya_existe'
						? 'Ya existe un tipo de expediente con ese nombre.'
						: (datos?.mensaje ?? 'No se pudo crear el tipo de expediente. Intenta de nuevo.');
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
			data-testid="modal-tipo-expediente"
			onOpenAutoFocus={(e) => {
				// Quien abre el alta quiere escribir: el cursor va al campo y no a la X.
				e.preventDefault();
				campo?.focus();
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
					<FolderPlus class="size-4" />
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">Nuevo tipo de expediente</DialogPrimitive.Title>
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
				<div class="flex flex-col gap-2 px-4 py-4">
					<label for="nombre-tipo-expediente" class="text-base font-medium text-foreground">Nombre del tipo de expediente *</label>
					<input
						id="nombre-tipo-expediente"
						type="text"
						bind:this={campo}
						bind:value={nombre}
						maxlength={MAX_NOMBRE_TIPO}
						autocomplete="off"
						data-testid="nombre-tipo-expediente"
						aria-invalid={error ? 'true' : undefined}
						aria-describedby="ayuda-tipo-expediente"
						class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
					/>
					<p id="ayuda-tipo-expediente" class="text-xs text-muted-foreground">
						Por ejemplo: «Expediente médico» o «Expediente de un choque». Cada expediente que crees después será una instancia de un tipo.
					</p>
					{#if error}
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
					<Button type="submit" class="h-9.5 px-4" data-testid="crear-tipo-expediente" disabled={!completo || enviando}>
						{enviando ? 'Creando…' : 'Crear tipo de expediente'}
					</Button>
				</div>
			</form>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
