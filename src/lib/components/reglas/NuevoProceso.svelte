<script lang="ts">
	/**
	 * El alta de un proceso (2026-11-06, Moibe: «al crear un proceso nuevo, en lugar de ir directo al canvas, haremos lo que dice este Figma, o sea
	 * seleccionar los tipos documentales que usaremos (con una excepción, no seleccionaremos campos): eso sí lo podemos hacer en el canvas»).
	 *
	 * Sale del Figma Sprint 5, HUN5 «Crear proceso» (frames `5480:105239` el formulario vacío, `5503:106159` con el tipo abierto y `5503:106491` con los
	 * campos elegidos): «Nuevo proceso», el nombre, y una fila por tipo documental con «Agregar otro…». Va en el mismo panel de la lista de procesos
	 * (`ListaDeProcesos.svelte`), como en el diseño, y al continuar lleva al lienzo de un proceso nuevo YA con el nombre y con un nodo por cada tipo
	 * elegido (`direccionDeProcesoNuevo` / `entradasDeProcesoNuevo`, en `reglas.ts`).
	 *
	 * Lo que se aparta del diseño:
	 *   · SIN «Campos»: la columna de campos de cada fila y el «Campo ancla» no están (Moibe: los campos se eligen en el lienzo, conectándolos a las reglas).
	 *   · «Agregar otro campo» dice «Agregar otro tipo documental», que es lo que agrega.
	 *   · «Crear proceso» dice «Continuar al lienzo»: nada queda guardado todavía (para guardar falta, por lo menos, el nodo «Resultado», que se arma en el
	 *     lienzo), y un botón que dijera «Crear» prometería un proceso que aún no existe.
	 *   · «Cancelar registro» dice «Cancelar».
	 *   · El desplegable es una sola lista (el diseño la parte en «Documentos de sistema» y «Tipo documental configurado»; aquí no hay esa distinción) y solo
	 *     ofrece los tipos ACTIVOS, como la paleta del lienzo (2026-11-05): uno en borrador o archivado no se puede usar en un proceso. Un tipo ya elegido
	 *     en otra fila no se ofrece de nuevo.
	 *   · El texto que dice que el sistema «agrupará los documentos relacionados en expedientes» es de antes de que un proceso corriera sobre el expediente
	 *     completo; aquí dice lo que de verdad pasa.
	 *
	 * El nombre se comprueba contra los procesos que ya hay (sin distinguir mayúsculas ni espacios de más, la misma regla del servidor) para avisar ya y no
	 * hasta el primer guardado; nexus_back lo vuelve a comprobar al guardar.
	 */
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import X from '@lucide/svelte/icons/x';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { MAX_NOMBRE_PROCESO } from '$lib/reglas/reglas';
	import { claveDeNombreTipo, estadoBiblioteca, tiposDocumentales } from '$lib/state/configuracion.svelte';
	import { estadoProcesos } from '$lib/state/procesos.svelte';

	let {
		alCancelar,
		alContinuar
	}: {
		alCancelar: () => void;
		/** Lo que se eligió: el nombre ya limpio y los ids de los tipos documentales, en el orden de las filas y sin repetir. */
		alContinuar: (eleccion: { nombre: string; tipos: string[] }) => void;
	} = $props();

	let nombre = $state('');
	/** Una fila por tipo; `''` es una fila sin elegir todavía. Arranca con una. */
	let filas = $state<string[]>(['']);

	const activos = $derived(tiposDocumentales.filter((t) => t.estado === 'activo'));
	const nombreDe = (id: string) => activos.find((t) => t.id === id)?.nombre ?? '';
	/** Lo elegido que sigue siendo ofrecible: si la biblioteca cambió mientras tanto y uno dejó de estar activo, ya no cuenta. */
	const elegidos = $derived(filas.filter((id) => id !== '' && activos.some((t) => t.id === id)));
	/** Los tipos que una fila puede ofrecer: los activos que no eligió OTRA fila (el suyo propio se queda). */
	const disponibles = (indice: number) => activos.filter((t) => t.id === filas[indice] || !filas.includes(t.id));

	const nombreLimpio = $derived(nombre.trim());
	const repetido = $derived(
		estadoProcesos.cargada && nombreLimpio !== '' && estadoProcesos.lista.some((p) => claveDeNombreTipo(p.datos.nombre) === claveDeNombreTipo(nombreLimpio))
	);
	const completo = $derived(nombreLimpio !== '' && !repetido && elegidos.length > 0);
	/** Otra fila solo tiene sentido si la última ya eligió algo y todavía queda un tipo activo sin usar. */
	const puedeAgregar = $derived(!filas.includes('') && filas.length < activos.length);

	function elegir(indice: number, id: string) {
		filas = filas.map((f, i) => (i === indice ? id : f));
	}
	function quitar(indice: number) {
		filas = filas.filter((_, i) => i !== indice);
		if (filas.length === 0) filas = [''];
	}
	function continuar() {
		if (!completo) return;
		alContinuar({ nombre: nombreLimpio, tipos: [...new Set(elegidos)] });
	}
</script>

<form
	class="mx-auto flex h-full w-full max-w-3xl flex-col"
	data-testid="nuevo-proceso-form"
	onsubmit={(e) => {
		e.preventDefault();
		continuar();
	}}
>
	<div class="min-h-0 flex-1 overflow-y-auto">
		<h3 class="text-xl font-medium text-foreground">Nuevo proceso</h3>
		<p class="mt-1 text-sm text-muted-foreground">
			Un proceso corre sobre un expediente completo y toma de él los documentos de los tipos que elijas aquí. Estos tipos serán las entradas de tu proceso en
			el lienzo; los campos de cada uno y las reglas las armas allá.
		</p>

		<div class="mt-5 rounded-xl border border-border bg-card p-4">
			<label for="nuevo-proceso-nombre" class="text-base font-medium text-foreground">Nombre de proceso *</label>
			<Input
				id="nuevo-proceso-nombre"
				class="mt-2"
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

		<div class="mt-6 border-t border-border pt-5">
			<h4 class="text-xl font-medium text-foreground">Selección de tipos documentales</h4>
			<p class="mt-1 text-sm text-muted-foreground">Elige los tipos documentales que necesita este proceso. Los campos los eliges después, en el lienzo.</p>

			{#if estadoBiblioteca.errorCarga}
				<p class="mt-4 text-sm text-destructive" role="alert" data-testid="nuevo-proceso-error">No se pudo leer la biblioteca de tipos documentales: {estadoBiblioteca.errorCarga}</p>
			{:else if !estadoBiblioteca.cargada}
				<p class="mt-4 text-sm text-muted-foreground" role="status" data-testid="nuevo-proceso-cargando">Cargando los tipos documentales…</p>
			{:else if activos.length === 0}
				<p class="mt-4 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground" data-testid="nuevo-proceso-sin-tipos">
					Tu organización no tiene tipos documentales activos. Se activan en Configuración › Tipos documentales; sin ninguno, un proceso no tiene qué usar como entrada.
				</p>
			{:else}
				<div class="mt-4 flex flex-col gap-3" data-testid="nuevo-proceso-filas">
					{#each filas as fila, i (i)}
						<div class="flex items-end gap-2 rounded-xl border border-border bg-card p-4" data-testid="nuevo-proceso-fila">
							<div class="flex min-w-0 flex-1 flex-col gap-2">
								<span class="text-base font-medium text-foreground {i > 0 ? 'sr-only' : ''}">Tipo documental *</span>
								<Select.Root type="single" value={fila} onValueChange={(valor) => elegir(i, valor)}>
									<Select.Trigger class="h-10 w-full" data-testid="nuevo-proceso-tipo" aria-label="Tipo documental {i + 1}">
										{nombreDe(fila) || 'Selecciona un tipo documental'}
									</Select.Trigger>
									<Select.Content>
										{#each disponibles(i) as t (t.id)}
											<Select.Item value={t.id} label={t.nombre} data-testid="nuevo-proceso-opcion-tipo" />
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							{#if filas.length > 1}
								<button
									type="button"
									class="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
									data-testid="nuevo-proceso-quitar-tipo"
									title="Quitar este tipo documental"
									aria-label="Quitar el tipo documental {i + 1}"
									onclick={() => quitar(i)}
								>
									<X class="size-4" />
								</button>
							{/if}
						</div>
					{/each}
				</div>

				<div class="mt-3 flex justify-center">
					<button
						type="button"
						class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
						data-testid="nuevo-proceso-agregar-tipo"
						disabled={!puedeAgregar}
						title={puedeAgregar ? undefined : filas.includes('') ? 'Elige primero el tipo de la fila de arriba' : 'Ya elegiste todos los tipos activos'}
						onclick={() => (filas = [...filas, ''])}
					>
						<CirclePlus class="size-4" />
						Agregar otro tipo documental
					</button>
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
