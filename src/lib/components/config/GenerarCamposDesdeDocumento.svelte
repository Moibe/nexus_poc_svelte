<script lang="ts">
	/**
	 * «Generar a partir de un documento» — paso 2 del alta de un tipo documental (pedido el 2026-10-29, como el botón del mismo
	 * nombre de la consola de Document AI). La persona sube un documento de ejemplo, Document AI lo lee y PROPONE campos
	 * (`/api/procesadores/generar-campos`), y aquí se revisan: cada propuesta trae casilla y solo se agregan las elegidas. Lo
	 * agregado cae en «Campos agregados» y se edita como cualquier otro campo.
	 *
	 * **Hasta 3 documentos de ejemplo (2026-11-07, Moibe: «sí, me gusta esa propuesta, hazla así»); desde el 2026-11-12, UNO solo (Moibe: «solo quiero agregar 1»; ver `MAX_DOCUMENTOS`).** Con uno solo la propuesta de Google cambia de corrida a
	 * corrida y juzga todo desde ese ejemplo; con dos o tres se lee cada uno por separado (en paralelo) y se UNEN las propuestas (`unirPropuestas`): cada campo
	 * dice en cuántos documentos salió; los que salieron en más de la mitad vienen marcados y los que salieron en pocos, sin marcar, y todo el que no salió en
	 * todos se agrega como OPCIONAL (un documento válido que no lo trae no debe fallar). Si un documento no se puede leer, los demás siguen y se dice cuál falló.
	 * Los documentos leídos se entregan a quien abrió el modal (`onAgregar`) para que pueda PROBAR la extracción con ellos al activar el tipo; aquí no se guardan.
	 *
	 * **El documento a un lado, con los campos marcados (2026-11-11, Moibe: «que a un lado mostremos el documento y marcados etiquetados los campos
	 * seleccionados»).** Al llegar la propuesta, el modal se ensancha: a la izquierda el documento (`DocumentoConCampos`, con pestañas si son varios) y
	 * a la derecha la lista. Por cada documento se pregunta, en paralelo, dónde está cada campo propuesto (`/api/procesadores/ubicar-campos`, Gemini);
	 * los campos ELEGIDOS se marcan con un recuadro y su nombre, y pasar el puntero por un renglón resalta su recuadro. Si ubicar falla, la propuesta
	 * sirve igual y el documento se enseña sin marcas. Se pregunta una vez por documento con TODOS los propuestos: marcar y desmarcar no vuelve a llamar.
	 *
	 * **«Agregar otro campo» (2026-11-11, Moibe: «sí, dale a la versión sencilla»).** Al final de la lista, la persona escribe un campo que la propuesta no
	 * trajo (nombre, tipo y una descripción opcional). Entra marcado y se busca SOLO ese campo en cada documento (una llamada corta a ubicar): si aparece,
	 * se marca como los demás; si no, el resumen lo cuenta como no encontrado, lo que también avisa que el nombre o la descripción no son claros.
	 *
	 * **Editar un campo de la lista, datos y recuadro (2026-11-11, Moibe: «quiero poder también editar los campos… la herramienta de dibujo me tiene
	 * que permitir editar campos existentes»; eligió «sus datos y su recuadro»).** El lápiz de cada renglón, o un clic en su recuadro sobre el
	 * documento, abre el mismo formulario ya lleno en su renglón. Si cambia el nombre o la descripción, se vuelve a buscar (y el recuadro se mueve
	 * si aparece). Mientras está abierto, su recuadro se mueve, cambia de tamaño, se dibuja de nuevo o se quita (`DocumentoConCampos`); eso solo
	 * ayuda a ver qué es el campo: no se guarda ni cambia lo que extraerá el procesador. Lo puesto a mano no lo pisa ninguna búsqueda.
	 *
	 * **El recuadro completa el campo (2026-11-12, Moibe: «quiero que ese etiquetado sí sirva para definir el schema»; eligió «El recuadro completa el
	 * campo» y «Dibujar crea el campo»).** El recuadro no viaja a Google: el extractor lee el nombre, el tipo, la descripción y el valor de estructura
	 * de cada campo. El 2026-11-11 el recuadro solo SUGERÍA la descripción del campo que se editaba; ahora, en cuanto llegan las marcas, Gemini lee lo
	 * que hay dentro de cada recuadro (`/api/procesadores/describir-campos`, una llamada por documento) y escribe en cada campo su descripción (zona,
	 * rótulo, forma), el tipo que corresponde a lo que se lee y un ejemplo INVENTADO de su forma; el renglón lo dice («Desde su recuadro»). Mover o
	 * dibujar un recuadro lo vuelve a leer (`/api/procesadores/describir-campo`, tras 1.2 s quieto). Lo que escribió la persona NUNCA lo cambia un
	 * recuadro (`origenes`): si la descripción es suya, el recuadro solo se la sugiere.
	 *
	 * **Dibujar un campo (2026-11-12).** Un recuadro sobre un dato que no está en la lista: Gemini propone el campo con su nombre
	 * (`/api/procesadores/proponer-campo`), el formulario se llena con eso y la persona lo revisa antes de agregarlo. Si ese dato ya es un campo de la
	 * lista, se ofrece ponerle ese recuadro en vez de duplicarlo.
	 *
	 * Es un `Dialog` normal (como lo era `GenerarPrompts.svelte`, quitado el 2026-11-06 con «Calibrar») y no `ConfirmarAccion`: no se destruye nada, así que Escape y el clic
	 * fuera cierran. Si se cierra mientras Google está leyendo, la respuesta que llegue después se descarta.
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import AlertCircle from '@lucide/svelte/icons/circle-alert';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import FolderLibraryIcon from '$lib/components/icons/FolderLibraryIcon.svelte';
	import { mensajeDeFallo } from '$lib/documentos/mensajeDeFallo';
	import { llaveDeCampo, unirPropuestas, type CampoUnido } from '$lib/documentos/unirPropuestas';
	import { imagenDerecha, leerUbicaciones, sePuedeMarcar, type Ubicacion } from '$lib/documentos/ubicaciones';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ScanText from '@lucide/svelte/icons/scan-text';
	import SquareDashedMousePointer from '@lucide/svelte/icons/square-dashed-mouse-pointer';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import DocumentoConCampos, { type CambioDeCaja, type EstadoUbicacion } from './DocumentoConCampos.svelte';
	import { TIPOS_DE_DATO, TIPOS_DE_SUBCAMPO, type CampoPropuesto } from '$lib/state/configuracion.svelte';

	const MAX_MB = 20;
	/**
	 * Cuántos documentos de ejemplo se leen. Fueron 3 (2026-11-07, para ver qué campos se repiten); desde el 2026-11-12 es UNO (Moibe: «no quiero
	 * agregar hasta 3, solo quiero agregar 1»). La unión de propuestas (`unirPropuestas`) y las pestañas siguen sirviendo igual con uno.
	 */
	const MAX_DOCUMENTOS = 1;
	const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];

	let {
		abierto = false,
		nombreTipo = '',
		descripcionTipo = '',
		existentes = [],
		ejemplosPrevios = [],
		onCerrar,
		onAgregar
	}: {
		abierto?: boolean;
		/** Lo capturado en el paso 1: viaja como contexto para el modelo. */
		nombreTipo?: string;
		descripcionTipo?: string;
		/** Los nombres de los campos que el tipo YA tiene: una propuesta con el mismo nombre no se puede elegir. */
		existentes?: string[];
		/** Los documentos que ya se dieron en el paso 1 (para «Sugerir descripción» con documentos): se ofrecen para no pedirlos otra vez. */
		ejemplosPrevios?: File[];
		onCerrar: () => void;
		/** Los campos elegidos y los documentos de ejemplo que se LEYERON (los que sí dieron propuesta), para probar la extracción con ellos después. */
		onAgregar: (elegidos: CampoPropuesto[], ejemplos: File[]) => void;
	} = $props();

	let fase = $state<'elegir' | 'generando' | 'propuesta' | 'error'>('elegir');
	/** Los nombres de los documentos que se están leyendo o se leyeron, para decirlo en pantalla. */
	let nombresArchivos = $state<string[]>([]);
	/** Cuántos de los que se están leyendo ya terminaron (bien o mal). */
	let terminados = $state(0);
	/** Los documentos que NO se pudieron leer (formato, tamaño o un fallo de Google), cada uno con su motivo. */
	let fallos = $state<{ nombre: string; mensaje: string }[]>([]);
	/** Cuántos archivos se soltaron de más (solo se leen los primeros `MAX_DOCUMENTOS`). */
	let sobrantes = $state(0);
	/** Los documentos que sí dieron propuesta: no se pintan, se le entregan a quien abrió el modal al agregar. */
	let leidos: File[] = [];
	let error = $state('');
	let propuestos = $state<CampoUnido[]>([]);
	let elegidos = $state<boolean[]>([]);
	/** Los documentos que se enseñan a un lado de la propuesta (los leídos) y, de cada uno, cómo va la ubicación de los campos. */
	let documentosVista = $state<File[]>([]);
	let estadosUbicacion = $state<EstadoUbicacion[]>([]);
	/** El campo que se resalta en el documento (el renglón o el recuadro bajo el puntero). */
	let resaltado = $state<string | null>(null);
	const visibles = $derived(propuestos.filter((_, i) => elegidos[i] && disponibles[i]).map((c) => c.nombre));

	/**
	 * Los recuadros: por documento, el de cada campo según su LUGAR en `propuestos` (los campos nunca se quitan de la lista, así que el lugar no
	 * cambia aunque se edite el nombre). Llegan de la búsqueda (`ubicar`, `buscarCampo`) o de la persona (`cambiarCaja`, «Dibujar un campo»).
	 */
	type Marca = { pagina: number; caja: Ubicacion['caja']; valor: string };
	let marcas = $state<Record<number, Marca>[]>([]);
	/** El turno del último cambio de cada recuadro («documento:campo»): una búsqueda que llega tarde no pisa algo más nuevo, como un recuadro dibujado. */
	let turnosMarca: Record<string, number> = {};
	let contadorMarca = 0;
	/** Los recuadros que puso la persona: si después edita el nombre o la descripción, ahí no se vuelve a buscar. */
	let aMano: Record<string, boolean> = {};
	const llaveMarca = (documento: number, campo: number) => `${documento}:${campo}`;
	function nuevoTurno(documento: number, campo: number) {
		contadorMarca += 1;
		turnosMarca[llaveMarca(documento, campo)] = contadorMarca;
		return contadorMarca;
	}
	const ubicacionesVista = $derived(
		marcas.map((m) => Object.entries(m).flatMap(([k, v]) => (propuestos[+k] ? [{ campo: propuestos[+k].nombre, ...v }] : [])))
	);
	/** Cuántas búsquedas siguen en curso por campo (su lugar en la lista), y cuáles no se pudieron hacer. */
	let buscando = $state<Record<number, number>>({});
	let sinBuscar = $state<number[]>([]);

	// ── El recuadro completa el campo (2026-11-12, Moibe: «quiero que ese etiquetado sí sirva para definir el schema») ──
	// Lo que hay dentro de cada recuadro se convierte en lo que el extractor sí lee: la descripción, el tipo y el valor de estructura de su campo.
	type Dato = 'descripcion' | 'tipoDato' | 'valorEstructura';
	type Origen = 'recuadro' | 'mano';
	/**
	 * De dónde salió cada dato de cada campo (por su LUGAR en `propuestos`): `recuadro` = lo escribió Biblioratum mirando su recuadro; `mano` = la
	 * persona. Sin entrada, lo propuso el documento. Un recuadro NUNCA cambia lo que es `mano`: si la descripción es de la persona, solo la sugiere.
	 */
	let origenes = $state<Record<number, Partial<Record<Dato, Origen>>>>({});
	const desdeRecuadro = (k: number) => Object.values(origenes[k] ?? {}).includes('recuadro');
	/** Cuánto se espera tras el último ajuste a mano de un recuadro antes de leerlo: arrastrar o usar las flechas son muchos ajustes seguidos. */
	const ESPERA_COMPLETAR_MS = 1200;
	/** El turno de la última lectura pedida por campo: una respuesta que llega tarde no pisa una más nueva. */
	let turnosCompletado: Record<number, number> = {};
	let contadorCompletado = 0;
	let esperasCompletado: Record<number, ReturnType<typeof setTimeout>> = {};
	/** El documento donde la persona marcó el campo la última vez: de ahí se lee. */
	let documentoPreferido: Record<number, number> = {};
	/** El recuadro con el que se escribió cada campo la última vez (documento, página y caja): el mismo recuadro no se vuelve a leer. */
	let leidoCon: Record<number, string> = {};
	/** Los campos que hay que leer aunque su recuadro no haya cambiado («Volver a leer», o se renombró). */
	let forzarLectura: Record<number, boolean> = {};
	/** Los campos cuyo recuadro se está leyendo (o se va a leer en cuanto quede quieto). */
	let completando = $state<Record<number, boolean>>({});
	/** La primera lectura de todos los recuadros, al llegar las marcas, y si falló. */
	let completandoTodos = $state(false);
	let errorCompletado = $state('');
	/** Lo último que se leyó del campo que se edita: qué cambió, qué se lee en su recuadro, o por qué no se pudo (se dice en su formulario). */
	let ultimaLectura = $state<{ indice: number; cambios: string[]; valor: string; error?: string } | null>(null);

	type Completado = { nombre: string; descripcion: string; tipoDato: string | null; valorEstructura: string; valor: string };
	/** Los tipos que se deducen de un valor (lista y grupo no: dependen de todos los valores o de cómo está armado el documento). */
	const TIPOS_DEDUCIBLES = ['texto', 'numero', 'fecha', 'moneda', 'booleano'];
	function leerCompletado(x: unknown, nombre?: string): Completado | null {
		const o = (x ?? null) as Record<string, unknown> | null;
		const descripcion = typeof o?.descripcion === 'string' ? o.descripcion.trim() : '';
		const n = typeof o?.nombre === 'string' && o.nombre.trim() ? o.nombre.trim() : nombre;
		if (!descripcion || !n) return null;
		return {
			nombre: n,
			descripcion: descripcion.slice(0, 200),
			tipoDato: typeof o?.tipoDato === 'string' && TIPOS_DEDUCIBLES.includes(o.tipoDato) ? o.tipoDato : null,
			valorEstructura: typeof o?.valorEstructura === 'string' ? o.valorEstructura.trim().slice(0, 120) : '',
			valor: typeof o?.valor === 'string' ? o.valor : ''
		};
	}
	const llaveLectura = (documento: number, k: number) => {
		const m = marcas[documento]?.[k];
		return m ? `${documento}:${m.pagina}:${m.caja.join(',')}` : '';
	};

	/** El documento del que se lee un campo: donde la persona lo marcó la última vez, o el primero donde está marcado. */
	function documentoDe(k: number): number | null {
		const preferido = documentoPreferido[k];
		if (preferido !== undefined && marcas[preferido]?.[k]) return preferido;
		const d = marcas.findIndex((m) => !!m[k]);
		return d >= 0 ? d : null;
	}

	/** ¿Le queda a este campo algo que un recuadro pueda escribir? (todo de la persona: no hace falta leerlo) */
	function porCompletar(k: number): boolean {
		const c = propuestos[k];
		if (!c) return false;
		const o = origenes[k] ?? {};
		const datos: Dato[] = c.tipoDato === 'grupo' ? ['descripcion'] : c.tipoDato === 'lista' ? ['descripcion', 'valorEstructura'] : ['descripcion', 'tipoDato', 'valorEstructura'];
		return datos.some((d) => o[d] !== 'mano');
	}

	/**
	 * Escribe en el campo lo que se leyó en su recuadro, menos lo que es de la persona. Si el campo está abierto, también en lo que la persona todavía no
	 * tocó del formulario (lo que sí tocó se queda: al guardar, gana lo suyo). Una descripción que es de la persona solo se SUGIERE.
	 */
	function aplicarCompletado(k: number, x: Completado, documento: number) {
		const c = propuestos[k];
		if (!c) return;
		const o = { ...(origenes[k] ?? {}) };
		const nuevo = { ...c };
		const abierto = editando === k;
		const cambios: string[] = [];
		if (o.descripcion !== 'mano') {
			if (abierto && fDescripcion === c.descripcion) fDescripcion = x.descripcion;
			if (x.descripcion !== c.descripcion) cambios.push('la descripción');
			nuevo.descripcion = x.descripcion;
			o.descripcion = 'recuadro';
		} else if (abierto && x.descripcion !== fDescripcion.trim()) {
			sugerencia = { descripcion: x.descripcion, valor: x.valor };
		}
		if (o.tipoDato !== 'mano' && x.tipoDato && c.tipoDato !== 'lista' && c.tipoDato !== 'grupo') {
			if (abierto && fTipo === c.tipoDato) fTipo = x.tipoDato;
			if (x.tipoDato !== c.tipoDato) cambios.push('el tipo');
			nuevo.tipoDato = x.tipoDato;
			o.tipoDato = 'recuadro';
		}
		if (o.valorEstructura !== 'mano' && c.tipoDato !== 'grupo' && (x.valorEstructura || o.valorEstructura === 'recuadro')) {
			if (abierto && fEstructura === (c.valorEstructura ?? '')) fEstructura = x.valorEstructura;
			if (x.valorEstructura !== (c.valorEstructura ?? '')) cambios.push('la estructura');
			nuevo.valorEstructura = x.valorEstructura;
			o.valorEstructura = 'recuadro';
		}
		propuestos[k] = nuevo;
		origenes[k] = o;
		// Lo que se leyó es también el valor de su recuadro (se enseña al pasar el puntero).
		const m = marcas[documento]?.[k];
		if (m && x.valor) marcas[documento][k] = { ...m, valor: x.valor };
		if (abierto) ultimaLectura = { indice: k, cambios, valor: x.valor };
	}

	/**
	 * Lee los recuadros de esos campos en UN documento (uno solo con `/describir-campo`, varios con `/describir-campos`) y escribe en cada campo lo que
	 * salga. Devuelve el mensaje de error, o `''`. Nunca lanza.
	 */
	async function completarEn(documento: number, indices: number[], turno: number): Promise<string> {
		const archivo = documentosVista[documento];
		const conCaja = indices.filter((k) => propuestos[k] && marcas[documento]?.[k]);
		if (!archivo || conCaja.length === 0) return '';
		const mios = conCaja.map((k) => (turnosCompletado[k] = ++contadorCompletado));
		const versiones = conCaja.map((k) => llaveLectura(documento, k));
		conCaja.forEach((k) => (completando[k] = true));
		// Cada respuesta vuelve a su campo por el nombre que se MANDÓ (mientras tanto la persona pudo renombrarlo).
		const enviados = conCaja.map((k) => propuestos[k].nombre);
		const campos = conCaja.map((k) => {
			const c = propuestos[k];
			const m = marcas[documento][k];
			return { nombre: c.nombre, tipoDato: c.tipoDato, descripcion: c.descripcion, pagina: m.pagina, caja: m.caja };
		});
		const uno = campos.length === 1;
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		if (uno) {
			cuerpo.append('campo', JSON.stringify({ nombre: campos[0].nombre, tipoDato: campos[0].tipoDato, descripcion: campos[0].descripcion }));
			cuerpo.append('pagina', String(campos[0].pagina));
			cuerpo.append('caja', JSON.stringify(campos[0].caja));
		} else {
			cuerpo.append('campos', JSON.stringify(campos));
		}
		if (nombreTipo.trim()) cuerpo.append('nombreTipo', nombreTipo.trim());
		if (descripcionTipo.trim()) cuerpo.append('descripcionTipo', descripcionTipo.trim());
		let completados: Completado[] = [];
		let mensaje = '';
		try {
			const r = await fetch(uno ? '/api/procesadores/describir-campo' : '/api/procesadores/describir-campos', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			if (r.ok) {
				const crudos: unknown[] = uno ? [datos] : Array.isArray(datos?.campos) ? datos.campos : [];
				completados = crudos.map((x) => leerCompletado(x, uno ? enviados[0] : undefined)).filter((x): x is Completado => x !== null);
			} else {
				mensaje = r.status === 429 ? 'Hay muchas solicitudes a la vez: no se pudieron leer los recuadros.' : 'No se pudieron leer los recuadros para completar los campos.';
			}
		} catch {
			mensaje = 'No se pudo contactar al servidor para leer los recuadros.';
		}
		if (turno !== vigente) return '';
		conCaja.forEach((k, i) => {
			if (turnosCompletado[k] === mios[i]) completando[k] = false;
		});
		for (const x of completados) {
			const i = enviados.indexOf(x.nombre);
			if (i < 0 || turnosCompletado[conCaja[i]] !== mios[i]) continue;
			aplicarCompletado(conCaja[i], x, documento);
			leidoCon[conCaja[i]] = versiones[i];
		}
		if (uno && mensaje && editando === conCaja[0] && turnosCompletado[conCaja[0]] === mios[0]) {
			ultimaLectura = { indice: conCaja[0], cambios: [], valor: '', error: 'No se pudo leer su recuadro.' };
		}
		return mensaje;
	}

	/**
	 * Vuelve a leer el recuadro de UN campo cuando lleva `espera` ms sin cambios (cada cambio reinicia la espera). `documento` es donde la persona lo
	 * acaba de marcar (o `null`: el de siempre). Sin `forzar`, un recuadro que ya se leyó tal cual no se vuelve a leer.
	 */
	function programarCompletado(k: number, documento: number | null, espera = ESPERA_COMPLETAR_MS, forzar = false) {
		if (!porCompletar(k) && editando !== k) return;
		if (documento !== null) documentoPreferido[k] = documento;
		// Un «forzar» pendiente no lo borra otro aviso que llegue después (la búsqueda que termina tras renombrar).
		if (forzar) forzarLectura[k] = true;
		turnosCompletado[k] = ++contadorCompletado; // lo que esté en camino ya es viejo
		completando[k] = true;
		clearTimeout(esperasCompletado[k]);
		const turno = vigente;
		esperasCompletado[k] = setTimeout(() => {
			delete esperasCompletado[k];
			const forzada = forzarLectura[k] === true;
			delete forzarLectura[k];
			const d = documentoDe(k);
			if (turno !== vigente || d === null || (!forzada && leidoCon[k] === llaveLectura(d, k))) {
				completando[k] = false;
				return;
			}
			void completarEn(d, [k], turno);
		}, espera);
	}

	/** La primera lectura: todos los campos marcados que se pueden agregar, UNA llamada por documento (cada campo, del primero donde está marcado). */
	async function completarTodos(turno: number) {
		const porDocumento = new Map<number, number[]>();
		propuestos.forEach((_, k) => {
			if (!disponibles[k] || !porCompletar(k)) return;
			const d = documentoDe(k);
			if (d !== null) porDocumento.set(d, [...(porDocumento.get(d) ?? []), k]);
		});
		if (porDocumento.size === 0) return;
		completandoTodos = true;
		errorCompletado = '';
		const mensajes = await Promise.all([...porDocumento].map(([d, ks]) => completarEn(d, ks, turno)));
		if (turno !== vigente) return;
		completandoTodos = false;
		errorCompletado = mensajes.find(Boolean) ?? '';
	}

	// El formulario de un campo: «Agregar otro campo» (al final) o «Editar» uno de la lista (en su renglón). Solo uno abierto a la vez.
	let formulario = $state<{ modo: 'nuevo' } | { modo: 'editar'; indice: number } | null>(null);
	let fNombre = $state('');
	let fTipo = $state('texto');
	let fDescripcion = $state('');
	let fEstructura = $state('');
	let fError = $state('');
	let fInput = $state<HTMLInputElement | null>(null);
	const editando = $derived(formulario?.modo === 'editar' ? formulario.indice : null);
	const nombreEditando = $derived(editando !== null ? (propuestos[editando]?.nombre ?? null) : null);
	/** Los tipos que se pueden elegir: los sencillos, y el que ya trae el campo si es lista o grupo (para poder dejarlo como está). */
	const opcionesTipo = $derived.by(() => {
		const actual = editando !== null ? propuestos[editando]?.tipoDato : undefined;
		const extra = TIPOS_DE_DATO.find((t) => t.value === actual && !TIPOS_DE_SUBCAMPO.some((s) => s.value === t.value));
		return extra ? [...TIPOS_DE_SUBCAMPO, extra] : [...TIPOS_DE_SUBCAMPO];
	});

	/** Si ya se cambió algo del nombre, tipo, descripción o estructura del campo que se edita (los cambios al recuadro se aplican al momento). */
	const editoDatos = $derived.by(() => {
		const c = editando !== null ? propuestos[editando] : undefined;
		return !!c && (fNombre !== c.nombre || fTipo !== c.tipoDato || fDescripcion !== c.descripcion || fEstructura !== (c.valorEstructura ?? ''));
	});
	/** ¿El campo que se edita tiene recuadro en algún documento? (sin recuadro no hay qué leer) */
	const conRecuadro = $derived(editando !== null && marcas.some((m) => !!m[editando]));

	$effect(() => {
		if (formulario) fInput?.focus();
	});

	/** El documento que se está viendo a un lado (la pestaña elegida). */
	let documentoVisible = $state(0);
	/** Una descripción leída en el recuadro de un campo cuya descripción escribió la persona: no se le aplica, se le sugiere. */
	let sugerencia = $state<{ descripcion: string; valor: string } | null>(null);
	/** La descripción que la persona tomó de la sugerencia: al guardar, sigue siendo «del recuadro» (un recuadro nuevo la puede reescribir). */
	let aceptadaDelRecuadro: string | null = null;

	function usarSugerencia() {
		if (!sugerencia) return;
		fDescripcion = sugerencia.descripcion.slice(0, 200);
		aceptadaDelRecuadro = fDescripcion;
		sugerencia = null;
	}

	/** «Volver a leer su recuadro»: el del documento que se ve si ahí está marcado; si no, el de siempre. */
	function volverALeer() {
		if (editando === null) return;
		sugerencia = null;
		ultimaLectura = null;
		programarCompletado(editando, marcas[documentoVisible]?.[editando] ? documentoVisible : null, 0, true);
	}

	// ── «Dibujar un campo» (2026-11-12, Moibe eligió «Dibujar crea el campo») ──
	// Un recuadro sobre un dato que no está en la lista: Biblioratum lee lo que hay dentro y propone el campo (nombre, tipo, descripción y estructura).
	let dibujandoNuevo = $state(false);
	let dibujo = $state<{ documento: number; pagina: number; caja: Ubicacion['caja'] } | null>(null);
	type Propuesta =
		| { fase: 'pensando' }
		| { fase: 'lista'; nombre: string; tipoDato: string | null; descripcion: string; valorEstructura: string; valor: string }
		| { fase: 'error'; mensaje: string };
	let propuesta = $state<Propuesta | null>(null);
	let turnoPropuesta = 0;
	/** Con un recuadro dibujado: el campo de la lista que ya se llama así (el dato ya era un campo), o -1. */
	const repetido = $derived(dibujo && fNombre.trim() ? propuestos.findIndex((p) => llaveDeCampo(p.nombre) === llaveDeCampo(fNombre.trim())) : -1);

	function empezarDibujo() {
		cerrarFormulario();
		resaltado = null;
		dibujandoNuevo = true;
	}

	function cancelarDibujo() {
		dibujandoNuevo = false;
	}

	function alDibujarNuevo(n: { documento: number; pagina: number; caja: Ubicacion['caja'] }) {
		dibujandoNuevo = false;
		abrirNuevo();
		dibujo = n;
		void proponerCampo(n);
	}

	/** Pide el campo que sería el recuadro dibujado y llena con él lo que la persona todavía no escribió. Nunca lanza. */
	async function proponerCampo(n: { documento: number; pagina: number; caja: Ubicacion['caja'] }) {
		const archivo = documentosVista[n.documento];
		if (!archivo) return;
		const mio = ++turnoPropuesta;
		propuesta = { fase: 'pensando' };
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		cuerpo.append('pagina', String(n.pagina));
		cuerpo.append('caja', JSON.stringify(n.caja));
		// Para que, si el dato ya es un campo, lo diga con ese mismo nombre.
		cuerpo.append('existentes', JSON.stringify([...propuestos.map((p) => p.nombre), ...existentes].slice(0, 200)));
		if (nombreTipo.trim()) cuerpo.append('nombreTipo', nombreTipo.trim());
		if (descripcionTipo.trim()) cuerpo.append('descripcionTipo', descripcionTipo.trim());
		let nueva: Propuesta;
		try {
			const r = await fetch('/api/procesadores/proponer-campo', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			const leida = r.ok ? leerCompletado(datos) : null;
			nueva = leida
				? { fase: 'lista', ...leida }
				: {
						fase: 'error',
						mensaje:
							r.status === 429
								? 'Hay muchas solicitudes a la vez y no se pudo leer el recuadro. Escribe el campo a mano; el recuadro se queda marcado.'
								: 'No se pudo leer el recuadro. Escribe el campo a mano; el recuadro se queda marcado.'
					};
		} catch {
			nueva = { fase: 'error', mensaje: 'No se pudo contactar al servidor para leer el recuadro. Escribe el campo a mano; el recuadro se queda marcado.' };
		}
		if (mio !== turnoPropuesta || formulario?.modo !== 'nuevo') return;
		propuesta = nueva;
		if (nueva.fase === 'lista') {
			// Lo propuesto llena lo que la persona no ha escrito todavía.
			if (!fNombre.trim()) fNombre = nueva.nombre.slice(0, 80);
			if (!fDescripcion.trim()) fDescripcion = nueva.descripcion;
			if (!fEstructura.trim()) fEstructura = nueva.valorEstructura;
			if (fTipo === 'texto' && nueva.tipoDato) fTipo = nueva.tipoDato;
			fError = '';
		}
	}

	/** El dato dibujado ya es un campo de la lista: en vez de crear otro, se le pone ese recuadro (y se vuelve a leer). */
	function ponerRecuadroA(k: number) {
		const d = dibujo;
		if (!d || !propuestos[k] || !marcas[d.documento]) return;
		cerrarFormulario();
		nuevoTurno(d.documento, k);
		marcas[d.documento][k] = { pagina: d.pagina, caja: d.caja, valor: '' };
		aMano[llaveMarca(d.documento, k)] = true;
		if (disponibles[k]) elegidos[k] = true;
		programarCompletado(k, d.documento, 0);
	}

	function cerrarFormulario() {
		sugerencia = null;
		aceptadaDelRecuadro = null;
		ultimaLectura = null;
		turnoPropuesta += 1;
		propuesta = null;
		dibujo = null;
		formulario = null;
		fNombre = '';
		fTipo = 'texto';
		fDescripcion = '';
		fEstructura = '';
		fError = '';
	}

	function abrirNuevo() {
		cerrarFormulario();
		dibujandoNuevo = false;
		formulario = { modo: 'nuevo' };
	}

	function abrirEdicion(indice: number) {
		const campo = propuestos[indice];
		if (!campo) return;
		cerrarFormulario();
		dibujandoNuevo = false;
		formulario = { modo: 'editar', indice };
		fNombre = campo.nombre;
		fTipo = campo.tipoDato;
		fDescripcion = campo.descripcion;
		fEstructura = campo.valorEstructura ?? '';
	}

	/** El nombre escrito, o `null` y el error dicho si está vacío o choca con otro (sin contar el campo que se edita). */
	function nombreValido(propio: number | null): string | null {
		const nombre = fNombre.trim().replace(/\s+/g, ' ');
		if (!nombre) {
			fError = 'Escribe el nombre del campo.';
			return null;
		}
		const mismo = propio !== null && llaveDeCampo(propuestos[propio].nombre) === llaveDeCampo(nombre);
		if (!mismo && (yaExiste(nombre) || propuestos.some((p, k) => k !== propio && llaveDeCampo(p.nombre) === llaveDeCampo(nombre)))) {
			fError = 'Ya hay un campo con ese nombre.';
			return null;
		}
		return nombre;
	}

	function guardarFormulario() {
		if (!formulario) return;
		if (formulario.modo === 'nuevo') agregarOtro();
		else guardarEdicion(formulario.indice);
	}

	/** Sin las entradas vacías (un dato sin origen es «lo que propuso el documento»). */
	const soloDefinidos = (o: Partial<Record<Dato, Origen | undefined>>) =>
		Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<Record<Dato, Origen>>;

	function agregarOtro() {
		const nombre = nombreValido(null);
		if (!nombre) return;
		const descripcion = fDescripcion.trim();
		const estructura = fTipo === 'grupo' ? '' : fEstructura.trim();
		const p = propuesta?.fase === 'lista' ? propuesta : null;
		// De dónde sale cada dato: lo que quedó igual a lo que propuso el recuadro es «del recuadro»; lo demás que se escribió, de la persona; lo vacío
		// (y el tipo «texto» que nadie eligió) queda libre para que lo escriba su recuadro.
		const tipoPropuesto = p?.tipoDato ?? null;
		const origen = soloDefinidos({
			descripcion: descripcion === '' ? undefined : p && descripcion === p.descripcion ? 'recuadro' : 'mano',
			tipoDato: tipoPropuesto && fTipo === tipoPropuesto ? 'recuadro' : tipoPropuesto || fTipo !== 'texto' ? 'mano' : undefined,
			valorEstructura: estructura === '' ? undefined : p && estructura === p.valorEstructura ? 'recuadro' : 'mano'
		});
		const campo: CampoUnido = {
			nombre,
			tipoDato: fTipo,
			descripcion,
			valorEstructura: estructura,
			obligatorio: true,
			cardinalidad: 'unico',
			valoresLista: [],
			subcampos: [],
			apariciones: 0,
			total: nombresArchivos.length,
			opcionalSugerido: false,
			manual: true
		};
		const k = propuestos.length;
		const d = dibujo;
		const valorLeido = p?.valor ?? '';
		propuestos = [...propuestos, campo];
		elegidos = [...elegidos, true];
		origenes[k] = origen;
		cerrarFormulario();
		if (d && marcas[d.documento]) {
			// Dibujado: su recuadro es el que se dibujó, y lo propuesto ya es la lectura de ese recuadro. En los demás documentos se busca.
			nuevoTurno(d.documento, k);
			marcas[d.documento][k] = { pagina: d.pagina, caja: d.caja, valor: valorLeido };
			aMano[llaveMarca(d.documento, k)] = true;
			documentoPreferido[k] = d.documento;
			if (p) leidoCon[k] = llaveLectura(d.documento, k);
			else programarCompletado(k, d.documento, 0);
			documentosVista.forEach((a, j) => {
				if (j !== d.documento && sePuedeMarcar(a)) void buscarCampo(j, k, vigente);
			});
		} else {
			buscarEnTodos(k);
		}
	}

	/**
	 * Guarda lo editado de un campo de la lista. Si cambió el nombre o la descripción, se vuelve a buscar en cada documento (menos donde la persona
	 * puso el recuadro a mano): si aparece, su recuadro se mueve ahí; si no, se queda el que tenía. Lo que la persona cambió queda como suyo.
	 */
	function guardarEdicion(indice: number) {
		const campo = propuestos[indice];
		const nombre = nombreValido(indice);
		if (!campo || !nombre) return;
		const descripcion = fDescripcion.trim();
		const estructura = fTipo === 'grupo' ? '' : fEstructura.trim();
		const buscarOtraVez = nombre !== campo.nombre || descripcion !== campo.descripcion;
		const noEstabaDisponible = yaExiste(campo.nombre);
		const o = { ...(origenes[indice] ?? {}) };
		if (descripcion !== campo.descripcion) o.descripcion = descripcion === '' ? undefined : descripcion === aceptadaDelRecuadro ? 'recuadro' : 'mano';
		if (fTipo !== campo.tipoDato) o.tipoDato = 'mano';
		if (estructura !== (campo.valorEstructura ?? '')) o.valorEstructura = estructura === '' ? undefined : 'mano';
		propuestos[indice] = {
			...campo,
			nombre,
			tipoDato: fTipo,
			descripcion,
			valorEstructura: estructura,
			subcampos: fTipo === 'grupo' ? campo.subcampos : [],
			valoresLista: fTipo === 'lista' ? campo.valoresLista : []
		};
		origenes[indice] = soloDefinidos(o);
		// Uno que chocaba con un campo que el tipo ya tiene y ahora tiene otro nombre: ya se puede agregar, y se marca.
		if (noEstabaDisponible && !yaExiste(nombre)) elegidos[indice] = true;
		resaltado = null;
		cerrarFormulario();
		if (buscarOtraVez) buscarEnTodos(indice, true);
		// Con otro nombre, lo que se escribió con su recuadro puede quedarse corto: se vuelve a leer (lo de la persona no se toca).
		if (nombre !== campo.nombre && descripcion !== '' && origenes[indice]?.descripcion !== 'mano') programarCompletado(indice, null, ESPERA_COMPLETAR_MS, true);
	}

	function buscarEnTodos(indice: number, respetarAMano = false) {
		documentosVista.forEach((a, d) => {
			if (sePuedeMarcar(a) && !(respetarAMano && aMano[llaveMarca(d, indice)])) void buscarCampo(d, indice, vigente);
		});
	}

	/** Busca UN campo en un documento y pone (o mueve) su recuadro; con el recuadro nuevo, el campo se completa. Si no aparece, se queda el que tenía. Nunca lanza. */
	async function buscarCampo(documento: number, indice: number, turno: number) {
		const archivo = documentosVista[documento];
		const campo = propuestos[indice];
		if (!archivo || !campo) return;
		const mio = nuevoTurno(documento, indice);
		buscando[indice] = (buscando[indice] ?? 0) + 1;
		sinBuscar = sinBuscar.filter((k) => k !== indice);
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		cuerpo.append('campos', JSON.stringify([{ nombre: campo.nombre, descripcion: campo.descripcion }]));
		try {
			const r = await fetch('/api/procesadores/ubicar-campos', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			if (turno !== vigente) return;
			if (!r.ok) {
				if (!sinBuscar.includes(indice)) sinBuscar = [...sinBuscar, indice];
				return;
			}
			const u = leerUbicaciones(datos).find((x) => x.campo === campo.nombre);
			if (u && turnosMarca[llaveMarca(documento, indice)] === mio) {
				marcas[documento][indice] = { pagina: u.pagina, caja: u.caja, valor: u.valor };
				aMano[llaveMarca(documento, indice)] = false;
				// Varias búsquedas (una por documento) terminan casi juntas: se espera un poco para leer UNA vez.
				programarCompletado(indice, null, 300);
			}
		} catch {
			if (turno === vigente && !sinBuscar.includes(indice)) sinBuscar = [...sinBuscar, indice];
		} finally {
			if (turno === vigente) buscando[indice] = Math.max(0, (buscando[indice] ?? 1) - 1);
		}
	}

	/** La persona movió, cambió de tamaño o dibujó un recuadro: manda sobre cualquier búsqueda que siga en camino, y su campo se vuelve a completar. */
	function cambiarCaja(cambio: CambioDeCaja) {
		const indice = propuestos.findIndex((p) => p.nombre === cambio.campo);
		if (indice < 0 || !marcas[cambio.documento]) return;
		nuevoTurno(cambio.documento, indice);
		const antes = marcas[cambio.documento][indice];
		marcas[cambio.documento][indice] = { pagina: cambio.pagina, caja: cambio.caja, valor: cambio.modo === 'ajustar' ? (antes?.valor ?? '') : '' };
		aMano[llaveMarca(cambio.documento, indice)] = true;
		if (indice === editando) {
			sugerencia = null;
			ultimaLectura = null;
		}
		programarCompletado(indice, cambio.documento);
	}

	function quitarCaja(documento: number, nombre: string) {
		const indice = propuestos.findIndex((p) => p.nombre === nombre);
		if (indice < 0 || !marcas[documento]) return;
		nuevoTurno(documento, indice);
		delete marcas[documento][indice];
		aMano[llaveMarca(documento, indice)] = true;
		if (indice === editando) {
			sugerencia = null;
			ultimaLectura = null;
		}
	}
	let arrastrando = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	// Cada generación se numera: si se cierra el modal o se elige otro documento mientras Google lee, la respuesta vieja ya es de
	// nadie y no debe pintarse encima de lo nuevo.
	let vigente = 0;

	/** «a», «a y b», «a, b y c». */
	const lista = (nombres: string[]) => (nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);
	const nombresEntreComillas = $derived(lista(nombresArchivos.map((n) => `«${n}»`)));

	const etiquetaTipo = (valor: string) => TIPOS_DE_DATO.find((t) => t.value === valor)?.label ?? 'Texto';
	const yaExiste = (nombre: string) => existentes.some((e) => e.trim().toLowerCase() === nombre.trim().toLowerCase());
	const disponibles = $derived(propuestos.map((p) => !yaExiste(p.nombre)));
	const cuantosElegidos = $derived(elegidos.filter((e, i) => e && disponibles[i]).length);
	const todosElegidos = $derived(disponibles.some(Boolean) && disponibles.every((d, i) => !d || elegidos[i]));

	// Al abrir, siempre desde el principio: la propuesta de una vez anterior no es la de este momento.
	$effect(() => {
		if (abierto) reiniciar();
	});

	function reiniciar() {
		vigente += 1;
		fase = 'elegir';
		nombresArchivos = [];
		terminados = 0;
		fallos = [];
		sobrantes = 0;
		leidos = [];
		error = '';
		propuestos = [];
		elegidos = [];
		documentosVista = [];
		documentoVisible = 0;
		marcas = [];
		turnosMarca = {};
		aMano = {};
		buscando = {};
		sinBuscar = [];
		Object.values(esperasCompletado).forEach((t) => clearTimeout(t));
		esperasCompletado = {};
		origenes = {};
		turnosCompletado = {};
		documentoPreferido = {};
		leidoCon = {};
		forzarLectura = {};
		completando = {};
		completandoTodos = false;
		errorCompletado = '';
		dibujandoNuevo = false;
		cerrarFormulario();
		estadosUbicacion = [];
		resaltado = null;
	}

	function cerrar() {
		vigente += 1;
		onCerrar();
	}

	function manejarDrop(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		const soltados = [...(evento.dataTransfer?.files ?? [])];
		if (soltados.length > 0) void generar(soltados);
	}

	function alElegir(evento: Event) {
		const input = evento.currentTarget as HTMLInputElement;
		const elegidosDelInput = [...(input.files ?? [])];
		input.value = ''; // para que volver a elegir el MISMO archivo dispare el cambio
		if (elegidosDelInput.length > 0) void generar(elegidosDelInput);
	}

	/** Por qué un archivo no se puede leer ANTES de mandarlo, o `null` si está bien. */
	function motivoDeRechazo(archivo: File): string | null {
		const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
		if (!EXTENSIONES.includes(extension)) return 'Ese formato no se puede leer. Usa un PDF o una imagen (JPG, PNG o TIFF).';
		if (archivo.size > MAX_MB * 1024 * 1024) return `El archivo excede el límite de ${MAX_MB} MB.`;
		return null;
	}

	/** Lee UN documento: sus campos propuestos, o por qué no se pudo. Nunca lanza. */
	async function leer(archivo: File, turno: number): Promise<{ ok: true; campos: CampoPropuesto[] } | { ok: false; mensaje: string }> {
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		if (nombreTipo.trim()) cuerpo.append('nombre', nombreTipo.trim());
		if (descripcionTipo.trim()) cuerpo.append('descripcion', descripcionTipo.trim());
		try {
			const r = await fetch('/api/procesadores/generar-campos', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			if (!r.ok) return { ok: false, mensaje: mensajeDeFallo(datos, r.status, 'al proponer los campos') };
			const campos: CampoPropuesto[] = Array.isArray(datos?.campos) ? datos.campos : [];
			if (campos.length === 0) return { ok: false, mensaje: 'Biblioratum no encontró campos que proponer en este documento. Prueba con otro ejemplo.' };
			return { ok: true, campos };
		} catch {
			return { ok: false, mensaje: 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo.' };
		} finally {
			if (turno === vigente) terminados += 1;
		}
	}

	async function generar(archivos: File[]) {
		const aLeer = archivos.slice(0, MAX_DOCUMENTOS);
		const turno = ++vigente;
		nombresArchivos = aLeer.map((a) => a.name);
		sobrantes = archivos.length - aLeer.length;
		terminados = 0;
		fallos = [];
		leidos = [];
		error = '';
		const rechazos = aLeer.map((a) => motivoDeRechazo(a));
		const validos = aLeer.filter((_, i) => rechazos[i] === null);
		if (validos.length === 0) {
			// Nada que mandar: se dice por qué (con uno solo, con las mismas palabras de siempre).
			fase = 'error';
			fallos = aLeer.map((a, i) => ({ nombre: a.name, mensaje: rechazos[i] ?? '' }));
			error = aLeer.length === 1 ? (rechazos[0] ?? '') : 'Ninguno de esos archivos se puede leer.';
			return;
		}
		fase = 'generando';
		// Se leen EN PARALELO: cada uno tarda hasta un minuto y esperar uno tras otro sumaría hasta tres.
		const resultados = await Promise.all(validos.map((a) => leer(a, turno)));
		if (turno !== vigente) return;
		const propuestasPorDocumento: CampoPropuesto[][] = [];
		const fallidos: { nombre: string; mensaje: string }[] = aLeer.flatMap((a, i) => (rechazos[i] !== null ? [{ nombre: a.name, mensaje: rechazos[i] as string }] : []));
		resultados.forEach((resultado, i) => {
			if (resultado.ok) {
				propuestasPorDocumento.push(resultado.campos);
				leidos.push(validos[i]);
			} else {
				fallidos.push({ nombre: validos[i].name, mensaje: resultado.mensaje });
			}
		});
		fallos = fallidos;
		if (propuestasPorDocumento.length === 0) {
			fase = 'error';
			error = fallidos.length === 1 ? fallidos[0].mensaje : 'No se pudo leer ninguno de los documentos.';
			return;
		}
		// Los nombres que se muestran son los de los que SÍ dieron propuesta (los que fallaron se dicen aparte).
		nombresArchivos = leidos.map((a) => a.name);
		propuestos = unirPropuestas(propuestasPorDocumento);
		// Todos marcados de entrada (2026-11-10, Moibe: «que todos aparezcan seleccionados por default»), menos los que ya existen.
		elegidos = propuestos.map((c) => !yaExiste(c.nombre));
		fase = 'propuesta';
		// El documento a un lado, y en cada uno se buscan los campos (en paralelo; no se espera: la lista ya sirve).
		// Las fotos van ENDEREZADAS (`imagenDerecha`): lo que ve Gemini y lo que se pinta debajo de las marcas son los mismos píxeles.
		estadosUbicacion = leidos.map((a) => (sePuedeMarcar(a) ? { fase: 'cargando' } : { fase: 'no-soportado' }));
		marcas = leidos.map(() => ({}));
		const derechas = await Promise.all(leidos.map((a) => imagenDerecha(a)));
		if (turno !== vigente) return;
		documentosVista = derechas;
		await Promise.all(derechas.map((a, i) => (sePuedeMarcar(a) ? ubicar(a, i, turno) : Promise.resolve())));
		if (turno !== vigente) return;
		// Con los recuadros puestos, cada campo se completa con lo que hay dentro del suyo (2026-11-12).
		await completarTodos(turno);
	}

	/** Pregunta dónde está cada campo de la lista en UN documento. Nunca lanza: un fallo deja el documento sin marcas y lo dice. */
	async function ubicar(archivo: File, documento: number, turno: number) {
		// Lo que se pregunta es la lista de ESTE momento; cada respuesta vuelve a su campo por el nombre que se mandó.
		const nombres = propuestos.map((c) => c.nombre);
		const mios = nombres.map((_, k) => nuevoTurno(documento, k));
		const cuerpo = new FormData();
		cuerpo.append('archivo', archivo, archivo.name);
		cuerpo.append('campos', JSON.stringify(propuestos.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion }))));
		let estado: EstadoUbicacion;
		let encontradas: Ubicacion[] = [];
		try {
			const r = await fetch('/api/procesadores/ubicar-campos', { method: 'POST', body: cuerpo });
			const datos = await r.json().catch(() => null);
			// El detalle técnico no le sirve a nadie aquí: la propuesta ya está y lo único que falló es la guía visual.
			if (r.ok) encontradas = leerUbicaciones(datos);
			estado = r.ok
				? { fase: 'listo' }
				: { fase: 'error', mensaje: r.status === 429 ? 'Hay muchas solicitudes a la vez y no se marcaron los campos.' : 'No se pudieron marcar los campos sobre este documento.' };
		} catch {
			estado = { fase: 'error', mensaje: 'No se pudo contactar al servidor para marcar los campos.' };
		}
		if (turno !== vigente) return;
		for (const u of encontradas) {
			const k = nombres.indexOf(u.campo);
			// Si mientras tanto la persona movió o dibujó ese recuadro (o se volvió a buscar), lo suyo manda.
			if (k >= 0 && turnosMarca[llaveMarca(documento, k)] === mios[k]) marcas[documento][k] = { pagina: u.pagina, caja: u.caja, valor: u.valor };
		}
		estadosUbicacion[documento] = estado;
	}

	function alternarTodos(marcar: boolean) {
		elegidos = propuestos.map((_, i) => marcar && disponibles[i]);
	}

	function agregar() {
		const seleccion = propuestos.filter((_, i) => elegidos[i] && disponibles[i]);
		if (seleccion.length === 0) return;
		vigente += 1;
		onAgregar(seleccion, [...leidos]);
	}
</script>

<!-- El formulario de un campo: «Otro campo» (al final de la lista; también el de un recuadro dibujado) o «Editar campo» (en el renglón del campo). -->
{#snippet formularioCampo(editar: boolean)}
	{@const prefijo = editar ? 'editar-campo' : 'nuevo-campo'}
	<form
		class={[
			'flex flex-col gap-3 rounded-lg p-4',
			editar || dibujo ? 'border border-amber-300 bg-background dark:border-amber-800' : 'border border-dashed border-border'
		]}
		data-testid={prefijo}
		data-dibujado={!editar && dibujo ? '' : undefined}
		onsubmit={(e) => {
			e.preventDefault();
			guardarFormulario();
		}}
	>
		<p class="text-sm font-medium text-foreground">{editar ? 'Editar campo' : dibujo ? 'Campo nuevo desde tu recuadro' : 'Otro campo'}</p>
		{#if !editar && dibujo}
			<!-- Lo que Biblioratum leyó en el recuadro dibujado (2026-11-12). -->
			{#if propuesta?.fase === 'pensando'}
				<p class="flex items-center gap-2 text-xs text-muted-foreground" data-testid="proponiendo-campo" aria-live="polite">
					<LoaderCircle class="size-3.5 animate-spin text-primary" /> Leyendo el recuadro para proponer el campo…
				</p>
			{:else if propuesta?.fase === 'lista'}
				<p class="text-xs text-muted-foreground" data-testid="propuesta-recuadro" aria-live="polite">
					Biblioratum lo propuso con lo que hay en tu recuadro; revísalo antes de agregarlo.
					{#if propuesta.valor}
						<span class="wrap-break-word" data-testid="propuesta-recuadro-valor">En el recuadro se lee: «{propuesta.valor}».</span>
					{/if}
				</p>
			{:else if propuesta?.fase === 'error'}
				<p class="text-xs text-destructive" role="alert" data-testid="propuesta-error">{propuesta.mensaje}</p>
			{/if}
			{#if repetido >= 0}
				<div
					class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
					data-testid="propuesta-repetida"
					role="status"
				>
					<span class="min-w-0 flex-1">Ese dato ya es el campo <span class="font-medium">«{propuestos[repetido].nombre}»</span> de la lista.</span>
					<Button type="button" variant="outline" size="sm" data-testid="poner-recuadro-existente" onclick={() => ponerRecuadroA(repetido)}>
						Ponerle este recuadro
					</Button>
				</div>
			{/if}
		{/if}
		<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
			<Input
				bind:ref={fInput}
				bind:value={fNombre}
				placeholder="Nombre del campo"
				aria-label="Nombre del campo"
				aria-invalid={fError !== ''}
				maxlength={80}
				data-testid="{prefijo}-nombre"
				oninput={() => (fError = '')}
			/>
			<Select.Root type="single" value={fTipo} onValueChange={(v) => (fTipo = v)}>
				<Select.Trigger class="w-full" aria-label="Tipo de dato" data-testid="{prefijo}-tipo">{etiquetaTipo(fTipo)}</Select.Trigger>
				<!-- z-70: por encima del modal (z-60); el menú vive en un portal. -->
				<Select.Content class="z-70">
					{#each editar ? opcionesTipo : TIPOS_DE_SUBCAMPO as tipo (tipo.value)}
						<Select.Item value={tipo.value} label={tipo.label} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<Input
			bind:value={fDescripcion}
			placeholder="Descripción (opcional): ayuda a encontrarlo en el documento"
			aria-label="Descripción del campo"
			maxlength={200}
			data-testid="{prefijo}-descripcion"
		/>
		{#if fTipo !== 'grupo'}
			<!-- El «Valor de estructura» del paso 2 (2026-11-12): un ejemplo de la forma del dato; va al esquema dentro de la descripción. -->
			<Input
				bind:value={fEstructura}
				placeholder="Valor de estructura (opcional): un ejemplo inventado de su forma"
				aria-label="Valor de estructura"
				maxlength={120}
				data-testid="{prefijo}-estructura"
			/>
		{/if}
		{#if editar && documentosVista.some((a) => sePuedeMarcar(a))}
			<!-- Lo que se leyó en su recuadro (2026-11-12): qué cambió, o la descripción sugerida si la descripción es de la persona. -->
			{#if editando !== null && completando[editando]}
				<p class="flex items-center gap-2 text-xs text-muted-foreground" data-testid="leyendo-recuadro" aria-live="polite">
					<LoaderCircle class="size-3.5 animate-spin text-primary" /> Leyendo su recuadro…
				</p>
			{:else if ultimaLectura && ultimaLectura.indice === editando && ultimaLectura.error}
				<p class="text-xs text-destructive" role="alert" data-testid="leer-recuadro-error">{ultimaLectura.error}</p>
			{:else if ultimaLectura && ultimaLectura.indice === editando && !(sugerencia && ultimaLectura.cambios.length === 0)}
				<!-- Con una sugerencia a la vista y nada más cambiado, la tarjeta ya lo dice todo (y «no cambió nada» la contradecía). -->
				<p class="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="leido-recuadro" aria-live="polite">
					<ScanText class="mt-px size-3.5 shrink-0 text-primary dark:text-blue-300" />
					<span>
						{ultimaLectura.cambios.length > 0 ? `Con su recuadro se actualizó ${lista(ultimaLectura.cambios)}.` : 'Su recuadro no cambió nada.'}
						{#if ultimaLectura.valor}
							<span class="wrap-break-word" data-testid="leido-recuadro-valor">En el recuadro se lee: «{ultimaLectura.valor}».</span>
						{/if}
					</span>
				</p>
			{/if}
			{#if sugerencia}
				<div class="flex flex-col gap-2 rounded-md border border-primary/25 bg-primary/5 p-3" data-testid="sugerencia-descripcion" aria-live="polite">
					<p class="flex items-center gap-1.5 text-xs font-medium text-primary dark:text-blue-300">
						<Sparkles class="size-3.5" /> Descripción sugerida con su recuadro
					</p>
					<p class="text-sm text-foreground" data-testid="sugerencia-descripcion-texto">{sugerencia.descripcion}</p>
					{#if sugerencia.valor}
						<p class="line-clamp-2 text-xs wrap-break-word text-muted-foreground" data-testid="sugerencia-descripcion-valor">
							En el recuadro se lee: «{sugerencia.valor}»
						</p>
					{/if}
					<p class="text-xs text-muted-foreground">La descripción de este campo la escribiste tú, así que no se cambió sola.</p>
					<div class="flex justify-end gap-2">
						<Button type="button" variant="ghost" size="sm" data-testid="sugerencia-descripcion-descartar" onclick={() => (sugerencia = null)}>Descartar</Button>
						<Button type="button" variant="outline" size="sm" data-testid="sugerencia-descripcion-usar" onclick={usarSugerencia}>Usar esta descripción</Button>
					</div>
				</div>
			{/if}
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={!conRecuadro || (editando !== null && completando[editando])}
					data-testid="volver-a-leer-recuadro"
					onclick={volverALeer}
				>
					<ScanText class="size-3.5" /> Volver a leer su recuadro
				</Button>
				{#if !conRecuadro}
					<span class="text-xs text-muted-foreground">Primero marca su recuadro en el documento.</span>
				{/if}
			</div>
			<p class="text-xs text-muted-foreground">
				Al mover o dibujar su recuadro, Biblioratum vuelve a escribir su descripción, su tipo y su estructura con lo que hay dentro. Lo que escribas tú se
				respeta.
			</p>
		{/if}
		{#if fError}
			<p class="text-xs text-destructive" role="alert" data-testid="{prefijo}-error">{fError}</p>
		{/if}
		<div class="flex justify-end gap-3">
			<Button type="button" variant="ghost" size="sm" data-testid="{prefijo}-cancelar" onclick={cerrarFormulario}>
				{editar && !editoDatos ? 'Cerrar' : 'Cancelar'}
			</Button>
			<Button type="submit" size="sm" data-testid={editar ? 'editar-campo-guardar' : 'nuevo-campo-agregar'}>
				{editar ? 'Guardar cambios' : 'Agregar a la lista'}
			</Button>
		</div>
	</form>
{/snippet}

<DialogPrimitive.Root
	open={abierto}
	onOpenChange={(v) => {
		if (!v) cerrar();
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-60 bg-black/10" />
		<DialogPrimitive.Content
			data-testid="modal-generar-campos"
			onEscapeKeydown={(e) => {
				// Dibujando un campo, o con un campo abierto, Escape deja de dibujar o cierra ese formulario, y no el modal entero (se perdería la propuesta).
				if (dibujandoNuevo) {
					e.preventDefault();
					cancelarDibujo();
				} else if (formulario) {
					e.preventDefault();
					cerrarFormulario();
				}
			}}
			class="fixed top-1/2 left-1/2 z-60 flex max-h-[90vh] w-[92vw] {fase === 'propuesta' && documentosVista.length > 0 ? 'max-w-6xl' : 'max-w-2xl'} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
		>
			<div class="flex items-center gap-3 border-b border-border px-6 py-4">
				<span class="min-w-0 flex-1 text-sm text-muted-foreground">Campos de extracción</span>
				<DialogPrimitive.Close aria-label="Cerrar" onclick={cerrar}>
					<CancelSquareIcon />
				</DialogPrimitive.Close>
			</div>

			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
				<div class="flex items-start gap-4">
					<span class="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5 text-primary">
						<Sparkles class="size-6" />
					</span>
					<div class="min-w-0 flex-1">
						<DialogPrimitive.Title class="text-xl font-bold text-foreground">
							Generar a partir de un documento
						</DialogPrimitive.Title>
						<DialogPrimitive.Description class="mt-1 text-sm text-muted-foreground">
							Sube un documento de ejemplo y Biblioratum propondrá los campos a extraer. Tú eliges cuáles agregar; los que después no
							te sirvan, los puedes quitar.
						</DialogPrimitive.Description>
					</div>
				</div>

				{#if fase === 'elegir'}
					<!-- Los documentos del paso 1 (2026-11-07): ya se leyeron para sugerir la descripción; aquí se pueden reutilizar en vez de pedirlos otra vez. -->
					{#if ejemplosPrevios.length > 0}
						<div class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3" data-testid="generar-campos-previos">
							{#if ejemplosPrevios.length === 1}
								<p class="min-w-0 flex-1 text-sm text-foreground">
									Ya elegiste un documento en el paso 1: <span class="text-muted-foreground">«{ejemplosPrevios[0].name}»</span>.
								</p>
								<Button size="sm" data-testid="generar-campos-usar-previos" onclick={() => void generar([ejemplosPrevios[0]])}>Usar este documento</Button>
							{:else}
								<!-- Con un solo documento por vez (2026-11-12), de los del paso 1 se elige cuál. -->
								<p class="w-full text-sm text-foreground">Ya elegiste {ejemplosPrevios.length} documentos en el paso 1. Usa uno:</p>
								{#each ejemplosPrevios as previo, i (i)}
									<Button size="sm" variant="outline" class="max-w-full" data-testid="generar-campos-usar-previos" onclick={() => void generar([previo])}>
										<span class="truncate">Usar «{previo.name}»</span>
									</Button>
								{/each}
							{/if}
						</div>
					{/if}
					<button
						type="button"
						data-testid="generar-campos-zona"
						class={[
							'flex h-56 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors',
							arrastrando ? 'border-primary bg-muted' : 'border-border bg-background'
						]}
						onclick={() => fileInput?.click()}
						ondragover={(e) => {
							e.preventDefault();
							arrastrando = true;
						}}
						ondragleave={() => (arrastrando = false)}
						ondrop={manejarDrop}
					>
						<span class="flex size-8 items-center justify-center rounded-lg border border-border bg-card">
							<FolderLibraryIcon />
						</span>
						<div class="flex flex-col items-center gap-0.5 text-center">
							<p class="text-sm font-medium text-foreground">
								Arrastra y suelta tu documento de ejemplo aquí o selecciónalo
							</p>
							<p class="text-xs text-muted-foreground">PDF, JPG, JPEG, PNG, TIFF | Max {MAX_MB} MB</p>
						</div>
						<span class="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-secondary-foreground">
							Buscar archivo
						</span>
					</button>
					<input
						bind:this={fileInput}
						data-testid="generar-campos-archivo"
						type="file"
						class="hidden"
						accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
						onchange={alElegir}
					/>
				{:else if fase === 'generando'}
					<div
						class="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-center"
						data-testid="generar-campos-leyendo"
						aria-live="polite"
					>
						<LoaderCircle class="size-7 animate-spin text-primary" />
						<p class="text-sm font-medium text-foreground">
							{nombresArchivos.length === 1 ? `Leyendo «${nombresArchivos[0]}» y proponiendo campos…` : `Leyendo ${nombresArchivos.length} documentos y proponiendo campos…`}
						</p>
						<!-- Medido el 2026-10-29 con una factura de una página: de 12 a 50 s según la corrida. Con varios se leen a la vez, así que no suma. -->
						<p class="text-xs text-muted-foreground" data-testid="generar-campos-progreso">
							{nombresArchivos.length > 1 ? `${terminados} de ${nombresArchivos.length} listos. ` : ''}Puede tardar hasta un minuto.
						</p>
					</div>
				{:else if fase === 'error'}
					<div
						class="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
						data-testid="generar-campos-error"
						role="alert"
					>
						<AlertCircle class="mt-0.5 size-4 shrink-0 text-destructive" />
						<div class="min-w-0 text-sm">
							<p class="font-medium text-destructive">No se pudieron proponer campos{nombresArchivos.length === 1 ? ` para «${nombresArchivos[0]}»` : ''}.</p>
							<p class="mt-1 text-muted-foreground">{error}</p>
							{#if fallos.length > 1}
								<ul class="mt-2 list-disc pl-5 text-xs text-muted-foreground" data-testid="generar-campos-fallos">
									{#each fallos as f (f.nombre)}
										<li><span class="font-medium">{f.nombre}</span>: {f.mensaje}</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>
				{:else}
					<div class={documentosVista.length > 0 ? 'grid items-start gap-6 lg:grid-cols-2' : 'contents'}>
						{#if documentosVista.length > 0}
							<div class="lg:sticky lg:top-0">
								<DocumentoConCampos
									bind:indice={documentoVisible}
									documentos={documentosVista}
									estados={estadosUbicacion}
									ubicaciones={ubicacionesVista}
									{visibles}
									resaltado={nombreEditando ?? resaltado}
									editando={nombreEditando}
									onResaltar={(campo) => (resaltado = campo)}
									onElegir={(campo) => {
										const k = propuestos.findIndex((p) => p.nombre === campo);
										if (k >= 0) abrirEdicion(k);
									}}
									onCaja={cambiarCaja}
									onQuitar={quitarCaja}
									dibujarNuevo={dibujandoNuevo}
									nuevo={dibujo && formulario?.modo === 'nuevo' ? { ...dibujo, etiqueta: fNombre.trim() || 'Campo nuevo' } : null}
									onNuevo={alDibujarNuevo}
									onCancelarDibujo={cancelarDibujo}
								/>
							</div>
						{/if}
						<div class="flex min-w-0 flex-col gap-5">
							<div class="flex items-center justify-between gap-3">
								<p class="text-sm text-muted-foreground" data-testid="generar-campos-resumen">
									{propuestos.length === 1 ? 'Se propuso 1 campo' : `Se propusieron ${propuestos.length} campos`} a partir de
									{nombresEntreComillas}.
								</p>
								<label class="flex shrink-0 items-center gap-2 text-sm text-foreground">
									<Checkbox
										data-testid="generar-campos-todos"
										checked={todosElegidos}
										disabled={!disponibles.some(Boolean)}
										onCheckedChange={(v) => alternarTodos(v === true)}
									/>
									Seleccionar todos
								</label>
							</div>
							<!-- Lo que no se pudo leer, o lo que sobró, se dice: sin esto la propuesta parecería hecha con todos los documentos. -->
							{#if fallos.length > 0}
								<div class="-mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="generar-campos-fallos" role="status">
									<p class="font-medium">{fallos.length === 1 ? 'Un documento no se pudo leer y no cuenta en la propuesta:' : `${fallos.length} documentos no se pudieron leer y no cuentan en la propuesta:`}</p>
									<ul class="mt-1 list-disc pl-5">
										{#each fallos as f (f.nombre)}
											<li><span class="font-medium">{f.nombre}</span>: {f.mensaje}</li>
										{/each}
									</ul>
								</div>
							{/if}
							{#if sobrantes > 0}
								<p class="-mt-2 text-xs text-muted-foreground" data-testid="generar-campos-sobrantes">
									Se lee un documento a la vez: se usó «{nombresArchivos[0]}» y {sobrantes === 1 ? 'el otro se dejó fuera' : `los otros ${sobrantes} se dejaron fuera`}.
								</p>
							{/if}
							<!-- La primera lectura de los recuadros (2026-11-12): mientras dura, y si falló (la propuesta sirve igual, como la dio el documento). -->
							{#if completandoTodos}
								<p class="-mt-2 flex items-center gap-2 text-xs text-muted-foreground" data-testid="completando-campos" aria-live="polite">
									<LoaderCircle class="size-3.5 animate-spin text-primary" /> Leyendo los recuadros para completar cada campo…
								</p>
							{:else if errorCompletado}
								<div class="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" data-testid="completar-error" role="status">
									<span class="text-destructive">{errorCompletado} Los campos se quedan como los propuso el documento.</span>
									<Button variant="link" size="sm" class="h-auto p-0 text-xs" data-testid="completar-reintentar" onclick={() => void completarTodos(vigente)}>
										Reintentar
									</Button>
								</div>
							{/if}

							<!-- Cada renglón: solo el campo y su tipo (2026-11-10, Moibe: «hay demasiado texto… evita la descripción y en cuántos documentos apareció»). La descripción se sigue agregando al campo. -->
							<ul class="flex flex-col divide-y divide-border rounded-lg border border-border" data-testid="generar-campos-lista">
								{#each propuestos as campo, i (i)}
									{#if editando === i}
										<li class="bg-amber-50/60 p-3 dark:bg-amber-950/30" data-testid="campo-propuesto" data-editando="">
											{@render formularioCampo(true)}
										</li>
									{:else}
									<li
										class={[
											'group/renglon flex items-start gap-3 px-4 py-3 transition-colors',
											!disponibles[i] && 'opacity-60',
											resaltado === campo.nombre && elegidos[i] && 'bg-amber-50 dark:bg-amber-950/40'
										]}
										data-testid="campo-propuesto"
										onpointerenter={() => (resaltado = campo.nombre)}
										onpointerleave={() => (resaltado = null)}
									>
										<Checkbox
											id="propuesto-{i}"
											class="mt-0.5"
											checked={elegidos[i] && disponibles[i]}
											disabled={!disponibles[i]}
											onCheckedChange={(v) => (elegidos[i] = v === true)}
											aria-label="Agregar {campo.nombre}"
										/>
										<label for="propuesto-{i}" class="min-w-0 flex-1 cursor-pointer">
											<span class="flex flex-wrap items-center gap-2">
												<span class="text-sm font-medium text-foreground" data-testid="campo-propuesto-nombre">{campo.nombre}</span>
												<span class="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" data-testid="campo-propuesto-tipo">{etiquetaTipo(campo.tipoDato)}</span>
												{#if campo.cardinalidad === 'multiple'}
													<span class="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary dark:text-blue-300">Se repite</span>
												{/if}
												{#if campo.manual}
													<span class="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" data-testid="campo-propuesto-manual">Agregado por ti</span>
												{/if}
												{#if desdeRecuadro(i)}
													<!-- Lo que el extractor leerá de este campo salió de su recuadro (2026-11-12). -->
													<span
														class="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary dark:text-blue-300"
														data-testid="campo-propuesto-recuadro"
														title="Biblioratum escribió su descripción, su tipo y su estructura con lo que hay dentro de su recuadro. Edítalo para cambiarlos."
													>
														<ScanText class="size-3" /> Desde su recuadro
													</span>
												{/if}
												{#if completando[i] && !completandoTodos}
													<span class="flex items-center gap-1 text-xs text-muted-foreground" data-testid="campo-propuesto-leyendo">
														<LoaderCircle class="size-3 animate-spin text-primary" /> Leyendo su recuadro…
													</span>
												{/if}
												{#if (buscando[i] ?? 0) > 0}
													<span class="flex items-center gap-1 text-xs text-muted-foreground" data-testid="campo-propuesto-buscando">
														<LoaderCircle class="size-3 animate-spin text-primary" /> Buscándolo en el documento…
													</span>
												{:else if sinBuscar.includes(i)}
													<span class="text-xs text-muted-foreground" data-testid="campo-propuesto-sin-buscar">No se pudo buscar en el documento</span>
												{/if}
												{#if !disponibles[i]}
													<span class="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800" data-testid="campo-propuesto-existe">
														Ya existe un campo con este nombre
													</span>
												{/if}
											</span>
											{#if campo.tipoDato === 'grupo' && campo.subcampos.length}
												<span class="mt-1 block text-xs text-muted-foreground">
													Campos del grupo: {campo.subcampos.map((s) => `${s.nombre} (${etiquetaTipo(s.tipoDato)})`).join(' · ')}
												</span>
											{/if}
											{#if campo.tipoDato === 'lista' && campo.valoresLista.length}
												<span class="mt-1 block text-xs text-muted-foreground">Valores: {campo.valoresLista.join(' · ')}</span>
											{/if}
										</label>
										<Button
											variant="ghost"
											size="icon-sm"
											class="-my-1 shrink-0 text-muted-foreground"
											aria-label="Editar {campo.nombre}"
											title="Editar"
											data-testid="campo-propuesto-editar"
											onclick={() => abrirEdicion(i)}
										>
											<Pencil class="size-3.5" />
										</Button>
									</li>
									{/if}
								{/each}
							</ul>
							{#if formulario?.modo === 'nuevo'}
								<div class="-mt-2">{@render formularioCampo(false)}</div>
							{:else}
								<div class="-mt-2 flex flex-wrap items-center gap-2">
									<Button variant="outline" size="sm" data-testid="agregar-otro-campo" onclick={abrirNuevo}>
										<Plus class="size-4" /> Agregar otro campo
									</Button>
									{#if documentosVista.some((a) => sePuedeMarcar(a))}
										<!-- «Dibujar un campo» (2026-11-12): un recuadro sobre un dato que no está en la lista propone el campo. -->
										<Button
											variant={dibujandoNuevo ? 'secondary' : 'outline'}
											size="sm"
											aria-pressed={dibujandoNuevo}
											data-testid="dibujar-campo"
											onclick={() => (dibujandoNuevo ? cancelarDibujo() : empezarDibujo())}
										>
											<SquareDashedMousePointer class="size-4" />
											{dibujandoNuevo ? 'Dibujando en el documento…' : 'Dibujar un campo'}
										</Button>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
				{#if fase === 'propuesta' || fase === 'error'}
					<Button variant="link" class="h-auto p-0" data-testid="generar-campos-otro" onclick={reiniciar}>
						{nombresArchivos.length > 1 ? 'Usar otros documentos' : 'Usar otro documento'}
					</Button>
				{:else}
					<span></span>
				{/if}
				<div class="flex items-center gap-4">
					<Button variant="link" class="h-auto p-0 text-destructive" onclick={cerrar}>Cancelar</Button>
					{#if fase === 'propuesta'}
						<Button size="lg" data-testid="generar-campos-agregar" disabled={cuantosElegidos === 0} onclick={agregar}>
							{cuantosElegidos === 1 ? 'Agregar 1 campo' : `Agregar ${cuantosElegidos} campos`}
						</Button>
					{/if}
				</div>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
