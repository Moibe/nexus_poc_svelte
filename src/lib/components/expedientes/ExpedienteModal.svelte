<script lang="ts">
	/**
	 * «Nuevo expediente» (2026-10-24): el alta de un expediente con su nombre y, desde el 2026-11-03, su GRUPO.
	 *
	 * Un expediente es la carpeta de un cliente o de un caso, un receptáculo de documentos. Hasta el 2026-10-29 nacía de un tipo de
	 * expediente y aquí se elegía; ese día el tipo se fue (pasó a unos «expedientes virtuales» que Moibe quitó el 2026-11-05), así que el
	 * alta pidió solo el nombre. Dos expedientes pueden llamarse igual (un mismo cliente puede tener dos solicitudes), así que aquí
	 * no hay «ya existe».
	 *
	 * **El grupo (2026-11-03, decisión de Moibe).** Varios expedientes viven en un grupo (áreas, departamentos, trimestres… como lo llame cada
	 * organización) y el expediente nace EN uno: se elige aquí, es obligatorio y no se enciende «Crear expediente» sin él. Los grupos se crean
	 * ANTES, en Configuración; sin ninguno no se puede crear un expediente y el modal lo dice, con el camino a Configuración para quien
	 * administra. Si la organización tiene UN solo grupo, ya viene elegido (no hay nada que decidir). El selector va en `z-70` para quedar sobre
	 * el modal.
	 *
	 * Es el mismo molde que el «Registro de motivo»: modal centrado de 684 px con cabecera, título con su ícono, cuerpo con los campos y
	 * pie con «Cancelar» y el botón principal.
	 *
	 * Nexus_back vuelve a comprobar todo, limpia los espacios de más del nombre, y rechaza a un rol que no organiza (403) o un grupo que ya no
	 * existe (404): lo que diga se muestra aquí mismo, sin cerrar el modal.
	 */
	import { untrack } from 'svelte';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { MAX_NOMBRE_EXPEDIENTE } from '$lib/expedientes/expedientes';
	import type { Grupo } from '$lib/expedientes/grupos';

	let {
		open = $bindable(false),
		grupos = [],
		gruposFallo = false,
		puedeCrearGrupo = false,
		grupoInicial = null,
		alCrear
	}: {
		open?: boolean;
		/** Los grupos de la organización, entre los que se elige el del expediente. */
		grupos?: Grupo[];
		/** No se pudieron leer los grupos: el modal lo dice y no deja crear. */
		gruposFallo?: boolean;
		/** Quien mira administra: si no hay grupos, se le ofrece ir a crearlos. */
		puedeCrearGrupo?: boolean;
		/** El grupo que ya viene elegido al abrir (el que filtra el listado, si hay uno); sin él, se elige aquí. */
		grupoInicial?: string | null;
		/** El expediente YA se creó y el modal ya se cerró; recibe el nombre con que quedó guardado y el nombre de su grupo. */
		alCrear: (nombre: string, grupo: string) => Promise<void> | void;
	} = $props();

	let nombre = $state('');
	let grupoId = $state('');
	let enviando = $state(false);
	let error = $state('');
	/** El error es del nombre (un 400): solo entonces se pinta el campo. */
	let errorEnNombre = $state(false);
	let campo = $state<HTMLInputElement | null>(null);

	const grupo = $derived(grupos.find((g) => g.id === grupoId) ?? null);
	const completo = $derived(nombre.trim().length > 0 && grupo !== null);

	// Cada vez que se abre, el formulario arranca limpio. Con un solo grupo, o con el que filtra el listado, ya viene elegido.
	//
	// Depende SOLO de `open` (2026-11-05, Moibe: «si me tardo en guardar se borra»). Antes leía `grupos` aquí mismo, y esa lista viene de
	// `data`, que el layout vuelve a pedir cada 20 s (`invalidateAll`): llegaba como un arreglo nuevo, el efecto corría otra vez y vaciaba
	// el nombre a media escritura. Todo lo que se lee va dentro de `untrack`: con el modal abierto, lo escrito y lo elegido no se tocan
	// aunque la lista cambie.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			nombre = '';
			grupoId = grupos.length === 1 ? grupos[0].id : (grupos.find((g) => g.id === grupoInicial)?.id ?? '');
			error = '';
			errorEnNombre = false;
		});
	});

	async function crear() {
		if (!completo || enviando || !grupo) return;
		enviando = true;
		error = '';
		errorEnNombre = false;
		const elegido = grupo;
		try {
			const r = await fetch('/api/expedientes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre: nombre.trim(), grupoId: elegido.id })
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo crear el expediente. Intenta de nuevo.';
				// 400: el nombre no sirvió. Lo demás no es de un campo.
				errorEnNombre = r.status === 400;
				return;
			}
			open = false;
			await alCrear(typeof datos?.nombre === 'string' ? datos.nombre : nombre.trim(), typeof datos?.grupo?.nombre === 'string' ? datos.grupo.nombre : elegido.nombre);
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

			{#if grupos.length === 0}
				<!-- Sin grupos no hay en cuál crear el expediente: se dice, y a quien administra se le da el camino a Configuración. -->
				<div class="mx-4 my-4 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground" data-testid="expediente-sin-grupos">
					{#if gruposFallo}
						No se pudieron cargar los grupos de tu organización. Recarga la página e intenta de nuevo.
					{:else}
						Tu organización todavía no tiene grupos, y cada expediente se crea dentro de uno (por ejemplo «Ventas» o «T1 2026»).
						{#if puedeCrearGrupo}
							Créalos en <a href="/configuracion/grupos" class="text-primary underline-offset-2 hover:underline" data-testid="ir-a-grupos">Configuración › Grupos</a> y vuelve.
						{:else}
							Quien administra tu organización puede crearlos.
						{/if}
					{/if}
				</div>
				<div class="flex items-center justify-end border-t border-border p-2.5">
					<Button type="button" variant="link" class="h-9.5 px-4" data-testid="cancelar-expediente" onclick={() => (open = false)}>Cerrar</Button>
				</div>
			{:else}
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
								Por ejemplo: «Juan Pérez» o «Choque del 12 de marzo». Dos expedientes pueden llamarse igual.
							</p>
						</div>

						<div class="flex flex-col gap-2">
							<label for="grupo-del-expediente" class="text-base font-medium text-foreground">Grupo *</label>
							<Select.Root type="single" value={grupoId} onValueChange={(valor) => (grupoId = valor)}>
								<Select.Trigger id="grupo-del-expediente" class="h-10 w-full" data-testid="grupo-del-expediente">
									{grupo?.nombre ?? 'Elige un grupo'}
								</Select.Trigger>
								<Select.Content class="z-70">
									{#each grupos as g (g.id)}
										<Select.Item value={g.id} label={g.nombre} data-testid="opcion-grupo" />
									{/each}
								</Select.Content>
							</Select.Root>
							<p class="text-xs text-muted-foreground">
								El grupo en que vive el expediente: tu área, departamento o periodo. Se puede cambiar después.
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
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
