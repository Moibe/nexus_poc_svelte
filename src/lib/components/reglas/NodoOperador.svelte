<script lang="ts">
	/**
	 * Un OPERADOR en el lienzo del motor de reglas (2026-10-20): una regla. Todos se dibujan igual y cambian en su catálogo
	 * (`OPERADORES`):
	 *
	 *   · de COMPARACIÓN (igual, distinto, contiene, parecido, mayor, menor y sus «o igual», entre): sus entradas reciben VALORES: un campo de
	 *     un documento, un valor fijo, o el número que entrega `Cantidad` o `Suma`. Dan pasa / no pasa. «Entre» tiene tres (Valor, Desde, Hasta).
	 *   · de FECHAS («Antigüedad contra hoy», 2026-11-10): recibe una fecha; su máximo y su unidad («3 meses») se eligen en el nodo, y el «hoy» con
	 *     que se prueba también se escribe ahí (al ejecutar, es el día de la ejecución).
	 *   · de LISTAS (cantidad, suma, alguno, todos, unicos): reciben una LISTA (un campo «1 a N» o una columna de un grupo que se repite;
	 *     «Cantidad» también las filas de un grupo). `Cantidad` y `Suma` entregan un número; los demás, pasa / no pasa.
	 *   · LÓGICOS (Y, O, No, Implica): sus entradas reciben el pasa / no pasa de OTRAS reglas. Así se encadenan. «Implica» tiene una
	 *     entrada «Si (condición)» y otra «Entonces (debe pasar)»; pasa también cuando la condición no se cumple, y el nodo lo dice
	 *     (si no, una regla que «pasa» cuando la regla de entrada no pasa parece un error).
	 *   · «Existe documento»: su entrada recibe el DOCUMENTO entero (el rombo de un tipo documental) y dice si el expediente lo trae.
	 *     Su ejemplo no es un texto sino una elección: el expediente de ejemplo SÍ o NO trae el documento.
	 *
	 * Como el lienzo todavía no corre sobre un expediente de verdad, cada entrada que viene de un CAMPO trae una cajita de VALOR DE
	 * EJEMPLO (si es una lista, un área con un elemento por renglón): se escribe lo que traería el campo y el nodo dice qué daría la
	 * regla. Los valores viven en el nodo, no en el campo. Lo que viene de un valor fijo o de otra regla no se escribe aquí: se ve.
	 *
	 * Lo que evaluó el lienzo para todo el grafo (`evaluar`) se lo ofrece a los nodos por contexto: una regla que depende de otra tiene
	 * que ver el estado y el valor actuales de ésa.
	 */
	import { Handle, Position, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import Equal from '@lucide/svelte/icons/equal';
	import X from '@lucide/svelte/icons/x';
	import { getContext } from 'svelte';

	import OrigenDeEntrada from '$lib/components/reglas/OrigenDeEntrada.svelte';
	import SelloDeVeredicto from '$lib/components/reglas/SelloDeVeredicto.svelte';
	import SimboloDeOperador from '$lib/components/reglas/SimboloDeOperador.svelte';
	import { usarOrigenes } from '$lib/components/reglas/origenes';
	import {
		CLAVE_VEREDICTOS,
		SALIDA_RESULTADO,
		TOPE_MAXIMO_ANTIGUEDAD,
		UNIDADES_DE_TIEMPO,
		esNumero,
		lineasDeEjemplo,
		maximoDeAntiguedad,
		minimoDeParecido,
		numeroDeOperador,
		operadorDe,
		textoDeAntiguedad,
		textoDeParecido,
		unidadDeAntiguedad,
		type DatosNodoOperador,
		type EvaluadoDelLienzo,
		type Estado,
		type UnidadDeTiempo
	} from '$lib/reglas/reglas';

	let { id, data, selected }: NodeProps<Node<DatosNodoOperador>> = $props();

	const { deleteElements, updateNodeData } = useSvelteFlow();
	const evaluado = getContext<EvaluadoDelLienzo>(CLAVE_VEREDICTOS);
	/** Lo que llega a cada entrada (un campo, un valor fijo o una regla); lo comparte con los nodos finales. `c` solo existe en «Entre». */
	const origenDe = usarOrigenes(['a', 'b', 'c']);

	const def = $derived(operadorDe(data.operador));
	const estado = $derived<Estado>(evaluado.todos[id] ?? 'sin_conexion');
	const valorDeSalida = $derived(evaluado.valores[id]);
	const esLogico = $derived(def?.grupo === 'logico');
	const esDocumento = $derived(def?.grupo === 'documento');
	const entregaValor = $derived(def?.salida === 'valor');

	// «Parecido a» (2026-11-10): el mínimo vive en el nodo; el porcentaje lo mide la IA y llega por el contexto del lienzo.
	const esParecido = $derived(def?.clave === 'parecido');
	const minimo = $derived(minimoDeParecido(data));
	const medida = $derived(evaluado.parecidos?.[id]);
	const llaveDelPar = $derived(evaluado.llavesDeParecido?.[id]);
	const midiendoElPar = $derived(llaveDelPar !== undefined && (evaluado.midiendo?.has(llaveDelPar) ?? false));
	const errorDelPar = $derived(llaveDelPar !== undefined ? evaluado.erroresDeParecido?.[llaveDelPar] : undefined);
	let minimoEscrito = $state('');
	$effect(() => {
		minimoEscrito = String(minimo);
	});
	/** Se guarda al salir de la caja (o con Enter): un entero de 1 a 100. Otra cosa vuelve al que tenía. */
	function fijarMinimo() {
		const n = Number(minimoEscrito.trim());
		if (Number.isInteger(n) && n >= 1 && n <= 100) updateNodeData(id, { minimo: n });
		else minimoEscrito = String(minimo);
	}

	// «Antigüedad contra hoy» (2026-11-10): el máximo y su unidad viven en el nodo y se guardan; el «hoy» es de ejemplo (no se guarda): mientras no se
	// escriba otro, el lienzo prueba con la fecha de hoy, y al ejecutar el proceso se usa la del día en que se ejecuta.
	const esAntiguedad = $derived(def?.clave === 'antiguedad');
	const maximo = $derived(maximoDeAntiguedad(data));
	const unidad = $derived(unidadDeAntiguedad(data));
	const hoyDeEjemplo = $derived(typeof data.hoy === 'string' ? data.hoy : evaluado.hoy);
	const medidaDeAntiguedad = $derived(evaluado.antiguedades?.[id]);
	let maximoEscrito = $state('');
	$effect(() => {
		maximoEscrito = String(maximo);
	});
	/** Igual que el mínimo de «Parecido a»: se guarda al salir de la caja (o con Enter) si es un entero de 1 a 9999; si no, vuelve al que tenía. */
	function fijarMaximo() {
		const n = Number(maximoEscrito.trim());
		if (Number.isInteger(n) && n >= 1 && n <= TOPE_MAXIMO_ANTIGUEDAD) updateNodeData(id, { maximo: n });
		else maximoEscrito = String(maximo);
	}

	/** El renglón de una lista de ejemplo que no es número, cuando la regla suma: se avisa en vez de dejar un «sin valores» mudo. */
	function lineaQueNoEsNumero(): string | null {
		if (def?.clave !== 'suma') return null;
		const origen = origenDe('a');
		if (origen?.clase !== 'campo') return null;
		return lineasDeEjemplo(String(data.a ?? '')).find((l) => !esNumero(l)) ?? null;
	}

	const textoDelEstado = $derived.by(() => {
		if (!def) return '';
		switch (estado) {
			case 'pasa': {
				if (esParecido && medida) return textoDeParecido('pasa', medida);
				if (esAntiguedad && medidaDeAntiguedad) return textoDeAntiguedad('pasa', medidaDeAntiguedad);
				// «Implica» pasa de dos maneras: porque se cumple lo que exige, o porque la condición no se cumple y no hay nada que
				// exigir. Se dice cuál, porque lo segundo —pasar cuando la regla de entrada no pasa— parece un error.
				const condicion = def.textoPasaSinCondicion ? origenDe('a') : null;
				return condicion?.clase === 'regla' && condicion.estado === 'no_pasa' ? (def.textoPasaSinCondicion ?? def.textoPasa) : def.textoPasa;
			}
			case 'no_pasa':
				if (esAntiguedad && medidaDeAntiguedad) return textoDeAntiguedad('no_pasa', medidaDeAntiguedad);
				return esParecido && medida ? textoDeParecido('no_pasa', medida) : def.textoNoPasa;
			case 'listo':
				return `Resultado: ${valorDeSalida ?? ''}`;
			case 'sin_valores': {
				if (esLogico) return 'Falta el veredicto de alguna regla';
				if (esDocumento) return 'Elige si el expediente de ejemplo trae el documento';
				if (esParecido && midiendoElPar) return 'Midiendo el parecido con IA…';
				if (esParecido && errorDelPar) return errorDelPar;
				if (esAntiguedad) return hoyDeEjemplo.trim() ? 'Escribe una fecha de ejemplo' : 'Escribe la fecha de hoy con la que quieres probar';
				const mala = lineaQueNoEsNumero();
				if (mala !== null) return `«${mala}» no es un número`;
				if (def.grupo === 'lista') return 'Escribe los valores de ejemplo (uno por renglón)';
				return def.entradas.length > 2 ? 'Escribe un valor de ejemplo en cada entrada' : 'Escribe un valor de ejemplo en cada lado';
			}
			default:
				if (esDocumento) return 'Conecta el documento de un tipo documental';
				if (esLogico) return def.entradas.length === 1 ? 'Conecta una regla' : 'Conecta una regla a cada entrada';
				if (def.grupo === 'lista') return def.entradas.length === 1 ? 'Conecta una lista' : 'Conecta una lista y un valor';
				if (esAntiguedad) return 'Conecta un campo de fecha o un valor fijo';
				return 'Conecta un campo o un valor fijo a cada entrada';
		}
	});
	const claseDelEstado = $derived(
		estado === 'pasa' ? 'text-green-700 dark:text-green-400' : estado === 'no_pasa' ? 'text-destructive' : estado === 'listo' ? 'text-foreground' : 'text-muted-foreground'
	);
</script>

{#if def}
	<div
		data-testid="nodo-operador"
		data-operador={def.clave}
		class="w-72 rounded-xl border bg-card text-card-foreground shadow-sm {selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'}"
	>
		<div class="flex items-start gap-2 rounded-t-xl border-b border-border bg-muted/50 px-3 py-2.5">
			<SimboloDeOperador operador={def} class="mt-0.5" />
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold">
					<span data-testid="operador-nombre">{def.etiqueta}</span>
					<span class="font-normal text-muted-foreground" data-testid="operador-numero">#{numeroDeOperador(id)}</span>
				</p>
				<p class="text-xs text-muted-foreground" data-testid="operador-descripcion">{def.descripcionEnNodo ?? def.descripcion}</p>
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

		{#each def.entradas as entrada (entrada.id)}
			<div class="relative border-b border-border px-3 py-2.5" data-testid="entrada-operador" data-entrada={entrada.id}>
				<Handle type="target" position={Position.Left} id={entrada.id} />
				<p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{entrada.etiqueta}</p>
				<OrigenDeEntrada
					{entrada}
					origen={origenDe(entrada.id)}
					ejemplo={String(data[entrada.id] ?? '')}
					alEscribir={(texto) => updateNodeData(id, { [entrada.id]: texto })}
				/>
			</div>
		{/each}

		{#if esParecido}
			<div class="border-b border-border px-3 py-2.5" data-testid="parecido-minimo">
				<label class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase" for="minimo-{id}">Parecido mínimo</label>
				<div class="mt-1 flex items-center gap-2">
					<input
						id="minimo-{id}"
						type="text"
						maxlength="3"
						inputmode="numeric"
						data-testid="parecido-minimo-valor"
						class="nodrag h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
						bind:value={minimoEscrito}
						onblur={fijarMinimo}
						onkeydown={(e) => e.key === 'Enter' && fijarMinimo()}
					/>
					<span class="text-sm text-muted-foreground">%</span>
				</div>
			</div>
		{/if}

		{#if esAntiguedad}
			<!-- «Antigüedad contra hoy» (2026-11-10, con el diseño de Moibe): el máximo con su unidad, y el «hoy» con el que se prueba. Ninguno lleva punto
			     de entrada: el máximo es parte de la regla, y en una ejecución «hoy» es la fecha del día en que se ejecuta. -->
			<div class="border-b border-border px-3 py-2.5" data-testid="antiguedad-maximo">
				<label class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase" for="maximo-{id}">Máximo</label>
				<div class="mt-1.5 flex items-center gap-2">
					<input
						id="maximo-{id}"
						type="text"
						maxlength="4"
						inputmode="numeric"
						autocomplete="off"
						data-testid="antiguedad-maximo-valor"
						class="nodrag nowheel h-8 w-20 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
						bind:value={maximoEscrito}
						onblur={fijarMaximo}
						onkeydown={(e) => {
							e.stopPropagation();
							if (e.key === 'Enter') fijarMaximo();
						}}
					/>
					<select
						aria-label="Unidad del máximo"
						data-testid="antiguedad-unidad"
						value={unidad}
						class="nodrag nowheel h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
						onchange={(e) => updateNodeData(id, { unidad: e.currentTarget.value as UnidadDeTiempo })}
						onkeydown={(e) => e.stopPropagation()}
					>
						{#each UNIDADES_DE_TIEMPO as u (u.valor)}
							<option value={u.valor}>{u.plural}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="border-b border-border px-3 py-2.5" data-testid="antiguedad-hoy">
				<label class="text-[11px] font-medium tracking-wide text-muted-foreground" for="hoy-{id}"
					><span class="uppercase">Hoy</span> (de la ejecución)</label
				>
				<input
					id="hoy-{id}"
					type="text"
					autocomplete="off"
					placeholder="aaaa-mm-dd"
					title="Para probar la regla aquí. Al ejecutar el proceso se usa la fecha del día en que se ejecuta."
					data-testid="antiguedad-hoy-valor"
					value={hoyDeEjemplo}
					class="nodrag nowheel mt-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
					oninput={(e) => updateNodeData(id, { hoy: e.currentTarget.value })}
					onkeydown={(e) => e.stopPropagation()}
				/>
			</div>
		{/if}

		<!-- El veredicto de la regla (2026-11-04, Moibe: «el resultado final, ligeramente más grande, y la palomota más prominente»). El texto sube
		     de 12 a 14 px, y «pasa» y «no pasa» llevan su sello: círculo verde con paloma amarilla, círculo rojo con tache blanco. Todos los estados
		     comparten la misma caja de 24 px para el ícono, así el nodo no cambia de alto ni se mueve su punto de salida al cambiar el veredicto.
		     El sello es decorativo: lo que dice el estado es el texto de al lado. -->
		<div class="relative flex items-center gap-2.5 px-3 py-3 text-sm leading-snug font-medium {claseDelEstado}">
			<span class="flex size-6 shrink-0 items-center justify-center" data-testid="icono-veredicto" data-estado={estado} aria-hidden="true">
				{#if estado === 'pasa'}
					<SelloDeVeredicto tipo="pasa" />
				{:else if estado === 'no_pasa'}
					<SelloDeVeredicto tipo="no_pasa" />
				{:else if estado === 'listo'}
					<Equal class="size-4" />
				{:else}
					<CircleDashed class="size-4" />
				{/if}
			</span>
			<span class="min-w-0" data-testid="resultado-operador" data-estado={estado} data-valor={valorDeSalida ?? ''}>
				{textoDelEstado}
				{#if esParecido && medida?.razon && (estado === 'pasa' || estado === 'no_pasa')}
					<span class="mt-0.5 block text-xs font-normal text-muted-foreground" data-testid="parecido-razon">{medida.sinIA ? '' : 'IA: '}{medida.razon}</span>
				{/if}
				{#if esParecido && errorDelPar && llaveDelPar && !midiendoElPar}
					<button
						type="button"
						class="nodrag mt-0.5 block text-xs font-medium text-primary hover:underline"
						data-testid="parecido-reintentar"
						onclick={() => evaluado.reintentarParecido(llaveDelPar)}>Reintentar</button
					>
				{/if}
			</span>
			<Handle
				type="source"
				position={Position.Right}
				id={SALIDA_RESULTADO}
				title={entregaValor ? 'El número que calculó: conéctalo a una comparación' : 'Resultado de la regla: conéctalo a un operador lógico (Y, O, No o Implica)'}
			/>
		</div>
	</div>
{/if}
