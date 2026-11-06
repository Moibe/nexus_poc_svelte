<script lang="ts">
	/**
	 * «Nuevo grupo» y «Renombrar grupo» (2026-11-03, decisión de Moibe): el alta de un grupo con su nombre y el cambio de nombre de uno ya creado,
	 * en el mismo modal.
	 *
	 * Un grupo es el nivel de arriba de los expedientes: varios expedientes viven juntos en un grupo, y cada organización lo llama como quiere
	 * (áreas, departamentos, trimestres del año…). Solo tiene un nombre. Se crea ANTES de los expedientes, aquí en Configuración, y al crear un
	 * expediente se elige a cuál pertenece.
	 *
	 * Sin `grupo` el modal da de alta uno. Con `grupo` lo RENOMBRA: viene con el nombre actual y «Guardar cambios» solo se enciende si cambió
	 * de verdad (cambiarle solo las mayúsculas sí cuenta). Los expedientes del grupo ven el nombre nuevo sin tocarlos (guardan el id).
	 *
	 * Mismo molde que «Nuevo expediente» (`ExpedienteModal`), que a su vez salió del «Registro de motivo»: modal centrado de 684 px con
	 * cabecera, título con su ícono, cuerpo con el campo y pie con «Cancelar» y el botón principal.
	 *
	 * El nombre es obligatorio y mide como mucho `MAX_NOMBRE_GRUPO` caracteres. Nexus_back lo vuelve a comprobar, limpia los espacios de más y
	 * no deja repetir un nombre dentro de la organización (sin distinguir mayúsculas; cambiarle solo las mayúsculas al propio nombre sí se
	 * puede): ese caso se dice bajo el campo, sin cerrar el modal. Cualquier otro rechazo (el servidor, la red, un rol que no administra) se
	 * dice sobre el pie.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Layers from '@lucide/svelte/icons/layers';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { MAX_NOMBRE_GRUPO } from '$lib/expedientes/grupos';

	let {
		open = $bindable(false),
		grupo = null,
		alCrear,
		alRenombrar
	}: {
		open?: boolean;
		/** Con un grupo, el modal lo RENOMBRA; sin él (`null`), da de alta uno nuevo. */
		grupo?: { id: string; nombre: string } | null;
		/** El grupo YA se creó y el modal ya se cerró; recibe el nombre con que quedó guardado. */
		alCrear?: (nombre: string) => Promise<void> | void;
		/** El grupo YA se renombró y el modal ya se cerró; recibe cómo se llamaba, cómo se llama y si de verdad cambió. */
		alRenombrar?: (antes: string, despues: string, cambiado: boolean) => Promise<void> | void;
	} = $props();

	let nombre = $state('');
	let enviando = $state(false);
	let error = $state('');
	/** El error es del nombre (uno repetido o uno que no sirve): se pinta bajo el campo; cualquier otro, sobre el pie. */
	let errorEnNombre = $state(false);
	let campo = $state<HTMLInputElement | null>(null);

	const renombrando = $derived(grupo !== null);
	const nombreLimpio = $derived(nombre.trim().replace(/\s+/g, ' '));
	const completo = $derived(nombreLimpio.length > 0 && (grupo === null || nombreLimpio !== grupo.nombre));

	// Cada vez que se abre, el formulario arranca limpio (o con el nombre actual, al renombrar).
	$effect(() => {
		if (!open) return;
		nombre = grupo?.nombre ?? '';
		error = '';
		errorEnNombre = false;
	});

	async function guardar() {
		if (!completo || enviando) return;
		enviando = true;
		error = '';
		errorEnNombre = false;
		const enviado = nombreLimpio;
		const antes = grupo?.nombre ?? '';
		try {
			let r: Response;
			try {
				r = grupo
					? await fetch(`/api/grupos/${encodeURIComponent(grupo.id)}`, {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ nombre: enviado })
						})
					: await fetch('/api/grupos', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ nombre: enviado })
						});
			} catch {
				error = 'No se pudo contactar al servidor. Intenta de nuevo.';
				return;
			}
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error =
					datos?.codigo === 'ya_existe'
						? 'Ya hay un grupo con ese nombre. Elige otro.'
						: (datos?.mensaje ?? (renombrando ? 'No se pudo renombrar el grupo. Intenta de nuevo.' : 'No se pudo crear el grupo. Intenta de nuevo.'));
				// Un nombre repetido (409) o que no sirvió (400) es del campo; lo demás no.
				errorEnNombre = r.status === 409 || r.status === 400;
				return;
			}
			open = false;
			if (grupo) await alRenombrar?.(antes, typeof datos?.grupo?.nombre === 'string' ? datos.grupo.nombre : enviado, datos?.cambiado !== false);
			else await alCrear?.(typeof datos?.nombre === 'string' ? datos.nombre : enviado);
		} finally {
			enviando = false;
		}
	}
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-grupo"
			onOpenAutoFocus={(e) => {
				// Quien abre el alta quiere escribir: el cursor va al nombre y no a la X.
				e.preventDefault();
				campo?.focus();
				campo?.select();
			}}
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<!-- header . navigation -->
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="flex-1 text-sm text-muted-foreground">Configuración / Grupos</p>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
					data-testid="cerrar-grupo"
					onclick={() => (open = false)}
				>
					<CancelSquareIcon />
					<span class="sr-only">Cerrar</span>
				</button>
			</div>

			<!-- header.modal -->
			<div class="flex h-16 shrink-0 items-center gap-3">
				<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
					<Layers class="size-4" />
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg leading-relaxed font-medium text-foreground">
						{renombrando ? 'Renombrar grupo' : 'Nuevo grupo'}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
						{renombrando ? 'Sus expedientes verán el nombre nuevo.' : 'Completa la información requerida.'}
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
						<label for="nombre-grupo" class="text-base font-medium text-foreground">Nombre del grupo *</label>
						<input
							id="nombre-grupo"
							type="text"
							bind:this={campo}
							bind:value={nombre}
							maxlength={MAX_NOMBRE_GRUPO}
							autocomplete="off"
							data-testid="nombre-grupo"
							aria-invalid={errorEnNombre ? 'true' : undefined}
							aria-describedby="ayuda-grupo"
							class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
						/>
						<p id="ayuda-grupo" class="text-xs text-muted-foreground">
							Por ejemplo: «Ventas», «Recursos Humanos» o «T1 2026». Llámalo como llame tu organización a sus áreas, departamentos o periodos; no
							puede haber dos grupos con el mismo nombre.
						</p>
					</div>

					{#if error}
						<p class="text-xs text-destructive" role="alert" data-testid="error-grupo">{error}</p>
					{/if}
				</div>

				<!-- footer.modal -->
				<div class="flex items-center justify-end gap-4 border-t border-border p-2.5">
					<Button type="button" variant="link" class="h-9.5 px-4 text-destructive" data-testid="cancelar-grupo" onclick={() => (open = false)}>
						Cancelar
					</Button>
					<Button type="submit" class="h-9.5 px-4" data-testid="guardar-grupo" disabled={!completo || enviando}>
						{#if renombrando}
							{enviando ? 'Guardando…' : 'Guardar cambios'}
						{:else}
							{enviando ? 'Creando…' : 'Crear grupo'}
						{/if}
					</Button>
				</div>
			</form>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
