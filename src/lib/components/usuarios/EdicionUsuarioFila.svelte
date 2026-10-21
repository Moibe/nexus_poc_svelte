<script lang="ts">
	/**
	 * HU07 · "Actualiza la información del usuario" (Figma: la fila elegida se abre EN LA TABLA, no en un panel).
	 *
	 * Es la tarjeta que va justo debajo de la fila del usuario: nombre, correo y rol en una línea, y debajo, la
	 * descripción del rol elegido. La barra flotante con "Cancelar edición" y "Guardar cambios" la pinta la página
	 * (reemplaza a la de acciones mientras se edita) y llama a `guardar()` de aquí.
	 *
	 * Desviaciones: el correo NO se puede cambiar (es con el que la persona entra; el servidor no lo toca), así que va
	 * apagado con su aviso. El teléfono, que el diseño no pone aquí, se manda tal como estaba para no borrarlo.
	 */
	import { untrack } from 'svelte';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import * as Select from '$lib/components/ui/select/index.js';
	import type { Rol, UsuarioDeOrganizacion } from '$lib/usuarios/tipos';

	let {
		usuario,
		roles,
		estado = $bindable({ completo: false, enviando: false })
	}: {
		usuario: UsuarioDeOrganizacion;
		roles: Rol[];
		/** Lo que la barra flotante necesita saber: si se puede guardar y si ya está guardando. */
		estado?: { completo: boolean; enviando: boolean };
	} = $props();

	// Se llenan una vez, al montarse: la página monta esta tarjeta solo mientras se edita a ESE usuario.
	let nombre = $state(untrack(() => usuario.nombre));
	let rol = $state(untrack(() => usuario.rol ?? ''));
	let error = $state('');
	let enviando = $state(false);

	/** Si el rol actual no es de los que se pueden asignar (el de administrador), se conserva como opción para no perderlo. */
	const opciones = $derived<Rol[]>(
		usuario.rol && !roles.some((r) => r.codigo === usuario.rol)
			? [{ codigo: usuario.rol, nombre: usuario.rolNombre, descripcion: '' }, ...roles]
			: roles
	);
	const elegido = $derived(opciones.find((r) => r.codigo === rol) ?? null);
	const completo = $derived(nombre.trim().length > 0 && rol !== '');

	$effect(() => {
		estado = { completo, enviando };
	});

	/** La llama la barra flotante. Devuelve `true` si se guardó. */
	export async function guardar(): Promise<boolean> {
		if (!completo || enviando) return false;
		enviando = true;
		error = '';
		try {
			const r = await fetch(`/api/usuarios/${usuario.guid}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre: nombre.trim(), apellidos: '', telefono: usuario.telefono, rol })
			});
			if (!r.ok) {
				const datos = await r.json().catch(() => null);
				error = datos?.mensaje ?? 'No se pudo guardar. Intenta de nuevo.';
				return false;
			}
			return true;
		} finally {
			enviando = false;
		}
	}
</script>

<div class="flex gap-3 px-2 py-4" data-testid="edicion-usuario">
	<!-- El conector del diseño: baja desde la fila y entra a la tarjeta. -->
	<span class="ml-4 mt-2 h-8 w-5 shrink-0 rounded-bl-lg border-b border-l border-border" aria-hidden="true"></span>
	<div class="min-w-0 flex-1 rounded-xl border border-border bg-background p-4">
		<p class="text-sm font-medium text-foreground">Actualiza la información del usuario</p>
		<p class="mt-0.5 text-xs text-muted-foreground">
			Realiza cambios en la información y permisos del usuario para mantener una administración segura y centralizada.
		</p>

		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="flex flex-col gap-1.5">
				<label for="usuario-nombre" class="text-sm font-medium text-foreground">
					Nombre del usuario <span class="text-destructive">*</span>
				</label>
				<input
					id="usuario-nombre"
					bind:value={nombre}
					class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="usuario-email" class="text-sm font-medium text-foreground">
					Correo electrónico <span class="text-destructive">*</span>
				</label>
				<input
					id="usuario-email"
					type="email"
					value={usuario.email}
					disabled
					class="h-10 w-full rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground outline-none"
				/>
				<p class="text-xs text-muted-foreground">El correo no se puede cambiar: es con el que inicia sesión.</p>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="usuario-rol" class="text-sm font-medium text-foreground">
					Selecciona un rol <span class="text-destructive">*</span>
				</label>
				<Select.Root type="single" bind:value={rol}>
					<Select.Trigger id="usuario-rol" class="h-10 w-full" data-testid="rol-usuario">
						{elegido?.nombre ?? 'Selecciona un rol'}
					</Select.Trigger>
					<Select.Content>
						{#each opciones as opcion (opcion.codigo)}
							<Select.Item value={opcion.codigo} label={opcion.nombre} data-testid="rol-{opcion.codigo}" />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		{#if elegido?.descripcion}
			<div class="mt-4 rounded-lg border border-border bg-card p-4" data-testid="descripcion-rol">
				<p class="text-sm font-medium text-foreground">{elegido.nombre}</p>
				<p class="mt-0.5 text-xs text-muted-foreground">{elegido.descripcion}</p>
			</div>
		{/if}

		{#if error}
			<p class="mt-3 flex items-start gap-1 text-xs text-destructive" role="alert" data-testid="error-general-usuario">
				<TriangleAlert class="mt-0.5 size-3 shrink-0" />
				{error}
			</p>
		{/if}
	</div>
</div>
