<script lang="ts">
	/**
	 * LA barra de acciones: una sola, flotando al pie de la VENTANA, centrada,
	 * por encima de las tres tarjetas.
	 *
	 * ## Una sola barra para las tres bandejas (2026-10-01)
	 *
	 * Antes había una píldora por bandeja, apiladas en un carril. Se pidió
	 * juntarlas: *"que la barra de menú ya no sean barras independientes, para
	 * las 3 bandejas usarán la misma barra, es decir, todos los menús que cada
	 * uno ocupe aparecerán en esa barra única de en medio"*.
	 *
	 * Son **las tres**, no las dos que ya tenían píldora: por eso la Carga
	 * documental también entra, con su "Cancelar" y su "Subir documentos", que
	 * hasta hoy vivían al pie de su propia tarjeta. Se MOVIERON, no se
	 * duplicaron — dejarlas en los dos lados sería seguir teniendo barras
	 * independientes, que es justo lo que se pidió quitar.
	 *
	 * ## Lo que la unión obligó a resolver
	 *
	 * La separación existía desde el 2026-09-10 por una razón que no desapareció:
	 * **las bandejas pueden tener selección al mismo tiempo**, así que una barra
	 * única tiene que decir sobre cuál actúa cada acción. La respuesta son los
	 * grupos (ver `BarraAccionesPanel`): un grupo por bandeja, y cuando hay más
	 * de uno cada uno se abre con el nombre de su bandeja. Con uno solo no se
	 * dibuja nombre y se ve igual que el frame.
	 *
	 * ## Por qué vive aquí y no dentro de cada tarjeta
	 *
	 * Dentro de la tarjeta queda presa de un contenedor con `overflow-y-auto`, y
	 * `fixed` dentro de una columna no gana ancho: la columna da 433px y la
	 * píldora pide más con la tipografía real, así que aparecía una barra de
	 * scroll horizontal y las acciones quedaban cortadas. Montarla aquí, hermana
	 * de las tres columnas, es lo mismo que ya se hace con los paneles laterales.
	 */
	import BarraAccionesPanel, {
		type AccionPanel,
		type GrupoAcciones
	} from './BarraAccionesPanel.svelte';
	import Eye from '@lucide/svelte/icons/eye';
	import FileBadge from '@lucide/svelte/icons/file-badge';
	import Clock from '@lucide/svelte/icons/clock';
	import Workflow from '@lucide/svelte/icons/workflow';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Play from '@lucide/svelte/icons/play';
	import Upload from '@lucide/svelte/icons/upload';
	import {
		archivosPendientesDeCarga,
		cancelarCargaPendiente,
		confirmarCargaPendiente,
		documentosEnBandeja
	} from '$lib/state/bandeja.svelte';
	import { documentosEnPipeline, iniciarPipeline, sePuedeProcesar } from '$lib/state/pipeline.svelte';

	let {
		alAbrirDetalle,
		alAbrirRegistroOt,
		alAbrirEstado,
		alAbrirExpedientes
	}: {
		alAbrirDetalle: (id: string) => void;
		alAbrirRegistroOt: (id: string) => void;
		alAbrirEstado: (id: string) => void;
		alAbrirExpedientes: () => void;
	} = $props();

	// ── Carga documental ────────────────────────────────────────────────────
	// A diferencia de las otras dos, esta bandeja no aporta acciones "sobre lo
	// seleccionado" sino el cierre de su propio flujo. Aparecen en cuanto hay
	// algo pendiente de subir, no cuando hay selección: "Cancelar" tiene sentido
	// aunque no haya nada marcado, porque limpia la lista entera.
	const pendientesMarcados = $derived(archivosPendientesDeCarga.filter((a) => a.seleccionado));

	const accionesCarga = $derived<AccionPanel[]>([
		{
			etiqueta: 'Subir documentos',
			icono: Upload,
			// Igual que antes de mudarse: sin nada marcado no hay qué subir.
			alHacerClic: pendientesMarcados.length > 0 ? confirmarCargaPendiente : undefined,
			testid: 'accion-subir-documentos'
		},
		{
			etiqueta: 'Cancelar',
			icono: CircleX,
			peligro: true,
			alHacerClic: cancelarCargaPendiente,
			testid: 'accion-cancelar-carga'
		}
	]);

	// ── Bandeja de preparación ──────────────────────────────────────────────
	const enBandeja = $derived(documentosEnBandeja.filter((d) => d.seleccionado));

	// "Iniciar pipeline" solo aparece si hay algo seleccionado que de verdad se
	// pueda mandar. Un archivo protegido o corrupto es seleccionable pero no es
	// procesable, y ofrecer el botón para que luego no pase nada es peor que no
	// ofrecerlo.
	const procesables = $derived(enBandeja.filter(sePuedeProcesar));

	// "Detalle" NO va en este grupo: un documento que sigue en la Bandeja
	// todavía no tiene resultado de OCR que mostrar, así que ahí estaría apagado
	// para siempre. Es el mismo criterio de cuando cada bandeja tenía su píldora:
	// juntar las barras no junta las acciones, cada grupo sigue mostrando solo lo
	// que aplica a SU bandeja.
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

	// "Iniciar pipeline" NO va en este grupo: estos documentos ya pasaron por
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
		// "Eventos" sigue apagado y sin `onclick`, para que al leer el código sea
		// obvio que falta por cablear: necesita `audit_event`, que vive en SQL
		// Server y todavía no existe. NO es lo mismo que "Estado", que sí
		// funciona: aquélla sería la bitácora completa y duradera del documento
		// (quién lo tocó, desde dónde, qué cambió), y ésta es la historia de sus
		// estados tal como la vio este navegador.
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
		// "Ver expediente" (2026-10-01) es la única que NO exige un documento
		// único: abre la vista de expedientes, que hoy lista todos los documentos
		// de las bandejas y no depende de cuál esté seleccionado.
		{
			etiqueta: 'Ver expediente',
			icono: FolderOpen,
			alHacerClic: alAbrirExpedientes,
			testid: 'accion-ver-expediente'
		},
		// "Descartar" es destructivo y merece su propio modal de confirmación, no
		// un confirm() del navegador; sigue sin cablear.
		{ etiqueta: 'Descartar', icono: CircleX, peligro: true, testid: 'accion-descartar-pipeline' }
	]);

	// El orden es el de las columnas en pantalla, de izquierda a derecha. Leer la
	// barra y mirar las tarjetas tienen que dar el mismo orden; si no, el nombre
	// del grupo obliga a buscar de qué bandeja habla.
	const grupos = $derived<GrupoAcciones[]>(
		[
			{ bandeja: 'Carga documental', acciones: archivosPendientesDeCarga.length > 0 ? accionesCarga : [] },
			{ bandeja: 'Bandeja de preparación', acciones: enBandeja.length > 0 ? accionesBandeja : [] },
			{ bandeja: 'Pipeline', acciones: enPipeline.length > 0 ? accionesPipeline : [] }
		].filter((g) => g.acciones.length > 0)
	);
</script>

<!-- `pointer-events-none` en el carril y `auto` en la píldora: el carril mide
     todo el ancho de la ventana para poder centrar, y sin esto se comería los
     clics de lo que queda debajo. -->
{#if grupos.length > 0}
	<div
		class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
		data-testid="carril-acciones"
	>
		<BarraAccionesPanel {grupos} />
	</div>
{/if}
