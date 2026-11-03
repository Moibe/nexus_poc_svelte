<script lang="ts">
	/**
	 * «Asignar grupo» y «Cambiar grupo» (2026-11-03, decisión de Moibe: «lo que no tienen grupo que se les pueda añadir después»): mete un
	 * expediente a un grupo o lo pasa a otro, desde el detalle del expediente.
	 *
	 * Los expedientes anteriores a los grupos no tienen uno y salen como «Sin grupo»; aquí se les asigna. Uno que ya lo tiene se puede pasar a
	 * otro, pero NO se puede dejar sin grupo (por eso no hay una opción «Sin grupo»): un expediente que tuvo grupo siempre tiene uno.
	 *
	 * «Guardar» solo se enciende si el grupo elegido es otro que el actual. Sin grupos en la organización no hay a dónde mandarlo: se dice, con el
	 * camino a Configuración para quien administra. Mismo molde que «Nuevo expediente» (`ExpedienteModal`); el selector va en `z-70` para quedar
	 * sobre el modal. Nexus_back vuelve a comprobar todo (un grupo que ya no existe, un rol que no organiza): lo que diga se muestra aquí mismo.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Layers from '@lucide/svelte/icons/layers';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { Grupo, GrupoDeExpediente } from '$lib/expedientes/grupos';

	let {
		open = $bindable(false),
		expediente,
		grupos = [],
		gruposFallo = false,
		puedeCrearGrupo = false,
		alAsignar
	}: {
		open?: boolean;
		/** El expediente y el grupo en que está ahora (`null`: todavía no tiene). */
		expediente: { id: string; nombre: string; grupo?: GrupoDeExpediente | null };
		/** Los grupos de la organización, entre los que se elige. */
		grupos?: Grupo[];
		/** No se pudieron leer los grupos: el modal lo dice y no deja guardar. */
		gruposFallo?: boolean;
		/** Quien mira administra: si no hay grupos, se le ofrece ir a crearlos. */
		puedeCrearGrupo?: boolean;
		/** El grupo YA se asignó y el modal ya se cerró; recibe el nombre del grupo y si cambió algo de verdad. */
		alAsignar: (grupo: string, cambiado: boolean) => Promise<void> | void;
	} = $props();

	let grupoId = $state('');
	let enviando = $state(false);
	let error = $state('');

	const actual = $derived(expediente.grupo ?? null);
	const elegido = $derived(grupos.find((g) => g.id === grupoId) ?? null);
	const cambiando = $derived(actual !== null);
	const completo = $derived(elegido !== null && elegido.id !== actual?.id);

	// Cada vez que se abre, arranca con el grupo actual elegido (o ninguno, si todavía no tiene).
	$effect(() => {
		if (!open) return;
		grupoId = grupos.some((g) => g.id === expediente.grupo?.id) ? (expediente.grupo?.id ?? '') : '';
		error = '';
	});

	async function guardar() {
		if (!completo || enviando || !elegido) return;
		enviando = true;
		error = '';
		const destino = elegido;
		try {
			let r: Response;
			try {
				r = await fetch(`/api/expedientes/${encodeURIComponent(expediente.id)}/grupo`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ grupoId: destino.id })
				});
			} catch {
				error = 'No se pudo contactar al servidor. Intenta de nuevo.';
				return;
			}
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo asignar el grupo. Intenta de nuevo.';
				return;
			}
			open = false;
			await alAsignar(typeof datos?.expediente?.grupo?.nombre === 'string' ? datos.expediente.grupo.nombre : destino.nombre, datos?.cambiado !== false);
		} finally {
			enviando = false;
		}
	}
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-asignar-grupo"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[92vh] w-[92vw] max-w-171 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
		>
			<!-- header . navigation -->
			<div class="flex h-10 shrink-0 items-center gap-3 border-b border-border">
				<p class="min-w-0 flex-1 truncate text-sm text-muted-foreground">Expediente / {expediente.nombre}</p>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
					data-testid="cerrar-asignar-grupo"
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
						{cambiando ? 'Cambiar de grupo' : 'Asignar grupo'}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-xs leading-relaxed text-muted-foreground">
						{cambiando ? `Ahora está en «${actual?.nombre}».` : 'Este expediente todavía no pertenece a ningún grupo.'}
					</DialogPrimitive.Description>
				</div>
			</div>

			{#if grupos.length === 0}
				<div class="mx-4 my-4 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground" data-testid="asignar-sin-grupos">
					{#if gruposFallo}
						No se pudieron cargar los grupos de tu organización. Recarga la página e intenta de nuevo.
					{:else}
						Tu organización todavía no tiene grupos.
						{#if puedeCrearGrupo}
							Créalos en <a href="/configuracion/grupos" class="text-primary underline-offset-2 hover:underline" data-testid="ir-a-grupos">Configuración › Grupos</a> y vuelve.
						{:else}
							Quien administra tu organización puede crearlos.
						{/if}
					{/if}
				</div>
				<div class="flex items-center justify-end border-t border-border p-2.5">
					<Button type="button" variant="link" class="h-9.5 px-4" data-testid="cancelar-asignar-grupo" onclick={() => (open = false)}>Cerrar</Button>
				</div>
			{:else}
				<form
					class="contents"
					onsubmit={(e) => {
						e.preventDefault();
						guardar();
					}}
				>
					<div class="flex flex-col gap-5 px-4 py-4">
						<div class="flex flex-col gap-2">
							<label for="grupo-a-asignar" class="text-base font-medium text-foreground">Grupo *</label>
							<Select.Root type="single" value={grupoId} onValueChange={(valor) => (grupoId = valor)}>
								<Select.Trigger id="grupo-a-asignar" class="h-10 w-full" data-testid="grupo-a-asignar">
									{elegido?.nombre ?? 'Elige un grupo'}
								</Select.Trigger>
								<Select.Content class="z-70">
									{#each grupos as g (g.id)}
										<Select.Item value={g.id} label={g.nombre} data-testid="opcion-grupo" />
									{/each}
								</Select.Content>
							</Select.Root>
							<p class="text-xs text-muted-foreground">
								Un expediente siempre pertenece a un grupo: se puede pasar a otro, pero no dejar sin grupo.
							</p>
						</div>

						{#if error}
							<p class="text-xs text-destructive" role="alert" data-testid="error-asignar-grupo">{error}</p>
						{/if}
					</div>

					<div class="flex items-center justify-end gap-4 border-t border-border p-2.5">
						<Button type="button" variant="link" class="h-9.5 px-4 text-destructive" data-testid="cancelar-asignar-grupo" onclick={() => (open = false)}>
							Cancelar
						</Button>
						<Button type="submit" class="h-9.5 px-4" data-testid="guardar-asignar-grupo" disabled={!completo || enviando}>
							{enviando ? 'Guardando…' : cambiando ? 'Cambiar de grupo' : 'Asignar grupo'}
						</Button>
					</div>
				</form>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
