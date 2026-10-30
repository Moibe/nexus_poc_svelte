<script lang="ts">
	/**
	 * Elegir documentos de un expediente con casillas (2026-10-29): lo comparten el alta de un expediente virtual (con qué documentos nace)
	 * y «Agregar documentos» de un expediente virtual ya creado. Arriba «Seleccionar todos» y cuántos van; abajo una casilla por documento,
	 * con su formato y su peso. Es el mismo lenguaje de la lista de tipos documentales del esquema (`TipoExpedienteModal`).
	 *
	 * Solo ofrece lo que le pasan (los documentos DEL expediente): un expediente virtual no puede tener otros, y la base tampoco lo deja.
	 */
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { formatearTamano, formatoDe, type DocumentoDeExpediente } from '$lib/expedientes/expedientes';

	let {
		documentos,
		elegidos = $bindable([]),
		etiquetaId
	}: {
		documentos: DocumentoDeExpediente[];
		/** Los ids marcados, en el orden en que se marcaron. */
		elegidos?: string[];
		/** El id del texto que nombra la lista (para `aria-labelledby`). */
		etiquetaId: string;
	} = $props();

	const todos = $derived(documentos.length > 0 && documentos.every((d) => elegidos.includes(d.id)));

	function alternar(id: string) {
		elegidos = elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id];
	}

	function alternarTodos() {
		elegidos = todos ? [] : documentos.map((d) => d.id);
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
		<label class="flex cursor-pointer items-center gap-2">
			<Checkbox checked={todos} onCheckedChange={alternarTodos} data-testid="elegir-todos-documentos" />
			Seleccionar todos
		</label>
		<span aria-live="polite" data-testid="contador-documentos-elegidos">{elegidos.length} de {documentos.length} seleccionados</span>
	</div>
	<div
		role="group"
		aria-labelledby={etiquetaId}
		class="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-input bg-card"
		data-testid="lista-documentos-elegibles"
	>
		{#each documentos as d (d.id)}
			<label class="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted" data-testid="documento-elegible" data-documento-id={d.id}>
				<Checkbox checked={elegidos.includes(d.id)} onCheckedChange={() => alternar(d.id)} data-testid="casilla-documento" />
				<span class="min-w-0 flex-1 truncate" title={d.nombreOriginal}>{d.nombreOriginal}</span>
				<span class="shrink-0 text-xs text-muted-foreground">{formatoDe(d)} | {formatearTamano(d.tamanoBytes)}</span>
			</label>
		{/each}
	</div>
</div>
