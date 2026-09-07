<script lang="ts">
	/**
	 * "Generar prompts de configuración" — se abre desde el botón "Generar
	 * prompt" de la tarjeta de un tipo documental ACTIVO.
	 *
	 * Sin frame de Figma en el volcado: se construyó desde la captura que
	 * compartió el usuario el 2026-09-06 (rotulada "HU001 | 42"), así que el
	 * detalle fino (tipografía y espaciado exactos) queda pendiente de una
	 * pasada si aparece el link. Estructura y textos SÍ son los de la captura.
	 *
	 * Es un `Dialog` normal y no `ConfirmarAccion`: eso último es para acciones
	 * destructivas (AlertDialog, sin clic fuera). Aquí no se destruye nada, así
	 * que Escape y el clic fuera cierran sin exigir una respuesta.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import CodeXml from '@lucide/svelte/icons/code-xml';

	import { Button } from '$lib/components/ui/button/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	/** Rango que anuncia el propio texto del modal ("entre 3 y 5"), y que por lo
	 *  mismo NO puede divergir de él: si algún día cambia, cambian los dos. */
	const MINIMO = 3;
	const MAXIMO = 5;

	let {
		abierto = false,
		onCerrar,
		onGenerar
	}: {
		abierto?: boolean;
		onCerrar: () => void;
		/** Recibe la cantidad elegida. Opcional a propósito: hoy no hay nada
		 *  detrás (generar prompts no existe como concepto en el back), y este es
		 *  el punto exacto donde se cablea cuando exista. */
		onGenerar?: (cantidad: number) => void;
	} = $props();

	let cantidad = $state(MINIMO);

	// Al reabrir, siempre arranca en el default. Sin esto, el modal recordaría
	// la última cantidad elegida de una sesión anterior del diálogo, que es un
	// estado que nadie pidió conservar.
	$effect(() => {
		if (abierto) cantidad = MINIMO;
	});

	/**
	 * `min`/`max` de un `<input type="number">` NO impiden teclear fuera de
	 * rango (solo limitan las flechas y la validación de formulario), así que
	 * el acotado se hace en código. Un valor vacío o no numérico vuelve al
	 * mínimo en vez de quedar en `NaN`.
	 */
	function alEscribir(evento: Event) {
		const crudo = (evento.currentTarget as HTMLInputElement).value;
		const numero = Number.parseInt(crudo, 10);
		cantidad = Number.isNaN(numero) ? MINIMO : Math.min(MAXIMO, Math.max(MINIMO, numero));
	}
</script>

<DialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) onCerrar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10"
		/>
		<DialogPrimitive.Content
			data-testid="modal-generar-prompts"
			class="fixed top-1/2 left-1/2 z-60 flex w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<span class="min-w-0 flex-1 text-sm text-muted-foreground">Generación de prompt</span>
				<DialogPrimitive.Close aria-label="Cerrar" onclick={onCerrar}>
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="flex flex-col gap-6 px-6 py-5">
				<div class="flex items-start gap-4">
					<span
						class="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5 text-primary"
					>
						<CodeXml class="size-6" />
					</span>
					<div class="min-w-0 flex-1">
						<DialogPrimitive.Title class="text-xl font-bold text-foreground">
							Generar prompts de configuración
						</DialogPrimitive.Title>
						<DialogPrimitive.Description class="mt-1 text-sm text-muted-foreground">
							Completa la información requerida.
						</DialogPrimitive.Description>
					</div>
				</div>

				<p class="text-sm text-muted-foreground">
					Selecciona cuántos prompts deseas generar para este proceso. Puedes configurar entre
					{MINIMO} y {MAXIMO} prompts para obtener una configuración adecuada del tipo documental.
				</p>

				<div class="flex flex-col gap-2">
					<Label for="cantidad-prompts">Cantidad de prompts *</Label>
					<Input
						id="cantidad-prompts"
						data-testid="cantidad-prompts"
						type="number"
						min={MINIMO}
						max={MAXIMO}
						value={cantidad}
						oninput={alEscribir}
					/>
				</div>
			</div>

			<div class="flex items-center justify-end border-t border-border px-6 py-4">
				<Button
					size="lg"
					data-testid="boton-generar-prompts"
					onclick={() => onGenerar?.(cantidad)}
				>
					Generar prompts
				</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
