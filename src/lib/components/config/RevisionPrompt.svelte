<script lang="ts">
	/**
	 * Panel derecho de la pantalla de revisión de prompts: corre el extractor
	 * real contra el documento de ejemplo y presenta un par
	 * "valor correcto / valor extraído" por campo, con Correcto/Incorrecto.
	 *
	 * Construido desde la captura del 2026-09-06 (la ficha de `fecha_inicio`),
	 * con UNA desviación deliberada del diseño, que vale explicar porque cambia
	 * el significado de la pantalla:
	 *
	 *   En la captura los dos valores llegan llenos y distintos (12/07/2026 vs
	 *   12-01-2028) y aun así se pregunta Correcto/Incorrecto. Eso no puede ser
	 *   el estado inicial: "valor correcto" es la verdad de referencia, y hoy no
	 *   existe ningún lugar de donde sacarla — la base todavía no está, y no hay
	 *   sistema previo que ya tenga capturado este documento. Si el sistema ya
	 *   supiera el valor correcto, marcar "Incorrecto" no le enseñaría nada.
	 *
	 *   Así que aquí "Valor correcto" nace VACÍO y editable, y los botones son
	 *   el atajo para llenarlo: "Correcto" copia el valor extraído (el caso
	 *   mayoritario, un clic y sin teclear) e "Incorrecto" pone el cursor en el
	 *   campo para que la persona escriba el valor real. La captura del diseño
	 *   es entonces el estado FINAL de una ficha ya corregida, no el inicial —
	 *   y ese estado final es precisamente el que muestra solo un ícono azul en
	 *   vez de los dos botones de texto (ver el pie de cada ficha, abajo).
	 *
	 * Lo que se acumula aquí es exactamente el material que después se le
	 * mandaría a Document AI como ejemplos etiquetados. Hoy no se persiste: se
	 * pierde al salir de la pantalla. Ver `docs/pendientes-ux.md`.
	 */
	import Ban from '@lucide/svelte/icons/ban';
	import Braces from '@lucide/svelte/icons/braces';
	import Check from '@lucide/svelte/icons/check';

	import { Button } from '$lib/components/ui/button/index.js';
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
	import { camposDe, type CampoExtraido, type ResultadoIne } from '$lib/types/ine';

	let {
		archivo,
		numero = 1,
		onCambioRevision
	}: {
		/** El documento de ejemplo que se eligió en el paso anterior. */
		archivo: File;
		/** Qué prompt es este (1-indexado), solo para el título — hoy los N
		 *  prompts son la misma operación repetida, así que no cambia nada más. */
		numero?: number;
		/** Cuántos campos llevan veredicto, de cuántos hay. Quien nos monta lo
		 *  usa para decidir si "Continuar" ya tiene sentido. */
		onCambioRevision?: (revisados: number, total: number) => void;
	} = $props();

	type Veredicto = 'correcto' | 'incorrecto' | null;

	/** Una fila de la revisión: el campo tal como lo extrajo Document AI, más
	 *  lo que la persona dice al respecto. */
	type Fila = {
		nombre: string;
		campo: CampoExtraido;
		valorCorrecto: string;
		veredicto: Veredicto;
	};

	let estado = $state<'extrayendo' | 'error' | 'listo'>('extrayendo');
	let error = $state('');
	let filas = $state<Fila[]>([]);

	/** Invalida extracciones viejas: si se reintenta mientras una corrida
	 *  anterior sigue en vuelo, la que llegue tarde no debe pisar el resultado
	 *  de la nueva (mismo patrón que la lectura en `DocumentoParaPrompts`). */
	let corrida = 0;

	/** El valor que el extractor propone, ya elegido entre normalizado y crudo.
	 *  El normalizado es el que pasó por la regla del campo, así que es el que
	 *  se compara; el crudo es el respaldo cuando no hubo regla. */
	function valorExtraido(campo: CampoExtraido): string {
		return campo.value_normalized ?? campo.value_raw ?? '';
	}

	async function extraer() {
		const mia = ++corrida;
		estado = 'extrayendo';
		error = '';
		filas = [];

		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);

		let respuesta: Response;
		try {
			respuesta = await fetch('/api/pipeline/ine', { method: 'POST', body: cuerpo });
		} catch {
			if (mia !== corrida) return;
			error = 'No se pudo contactar al servidor. Revisa tu conexión y vuelve a intentar.';
			estado = 'error';
			return;
		}
		if (mia !== corrida) return;

		let datos: unknown = null;
		try {
			datos = await respuesta.json();
		} catch {
			// Cae aquí cuando algo se rompió antes de llegar al BFF y devolvió
			// HTML. Sin este caso el `catch` de arriba no aplica y el componente
			// se quedaría en 'extrayendo' para siempre.
			if (mia !== corrida) return;
			error = 'El servidor respondió algo que no se pudo leer.';
			estado = 'error';
			return;
		}
		if (mia !== corrida) return;

		if (!respuesta.ok) {
			// El BFF ya normaliza todos sus errores a `mensaje`, incluidos los
			// mapeados de Document AI (límite de páginas, archivo ilegible,
			// cuota). Se muestran tal cual porque están escritos para leerse.
			const mensaje = (datos as { mensaje?: unknown } | null)?.mensaje;
			error = typeof mensaje === 'string' ? mensaje : 'Falló la extracción del documento.';
			estado = 'error';
			return;
		}

		filas = camposDe(datos as ResultadoIne).map(([nombre, campo]) => ({
			nombre,
			campo,
			valorCorrecto: '',
			veredicto: null
		}));
		estado = 'listo';
	}

	// Se dispara con el archivo como dependencia: si algún día se puede cambiar
	// de documento sin salir de la pantalla, la extracción se repite sola.
	$effect(() => {
		void archivo;
		extraer();
	});

	const revisados = $derived(filas.filter((f) => f.veredicto !== null).length);

	$effect(() => {
		onCambioRevision?.(revisados, filas.length);
	});

	function marcarCorrecto(fila: Fila) {
		// El atajo que hace que "Correcto" valga un clic: la verdad de
		// referencia ES el valor extraído, así que se copia.
		fila.valorCorrecto = valorExtraido(fila.campo);
		fila.veredicto = 'correcto';
	}

	function marcarIncorrecto(fila: Fila, boton: HTMLElement) {
		fila.veredicto = 'incorrecto';
		// Decir "incorrecto" sin decir qué era lo correcto no sirve de nada, así
		// que el cursor va directo al campo donde se teclea.
		//
		// Se busca por el DOM (subiendo a la ficha y bajando a su caja) en vez de
		// con un `bind:this` a un arreglo indexado: está medido que ese arreglo
		// se queda vacío aquí, y el índice tampoco sobreviviría a reordenar las
		// filas. La relación "el botón y la caja viven en la misma ficha" sí.
		boton.closest('li')?.querySelector<HTMLInputElement>('input')?.focus();
	}
</script>

<div data-testid="revision-prompt">
	<h3 class="text-xl font-semibold text-foreground">Prompt {numero}</h3>
	<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
		Estos son los datos que el extractor encontró en <span class="font-medium text-foreground"
			>{archivo.name}</span
		>. Confirma cada uno o corrígelo: eso es lo que le enseña al prompt qué es un acierto.
	</p>

	{#if estado === 'extrayendo'}
		<!-- Sin barra de progreso: la extracción es una sola llamada al back y no
		     reporta avance, así que una barra estaría inventando un número. -->
		<p class="mt-8 text-sm text-muted-foreground" data-testid="extrayendo-prompt">
			Extrayendo los datos del documento…
		</p>
	{:else if estado === 'error'}
		<div
			class="mt-8 max-w-2xl rounded-xl border border-destructive/40 bg-destructive/5 p-5"
			data-testid="error-revision-prompt"
		>
			<p class="text-sm text-destructive">{error}</p>
			<Button variant="outline" size="sm" class="mt-4" onclick={extraer}>Volver a intentar</Button>
		</div>
	{:else if filas.length === 0}
		<!-- Respuesta buena pero sin campos: el clasificador dejó pasar el
		     documento y el extractor no reconoció nada. No es un error del
		     sistema, así que no se pinta como tal. -->
		<p class="mt-8 max-w-2xl text-sm text-muted-foreground">
			El extractor no reconoció ningún campo en este documento. Prueba con otro ejemplo del mismo
			tipo documental.
		</p>
	{:else}
		<p class="mt-8 text-sm text-muted-foreground" data-testid="avance-revision">
			{revisados} de {filas.length} campos revisados
		</p>

		<ul class="mt-4 max-w-4xl space-y-4">
			{#each filas as fila, i (fila.nombre)}
				<li
					class="rounded-xl border border-border bg-card"
					data-testid="ficha-campo"
					data-campo={fila.nombre}
					data-veredicto={fila.veredicto ?? 'pendiente'}
				>
					<!-- Grid de tres columnas fijas, no `flex-wrap`: con flex, cada ficha
					     se envolvía en un punto distinto según el largo de sus valores y
					     las columnas dejaban de alinearse entre fichas. -->
					<div class="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-8 px-5 py-4">
						<div class="min-w-0">
							<p class="text-xs text-muted-foreground">Tipo de dato</p>
							<p class="mt-1 truncate text-sm font-medium text-foreground" title={fila.nombre}>
								{fila.nombre}
							</p>
						</div>

						<div class="flex min-w-0 items-start gap-3">
							<span
								class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
								aria-hidden="true"
							>
								<Braces class="size-4" />
							</span>
							<div class="min-w-0 flex-1">
								<label class="block text-xs text-muted-foreground" for="correcto-{i}">
									Valor correcto
								</label>
								<!-- Caja de texto sin bordes a propósito: en la captura esto se
								     ve como texto, pero tiene que ser editable porque es lo
								     ÚNICO que la persona aporta de nuevo. -->
								<input
									id="correcto-{i}"
									bind:value={fila.valorCorrecto}
									placeholder="Escribe el valor real"
									data-testid="valor-correcto"
									class="mt-1 w-full bg-transparent text-sm font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none"
								/>
							</div>
						</div>

						<div class="flex min-w-0 items-start gap-3">
							<span
								class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
								aria-hidden="true"
							>
								<SearchIcon class="size-4" />
							</span>
							<div class="min-w-0">
								<p class="text-xs text-muted-foreground">Valor extraído</p>
								<p
									class="mt-1 truncate text-sm font-medium text-foreground"
									data-testid="valor-extraido"
									title={valorExtraido(fila.campo)}
								>
									{valorExtraido(fila.campo) || '—'}
								</p>
							</div>
						</div>
					</div>

					<!-- Dos estados del pie, corregido el 2026-09-07 a pedido explícito
					     ("quiero que diga las palabras Incorrecto y Correcto, y solo
					     hasta darles click es que se convierten en los iconitos azules"):
					       - PENDIENTE (`fila.veredicto === null`): los dos botones de
					         TEXTO, como cualquier acción del resto de la app.
					       - YA ELEGIDO: el par de botones se reemplaza por un solo
					         cuadrado azul con el ícono (check o ban) — así lucía la
					         captura original, que mostraba nada más UNO por ficha, no
					         los dos. Ese cuadrado es a su vez el botón para deshacer:
					         un clic vuelve a `veredicto = null` y reaparecen los dos
					         botones de texto, que es como se puede corregir un
					         veredicto equivocado sin volver a extraer el documento. -->
					<div class="flex items-center justify-end gap-4 border-t border-border px-5 py-3">
						{#if fila.veredicto === null}
							<Button
								variant="link"
								class="h-auto p-0 text-destructive"
								data-testid="marcar-incorrecto"
								onclick={(e) => marcarIncorrecto(fila, e.currentTarget)}
							>
								Incorrecto
							</Button>
							<Button data-testid="marcar-correcto" onclick={() => marcarCorrecto(fila)}>
								Correcto
							</Button>
						{:else}
							<button
								type="button"
								aria-label={fila.veredicto === 'correcto'
									? 'Marcado como correcto. Da clic para cambiarlo.'
									: 'Marcado como incorrecto. Da clic para cambiarlo.'}
								data-testid="veredicto-elegido"
								data-veredicto={fila.veredicto}
								onclick={() => (fila.veredicto = null)}
								class="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
							>
								{#if fila.veredicto === 'correcto'}
									<Check class="size-4" />
								{:else}
									<Ban class="size-4" />
								{/if}
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
