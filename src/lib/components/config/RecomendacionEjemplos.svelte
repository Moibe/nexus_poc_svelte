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

	Medidas y tipografía tomadas del frame real de Figma (2026-09-04, vía MCP:
	fileKey mlkIvCeeHsjHqKAMhWW5CP, node 1294:58486, "HU001 | 16" — confirmado
	que es este mismo aviso comparando su captura). Los colores literales del
	frame (`#55bfe7` de acento, `#e4f3fc` del ícono) NO se copiaron tal cual:
	son de una paleta vieja que ya no corresponde al azul real de la app
	(`--primary: #4268fb`) — se usan los tokens propios (`bg-primary`,
	`text-foreground`, `text-muted-foreground`) en su lugar, que además
	resultaron ser un match EXACTO para el gris de título (#1f2937) y el de
	cuerpo (#6b7280) del frame. Lo que sí se copió literal: el padding (24px),
	los espaciados (32px entre bloques, 16px entre título/cuerpo/pregunta), el
	radio (12px del contenedor, 8px del ícono), los tamaños de fuente (24px el
	título, 16px cuerpo y pregunta), la sombra de dos capas, y que los botones
	van alineados a la DERECHA (`justify-end`), no centrados. Layout en
	columna (ícono, bloque de texto, botones) distinto a propósito del molde
	usual de `ConfirmarAccion` (ícono + texto en fila): así lo trae el frame.
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
			class="fixed top-1/2 left-1/2 z-60 flex w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-8 rounded-xl border-2 border-border bg-background p-6 shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
		>
			<span class="flex items-center justify-center rounded-lg bg-primary/10 p-2.5 text-primary">
				<Power class="size-6" />
			</span>

			<div class="flex w-full flex-col gap-4 text-center">
				<DialogPrimitive.Title class="text-2xl font-bold text-foreground">
					Recomendación antes de activar
				</DialogPrimitive.Title>
				<DialogPrimitive.Description class="text-base text-muted-foreground">
					Se recomienda contar con al menos 3 ejemplos de referencia antes de activar esta
					versión. Esto ayudará a obtener mejores resultados durante la extracción automática de
					información.
				</DialogPrimitive.Description>
				<p class="text-base font-semibold text-foreground">¿Deseas continuar?</p>
			</div>

			<div class="flex w-full items-center justify-end gap-4">
				<Button variant="ghost" size="lg" class="text-primary hover:bg-primary/10 hover:text-primary" onclick={onAgregarMas}>
					Agregar más ejemplos
				</Button>
				<Button size="lg" onclick={onContinuar}>Continuar con la activación</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
