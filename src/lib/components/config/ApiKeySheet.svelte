<script lang="ts">
	/**
	 * Modal "Configuración de API Key" (capturas del 2026-09-23).
	 *
	 * Es el HERMANO de `ConfigSheet.svelte`: misma cáscara —encabezado con el
	 * nombre del módulo y su X, banda de título con ícono redondo, y abajo dos
	 * columnas (sidebar de 330px + panel de contenido)—, así que aquí se copia
	 * esa estructura al pie de la letra en vez de inventar una propia. Si esa
	 * cáscara cambia allá, este archivo tiene que seguirla.
	 *
	 * Dos vistas, las dos dibujadas: el estado vacío de entrada y el formulario
	 * de alta al que lleva "Nueva API Key".
	 *
	 * LO QUE TODAVÍA NO EXISTE (a propósito, no es olvido):
	 *
	 *  1. "Crear API Key" no guarda nada. No hay diseño de lo que sigue, y de
	 *     fondo `nexus_back` no tiene concepto de API keys ni la app tiene
	 *     autenticación: generar aquí una llave sería fabricar una credencial
	 *     que no autentica nada. El botón valida el formulario (por eso se
	 *     prende y se apaga), pero no hace el alta.
	 *  2. El renglón "API Keys" del sidebar no navega: es la única sección que
	 *     hay, así que no tiene a dónde llevar. La flecha va de adorno, como en
	 *     el diseño. Cuando haya una segunda sección, esto se vuelve botón.
	 *  3. No hay listado. El día que existan llaves guardadas, el panel derecho
	 *     alterna entre la tabla y el estado vacío.
	 */
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import ArchiveIcon from '$lib/components/icons/ArchiveIcon.svelte';
	import ArrowRightIcon from '$lib/components/icons/ArrowRightIcon.svelte';
	import EmptyState from '$lib/components/home/EmptyState.svelte';
	import Puzzle from '@lucide/svelte/icons/puzzle';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let vista = $state<'vacio' | 'nueva'>('vacio');

	// El borrador del alta. NO se limpia al cerrar el modal —igual que el
	// borrador del Modulo de configuración—: quien cerró por accidente a media
	// captura no debería perder lo escrito. Se limpia al cancelar, que sí es una
	// decisión explícita.
	let nombre = $state('');
	let descripcion = $state('');

	/** Las opciones de expiración son una SUPOSICIÓN: la captura solo alcanza a
	 *  mostrar "1 día" con el desplegable cerrado. Este juego es el habitual en
	 *  proveedores de API keys. A propósito NO hay "sin expiración": el rótulo
	 *  de abajo promete una fecha de vencimiento, y una llave eterna lo dejaría
	 *  sin nada que decir. Vale confirmarlo con el UX. */
	const EXPIRACIONES = [
		{ value: '1', label: '1 día' },
		{ value: '7', label: '7 días' },
		{ value: '30', label: '30 días' },
		{ value: '60', label: '60 días' },
		{ value: '90', label: '90 días' },
		{ value: '365', label: '1 año' }
	];
	let expiracion = $state('1');

	const etiquetaExpiracion = $derived(
		EXPIRACIONES.find((e) => e.value === expiracion)?.label ?? EXPIRACIONES[0].label
	);

	/** La fecha del rótulo se CALCULA a partir de hoy y de la opción elegida. En
	 *  la captura dice "20 de agosto de 2026", que es la fecha en que se dibujó
	 *  la pantalla; dejarla fija mostraría una expiración ya vencida. */
	const fechaExpiracion = $derived(
		new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(
			new Date(Date.now() + Number(expiracion) * 24 * 60 * 60 * 1000)
		)
	);

	/** Los tres campos llevan asterisco en el diseño, así que los tres son
	 *  obligatorios. `trim()` para que puros espacios no cuenten como llenos. */
	const formularioCompleto = $derived(nombre.trim() !== '' && descripcion.trim() !== '');

	function cancelar() {
		nombre = '';
		descripcion = '';
		expiracion = '1';
		vista = 'vacio';
	}
</script>

<Sheet.Root bind:open>
	<!-- Mismo ancho que el Modulo de configuración: la cáscara es la misma y dos
	     módulos hermanos que abren a distinto tamaño se sienten como dos apps. -->
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-api-key"
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[75%] data-[side=right]:xl:w-[70%]"
	>
		<!-- header . navigation -->
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">
				Configuración de API Key
			</Sheet.Title>
			<!-- La X cierra el módulo completo, también desde el formulario. A
			     diferencia de ConfigSheet no sube de nivel: aquí el camino de vuelta
			     al estado vacío es "Cancelar configuración", que además limpia lo
			     capturado; la X deja el borrador en pie. -->
			<Sheet.Close
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</Sheet.Close>
		</div>

		<!-- header.modal -->
		<div class="flex items-center gap-3 px-6 py-4">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
			>
				<Puzzle class="size-4" />
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="text-lg font-medium text-foreground">Claves de acceso API Keys</h2>
				<Sheet.Description class="text-sm">
					Configura y administra las credenciales que permiten autenticar integraciones y
					solicitudes a los servicios de NexusDoc.
				</Sheet.Description>
			</div>
		</div>

		<div class="flex min-h-0 flex-1">
			<!-- statusbar: 330px, fondo y bordes de 2px, igual que el del módulo de
			     configuración. No cambia entre las dos vistas. -->
			<aside
				class="w-82.5 shrink-0 overflow-y-auto border-t-2 border-r-2 border-muted bg-background p-6"
			>
				<p class="text-xs text-foreground">Configuración</p>
				<!-- La tarjeta de la sección, con la misma forma que "Biblioteca" allá
				     (ícono en cuadro redondeado + título + descripción + flecha). Va
				     como <div> y no como <button> porque hoy no navega a ningún lado:
				     un botón que no hace nada promete algo que no cumple. -->
				<div class="mt-6 flex w-full items-center gap-3" data-testid="seccion-api-keys">
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
					>
						<ArchiveIcon />
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-foreground">API Keys</p>
						<p class="mt-2 text-xs text-muted-foreground">
							Localiza tu listado de API Keys configuradas
						</p>
					</div>
					<ArrowRightIcon class="shrink-0 text-[#94a3b8]" />
				</div>
			</aside>

			<!-- El pie vive DENTRO de esta columna, no debajo del modal entero: en la
			     captura su línea divisoria arranca donde termina el sidebar. -->
			<div class="flex min-h-0 flex-1 flex-col">
				<div class="flex-1 overflow-y-auto p-8">
					{#if vista === 'vacio'}
						<!-- Estado vacío. `EmptyState` es el mismo componente de los paneles
						     del Home —ícono en cuadro de 50px, título y descripción—, que es
						     justo la forma que dibuja la captura; lo único que no trae es el
						     botón, así que ese va aquí abajo. -->
						<div class="flex h-full flex-col items-center justify-center gap-6">
							<EmptyState
								icon={Puzzle}
								title="Configura tu primera API Key"
								description="Genera una clave de acceso para autenticar de forma segura las solicitudes e integraciones disponibles."
							/>
							<Button
								class="w-60"
								data-testid="nueva-api-key"
								onclick={() => (vista = 'nueva')}
							>
								Nueva API Key
							</Button>
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">Configuración de nueva API Key</p>

						<div class="mt-4 rounded-xl border border-border p-6">
							<p class="text-sm text-muted-foreground">Completa la información requerida.</p>

							<!-- Nombre y Expiración comparten renglón; Descripción ocupa los dos,
							     como en la captura. Debajo de 640px se apilan: a ese ancho dos
							     columnas dejan el select sin aire para su etiqueta. -->
							<div class="mt-6 grid gap-6 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="nombre-api-key">Nombre API Key *</Label>
									<Input
										id="nombre-api-key"
										bind:value={nombre}
										placeholder="Ej. Integración producción"
									/>
								</div>

								<div class="space-y-2">
									<Label for="expiracion-api-key">Expiración *</Label>
									<Select.Root type="single" bind:value={expiracion}>
										<Select.Trigger id="expiracion-api-key" class="w-full">
											{etiquetaExpiracion}
										</Select.Trigger>
										<Select.Content>
											{#each EXPIRACIONES as e (e.value)}
												<Select.Item value={e.value} label={e.label} />
											{/each}
										</Select.Content>
									</Select.Root>
									<p class="text-xs text-muted-foreground" data-testid="fecha-expiracion">
										Esta clave expira el {fechaExpiracion}.
									</p>
								</div>

								<div class="space-y-2 sm:col-span-2">
									<Label for="descripcion-api-key">Descripción *</Label>
									<Textarea
										id="descripcion-api-key"
										bind:value={descripcion}
										rows={3}
										placeholder="Describe el propósito o uso de esta API Key"
									/>
								</div>
							</div>
						</div>
					{/if}
				</div>

				{#if vista === 'nueva'}
					<!-- Los dos a la derecha, como en la captura. "Cancelar configuración"
					     con el mismo variant="link" rojo que ya usan Calibración y la
					     evaluación de prompts en el módulo hermano. -->
					<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
						<Button
							variant="link"
							class="h-auto p-0 text-destructive"
							data-testid="cancelar-api-key"
							onclick={cancelar}
						>
							Cancelar configuración
						</Button>
						<!-- Sin onclick: ver la nota 1 del encabezado del archivo. -->
						<Button data-testid="crear-api-key" disabled={!formularioCompleto}>
							Crear API Key
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>
