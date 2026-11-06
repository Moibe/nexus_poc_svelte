<script lang="ts">
	/**
	 * Un TIPO DOCUMENTAL en el lienzo del motor de reglas (piloto 1, 2026-10-20).
	 *
	 * Representa «el documento de este tipo del expediente»: un proceso corre sobre un expediente, o sea un conjunto de documentos,
	 * y por eso cada tipo aparece UNA vez en el lienzo. Cada campo trae su propio punto de salida, porque las reglas hablan de campos
	 * («el RFC del acta debe ser igual al RFC de la constancia»), no de documentos enteros.
	 *
	 * **Solo se ven los campos que se van a usar (2026-11-03, Moibe: «mostrar todos los campos disponibles lo hace muy largo, prefiero que
	 * residan en un dropdown y que de ahí se pueda seleccionar»).** El nodo nace con el punto del DOCUMENTO y un menú «Agregar campo» que
	 * lista los demás (se lee en vivo de la biblioteca: si el tipo se edita, el menú lo refleja); cada campo elegido sale como un renglón con
	 * su punto de salida y su «x» para volver a esconderlo. Un campo con un cable NO se puede esconder (su punto tiene que existir para que el
	 * cable llegue): hay que desconectarlo antes. Qué campos se ven vive en `data.campos` y NO se guarda: al abrir un proceso, el nodo muestra
	 * justo los campos que tienen cable (`hidratarDibujo`), que es lo único que un proceso guardado usa; un campo agregado y sin cable no
	 * significa nada.
	 *
	 * Los puntos de salida se identifican con el nombre del campo, y con `grupo.subcampo` los de dentro de un grupo. Un grupo tiene
	 * además el suyo propio: contar cuántas filas trae («cuántos socios») es una regla tan válida como sumar una de sus columnas.
	 *
	 * Los puntos de salida se conectan a las entradas de un operador. Un campo suelto entrega un VALOR (punto redondo); los que traen
	 * VARIOS (un campo «1 a N», una columna de un grupo que se repite) entregan una LISTA, y un grupo que se repite entrega sus FILAS
	 * (puntos cuadrados): esos solo sirven a los operadores de listas. Un grupo que no se repite no entrega nada por sí mismo: su
	 * punto se ve apagado y dice por qué (sus columnas, en cambio, sí se conectan).
	 *
	 * Arriba de los campos va el punto del DOCUMENTO entero (un rombo): no es ningún dato, solo sirve para preguntarle al expediente si
	 * lo trae («Existe documento»). Su id es `HANDLE_DOCUMENTO`, con arroba para no chocar con el nombre de un campo.
	 */
	import { Handle, Position, useNodeConnections, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import FileText from '@lucide/svelte/icons/file-text';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import {
		TIPOS_DE_DATO,
		estadoBiblioteca,
		etiquetaVersion,
		tiposDocumentales,
		type CampoBorrador
	} from '$lib/state/configuracion.svelte';

	import { HANDLE_DOCUMENTO, estadoDeTipoEnLienzo, porQueNoSeConecta, salidaDe, type DatosNodoTipo, type Salida } from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoTipo>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();
	// Los cables que salen de este nodo: un campo con cable no se puede esconder.
	const conexiones = useNodeConnections({ handleType: 'source' });

	const tipo = $derived(tiposDocumentales.find((t) => t.id === data.tipoId));
	// La versión del tipo con la que se armó el proceso (NEX-542): es la que enseña el nodo. Un proceso de antes no la trae (`null`): se enseña la
	// del tipo y no hay aviso, porque no se sabe con cuál se armó.
	const registrada = $derived(Number.isInteger(data.version) ? (data.version as number) : null);
	const version = $derived(tipo ? etiquetaVersion(registrada ?? tipo.version) : '');
	/** El tipo ya va en otra versión que la registrada: se avisa y se ofrece usar la nueva (cambia el proceso: queda por guardar). */
	const versionNueva = $derived(tipo && registrada !== null && tipo.version > 0 && tipo.version !== registrada ? etiquetaVersion(tipo.version) : '');
	function usarVersionNueva() {
		if (tipo) updateNodeData(id, { version: tipo.version });
	}
	/** Un tipo archivado sigue en el proceso (no se quita solo), pero ya no sale de la biblioteca ni de la paleta: se dice (NEX-544). */
	const archivado = $derived(tipo?.estado === 'archivado');
	/**
	 * Solo un tipo ACTIVO se puede usar en un proceso (2026-11-05): si ya no lo es (borrador, o activo que volvió a borrador con «Crear nueva versión»,
	 * o borrado) el nodo se marca en rojo y el lienzo no deja conectarlo ni guardar el proceso. Mientras la biblioteca no está leída no se sabe: no se marca.
	 */
	const estadoDelTipo = $derived(estadoBiblioteca.cargada ? estadoDeTipoEnLienzo(tiposDocumentales, data.tipoId) : 'activo');
	const noActivo = $derived(estadoDelTipo !== 'activo');

	const etiquetaDeDato = (valor: string) => TIPOS_DE_DATO.find((t) => t.value === valor)?.label ?? valor;
	const seRepite = (c: Pick<CampoBorrador, 'cardinalidad'>) => c.cardinalidad === 'multiple';

	/** Los puntos de salida que se ven (nombre del campo, o `grupo.subcampo`). */
	const visibles = $derived(new Set(data.campos ?? []));
	const conCable = (punto: string) => conexiones.current.some((c) => c.sourceHandle === punto);

	/** Lo que el menú ofrece: cada campo y cada columna de grupo que todavía no se ve, en el orden del tipo. */
	const porAgregar = $derived(
		(tipo?.campos ?? []).flatMap((campo) => [
			...(visibles.has(campo.nombre) ? [] : [{ punto: campo.nombre, etiqueta: campo.nombre, dato: etiquetaDeDato(campo.tipoDato) }]),
			...(campo.tipoDato === 'grupo'
				? campo.subcampos
						.filter((s) => !visibles.has(`${campo.nombre}.${s.nombre}`))
						.map((s) => ({ punto: `${campo.nombre}.${s.nombre}`, etiqueta: `${campo.nombre} › ${s.nombre}`, dato: etiquetaDeDato(s.tipoDato) }))
				: [])
		])
	);

	function agregarCampo(punto: string) {
		if (!visibles.has(punto)) updateNodeData(id, { campos: [...(data.campos ?? []), punto] });
	}
	function esconderCampo(punto: string) {
		if (conCable(punto)) return;
		updateNodeData(id, { campos: (data.campos ?? []).filter((c) => c !== punto) });
	}

	/** Lo que dice el punto de salida: si se puede conectar, qué entrega (para que se vea y se lea) y, si no, por qué. */
	const salidaDelPunto = (s: Salida) => {
		const motivo = porQueNoSeConecta(s);
		if (motivo !== null) return { conectable: false, clase: 'sin-conexion', titulo: motivo };
		if (s.forma === 'lista') return { conectable: true, clase: 'forma-lista', titulo: `«${s.campo}» es una lista de valores: conéctala a un operador de listas` };
		if (s.forma === 'filas') return { conectable: true, clase: 'forma-lista', titulo: `«${s.campo}» son las filas de un grupo: cuéntalas con «Cantidad»` };
		return { conectable: true, clase: '', titulo: `Conectar «${s.campo}» a un operador` };
	};
</script>

<!-- La «x» de un campo: lo esconde (apagada si tiene cable, y lo dice). -->
{#snippet esconder(punto: string, etiqueta: string)}
	{@const cableado = conCable(punto)}
	<button
		type="button"
		data-testid="esconder-campo"
		aria-label={`Quitar «${etiqueta}» del nodo`}
		title={cableado ? 'Está conectado: desconéctalo para quitarlo del nodo' : 'Quitar este campo del nodo'}
		disabled={cableado}
		class="nodrag -ml-1 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
		onclick={() => esconderCampo(punto)}
	>
		<X class="size-3" />
	</button>
{/snippet}

<div
	data-testid="nodo-tipo"
	data-tipo-id={data.tipoId}
	data-estado-del-tipo={estadoDelTipo}
	class="w-72 rounded-xl border bg-card text-card-foreground shadow-sm {selected
		? 'border-primary ring-2 ring-primary/30'
		: noActivo
			? 'border-destructive'
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

	{#if archivado}
		<p class="border-b border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive" data-testid="nodo-archivado">
			Este tipo documental está archivado: ya no sale de la biblioteca ni se puede usar. Sus campos no se conectan y el proceso no se guarda con él. Quítalo del proceso o pídele a quien administra uno que lo sustituya.
		</p>
	{:else if noActivo}
		<p class="border-b border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive" data-testid="nodo-no-activo" data-estado={estadoDelTipo}>
			{#if estadoDelTipo === 'borrador'}
				Este tipo documental no está activo (está en borrador o en una nueva versión sin publicar): en un proceso solo se pueden usar tipos activos. Sus campos no se conectan y el proceso no se guarda con él. Quítalo, o actívalo de nuevo en Configuración › Tipos documentales.
			{:else}
				Este tipo documental ya no existe. Sus campos no se conectan y el proceso no se guarda con él: quítalo del proceso.
			{/if}
		</p>
	{/if}

	{#if versionNueva}
		<div class="nodrag border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800" data-testid="nodo-version-nueva">
			<p>
				El proceso se armó con {version ? `la v${version}` : 'una versión sin activar'}; el tipo ya va en la v{versionNueva}. Revisa que los campos conectados sigan igual antes de usarla.
			</p>
			<button
				type="button"
				data-testid="usar-version-nueva"
				class="mt-1 rounded-md border border-amber-400 bg-white px-2 py-0.5 font-medium text-amber-900 transition-colors hover:bg-amber-100"
				onclick={usarVersionNueva}
			>
				Usar la v{versionNueva}
			</button>
		</div>
	{/if}

	{#if tipo}
		<!-- El documento entero: la fila va aparte de los campos, con su propia línea debajo. -->
		<div class="relative flex h-8 items-center gap-2 border-b border-border px-3 text-xs" data-testid="documento-nodo">
			<span class="min-w-0 flex-1 truncate font-medium">Documento</span>
			<span class="shrink-0 text-[11px] text-muted-foreground">¿está en el expediente?</span>
			<Handle
				type="source"
				position={Position.Right}
				id={HANDLE_DOCUMENTO}
				title="El documento entero: conéctalo a «Existe documento» para preguntar si el expediente lo trae"
				class="forma-documento"
			/>
		</div>
		<ul class="py-1" data-testid="nodo-tipo-campos">
			{#each tipo.campos as campo (campo.id)}
				{#if visibles.has(campo.nombre)}
					{@const punto = salidaDelPunto(salidaDe(tipo.nombre, campo))}
					<li class="relative flex h-8 items-center gap-2 px-3 text-xs" data-testid="campo-nodo" data-campo={campo.nombre}>
						{@render esconder(campo.nombre, campo.nombre)}
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
				{/if}
				{#if campo.tipoDato === 'grupo'}
					{#each campo.subcampos as sub (sub.id)}
						{@const idSub = `${campo.nombre}.${sub.nombre}`}
						{#if visibles.has(idSub)}
							{@const puntoSub = salidaDelPunto(salidaDe(tipo.nombre, campo, sub))}
							<li
								class="relative flex h-7 items-center gap-2 pr-3 pl-3 text-xs"
								data-testid="subcampo-nodo"
								data-campo={idSub}
							>
								{@render esconder(idSub, `${campo.nombre} › ${sub.nombre}`)}
								<!-- Si el grupo mismo no se ve, la columna dice de cuál grupo es. -->
								<span class="min-w-0 flex-1 truncate text-muted-foreground {visibles.has(campo.nombre) ? 'pl-4' : ''}" title={visibles.has(campo.nombre) ? sub.nombre : `${campo.nombre} › ${sub.nombre}`}>
									{visibles.has(campo.nombre) ? sub.nombre : `${campo.nombre} › ${sub.nombre}`}{#if sub.obligatorio}<span class="text-destructive"> *</span>{/if}
								</span>
								<span class="shrink-0 text-[11px] text-muted-foreground">{etiquetaDeDato(sub.tipoDato)}</span>
								<Handle
									type="source"
									position={Position.Right}
									id={idSub}
									isConnectable={puntoSub.conectable}
									title={puntoSub.titulo}
									class={puntoSub.clase}
								/>
							</li>
						{/if}
					{/each}
				{/if}
			{:else}
				<li class="px-3 py-2 text-xs text-muted-foreground">Este tipo todavía no tiene campos.</li>
			{/each}
			{#if tipo.campos.length > 0 && visibles.size === 0}
				<li class="px-3 py-1.5 text-xs text-muted-foreground" data-testid="nodo-sin-campos">Agrega los campos que vas a usar en las reglas.</li>
			{/if}
		</ul>

		<!-- El menú con los campos que todavía no se ven: ahí se eligen (en vez de mostrarlos todos y alargar el nodo). -->
		{#if tipo.campos.length > 0}
			<div class="border-t border-border p-2">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						disabled={porAgregar.length === 0}
						data-testid="agregar-campo"
						class="nodrag flex h-8 w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
					>
						<Plus class="size-3.5" />
						<span class="min-w-0 flex-1 truncate text-left">{porAgregar.length === 0 ? 'Ya están todos los campos' : 'Agregar campo'}</span>
						{#if porAgregar.length > 0}
							<span class="text-[11px] font-normal" data-testid="agregar-campo-cuenta">{porAgregar.length}</span>
						{/if}
						<ChevronDown class="size-3.5" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="start" class="nowheel max-h-64 w-64 overflow-y-auto" data-testid="menu-agregar-campo">
						{#each porAgregar as c (c.punto)}
							<DropdownMenu.Item class="gap-2 text-xs" data-testid="opcion-agregar-campo" data-punto={c.punto} onSelect={() => agregarCampo(c.punto)}>
								<span class="min-w-0 flex-1 truncate">{c.etiqueta}</span>
								<span class="shrink-0 text-[11px] text-muted-foreground">{c.dato}</span>
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		{/if}
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
	/* El documento entero sale por un ROMBO (el cuadrado girado): no es un valor ni una lista. `rotate` y no `transform`, porque
	   la librería coloca el punto con `transform` y lo pisaríamos. */
	:global(.svelte-flow__handle.forma-documento) {
		border-radius: 2px;
		rotate: 45deg;
	}
	:global(.svelte-flow__handle.sin-conexion) {
		background: var(--muted-foreground);
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
