<script lang="ts">
	/**
	 * El alta de un proceso (2026-11-06, Moibe: «al crear un proceso nuevo, en lugar de ir directo al canvas, haremos lo que dice este Figma, o sea
	 * seleccionar los tipos documentales que usaremos (con una excepción, no seleccionaremos campos): eso sí lo podemos hacer en el canvas»).
	 *
	 * Sale del Figma Sprint 5, HUN5 «Crear proceso» (frames `5480:105239`, `5503:106159` y `5503:106491`): «Nuevo proceso», el nombre y la selección de
	 * tipos documentales. Va en el mismo panel de la lista de procesos (`ListaDeProcesos.svelte`), como en el diseño, y al continuar lleva al lienzo de un
	 * proceso nuevo YA con el nombre y con un nodo por cada tipo elegido (`direccionDeProcesoNuevo` / `entradasDeProcesoNuevo`, en `reglas.ts`).
	 *
	 * Los tipos se eligen en UN solo desplegable de elección múltiple, con casillas (Moibe, mismo día: «en lugar de que sea un dropdown en el que se
	 * seleccionen uno por uno, mejor que se puedan seleccionar varios a la vez»; es el `DesplegableMultiple` de los filtros). Lo elegido se enseña debajo,
	 * en el orden en que se marcó, cada uno con su X: ese es el orden en que entran al lienzo. El diseño traía una fila «Tipo documental» + «Campos» por
	 * cada tipo, con «Agregar otro campo».
	 *
	 * Lo que se aparta del diseño:
	 *   · SIN «Campos»: ni la columna de campos ni el «Campo ancla» (Moibe: los campos se eligen en el lienzo, conectándolos a las reglas).
	 *   · «Crear proceso» dice «Continuar al lienzo»: nada queda guardado todavía (para guardar falta, por lo menos, el nodo «Resultado», que se arma en el
	 *     lienzo), y un botón que dijera «Crear» prometería un proceso que aún no existe.
	 *   · «Cancelar registro» dice «Cancelar».
	 *   · La lista es una sola (el diseño la parte en «Documentos de sistema» y «Tipo documental configurado»; aquí no hay esa distinción) y solo ofrece
	 *     los tipos ACTIVOS, como la paleta del lienzo (2026-11-05): uno en borrador o archivado no se puede usar en un proceso.
	 *   · El texto que dice que el sistema «agrupará los documentos relacionados en expedientes» es de antes de que un proceso corriera sobre el expediente
	 *     completo; aquí dice lo que de verdad pasa.
	 *
	 * El nombre se comprueba contra los procesos que ya hay (sin distinguir mayúsculas ni espacios de más, la misma regla del servidor) para avisar ya y no
	 * hasta el primer guardado; nexus_back lo vuelve a comprobar al guardar.
	 */
	import X from '@lucide/svelte/icons/x';
	import { tick } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import DesplegableMultiple from '$lib/components/ui/DesplegableMultiple.svelte';
	import { MAX_NOMBRE_PROCESO } from '$lib/reglas/reglas';
	import { claveDeNombreTipo, estadoBiblioteca, tiposDocumentales } from '$lib/state/configuracion.svelte';
	import { estadoProcesos } from '$lib/state/procesos.svelte';

	let {
		alCancelar,
		alContinuar
	}: {
		alCancelar: () => void;
		/** Lo que se eligió: el nombre ya limpio y los ids de los tipos documentales, en el orden en que se marcaron y sin repetir. */
		alContinuar: (eleccion: { nombre: string; tipos: string[] }) => void;
	} = $props();

	let nombre = $state('');
	/** Los ids marcados, en el orden en que se marcaron. */
	let marcados = $state<string[]>([]);

	const activos = $derived(tiposDocumentales.filter((t) => t.estado === 'activo'));
	const opciones = $derived(activos.map((t) => ({ valor: t.id, etiqueta: t.nombre })));
	/** Lo marcado que sigue siendo ofrecible: si la biblioteca cambió mientras tanto y uno dejó de estar activo, ya no cuenta. */
	const elegidos = $derived(marcados.filter((id) => activos.some((t) => t.id === id)));
	const nombreDe = (id: string) => activos.find((t) => t.id === id)?.nombre ?? '';

	const nombreLimpio = $derived(nombre.trim());
	const repetido = $derived(
		estadoProcesos.cargada && nombreLimpio !== '' && estadoProcesos.lista.some((p) => claveDeNombreTipo(p.datos.nombre) === claveDeNombreTipo(nombreLimpio))
	);
	const completo = $derived(nombreLimpio !== '' && !repetido && elegidos.length > 0);

	// Lo elegido se enseña debajo del desplegable, y el panel es de alto fijo con scroll por dentro: en una pantalla normal las etiquetas quedaban al
	// borde o cortadas y había que desplazar para confirmar qué se marcó y en qué orden (lo vio la prueba en navegador, 2026-11-06). Al marcar, se
	// desplaza lo justo para que se vean.
	let listaElegidos = $state<HTMLUListElement | null>(null);
	$effect(() => {
		if (elegidos.length === 0 || !listaElegidos) return;
		const lista = listaElegidos;
		void tick().then(() => lista.scrollIntoView({ block: 'nearest' }));
	});

	function continuar() {
		if (!completo) return;
		alContinuar({ nombre: nombreLimpio, tipos: [...new Set(elegidos)] });
	}
</script>

<form
	class="flex h-full w-full flex-col"
	data-testid="nuevo-proceso-form"
	onsubmit={(e) => {
		e.preventDefault();
		continuar();
	}}
>
	<div class="min-h-0 flex-1 overflow-y-auto">
		<h3 class="text-xl font-medium text-foreground">Nuevo proceso</h3>
		<p class="mt-1 text-sm text-muted-foreground">Corre sobre un expediente completo y toma de él los documentos de los tipos que elijas.</p>

		<div class="mt-4 rounded-xl border border-border bg-card p-4">
			<label for="nuevo-proceso-nombre" class="text-base font-medium text-foreground">Nombre de proceso *</label>
			<Input
				id="nuevo-proceso-nombre"
				class="mt-2 h-11.5"
				data-testid="nuevo-proceso-nombre"
				bind:value={nombre}
				maxlength={MAX_NOMBRE_PROCESO}
				placeholder="Ej. Alta de cliente"
				autocomplete="off"
				aria-invalid={repetido ? true : undefined}
				aria-describedby={repetido ? 'nuevo-proceso-nombre-repetido' : undefined}
			/>
			{#if repetido}
				<p id="nuevo-proceso-nombre-repetido" role="alert" data-testid="nuevo-proceso-nombre-repetido" class="mt-2 text-xs text-destructive">
					Ya hay un proceso con ese nombre en tu organización. Ponle otro.
				</p>
			{/if}
		</div>

		<div class="mt-4 border-t border-border pt-4">
			<h4 class="text-xl font-medium text-foreground">Selección de tipos documentales</h4>
			<p class="mt-1 text-sm text-muted-foreground">Marca todos los tipos documentales que necesita este proceso. Los campos los eliges después, en el lienzo.</p>

			{#if estadoBiblioteca.errorCarga}
				<p class="mt-4 text-sm text-destructive" role="alert" data-testid="nuevo-proceso-error">No se pudo leer la biblioteca de tipos documentales: {estadoBiblioteca.errorCarga}</p>
			{:else if !estadoBiblioteca.cargada}
				<p class="mt-4 text-sm text-muted-foreground" role="status" data-testid="nuevo-proceso-cargando">Cargando los tipos documentales…</p>
			{:else if activos.length === 0}
				<p class="mt-4 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground" data-testid="nuevo-proceso-sin-tipos">
					Tu organización no tiene tipos documentales activos. Se activan en Configuración › Tipos documentales; sin ninguno, un proceso no tiene qué usar como entrada.
				</p>
			{:else}
				<div class="mt-4 rounded-xl border border-border bg-card p-4">
					<label for="nuevo-proceso-tipos" class="text-base font-medium text-foreground">Tipos documentales *</label>
					<div class="mt-2">
						<DesplegableMultiple
							id="nuevo-proceso-tipos"
							testid="nuevo-proceso-tipos"
							marcador="Selecciona uno o más tipos documentales"
							{opciones}
							bind:valor={marcados}
							alto="h-11.5 text-sm"
						/>
					</div>

					{#if elegidos.length > 0}
						<ul bind:this={listaElegidos} class="mt-3 flex flex-wrap gap-2" data-testid="nuevo-proceso-elegidos" aria-label="Tipos documentales elegidos">
							{#each elegidos as id (id)}
								<li class="flex items-center gap-1 rounded-full border border-border bg-muted/60 py-1 pr-1 pl-3 text-sm text-foreground" data-testid="nuevo-proceso-elegido">
									<span>{nombreDe(id)}</span>
									<button
										type="button"
										class="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
										data-testid="nuevo-proceso-quitar-tipo"
										title="Quitar «{nombreDe(id)}»"
										aria-label="Quitar «{nombreDe(id)}»"
										onclick={() => (marcados = marcados.filter((m) => m !== id))}
									>
										<X class="size-3.5" />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="mt-4 flex items-center justify-end gap-4 border-t border-border pt-3">
		<Button type="button" variant="link" class="h-9.5 px-4 text-destructive" data-testid="nuevo-proceso-cancelar" onclick={alCancelar}>Cancelar</Button>
		<Button
			type="submit"
			class="h-9.5 px-4"
			data-testid="nuevo-proceso-continuar"
			disabled={!completo}
			title={completo ? undefined : nombreLimpio === '' ? 'Ponle un nombre al proceso' : repetido ? 'Ese nombre ya lo tiene otro proceso' : 'Elige al menos un tipo documental'}
		>
			Continuar al lienzo
		</Button>
	</div>
</form>
