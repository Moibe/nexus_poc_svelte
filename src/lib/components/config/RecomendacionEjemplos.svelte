<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { Button } from '$lib/components/ui/button/index.js';
	import Power from '@lucide/svelte/icons/power';

	let {
		abierto = false,
		onAgregarMas,
		onContinuar,
		onCerrar
	}: {
		abierto?: boolean;
		/** "Agregar más ejemplos": cierra este aviso y lleva a Calibración —
		 *  NO activa el switch. */
		onAgregarMas: () => void;
		/** "Continuar con la activación": cierra este aviso Y activa el switch,
		 *  a pesar de no llegar a los 3 ejemplos recomendados. */
		onContinuar: () => void;
		/** Escape / clic fuera: solo cierra, sin activar el switch ni navegar —
		 *  es una recomendación, no una confirmación que exija una respuesta. */
		onCerrar: () => void;
	} = $props();
</script>

<!--
	Aviso — no `ConfirmarAccion`: esa es para acciones DESTRUCTIVAS (AlertDialog,
	sin clic fuera). Esto es una recomendación blanda antes de marcar "estoy
	listo" con pocos ejemplos, así que es un `Dialog` normal — Escape y el clic
	fuera sí lo cierran, sin forzar ninguna de las dos respuestas.

	Layout centrado (ícono, título, cuerpo, pregunta, botones) en vez del
	molde usual de `ConfirmarAccion` (ícono + texto en fila) porque así lo
	trae el mockup compartido — visualmente distinto a propósito.
-->
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
			data-testid="recomendacion-ejemplos"
			class="fixed top-1/2 left-1/2 z-60 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-8 text-center shadow-lg"
		>
			<span
				class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
			>
				<Power class="size-6" />
			</span>
			<DialogPrimitive.Title class="mt-5 text-lg font-bold text-foreground">
				Recomendación antes de activar
			</DialogPrimitive.Title>
			<DialogPrimitive.Description class="mt-3 text-sm text-muted-foreground">
				Se recomienda contar con al menos 3 ejemplos de referencia antes de activar esta
				versión. Esto ayudará a obtener mejores resultados durante la extracción automática de
				información.
			</DialogPrimitive.Description>
			<p class="mt-4 text-sm font-semibold text-foreground">¿Deseas continuar?</p>

			<div class="mt-6 flex items-center justify-center gap-6">
				<Button variant="link" class="h-auto p-0" onclick={onAgregarMas}>
					Agregar más ejemplos
				</Button>
				<Button onclick={onContinuar}>Continuar con la activación</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
