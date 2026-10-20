<script lang="ts">
	/**
	 * Un TIPO DOCUMENTAL en el lienzo del motor de reglas (piloto 1, 2026-10-20).
	 *
	 * Representa «el documento de este tipo del expediente»: un proceso corre sobre un expediente, o sea un conjunto de documentos,
	 * y por eso cada tipo aparece UNA vez en el lienzo. Muestra los campos del tipo tal como están en la biblioteca (se lee en vivo:
	 * si el tipo se edita, el nodo lo refleja) y cada campo trae su propio punto de salida, porque las reglas hablan de campos
	 * («el RFC del acta debe ser igual al RFC de la constancia»), no de documentos enteros.
	 *
	 * Los puntos de salida se identifican con el nombre del campo, y con `grupo.subcampo` los de dentro de un grupo. Un grupo tiene
	 * además el suyo propio: contar cuántas filas trae («cuántos socios») es una regla tan válida como sumar una de sus columnas.
	 *
	 * Los puntos de salida se conectan a las entradas de un operador. Un campo suelto entrega un VALOR (punto redondo); los que traen
	 * VARIOS (un campo «1 a N», una columna de un grupo que se repite) entregan una LISTA, y un grupo que se repite entrega sus FILAS
	 * (puntos cuadrados): esos solo sirven a los operadores de listas. Un grupo que no se repite no entrega nada por sí mismo: su
	 * punto se ve apagado y dice por qué (sus columnas, en cambio, sí se conectan).
	 */
	import { Handle, Position, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import FileText from '@lucide/svelte/icons/file-text';
	import X from '@lucide/svelte/icons/x';

	import {
		TIPOS_DE_DATO,
		etiquetaVersion,
		tiposDocumentales,
		type CampoBorrador
	} from '$lib/state/configuracion.svelte';

	import { porQueNoSeConecta, salidaDe, type DatosNodoTipo, type Salida } from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoTipo>> = $props();

	const { deleteElements } = useSvelteFlow();

	const tipo = $derived(tiposDocumentales.find((t) => t.id === data.tipoId));
	const version = $derived(tipo ? etiquetaVersion(tipo.version) : '');

	const etiquetaDeDato = (valor: string) => TIPOS_DE_DATO.find((t) => t.value === valor)?.label ?? valor;
	const seRepite = (c: Pick<CampoBorrador, 'cardinalidad'>) => c.cardinalidad === 'multiple';

	/** Lo que dice el punto de salida: si se puede conectar, qué entrega (para que se vea y se lea) y, si no, por qué. */
	const salidaDelPunto = (s: Salida) => {
		const motivo = porQueNoSeConecta(s);
		if (motivo !== null) return { conectable: false, clase: 'sin-conexion', titulo: motivo };
		if (s.forma === 'lista') return { conectable: true, clase: 'forma-lista', titulo: `«${s.campo}» es una lista de valores: conéctala a un operador de listas` };
		if (s.forma === 'filas') return { conectable: true, clase: 'forma-lista', titulo: `«${s.campo}» son las filas de un grupo: cuéntalas con «Cantidad»` };
		return { conectable: true, clase: '', titulo: `Conectar «${s.campo}» a un operador` };
	};
</script>

<div
	data-testid="nodo-tipo"
	data-tipo-id={data.tipoId}
	class="w-72 rounded-xl border bg-card text-card-foreground shadow-sm {selected
		? 'border-primary ring-2 ring-primary/30'
		: 'border-border'}"
>
	<div class="flex items-start gap-2 rounded-t-xl border-b border-border bg-muted/50 px-3 py-2.5">
		<FileText class="mt-0.5 size-4 shrink-0 text-primary" />
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-semibold" data-testid="nodo-tipo-nombre" title={tipo?.nombre}>
				{tipo?.nombre ?? 'Tipo documental no disponible'}
			</p>
			<p class="text-xs text-muted-foreground">
				{#if tipo}
					{tipo.campos.length}
					{tipo.campos.length === 1 ? 'campo' : 'campos'}{version ? ` · v${version}` : ''}
				{:else}
					Ya no está en la biblioteca
				{/if}
			</p>
		</div>
		<button
			type="button"
			data-testid="quitar-nodo"
			aria-label="Quitar del lienzo"
			title="Quitar del lienzo"
			class="nodrag flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			onclick={() => deleteElements({ nodes: [{ id }] })}
		>
			<X class="size-3.5" />
		</button>
	</div>

	{#if tipo}
		<ul class="py-1" data-testid="nodo-tipo-campos">
			{#each tipo.campos as campo (campo.id)}
				{@const punto = salidaDelPunto(salidaDe(tipo.nombre, campo))}
				<li class="relative flex h-8 items-center gap-2 px-3 text-xs" data-testid="campo-nodo" data-campo={campo.nombre}>
					<span class="min-w-0 flex-1 truncate font-medium" title={campo.nombre}>
						{campo.nombre}{#if campo.obligatorio}<span class="text-destructive" title="Obligatorio"> *</span>{/if}
					</span>
					{#if seRepite(campo)}
						<span
							class="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
							title="Se repite: puede traer varios valores"
							data-testid="campo-se-repite">1 a N</span
						>
					{/if}
					<span class="shrink-0 text-[11px] text-muted-foreground">{etiquetaDeDato(campo.tipoDato)}</span>
					<Handle
						type="source"
						position={Position.Right}
						id={campo.nombre}
						isConnectable={punto.conectable}
						title={punto.titulo}
						class={punto.clase}
					/>
				</li>
				{#if campo.tipoDato === 'grupo'}
					{#each campo.subcampos as sub (sub.id)}
						{@const puntoSub = salidaDelPunto(salidaDe(tipo.nombre, campo, sub))}
						<li
							class="relative flex h-7 items-center gap-2 pr-3 pl-7 text-xs"
							data-testid="subcampo-nodo"
							data-campo={`${campo.nombre}.${sub.nombre}`}
						>
							<span class="min-w-0 flex-1 truncate text-muted-foreground" title={sub.nombre}>
								{sub.nombre}{#if sub.obligatorio}<span class="text-destructive"> *</span>{/if}
							</span>
							<span class="shrink-0 text-[11px] text-muted-foreground">{etiquetaDeDato(sub.tipoDato)}</span>
							<Handle
								type="source"
								position={Position.Right}
								id={`${campo.nombre}.${sub.nombre}`}
								isConnectable={puntoSub.conectable}
								title={puntoSub.titulo}
								class={puntoSub.clase}
							/>
						</li>
					{/each}
				{/if}
			{:else}
				<li class="px-3 py-2 text-xs text-muted-foreground">Este tipo todavía no tiene campos.</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	/* Los puntos de salida se ven como en el resto de la app: un círculo del color primario con borde de tarjeta. */
	:global(.svelte-flow__handle) {
		width: 10px;
		height: 10px;
		background: var(--primary);
		border: 2px solid var(--card);
	}
	/* Un punto que no se puede conectar (trae varios valores) se ve apagado y el cursor no invita a arrastrarlo. */
	/* Una lista (o las filas de un grupo) sale por un punto CUADRADO: se ve que no es un valor suelto y no cabe en una comparación. */
	:global(.svelte-flow__handle.forma-lista) {
		border-radius: 2px;
	}
	:global(.svelte-flow__handle.sin-conexion) {
		background: var(--muted-foreground);
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
