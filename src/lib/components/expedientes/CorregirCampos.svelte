<script lang="ts">
	/**
	 * Revisar y corregir los datos extraídos de un documento (HU073 del Figma, «corregir campos», 2026-11-26; Moibe: «va, haz la pantalla de corrección con el
	 * HU073»). Vive como pestaña del detalle de datos extraídos (`DatosExtraidosModal`), que es donde nuestro modelo ya enseña lo extraído.
	 *
	 * Arriba, los campos que piden revisión (`revisionDeCampos`: sin valor, o con confianza menor a 85 %), cada uno en la tarjeta del diseño: su motivo, la
	 * confianza obtenida, «Valor extraído *» con lo leído y «Guardar», que se vuelve una palomita al quedar guardado. Debajo, plegados, los demás campos, que
	 * también se pueden corregir. Cada corrección se guarda aparte del dato extraído (que no se toca), con quién, cuándo y un motivo opcional; desde ese momento
	 * es el valor vigente: lo usan las ejecuciones de procesos y la búsqueda («¿qué se corrigió y quién?»).
	 *
	 * Lo que se aparta del diseño (que es de la «Cola de revisión manual», HU072, que en nuestro modelo no existe; el Figma vale solo por el look and feel):
	 *   · no hay «Registrar como ejemplo» (HU074) ni la vista previa grande del documento: cada campo con página lleva «Ver en el documento · pág. N», que lo
	 *     abre en esa página en otra pestaña;
	 *   · «Motivo» del diseño es por qué se pide revisar; el motivo de la CORRECCIÓN (opcional) se agrega con «Agregar motivo»;
	 *   · la lista de pendientes se fija al abrir: un campo recién corregido se queda en su lugar con su palomita en vez de brincar a «Otros campos».
	 */
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		MAX_MOTIVO_CORRECCION,
		nombreDeCampo,
		problemaDeCorreccion,
		quienCorrigio,
		revisionDeCampos,
		type Campo
	} from '$lib/expedientes/datosExtraidos';

	let {
		documentoId,
		campos,
		alCorregir,
		cambiosSinGuardar = $bindable(0)
	}: {
		documentoId: string;
		campos: Campo[];
		/** El campo como quedó, para que el detalle lo enseñe ya corregido. */
		alCorregir: (campo: Campo) => void;
		/** Cuántos campos tienen algo escrito y sin guardar (el detalle lo usa para no cerrarse y perderlo). */
		cambiosSinGuardar?: number;
	} = $props();

	type Borrador = { valor: string; motivo: string; conMotivo: boolean; estado: 'quieto' | 'guardando' | 'guardado'; error: string };
	let borradores = $state<Record<string, Borrador>>({});

	// Qué se pidió revisar, fijado la primera vez que llegan los campos de ESTE documento (ver el docstring).
	let fijadoPara = $state<string | null>(null);
	let rutasPendientes = $state<Record<string, string>>({});
	let otrosAbiertos = $state(false);
	// Antes de pintar: lo que se pide revisar (una vez por documento) y un borrador por campo, con su valor vigente.
	$effect.pre(() => {
		if (campos.length === 0) return;
		if (fijadoPara !== documentoId) {
			fijadoPara = documentoId;
			borradores = {};
			rutasPendientes = Object.fromEntries(revisionDeCampos(campos).pendientes.map((p) => [p.campo.ruta, p.motivo]));
			otrosAbiertos = Object.keys(rutasPendientes).length === 0;
		}
		for (const c of campos) borradores[c.ruta] ??= { valor: c.valor ?? '', motivo: '', conMotivo: false, estado: 'quieto', error: '' };
	});
	const pendientes = $derived(campos.filter((c) => c.ruta in rutasPendientes));
	const demas = $derived(campos.filter((c) => !(c.ruta in rutasPendientes)));

	const sucio = (c: Campo) => {
		const b = borradores[c.ruta];
		return !!b && b.estado !== 'guardando' && b.valor.trim() !== (c.valor ?? '').trim();
	};
	$effect(() => {
		cambiosSinGuardar = campos.filter(sucio).length;
	});

	async function guardar(c: Campo): Promise<boolean> {
		const b = borradores[c.ruta];
		if (!b) return false;
		const problema = problemaDeCorreccion(c, b.valor, b.motivo);
		if (problema) {
			b.error = problema;
			return false;
		}
		b.estado = 'guardando';
		b.error = '';
		try {
			const r = await fetch(`/api/documentos/${encodeURIComponent(documentoId)}/datos/correcciones`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ruta: c.ruta, valor: b.valor.trim(), motivo: b.conMotivo ? b.motivo.trim() : '' })
			});
			const cuerpo = await r.json().catch(() => null);
			if (!r.ok || !cuerpo || typeof cuerpo.ruta !== 'string') {
				b.estado = 'quieto';
				b.error =
					r.status === 403
						? 'Tu rol puede ver los datos, pero no corregirlos.'
						: (cuerpo?.mensaje ?? 'No se pudo guardar la corrección. Intenta de nuevo.');
				return false;
			}
			const nuevo = cuerpo as Campo;
			b.valor = nuevo.valor ?? b.valor.trim();
			b.motivo = '';
			b.conMotivo = false;
			b.estado = 'guardado';
			alCorregir(nuevo);
			return true;
		} catch {
			b.estado = 'quieto';
			b.error = 'No se pudo guardar la corrección. Revisa tu conexión e intenta de nuevo.';
			return false;
		}
	}

	/** «Guardar y cerrar»: guarda, uno por uno, todo lo que tenga algo escrito sin guardar. Devuelve cuántos guardó y si alguno falló. */
	export async function guardarTodo(): Promise<{ guardados: number; fallidos: number }> {
		let guardados = 0;
		let fallidos = 0;
		for (const c of campos.filter(sucio)) {
			if (await guardar(c)) guardados++;
			else fallidos++;
		}
		return { guardados, fallidos };
	}

	/** Tira lo escrito sin guardar (al cerrar sin guardar). */
	export function descartarTodo() {
		for (const c of campos) {
			const b = borradores[c.ruta];
			if (b && sucio(c)) {
				b.valor = c.valor ?? '';
				b.error = '';
			}
		}
	}
</script>

{#snippet tarjeta(c: Campo, motivoRevision: string | null)}
	{@const b = borradores[c.ruta]}
	{#if b}
	{@const cambio = b.valor.trim() !== (c.valor ?? '').trim()}
	{@const idInput = `corregir-${documentoId}-${c.ruta}`}
	<section class="rounded-xl border border-border bg-muted/40 p-3 dark:bg-muted/20" data-testid="campo-corregir" data-ruta={c.ruta}>
		<p class="px-1 text-xs font-medium text-foreground">{nombreDeCampo(c.ruta)}</p>
		<div class="mt-2 rounded-lg border border-border bg-card p-3">
			{#if motivoRevision}
				<div class="mb-3 grid grid-cols-2 gap-3" data-testid="campo-corregir-motivo">
					<div class="border-r border-border pr-3">
						<p class="text-xs text-muted-foreground">Motivo</p>
						<p class="mt-0.5 flex items-center gap-1.5 text-sm text-foreground">
							<TriangleAlert class="size-3.5 shrink-0 fill-amber-300 text-amber-600 dark:fill-amber-400/30 dark:text-amber-300" aria-hidden="true" />
							{motivoRevision}
						</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Confianza obtenida</p>
						<p class="mt-0.5 text-sm text-foreground tabular-nums">{typeof c.confianza === 'number' ? `${c.confianza.toFixed(0)} %` : '—'}</p>
					</div>
				</div>
			{/if}
			<label for={idInput} class="text-sm font-medium text-foreground">Valor extraído <span aria-hidden="true">*</span></label>
			<div class="mt-1.5 flex items-center gap-2">
				<Input
					id={idInput}
					bind:value={b.valor}
					placeholder="Escribe el valor como aparece en el documento"
					maxlength={4000}
					aria-invalid={b.error ? true : undefined}
					aria-describedby={b.error ? `${idInput}-error` : undefined}
					data-testid="campo-corregir-valor"
					oninput={() => (b.error = '')}
					onkeydown={(e) => {
						if (e.key === 'Enter' && cambio) {
							e.preventDefault();
							guardar(c);
						}
					}}
				/>
				{#if b.estado === 'guardado' && !cambio}
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
						title="Corrección guardada"
						data-testid="campo-corregir-guardado"
					>
						<BadgeCheck class="size-4" aria-hidden="true" />
						<span class="sr-only">Corrección guardada</span>
					</span>
				{:else}
					<Button
						type="button"
						class="h-9 shrink-0 px-4"
						disabled={!cambio || b.estado === 'guardando'}
						data-testid="campo-corregir-guardar"
						onclick={() => guardar(c)}
					>
						{#if b.estado === 'guardando'}<LoaderCircle class="size-4 animate-spin" />{/if}
						Guardar
					</Button>
				{/if}
			</div>
			{#if b.error}
				<p id="{idInput}-error" class="mt-1.5 text-xs text-destructive" role="alert" data-testid="campo-corregir-error">{b.error}</p>
			{/if}
			{#if b.conMotivo}
				<Input
					class="mt-2 h-8 text-xs"
					bind:value={b.motivo}
					maxlength={MAX_MOTIVO_CORRECCION}
					placeholder="Por qué se corrige (opcional)"
					aria-label="Motivo de la corrección de {nombreDeCampo(c.ruta)}"
					data-testid="campo-corregir-motivo-texto"
				/>
			{/if}
			<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
				{#if cambio && !b.conMotivo}
					<button type="button" class="text-primary hover:underline dark:text-blue-300" data-testid="campo-corregir-agregar-motivo" onclick={() => (b.conMotivo = true)}>
						Agregar motivo
					</button>
				{/if}
				{#if c.pagina}
					<a
						href={`/api/documentos/${encodeURIComponent(documentoId)}/abrir?pagina=${c.pagina}`}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
						data-testid="campo-corregir-ver"
					>
						Ver en el documento · pág. {c.pagina}
						<ExternalLink class="size-3" aria-hidden="true" />
					</a>
				{/if}
			</div>
			{#if quienCorrigio(c)}
				<p class="mt-2 text-xs text-muted-foreground" data-testid="campo-corregir-quien">
					{quienCorrigio(c)}{c.valorExtraido && c.valorExtraido !== c.valor ? ` · la extracción leyó «${c.valorExtraido}»` : ''}
				</p>
			{/if}
		</div>
	</section>
	{/if}
{/snippet}

<div data-testid="corregir-campos">
	{#if campos.length === 0}
		<p class="py-10 text-center text-sm text-muted-foreground">Este documento todavía no tiene datos extraídos que revisar.</p>
	{:else}
		<p class="mt-3 text-xs leading-relaxed text-muted-foreground">
			Confirma que el valor extraído sea correcto. En caso de detectar diferencias o errores, actualiza el contenido con la información correspondiente del
			documento.
		</p>

		{#if pendientes.length > 0}
			<div class="mt-3 flex flex-col gap-3" data-testid="campos-pendientes">
				{#each pendientes as c (c.ruta)}
					{@render tarjeta(c, rutasPendientes[c.ruta])}
				{/each}
			</div>
		{:else}
			<p class="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground dark:bg-muted/20" data-testid="sin-pendientes">
				<BadgeCheck class="size-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
				Ningún campo pide revisión: todos traen valor con buena confianza.
			</p>
		{/if}

		{#if demas.length > 0}
			<button
				type="button"
				class="mt-4 flex w-full items-center gap-2 rounded-md py-1 text-left text-sm font-medium text-foreground hover:text-primary"
				aria-expanded={otrosAbiertos}
				data-testid="otros-campos"
				onclick={() => (otrosAbiertos = !otrosAbiertos)}
			>
				<ChevronDown class="size-4 shrink-0 transition-transform {otrosAbiertos ? '' : '-rotate-90'}" aria-hidden="true" />
				{pendientes.length > 0 ? 'Otros campos' : 'Campos extraídos'} ({demas.length})
			</button>
			{#if otrosAbiertos}
				<div class="mt-2 flex flex-col gap-3" data-testid="campos-demas">
					{#each demas as c (c.ruta)}
						{@render tarjeta(c, null)}
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
