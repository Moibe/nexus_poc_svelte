<script lang="ts">
	/**
	 * La barra de arriba del lienzo (motor de reglas, 2026-10-20): el nombre del proceso, si está guardado, y lo que se hace con él:
	 * volver a la lista de procesos, borrarlo y guardarlo.
	 *
	 * Hasta el 2026-10-29 la barra traía un selector «Procesos ▾» para abrir otro y un «Nuevo»; desde que el motor arranca en la lista de
	 * procesos (`/motor-de-reglas`), abrir otro o empezar uno nuevo se hace allá, y aquí queda «Procesos» para regresar. Es un enlace
	 * normal: si hay cambios sin guardar, el lienzo pregunta antes de dejarlos (`beforeNavigate`).
	 *
	 * Sin «Corre sobre» (2026-11-05, Moibe: quitar los expedientes virtuales). Del 2026-10-29 al 2026-11-05 la barra traía también el TIPO DE
	 * EXPEDIENTE VIRTUAL sobre el que corría el proceso (un selector, con un cuadrito de ayuda cuando la organización no tenía tipos que elegir); era
	 * obligatorio para guardar y de él salían los tipos documentales que el lienzo ofrecía. Con los expedientes virtuales fuera, un proceso corre sobre
	 * cualquier expediente de la organización y la barra solo lleva el nombre.
	 *
	 * «Guardar» NO se apaga de verdad cuando falta algo (2026-11-03, Moibe: «si el botón está greyado y lo pican, que le avise que hay que ponerle
	 * nombre al proceso y focusee el cursor ahí»): un botón con `disabled` no recibe clics, así que se ve apagado (`aria-disabled`, mismo gris) y
	 * al pulsarlo dice qué falta (`faltaParaGuardar`, en `reglas.ts`, que también decide el orden), bajo el campo que corresponde: sin nombre, el
	 * cursor va al nombre. Sin cambios que guardar no dice nada (su título ya lo explica). Solo se apaga con `disabled` mientras guarda.
	 *
	 * Desde el 2026-11-03 el RESULTADO también es obligatorio (Moibe: «sí, que sea obligatorio el Resultado»): sin su nodo no se guarda, porque un
	 * proceso sin la palabra con la que termina no tiene con qué contestar cuando se ejecute. Con nombre y tipos documentales pero sin Resultado,
	 * «Guardar» lo dice bajo el botón y le pide a la paleta (`alFaltaResultado`) que abra «Salidas del proceso» y señale el botón del Resultado. Basta
	 * con que el nodo exista: conectarlo a una regla no se exige para guardar (se puede dejar a medias), pero un proceso sin regla en su Resultado no
	 * se ejecuta.
	 *
	 * Es solo presentación: quien decide qué pasa con cada botón es `LienzoDeProceso`, que es dueño del dibujo.
	 */
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Save from '@lucide/svelte/icons/save';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { faltaParaGuardar, type FaltaParaGuardar } from '$lib/reglas/reglas';
	import type { EstadoDeProceso } from '$lib/state/procesos.svelte';

	let {
		nombre = $bindable(),
		estado,
		guardando,
		puedeGuardar,
		puedeBorrar,
		tieneResultado,
		tieneDocumento,
		tiposNoActivos,
		nombreOcupado,
		alGuardar,
		alBorrar,
		alFaltaResultado,
		alFaltaDocumento,
		alFaltaActivo
	}: {
		nombre: string;
		estado: EstadoDeProceso;
		guardando: boolean;
		puedeGuardar: boolean;
		puedeBorrar: boolean;
		/** El lienzo ya trae su nodo de «Resultado» (obligatorio para guardar). */
		tieneResultado: boolean;
		/** El lienzo trae al menos un tipo documental (obligatorio para guardar: son las entradas del proceso). */
		tieneDocumento: boolean;
		/** Los nombres de los tipos documentales del lienzo que NO están activos (borrador, archivados o borrados): con alguno no se guarda. */
		tiposNoActivos: string[];
		/** El nombre que el servidor dijo que ya tiene otro proceso de la organización (409 `ya_existe`), o `null`. Se quita al cambiarlo. */
		nombreOcupado: string | null;
		alGuardar: () => void;
		alBorrar: () => void;
		/** Se pulsó «Guardar» sin Resultado: que la paleta lo señale. */
		alFaltaResultado: () => void;
		/** Se pulsó «Guardar» sin ningún tipo documental: que la paleta los señale. */
		alFaltaDocumento: () => void;
		/** Se pulsó «Guardar» con tipos que no están activos: que el lienzo señale el primero. */
		alFaltaActivo: () => void;
	} = $props();

	const TEXTO_DE_ESTADO: Record<EstadoDeProceso, string> = {
		nuevo: 'Proceso nuevo',
		sin_guardar: 'Sin guardar',
		cambios: 'Cambios sin guardar',
		guardado: 'Todos los cambios guardados'
	};

	/** Lo primero que le falta al proceso para guardarse (el orden es el de `faltaParaGuardar`); `null` si nada. Es lo que dice el título del botón. */
	const queFalta = $derived<FaltaParaGuardar | null>(
		faltaParaGuardar({ nombre, hayTipoDocumental: tieneDocumento, tiposNoActivos: tiposNoActivos.length, hayResultado: tieneResultado })
	);
	/** Qué le falta al proceso para guardarse, si la persona pulsó «Guardar» sin eso: se dice bajo el campo y se quita al llenarlo. */
	let falta = $state<FaltaParaGuardar | null>(null);
	$effect(() => {
		if (falta === 'nombre' && nombre.trim() !== '') falta = null;
		if (falta === 'documento' && tieneDocumento) falta = null;
		if (falta === 'inactivos' && tiposNoActivos.length === 0) falta = null;
		if (falta === 'resultado' && tieneResultado) falta = null;
	});
	/** El nombre que se está escribiendo es justo el que el servidor rechazó por repetido: se dice bajo el campo hasta que se cambie. */
	const nombreRepetido = $derived(nombreOcupado !== null && nombre.trim() === nombreOcupado);

	function pulsarGuardar() {
		if (guardando) return;
		if (puedeGuardar) {
			falta = null;
			alGuardar();
		} else if (queFalta === 'nombre') {
			falta = 'nombre';
			document.getElementById('nombre-del-proceso')?.focus();
		} else if (queFalta === 'documento') {
			falta = 'documento';
			alFaltaDocumento();
		} else if (queFalta === 'inactivos') {
			falta = 'inactivos';
			alFaltaActivo();
		} else if (queFalta === 'resultado') {
			falta = 'resultado';
			alFaltaResultado();
		}
		// Sin cambios que guardar: no hay nada que decir; el título del botón ya lo explica.
	}
</script>

<div class="mt-6 flex flex-wrap items-center gap-3" data-testid="barra-proceso">
	<Button variant="outline" href="/motor-de-reglas" data-testid="volver-a-procesos">
		<ChevronLeft />
		Procesos
	</Button>
	<div class="relative w-full max-w-sm min-w-56 flex-1">
		<label class="sr-only" for="nombre-del-proceso">Nombre del proceso</label>
		<Input
			id="nombre-del-proceso"
			data-testid="proceso-nombre"
			bind:value={nombre}
			maxlength={200}
			placeholder="Nombre del proceso"
			autocomplete="off"
			aria-invalid={falta === 'nombre' || nombreRepetido ? true : undefined}
		/>
		{#if falta === 'nombre'}
			<p role="alert" data-testid="falta-nombre" class="absolute top-full left-0 z-10 mt-1.5 rounded-md border border-destructive/30 bg-card px-2.5 py-1.5 text-xs text-destructive shadow-md">
				Ponle un nombre al proceso para guardarlo.
			</p>
		{:else if nombreRepetido}
			<p role="alert" data-testid="nombre-repetido" class="absolute top-full left-0 z-10 mt-1.5 rounded-md border border-destructive/30 bg-card px-2.5 py-1.5 text-xs text-destructive shadow-md">
				Ya hay un proceso con ese nombre en tu organización. Ponle otro para guardarlo.
			</p>
		{/if}
	</div>
	<span
		data-testid="proceso-estado"
		data-estado={estado}
		role="status"
		class="text-xs {estado === 'cambios' || estado === 'sin_guardar' ? 'font-medium text-foreground' : 'text-muted-foreground'}"
	>
		{TEXTO_DE_ESTADO[estado]}
	</span>

	<div class="ml-auto flex flex-wrap items-center gap-2">
		{#if puedeBorrar}
			<Button variant="destructive" data-testid="eliminar-proceso" onclick={alBorrar}>
				<Trash2 />
				Eliminar
			</Button>
		{/if}
		<div class="relative">
			<Button
				data-testid="guardar-proceso"
				disabled={guardando}
				aria-disabled={!puedeGuardar || guardando}
				class={!puedeGuardar && !guardando ? 'cursor-not-allowed opacity-50' : ''}
				title={queFalta === 'nombre'
					? 'Ponle un nombre al proceso para guardarlo'
					: queFalta === 'documento'
						? 'Agrega al menos un tipo documental para guardarlo'
						: queFalta === 'inactivos'
							? 'Quita del proceso los tipos documentales que no están activos (o vuelve a activarlos) para guardarlo'
							: queFalta === 'resultado'
								? 'Agrega el nodo «Resultado» para guardarlo'
								: !puedeGuardar
									? 'No hay cambios que guardar'
									: 'Guardar (Ctrl+S)'}
				onclick={pulsarGuardar}
			>
				<Save />
				{guardando ? 'Guardando…' : 'Guardar'}
			</Button>
			{#if falta === 'documento'}
				<p role="alert" data-testid="falta-documento" class="absolute top-full right-0 z-10 mt-1.5 w-72 rounded-md border border-destructive/30 bg-card px-2.5 py-1.5 text-xs text-destructive shadow-md">
					Agrega al menos un tipo documental para guardar: son las entradas del proceso. Los encuentras en «Tipos documentales».
				</p>
			{/if}
			{#if falta === 'inactivos'}
				<p role="alert" data-testid="falta-activo" class="absolute top-full right-0 z-10 mt-1.5 w-72 rounded-md border border-destructive/30 bg-card px-2.5 py-1.5 text-xs text-destructive shadow-md">
					Solo se pueden usar tipos documentales activos y estos ya no lo están: {tiposNoActivos.map((n) => `«${n}»`).join(', ')}. Quítalos del proceso o vuelve a activarlos en Configuración › Tipos documentales.
				</p>
			{/if}
			{#if falta === 'resultado'}
				<p role="alert" data-testid="falta-resultado" class="absolute top-full right-0 z-10 mt-1.5 w-72 rounded-md border border-destructive/30 bg-card px-2.5 py-1.5 text-xs text-destructive shadow-md">
					Agrega el nodo «Resultado» para guardar: es la palabra con la que termina el proceso. Lo encuentras en «Salidas del proceso».
				</p>
			{/if}
		</div>
	</div>
</div>
