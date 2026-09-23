<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { Button } from '$lib/components/ui/button/index.js';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Info from '@lucide/svelte/icons/info';

	let {
		abierto = false,
		titulo,
		mensaje,
		etiquetaConfirmar = 'Quitar',
		etiquetaCancelar = 'Cancelar',
		variante = 'destructivo',
		soloAviso = false,
		onConfirmar,
		onCerrar
	}: {
		abierto?: boolean;
		titulo: string;
		mensaje: string;
		etiquetaConfirmar?: string;
		etiquetaCancelar?: string;
		/** `destructivo` (default) es lo de siempre: algo se pierde y no vuelve.
		 *  `neutral` es para confirmar algo reversible o que no destruye nada
		 *  (p. ej. archivar) — mismo diálogo, sin el rojo ni el triángulo de
		 *  alerta que prometerían una gravedad que esa acción no tiene. */
		variante?: 'destructivo' | 'neutral';
		/** `true` esconde el botón de cancelar y deja solo el de aceptar: el
		 *  diálogo pasa de preguntar a AVISAR. Es para lo que el navegador
		 *  resolvería con `alert()`, que no se usa en este proyecto. No hay
		 *  nada que cancelar cuando el hecho ya ocurrió (p. ej. "no se pudo
		 *  guardar"), y ofrecer "Cancelar" ahí sugiere una salida que no
		 *  existe. Se extiende este componente en vez de escribir otro para
		 *  que los avisos y las confirmaciones se vean como la misma familia. */
		soloAviso?: boolean;
		onConfirmar: () => void;
		/** Se llama al cerrar por CUALQUIER vía —Cancelar, Escape o confirmar—
		 *  para que quien lo usa limpie el estado que lo abrió. Sin esto, `abierto`
		 *  siendo una expresión derivada (`algo !== null`) nunca se enteraría del
		 *  cierre y el diálogo quedaría atascado abierto. */
		onCerrar: () => void;
	} = $props();
</script>

<!--
	Confirmación para acciones que destruyen algo. Sustituye al `confirm()` del
	navegador, que además de verse ajeno bloquea el hilo y no es estilizable.

	Es `AlertDialog` y no `Dialog`: bits-ui le da `role="alertdialog"`, que un
	lector de pantalla anuncia como una interrupción que exige respuesta, y
	—clave aquí— NO se cierra con un clic fuera. Una acción destructiva no debe
	poder resolverse por accidente; solo con Cancelar, con Escape o confirmando.

	El z-70 es a propósito, y es MÁS ALTO que el z-60 del resto de los modales.
	Un alertdialog siempre va encima de todo: o exige una respuesta o avisa de
	algo que ya pasó, y en los dos casos quedar detrás lo vuelve inútil. Empezó
	en z-60 —suficiente para ganarle al Sheet, que va en z-50— y se subió el
	2026-09-22, cuando el aviso de "no se pudo guardar" apareció DETRÁS del
	modal de cargar ejemplo documental, que también es z-60: se veía, pero el
	clic no le llegaba.

	El diseño copia el molde de la casa: el overlay del Sheet
	(`bg-black/10` + `backdrop-blur-xs`), el redondeo de las tarjetas
	(`rounded-xl border-border`) y los mismos `Button` de siempre — el de
	confirmar en su variante `destructive`, que ya existe en el sistema.
-->
<AlertDialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) onCerrar();
	}}
>
	<AlertDialogPrimitive.Portal>
		<AlertDialogPrimitive.Overlay
			class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-70 bg-black/10"
		/>
		<AlertDialogPrimitive.Content
			data-testid="confirmar-accion"
			class="fixed top-1/2 left-1/2 z-70 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background px-6 pt-8 pb-6 shadow-lg"
		>
			<div class="flex items-start gap-3">
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-full {variante ===
					'destructivo'
						? 'bg-destructive/10 text-destructive'
						: 'bg-primary/10 text-primary'}"
				>
					{#if variante === 'destructivo'}
						<TriangleAlert class="size-4.5" />
					{:else}
						<Info class="size-4.5" />
					{/if}
				</span>
				<div class="min-w-0 flex-1">
					<AlertDialogPrimitive.Title class="text-sm font-semibold text-foreground">
						{titulo}
					</AlertDialogPrimitive.Title>
					<AlertDialogPrimitive.Description class="mt-1 text-xs text-muted-foreground">
						{mensaje}
					</AlertDialogPrimitive.Description>
				</div>
			</div>

			<!-- Cancelar a la izquierda del destructivo y con el foco inicial: si
			     alguien llega aquí por inercia y pica Enter, no destruye nada. -->
			<div class="mt-6 flex justify-end gap-3">
				{#if !soloAviso}
					<AlertDialogPrimitive.Cancel>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="sm" data-testid="confirmar-cancelar">
								{etiquetaCancelar}
							</Button>
						{/snippet}
					</AlertDialogPrimitive.Cancel>
				{/if}
				<AlertDialogPrimitive.Action onclick={onConfirmar}>
					{#snippet child({ props })}
						<Button
							{...props}
							variant={variante === 'destructivo' ? 'destructive' : 'default'}
							size="sm"
							data-testid="confirmar-aceptar"
						>
							{etiquetaConfirmar}
						</Button>
					{/snippet}
				</AlertDialogPrimitive.Action>
			</div>
		</AlertDialogPrimitive.Content>
	</AlertDialogPrimitive.Portal>
</AlertDialogPrimitive.Root>
