<script lang="ts">
	/**
	 * Expediente · Tipos de expediente (2026-10-24). Lo único que hace esta pantalla, por ahora: ver los tipos de expediente de la
	 * organización y DAR DE ALTA uno nuevo (solo su nombre).
	 *
	 * Un tipo de expediente es la clase de la que salen los expedientes («Expediente médico», «Expediente de un choque»); cada
	 * expediente es una instancia de un tipo, con los documentos de UN caso (un paciente, un choque). Crear los expedientes, asignar
	 * tipos documentales al esquema de un tipo, renombrar o borrar tipos: nada de eso está todavía.
	 *
	 * Tres estados, como la pantalla de Usuarios, de la que se tomó el lenguaje (migas de pan, título, tarjeta con tabla, estado vacío
	 * y aviso verde): sin tipos —con el botón para crear el primero, solo para quien administra—, y con tipos. NO salió de un frame de
	 * Figma: se agotó la cuota de lectura del archivo y el Sprint 5 no se pudo abrir; si el diseño trae otra cosa, se ajusta contra él.
	 *
	 * Quién puede crear tipos lo decide nexus_back (Administrador y Supervisor); aquí `puedeCrear` solo decide si se OFRECE el botón.
	 * Todos los roles ven la lista.
	 */
	import { invalidateAll } from '$app/navigation';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Sparkles from '@lucide/svelte/icons/sparkles';

	import AvisoVerde from '$lib/components/config/AvisoVerde.svelte';
	import TipoExpedienteModal from '$lib/components/expedientes/TipoExpedienteModal.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data } = $props();

	const tipos = $derived(data.tipos);

	let abierto = $state(false);
	/** El nombre del último tipo creado, para el aviso verde. Se apaga al abrir otra alta: a partir de ahí hablaría del anterior. */
	let creado = $state<string | null>(null);

	function abrirAlta() {
		creado = null;
		abierto = true;
	}

	function fecha(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
	}
</script>

<svelte:head><title>NexusDoc AI — Expediente</title></svelte:head>

<p class="text-xs text-muted-foreground">Expediente / Tipos de expediente</p>
<div class="mt-2">
	<h1 class="text-2xl font-semibold text-foreground">Tipos de expediente</h1>
	<p class="mt-1.5 max-w-3xl text-sm text-muted-foreground">
		Un tipo de expediente es la plantilla de la que salen tus expedientes, por ejemplo «Expediente médico» o «Expediente de un choque». Cada
		expediente es una instancia de un tipo y guarda los documentos de un caso: de un paciente, de un choque.
	</p>
</div>

<!-- El contenedor con `aria-live` va SIEMPRE montado y la bandera controla el aviso de adentro: una región que se monta junto con
     su texto no se anuncia. Vacío no mide nada; el margen va dentro del `if` por lo mismo. -->
<div role="status" aria-live="polite">
	{#if creado}
		<div class="mt-6">
			<AvisoVerde
				testid="tipo-expediente-creado-aviso"
				titulo="Tipo de expediente creado"
				cuerpo={`«${creado}» quedó registrado en tu organización.`}
			/>
		</div>
	{/if}
</div>

{#if tipos.length === 0}
	<div class="mt-8 flex flex-col items-center gap-6 rounded-2xl border-2 border-border bg-card py-24 text-center" data-testid="tipos-expediente-vacio">
		<Sparkles class="size-10 text-primary" />
		{#if data.puedeCrear}
			<div>
				<p class="text-lg font-medium text-foreground">Crea tu primer tipo de expediente</p>
				<p class="mt-1 max-w-lg text-sm text-muted-foreground">
					Define la clase de expediente con la que trabaja tu organización. Después, cada caso —un paciente, un choque— será un
					expediente de ese tipo, con sus propios documentos.
				</p>
			</div>
			<button
				type="button"
				class="flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted"
				data-testid="crear-primer-tipo-expediente"
				onclick={abrirAlta}
			>
				<span class="mt-0.5 shrink-0 text-primary"><FolderPlus class="size-5" /></span>
				<span class="min-w-0 flex-1">
					<span class="block text-sm font-medium text-foreground">Nuevo tipo de expediente</span>
					<span class="block text-xs text-muted-foreground">Ponle un nombre, por ejemplo «Expediente médico».</span>
				</span>
			</button>
		{:else}
			<div>
				<p class="text-lg font-medium text-foreground">Todavía no hay tipos de expediente</p>
				<p class="mt-1 max-w-lg text-sm text-muted-foreground">Quien administra tu organización puede crear el primero.</p>
			</div>
		{/if}
	</div>
{:else}
	<div class="mt-8 rounded-2xl border-2 border-border bg-card p-5">
		<div class="flex flex-wrap items-center gap-3">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-foreground">Listado de tipos de expediente</p>
				<p class="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="total-tipos-expediente">
					<FolderOpen class="size-3.5" />
					{tipos.length}
					{tipos.length === 1 ? 'tipo de expediente en total' : 'tipos de expediente en total'}
				</p>
			</div>
			{#if data.puedeCrear}
				<Button data-testid="nuevo-tipo-expediente" onclick={abrirAlta}>
					<Plus class="size-4" />
					Nuevo tipo de expediente
				</Button>
			{/if}
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-y border-border text-xs text-muted-foreground">
						<th class="py-2.5 pr-4 pl-2 font-normal">Tipo de expediente</th>
						<th class="py-2.5 pr-4 font-normal">Expedientes</th>
						<th class="py-2.5 pr-2 font-normal">Fecha de creación</th>
					</tr>
				</thead>
				<tbody data-testid="tabla-tipos-expediente">
					{#each tipos as tipo (tipo.id)}
						<tr class="border-b border-border last:border-0">
							<td class="min-w-0 py-3 pr-4 pl-2">
								<p class="truncate font-medium text-foreground" data-testid="tipo-expediente-nombre">{tipo.nombre}</p>
							</td>
							<td class="py-3 pr-4 text-foreground" data-testid="tipo-expediente-total">{tipo.totalExpedientes}</td>
							<td class="py-3 pr-2 text-xs text-muted-foreground">{fecha(tipo.creadoEn)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

<TipoExpedienteModal
	bind:open={abierto}
	alCrear={async (nombre) => {
		// El tipo YA está guardado: el aviso se pone antes de recargar, y si recargar fallara seguiría siendo verdad.
		creado = nombre;
		await invalidateAll();
	}}
/>
