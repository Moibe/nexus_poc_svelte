<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { Button } from '$lib/components/ui/button/index.js';
	import SetupIcon from '$lib/components/icons/SetupIcon.svelte';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FolderClock from '@lucide/svelte/icons/folder-clock';
	import { etiquetaVersion, etiquetaVertical, type TipoDocumentalGuardado } from '$lib/state/configuracion.svelte';
	import { formatearFecha } from '$lib/state/bandeja.svelte';

	let {
		abierto = false,
		tipo,
		onCerrar
	}: {
		abierto?: boolean;
		/** El tipo documental cuyo historial se muestra — el mismo del que se
		 *  abrió el menú `⋮`. `null` no debería pasar en la práctica (el menú
		 *  solo se habilita con historial real, ver ConfigSheet.svelte). */
		tipo: TipoDocumentalGuardado | null;
		onCerrar: () => void;
	} = $props();
</script>

<!--
	Frame de Figma `1077:66342` ("Historial de versiones"), dentro de la sección
	de HU038. Réplica fiel salvo el subtítulo de cada versión: el frame dice
	"{vertical} | Precisión 0%" — la precisión no existe como dato real (mismo
	desajuste ya aceptado para la tarjeta vigente, documentado en
	pendientes-ux.md), así que aquí también se cambia por "{N campos} · {vertical}".
-->
<DialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) onCerrar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/40"
		/>
		<DialogPrimitive.Content
			data-testid="modal-historial-versiones"
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[85vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<DialogPrimitive.Title class="flex-1 text-sm font-normal text-muted-foreground">
					Historial de versiones
				</DialogPrimitive.Title>
				<DialogPrimitive.Close aria-label="Cerrar">
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto p-6">
				<div class="flex items-center gap-3">
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
					>
						<FolderClock class="size-5" />
					</span>
					<div class="min-w-0">
						<h2 class="text-lg font-medium text-foreground">Modelos documentales</h2>
						<DialogPrimitive.Description class="text-sm text-muted-foreground">
							Accede al historial de modelos documentales para revisar versiones anteriores,
							conocer su estado y mantener la trazabilidad de cada configuración.
						</DialogPrimitive.Description>
					</div>
				</div>

				<div class="mt-6 flex flex-col gap-3">
					{#each tipo?.historialVersiones ?? [] as version (version.version)}
						<div
							class="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3"
						>
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
							>
								<SetupIcon class="size-4" />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-medium text-foreground">
									{tipo?.nombre}
								</span>
								<span class="mt-1 block truncate text-xs text-muted-foreground">
									{version.campos.length === 0
										? 'Sin campos configurados'
										: `${version.campos.length} ${version.campos.length === 1 ? 'campo' : 'campos'}`}
									{#if etiquetaVertical(tipo?.vertical ?? '')}
										· {etiquetaVertical(tipo?.vertical ?? '')}
									{/if}
									· v{etiquetaVersion(version.version)} · Publicada el {formatearFecha(
										new Date(version.publicadoEn)
									)}
								</span>
							</span>
							<span
								class="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
							>
								<span class="size-1.5 rounded-full bg-muted-foreground"></span>
								Inactivo
							</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="flex items-center justify-end border-t border-border px-6 py-4">
				<DialogPrimitive.Close>
					{#snippet child({ props })}
						<Button {...props}>Cerrar</Button>
					{/snippet}
				</DialogPrimitive.Close>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
