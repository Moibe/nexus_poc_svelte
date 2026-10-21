<script lang="ts">
	/**
	 * "Con sesión" / "Sin sesión", debajo del estatus de quien tiene la cuenta activa.
	 *
	 * Cerrar la sesión de alguien (HU05) NO cambia su estatus —sigue Activo y puede volver a entrar—, así que,
	 * sin esto, la lista se veía igual antes y después y parecía que no había pasado nada. Aquí se ve la
	 * diferencia: «Con sesión» quiere decir que hay un navegador que todavía puede renovar su acceso. A una
	 * cuenta desactivada no se le pinta: ya no puede tener sesión y el estatus lo dice todo.
	 */
	let { activo, sesionActiva, testid }: { activo: boolean; sesionActiva: boolean; testid: string } = $props();
</script>

{#if activo}
	<p class="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground" data-testid={testid}>
		<span class="size-1.5 rounded-full {sesionActiva ? 'bg-green-500' : 'bg-muted-foreground/40'}" aria-hidden="true"></span>
		{sesionActiva ? 'Con sesión' : 'Sin sesión'}
	</p>
{/if}
