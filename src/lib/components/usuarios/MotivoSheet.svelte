<script lang="ts">
	/**
	 * "Registro de motivo" (Figma `561:26129` y `555:27537`): el mismo panel
	 * para desactivar a alguien (HU08) y para cerrarle la sesión (HU05). Solo
	 * cambian el encabezado, la etiqueta del campo y el botón.
	 *
	 * El motivo es obligatorio: es lo que deja auditable por qué se le quitó el
	 * acceso a una persona. El servidor lo vuelve a exigir.
	 *
	 * Al terminar, la confirmación del diseño ("La cuenta fue desactivada" /
	 * "Sesión finalizada") se muestra en este mismo panel.
	 */
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import LogOut from '@lucide/svelte/icons/log-out';
	import UserRoundX from '@lucide/svelte/icons/user-round-x';

	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import type { UsuarioDeOrganizacion } from '$lib/usuarios/tipos';

	let {
		open = $bindable(false),
		accion,
		usuario,
		alTerminar
	}: {
		open?: boolean;
		accion: 'desactivar' | 'cerrar-sesion';
		usuario: UsuarioDeOrganizacion | null;
		alTerminar: () => Promise<void> | void;
	} = $props();

	const TEXTOS = {
		desactivar: {
			titulo: 'Agrega un motivo por desactivación',
			etiqueta: 'Motivo de desactivación',
			boton: 'Desactivar usuario',
			hechoTitulo: 'La cuenta fue desactivada',
			hechoCuerpo:
				'Las sesiones activas fueron cerradas y el acceso a la plataforma ha sido restringido. Las tareas asignadas al usuario serán retomados por proceso HITL.'
		},
		'cerrar-sesion': {
			titulo: 'Agrega un motivo por cierre de sesión',
			etiqueta: 'Motivo de cierre de sesión',
			boton: 'Cerrar sesión',
			hechoTitulo: 'Sesión finalizada',
			hechoCuerpo: 'El usuario deberá iniciar sesión nuevamente para acceder a la plataforma.'
		}
	} as const;

	let motivo = $state('');
	let enviando = $state(false);
	let error = $state('');
	let hecho = $state(false);

	const textos = $derived(TEXTOS[accion]);

	$effect(() => {
		if (!open) return;
		motivo = '';
		error = '';
		hecho = false;
	});

	async function confirmar() {
		if (!motivo.trim() || enviando || !usuario) return;
		enviando = true;
		error = '';
		try {
			const ruta =
				accion === 'desactivar'
					? `/api/usuarios/${usuario.guid}/estado`
					: `/api/usuarios/${usuario.guid}/cerrar-sesion`;
			const cuerpo = accion === 'desactivar' ? { activo: false, motivo: motivo.trim() } : { motivo: motivo.trim() };
			const r = await fetch(ruta, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(cuerpo)
			});
			const datos = await r.json().catch(() => null);
			if (!r.ok) {
				error = datos?.mensaje ?? 'No se pudo completar la acción. Intenta de nuevo.';
				return;
			}
			hecho = true;
			await alTerminar();
		} finally {
			enviando = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		showCloseButton={false}
		data-testid="modal-motivo"
		class="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:lg:w-[40%] data-[side=right]:xl:w-[34%]"
	>
		<div class="flex items-center gap-3 border-b-2 border-muted px-6 py-4">
			<Sheet.Title class="flex-1 text-sm font-normal text-muted-foreground">Registro de motivo</Sheet.Title>
			<button
				type="button"
				class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
				data-testid="cerrar-motivo"
				onclick={() => (open = false)}
			>
				<CancelSquareIcon />
				<span class="sr-only">Cerrar</span>
			</button>
		</div>

		{#if hecho}
			<div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 py-10 text-center">
				<span class="flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
					{#if accion === 'desactivar'}<TriangleAlert class="size-7" />{:else}<LogOut class="size-7" />{/if}
				</span>
				<p class="text-xl font-semibold text-foreground" data-testid="motivo-hecho">{textos.hechoTitulo}</p>
				<p class="max-w-sm text-sm text-muted-foreground">{textos.hechoCuerpo}</p>
			</div>
			<div class="flex items-center justify-end border-t border-border px-6 py-4">
				<Button data-testid="listo-motivo" onclick={() => (open = false)}>Listo</Button>
			</div>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
				<div class="flex items-center gap-3">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
						{#if accion === 'desactivar'}<UserRoundX class="size-5" />{:else}<ShieldAlert class="size-5" />{/if}
					</span>
					<div>
						<h2 class="text-lg font-medium text-foreground">{textos.titulo}</h2>
						<p class="text-sm text-muted-foreground">Completa la información requerida.</p>
					</div>
				</div>

				{#if usuario}
					<p class="text-sm text-muted-foreground">
						Usuario: <span class="font-medium text-foreground">{usuario.nombre}</span>
						<span class="text-muted-foreground">({usuario.email})</span>
					</p>
				{/if}

				<div class="flex flex-col gap-1.5">
					<label for="motivo" class="text-sm font-medium text-foreground">
						{textos.etiqueta} <span class="text-destructive">*</span>
					</label>
					<textarea
						id="motivo"
						rows="4"
						bind:value={motivo}
						placeholder="Describe el motivo"
						class="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					></textarea>
				</div>

				{#if error}
					<p class="text-xs text-destructive" data-testid="error-motivo">{error}</p>
				{/if}
			</div>

			<div class="flex items-center justify-end gap-4 border-t border-border px-6 py-4">
				<Button
					variant="link"
					class="h-auto p-0 text-destructive"
					data-testid="cancelar-motivo"
					onclick={() => (open = false)}
				>
					Cancelar registro
				</Button>
				<Button data-testid="confirmar-motivo" disabled={!motivo.trim() || enviando} onclick={confirmar}>
					{enviando ? 'Procesando…' : textos.boton}
				</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
