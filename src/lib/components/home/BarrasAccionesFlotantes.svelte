<script lang="ts">
	/**
	 * El carril de píldoras de acciones: flota al pie de la VENTANA, centrado,
	 * por encima de las tres tarjetas.
	 *
	 * ## Por qué vive aquí y no dentro de cada tarjeta (2026-10-01)
	 *
	 * Hasta hoy cada bandeja montaba su píldora anclada al pie de SU tarjeta. No
	 * cabía: la columna da 433px y la píldora del Pipeline pedía más con la
	 * tipografía real, así que aparecía una barra de scroll horizontal debajo de
	 * ella y las acciones quedaban cortadas. Se pidió sacarla al centro y afuera,
	 * como en Figma, que es además donde estuvo hasta el 2026-09-10.
	 *
	 * Montarla aquí, hermana de las tres columnas, es lo mismo que ya se hace con
	 * los dos paneles laterales (ver `+page.svelte`): dentro de la tarjeta queda
	 * presa de un contenedor con `overflow-y-auto`, y además `fixed` dentro de
	 * una columna no gana ancho, que era justo el problema.
	 *
	 * ## Lo que NO cambió: una píldora por bandeja
	 *
	 * El 2026-09-10 se partió la barra única en una por bandeja, a pedido
	 * explícito y por una razón estructural que sigue siendo cierta: **las
	 * bandejas pueden tener selección al mismo tiempo**, así que una sola barra
	 * no podría decir sobre cuál va a actuar ("Iniciar pipeline (1)" hablaba de
	 * la Bandeja de preparación y "Detalle" del Pipeline, en el mismo control).
	 * Eso se conserva entero: siguen siendo dos píldoras independientes, cada una
	 * con las acciones de su bandeja y actuando solo sobre su selección. Lo
	 * único que se movió es dónde se paran.
	 *
	 * Cuando las dos están a la vista se apilan —nunca se encima una sobre
	 * otra— y cada una se nombra, que es la pregunta que el diseño no contesta
	 * porque sus frames dibujan siempre una sola bandeja con selección. Con una
	 * sola píldora no se dibuja ningún nombre y se ve exactamente como el frame.
	 *
	 * La Carga documental sigue sin píldora: ya tiene sus propios controles
	 * ("Cancelar" / "Subir documentos") y no son contextuales a la selección.
	 */
	import BarraAccionesPanel, { type AccionPanel } from './BarraAccionesPanel.svelte';
	import Eye from '@lucide/svelte/icons/eye';
	import FileBadge from '@lucide/svelte/icons/file-badge';
	import Clock from '@lucide/svelte/icons/clock';
	import Workflow from '@lucide/svelte/icons/workflow';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Play from '@lucide/svelte/icons/play';
	import { documentosEnBandeja } from '$lib/state/bandeja.svelte';
	import { documentosEnPipeline, iniciarPipeline, sePuedeProcesar } from '$lib/state/pipeline.svelte';

	let {
		alAbrirDetalle,
		alAbrirRegistroOt,
		alAbrirEstado
	}: {
		alAbrirDetalle: (id: string) => void;
		alAbrirRegistroOt: (id: string) => void;
		alAbrirEstado: (id: string) => void;
	} = $props();

	// ── Bandeja de preparación ──────────────────────────────────────────────
	const enBandeja = $derived(documentosEnBandeja.filter((d) => d.seleccionado));

	// "Iniciar pipeline" solo aparece si hay algo seleccionado que de verdad se
	// pueda mandar. Un archivo protegido o corrupto es seleccionable pero no es
	// procesable, y ofrecer el botón para que luego no pase nada es peor que no
	// ofrecerlo.
	const procesables = $derived(enBandeja.filter(sePuedeProcesar));

	// "Detalle" NO va en esta píldora: un documento que sigue en la Bandeja
	// todavía no tiene resultado de OCR que mostrar, así que ahí estaría apagado
	// para siempre. Ese es justo el ruido que se quitó al darle su barra a cada
	// bandeja.
	const accionesBandeja = $derived<AccionPanel[]>([
		...(procesables.length > 0
			? [
					{
						etiqueta: `Iniciar pipeline (${procesables.length})`,
						icono: Play,
						alHacerClic: iniciarPipeline,
						testid: 'accion-iniciar-pipeline'
					}
				]
			: []),
		// Sin comportamiento todavía: es destructivo y merece su propio modal de
		// confirmación, no un confirm() del navegador.
		{ etiqueta: 'Descartar', icono: CircleX, peligro: true, testid: 'accion-descartar-bandeja' }
	]);

	// ── Pipeline documental ─────────────────────────────────────────────────
	const enPipeline = $derived(documentosEnPipeline.filter((d) => d.seleccionado));

	// El detalle es de UN documento: con varios seleccionados no se sabe cuál
	// abrir.
	const unico = $derived(enPipeline.length === 1 ? enPipeline[0].id : null);

	// "Iniciar pipeline" NO va en esta píldora: estos documentos ya pasaron por
	// ahí. Coincide con Figma (HU001|106 muestra solo Detalle / Eventos /
	// Descartar para un documento ya procesado).
	const accionesPipeline = $derived<AccionPanel[]>([
		{
			etiqueta: 'Detalle',
			icono: Eye,
			alHacerClic: unico ? () => alAbrirDetalle(unico) : undefined,
			testid: 'accion-detalle'
		},
		// "Registro de OT" se encendió el 2026-09-10. Abre una ventana de SOLO
		// LECTURA con los campos que el extractor sacó del documento. Sigue SIN
		// existir el acto de "registrar" una OT (asentar un folio, aprobar): no
		// hay orden de trabajo como concepto en el back ni tabla donde asentarla.
		// El nombre promete más de lo que hace, y es a propósito: es el nombre
		// que pidió el usuario. Misma regla que "Detalle": exige UN documento.
		{
			etiqueta: 'Registro de OT',
			icono: FileBadge,
			alHacerClic: unico ? () => alAbrirRegistroOt(unico) : undefined,
			testid: 'accion-registro-ot'
		},
		// Las dos de abajo siguen deshabilitadas y sin `onclick`, para que al leer
		// el código sea obvio que faltan por cablear:
		//   - Eventos   → necesita `audit_event`, que vive en SQL Server y
		//     todavía no existe.
		//   - Descartar → es destructivo y merece su propio modal de
		//     confirmación, no un confirm() del navegador.
		// "Eventos" sigue apagado y sin `onclick`: necesita `audit_event`, que
		// vive en SQL Server y todavía no existe. NO es lo mismo que "Estado",
		// que sí funciona: aquélla sería la bitácora completa y duradera del
		// documento (quién lo tocó, desde dónde, qué cambió), y ésta es la
		// historia de sus estados tal como la vio este navegador.
		{ etiqueta: 'Eventos', icono: Clock, testid: 'accion-eventos' },
		// "Estado" (2026-10-01): la línea de tiempo de sus cambios de estado.
		// Como "Detalle", exige UN documento: la ventana cuenta la historia de
		// uno.
		{
			etiqueta: 'Estado',
			icono: Workflow,
			alHacerClic: unico ? () => alAbrirEstado(unico) : undefined,
			testid: 'accion-estado'
		},
		// "Descartar" es destructivo y merece su propio modal de confirmación, no
		// un confirm() del navegador; sigue sin cablear.
		{ etiqueta: 'Descartar', icono: CircleX, peligro: true, testid: 'accion-descartar-pipeline' }
	]);

	const dos = $derived(enBandeja.length > 0 && enPipeline.length > 0);
</script>

<!-- `pointer-events-none` en el carril y `auto` en cada píldora: el carril mide
     todo el ancho de la ventana para poder centrar, y sin esto se comería los
     clics de lo que queda debajo. -->
{#if enBandeja.length > 0 || enPipeline.length > 0}
	<div
		class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
		data-testid="carril-acciones"
	>
		{#if enBandeja.length > 0}
			<BarraAccionesPanel
				acciones={accionesBandeja}
				nombreBandeja={dos ? 'Bandeja de preparación' : undefined}
			/>
		{/if}
		{#if enPipeline.length > 0}
			<BarraAccionesPanel
				acciones={accionesPipeline}
				nombreBandeja={dos ? 'Pipeline' : undefined}
			/>
		{/if}
	</div>
{/if}
