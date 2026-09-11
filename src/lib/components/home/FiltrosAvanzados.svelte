<script lang="ts">
	/**
	 * Modal "Filtros avanzados" (2026-09-11, a pedido explícito con captura).
	 *
	 * Lo abre el ícono del reloj de los dos paneles de detalle. Ese reloj llevaba
	 * meses apagado como "Historial de eventos", se quitó el 2026-09-10, volvió
	 * el 2026-09-11 —"ahorita te digo para qué nos va a servir"— y esto es para
	 * lo que servía.
	 *
	 * ESTADO: LA VENTANA, NO EL FILTRO. Decidido explícitamente por el usuario.
	 * "Aplicar filtros" cierra y conserva la selección, pero NO filtra nada
	 * todavía, porque no existe la lista de "outputs generados" sobre la cual
	 * actuaría. Cuando exista, el enganche es `alAplicar`.
	 *
	 * LOS DESPLEGABLES NACEN SIN OPCIONES, también por decisión explícita. El
	 * catálogo de "tipo de output" y de "estado" no está definido. Se abren y
	 * dicen que todavía no hay opciones, en vez de quedarse deshabilitados: un
	 * control apagado no distingue "no hay nada que elegir" de "esto está roto".
	 * Por eso "Aplicar filtros" nace apagado y hoy no se puede encender — y eso
	 * coincide con la captura, donde ese botón se ve atenuado.
	 *
	 * ES `Dialog` Y NO `AlertDialog`: aquí sí se puede cerrar con un clic fuera.
	 * No hay nada que destruir ni ninguna respuesta obligatoria; el molde de
	 * `ConfirmarAccion` es para lo otro.
	 *
	 * El z-60 es a propósito, misma razón que en `ConfirmarAccion`: esto vive
	 * ENCIMA de un Sheet, que va en z-50. Sin subirlo quedaría detrás del panel
	 * que lo abrió.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';

	let {
		abierto = false,
		onCerrar,
		alAplicar
	}: {
		abierto?: boolean;
		/** Se llama al cerrar por CUALQUIER vía: Aplicar, Escape o clic fuera.
		 *  Quien lo usa apaga ahí su bandera; si no, el modal se atasca abierto. */
		onCerrar: () => void;
		/** El enganche para cuando exista la lista que filtrar. Hoy nadie lo pasa. */
		alAplicar?: (filtros: { tipoOutput: string; estado: string }) => void;
	} = $props();

	// Vacío = "sin filtrar". Se conserva entre aperturas a propósito: quien
	// filtró algo y vuelve a abrir espera encontrar lo que eligió, no una hoja
	// en blanco.
	let tipoOutput = $state('');
	let estado = $state('');

	const hayFiltro = $derived(tipoOutput !== '' || estado !== '');

	// Hoy siempre vacíos (ver el docblock). Cuando se definan los catálogos,
	// estos dos arreglos son lo único que hay que llenar.
	const TIPOS_DE_OUTPUT: { value: string; label: string }[] = [];
	const ESTADOS: { value: string; label: string }[] = [];

	function limpiar() {
		tipoOutput = '';
		estado = '';
	}

	function aplicar() {
		alAplicar?.({ tipoOutput, estado });
		onCerrar();
	}
</script>

{#snippet desplegable(
	id: string,
	etiqueta: string,
	marcador: string,
	opciones: { value: string; label: string }[],
	valor: string,
	alElegir: (v: string) => void,
	testid: string
)}
	<div class="flex flex-col gap-2">
		<label for={id} class="text-sm font-medium text-foreground">{etiqueta}</label>
		<Select.Root type="single" value={valor} onValueChange={alElegir}>
			<Select.Trigger {id} data-testid={testid} class="w-full">
				{opciones.find((o) => o.value === valor)?.label ?? marcador}
			</Select.Trigger>
			<Select.Content>
				{#each opciones as o (o.value)}
					<Select.Item value={o.value} label={o.label} />
				{:else}
					<!-- Sin opciones todavía. Se dice, en vez de abrir un panel vacío
					     que parece un error de carga. -->
					<p class="px-2 py-3 text-center text-xs text-muted-foreground">
						Todavía no hay opciones
					</p>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{/snippet}

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
			data-testid="modal-filtros-avanzados"
			class="fixed top-1/2 left-1/2 z-60 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-lg"
		>
			<p class="px-6 pt-5 text-sm text-muted-foreground">Filtros avanzados</p>

			<div class="flex items-center gap-3 px-6 pt-5">
				<span
					class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
				>
					<SlidersHorizontal class="size-4.5" />
				</span>
				<div class="min-w-0">
					<DialogPrimitive.Title class="text-lg font-semibold text-foreground">
						Filtrar outputs generados
					</DialogPrimitive.Title>
					<DialogPrimitive.Description class="text-sm text-muted-foreground">
						Localizar rápidamente registros
					</DialogPrimitive.Description>
				</div>
			</div>

			<div class="mt-5 border-t border-border"></div>

			<div class="flex flex-col gap-5 px-6 py-5">
				{@render desplegable(
					'filtro-tipo-output',
					'Tipo de output',
					'Selecciona un tipo de output',
					TIPOS_DE_OUTPUT,
					tipoOutput,
					(v) => (tipoOutput = v ?? ''),
					'filtro-tipo-output'
				)}
				{@render desplegable(
					'filtro-estado',
					'Estado',
					'Selecciona un estado',
					ESTADOS,
					estado,
					(v) => (estado = v ?? ''),
					'filtro-estado'
				)}
			</div>

			<div class="border-t border-border"></div>

			<div class="flex items-center justify-end gap-4 px-6 py-4">
				<Button
					variant="link"
					class="h-auto p-0 text-destructive"
					data-testid="filtros-limpiar"
					onclick={limpiar}
				>
					Limpiar filtros
				</Button>
				<!-- Apagado mientras no haya nada elegido, que es como se ve en la
				     captura. Hoy eso significa siempre, porque no hay opciones. -->
				<Button data-testid="filtros-aplicar" disabled={!hayFiltro} onclick={aplicar}>
					Aplicar filtros
				</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
