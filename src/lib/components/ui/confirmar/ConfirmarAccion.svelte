<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Info from '@lucide/svelte/icons/info';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		abierto = false,
		titulo,
		mensaje,
		etiquetaConfirmar = 'Quitar',
		etiquetaCancelar = 'Cancelar',
		variante = 'destructivo',
		soloAviso = false,
		formato = 'compacto',
		pregunta,
		children,
		onConfirmar,
		onCancelar,
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
		/** `compacto` (default) es el diálogo de siempre: ícono a la izquierda del texto y los botones a la derecha.
		 *  `centrado` es el del diseño de «Estás por salir del registro» (Figma HU001 | 16): ícono de bote de basura
		 *  arriba y al centro, título grande, el mensaje en líneas centradas, la `pregunta` en negritas, y los botones
		 *  a la derecha —la salida destructiva como enlace rojo a la izquierda y la de «seguir» como botón azul
		 *  grande a la derecha—. Los saltos de línea del `mensaje` se respetan. */
		formato?: 'compacto' | 'centrado';
		/** Solo con `formato="centrado"`: la pregunta final, en negritas y separada del mensaje. */
		pregunta?: string;
		/** Contenido extra bajo el mensaje (p. ej. un campo de motivo). Quien lo pinta guarda su propio estado. */
		children?: Snippet;
		onConfirmar: () => void;
		/** Se llama cuando se cierra SIN confirmar (Cancelar o Escape), justo antes de `onCerrar`. Para quien tiene que
		 *  distinguir «no» de «ya terminó». */
		onCancelar?: () => void;
		/** Se llama al cerrar por CUALQUIER vía —Cancelar, Escape o confirmar—
		 *  para que quien lo usa limpie el estado que lo abrió. Sin esto, `abierto`
		 *  siendo una expresión derivada (`algo !== null`) nunca se enteraría del
		 *  cierre y el diálogo quedaría atascado abierto. */
		onCerrar: () => void;
	} = $props();

	/** Confirmar NO dispara el `onOpenChange` de bits-ui: `abierto` entra como
	 *  prop de una vía, así que el componente nunca se entera de que se cerró.
	 *  Hasta el 2026-10-09 cada pantalla tapaba ese hueco por su cuenta
	 *  limpiando también dentro de `onConfirmar`; a la de "Nueva organización"
	 *  se le olvidó y el diálogo de salir del registro se quedaba pegado en
	 *  pantalla con el panel ya cerrado detrás. Se arregla aquí, una vez, para
	 *  que `onCerrar` cumpla lo que promete y nadie más caiga en lo mismo. */
	let cerrandoPorConfirmar = $state(false);

	$effect(() => {
		if (abierto) cerrandoPorConfirmar = false;
	});

	function confirmar() {
		cerrandoPorConfirmar = true;
		onConfirmar();
		onCerrar();
	}
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
		// Si bits-ui llegara a avisar también al confirmar, no se avisa doble.
		if (!v && !cerrandoPorConfirmar) {
			onCancelar?.();
			onCerrar();
		}
	}}
>
	<AlertDialogPrimitive.Portal>
		<AlertDialogPrimitive.Overlay
			class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-70 bg-black/10"
		/>
		<AlertDialogPrimitive.Content
			data-testid="confirmar-accion"
			class="fixed top-1/2 left-1/2 z-70 w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-lg {formato ===
			'centrado'
				? 'max-w-2xl px-10 pt-10 pb-8'
				: 'max-w-md px-6 pt-8 pb-6'}"
		>
			{#if formato === 'centrado'}
				<!-- El molde del Figma («Estás por salir del registro», HU001 | 16): todo centrado salvo los botones. -->
				<div class="flex flex-col items-center text-center">
					<span
						data-testid="confirmar-icono"
						class="flex size-15 shrink-0 items-center justify-center rounded-xl {variante === 'destructivo'
							? 'bg-destructive/10 text-destructive'
							: 'bg-primary/10 text-primary'}"
					>
						{#if variante === 'destructivo'}
							<Trash2 class="size-6" />
						{:else}
							<Info class="size-6" />
						{/if}
					</span>
					<AlertDialogPrimitive.Title class="mt-8 text-2xl font-semibold text-foreground">
						{titulo}
					</AlertDialogPrimitive.Title>
					<AlertDialogPrimitive.Description class="mt-6 text-base text-foreground">
						{#each mensaje.split(String.fromCharCode(10)) as linea, i (i)}
							<span class="block">{linea}</span>
						{/each}
						{#if pregunta}
							<span class="mt-8 block font-semibold" data-testid="confirmar-pregunta">{pregunta}</span>
						{/if}
					</AlertDialogPrimitive.Description>
				</div>
			{:else}
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
			{/if}

			{#if children}
				<div class="mt-4">{@render children()}</div>
			{/if}

			<!-- Cancelar a la izquierda del destructivo y con el foco inicial: si
			     alguien llega aquí por inercia y pica Enter, no destruye nada.
			     En el formato centrado el ORDEN VISUAL es el del Figma (la salida destructiva a la izquierda como enlace rojo,
			     «seguir» a la derecha como botón azul grande), pero en el DOM «seguir» sigue primero: conserva el foco inicial. -->
			<div class="flex items-center justify-end {formato === 'centrado' ? 'mt-10 gap-8' : 'mt-6 gap-3'}">
				{#if !soloAviso}
					<AlertDialogPrimitive.Cancel>
						{#snippet child({ props })}
							{#if formato === 'centrado'}
								<Button
									{...props}
									variant="default"
									class="order-2 h-12 rounded-xl px-8 text-base"
									data-testid="confirmar-cancelar"
								>
									{etiquetaCancelar}
								</Button>
							{:else}
								<Button {...props} variant="outline" size="sm" data-testid="confirmar-cancelar">
									{etiquetaCancelar}
								</Button>
							{/if}
						{/snippet}
					</AlertDialogPrimitive.Cancel>
				{/if}
				<AlertDialogPrimitive.Action onclick={confirmar}>
					{#snippet child({ props })}
						{#if formato === 'centrado'}
							<Button
								{...props}
								variant="link"
								class="order-1 h-auto p-0 text-base {variante === 'destructivo' ? 'text-destructive' : ''}"
								data-testid="confirmar-aceptar"
							>
								{etiquetaConfirmar}
							</Button>
						{:else}
							<Button
								{...props}
								variant={variante === 'destructivo' ? 'destructive' : 'default'}
								size="sm"
								data-testid="confirmar-aceptar"
							>
								{etiquetaConfirmar}
							</Button>
						{/if}
					{/snippet}
				</AlertDialogPrimitive.Action>
			</div>
		</AlertDialogPrimitive.Content>
	</AlertDialogPrimitive.Portal>
</AlertDialogPrimitive.Root>
