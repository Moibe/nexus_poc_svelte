<script lang="ts">
	/**
	 * El historial de intentos de un webhook (2026-10-01): cada vez que NexusDoc
	 * le habló a su endpoint —al validarlo y al entregarle avisos—, con la hora,
	 * el número de intento, el código de respuesta, cuánto tardó y el motivo.
	 *
	 * Es lo que pide el aviso rojo de "Entrega del webhook fallida": "revisa el
	 * historial de intentos para consultar los timestamps y códigos de respuesta
	 * registrados". Se abre desde ese aviso y desde el `⋮` de la tarjeta, y se
	 * despliega dentro de ella, igual que las Métricas.
	 *
	 * Del más reciente al más viejo, los últimos 50. Los datos los guarda el
	 * servidor por cada intento (`GET /webhooks/{id}/intentos`).
	 */
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import EmptyState from '$lib/components/home/EmptyState.svelte';
	import ClockBadgeIcon from '$lib/components/icons/ClockBadgeIcon.svelte';
	import { cargarHistorialWebhook, type IntentoWebhook } from '$lib/state/webhooks.svelte';

	let { id, onCerrar }: { id: string; onCerrar: () => void } = $props();

	let intentos = $state<IntentoWebhook[] | null>(null);
	let cargando = $state(false);
	let error = $state('');

	async function cargar() {
		cargando = true;
		error = '';
		try {
			intentos = await cargarHistorialWebhook(id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo traer el historial.';
		} finally {
			cargando = false;
		}
	}

	onMount(cargar);

	const TIPOS: Record<string, string> = {
		'webhook.validacion': 'Validación de conexión',
		'documento.completado': 'Documento completado',
		'documento.fallido': 'Documento fallido',
		'documento.rechazado': 'Documento rechazado'
	};

	/** `01/10/2026 · 21:45:07`, en la hora de quien mira. Con segundos: sirven
	 *  para encontrar el mismo intento en los registros del endpoint. */
	function fechaHora(iso: string): string {
		const f = new Date(iso);
		if (Number.isNaN(f.getTime())) return '—';
		const dos = (n: number) => String(n).padStart(2, '0');
		return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} · ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
	}
</script>

<div class="mt-3 flex flex-col gap-3" data-testid="historial-webhook-panel">
	<div class="rounded-lg border border-border bg-background">
		<div class="flex items-start justify-between gap-4 px-4 py-3">
			<div class="min-w-0">
				<p class="text-sm font-medium text-foreground">Historial de intentos</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Cada vez que NexusDoc le habló a tu endpoint, al validarlo y al entregarle avisos: del más
					reciente al más viejo.
				</p>
			</div>
			<Button variant="outline" size="sm" data-testid="actualizar-historial" disabled={cargando} onclick={cargar}>
				Actualizar
			</Button>
		</div>

		<div class="border-t border-border px-4 py-4">
			{#if cargando && !intentos}
				<p class="text-sm text-muted-foreground" data-testid="historial-cargando">Cargando historial…</p>
			{:else if error}
				<div class="flex items-center justify-between gap-4 text-sm text-destructive" data-testid="historial-error">
					<span>No se pudo traer el historial: {error}</span>
					<Button variant="outline" size="sm" onclick={cargar}>Reintentar</Button>
				</div>
			{:else if intentos && intentos.length === 0}
				<div class="py-4" data-testid="historial-vacio">
					<EmptyState
						icon={ClockBadgeIcon}
						title="Todavía no hay intentos"
						description="Aquí aparecerá cada vez que NexusDoc le hable a tu endpoint: al validarlo y al entregarle avisos."
					/>
				</div>
			{:else if intentos}
				<!-- Tabla con desplazamiento propio: en pantallas angostas no empuja la
				     tarjeta más allá de la ventana. -->
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs" data-testid="historial-tabla">
						<thead class="text-muted-foreground">
							<tr class="border-b border-border">
								<th class="py-2 pr-4 font-medium">Fecha y hora</th>
								<th class="py-2 pr-4 font-medium">Aviso</th>
								<th class="py-2 pr-4 font-medium">Intento</th>
								<th class="py-2 pr-4 font-medium">Respuesta</th>
								<th class="py-2 pr-4 font-medium">Tiempo</th>
								<th class="py-2 font-medium">Detalle</th>
							</tr>
						</thead>
						<tbody>
							{#each intentos as x, i (i)}
								<tr class="border-b border-border last:border-0" data-testid="historial-fila">
									<td class="py-2 pr-4 whitespace-nowrap text-foreground">{fechaHora(x.en)}</td>
									<td class="py-2 pr-4 whitespace-nowrap text-foreground">
										{TIPOS[x.tipo] ?? x.tipo}
										{#if x.entradaId}
											<span class="text-muted-foreground" title={x.entradaId}>· entrada {x.entradaId.slice(0, 8)}…</span>
										{/if}
									</td>
									<td class="py-2 pr-4 text-muted-foreground">{x.n ?? '—'}</td>
									<td class="py-2 pr-4">
										<span
											data-testid="historial-respuesta"
											class="inline-flex rounded-full px-2 py-0.5 font-medium whitespace-nowrap {x.ok
												? 'bg-green-50 text-green-700'
												: 'bg-red-50 text-red-700'}"
										>
											{x.codigo ?? 'Sin respuesta'}
										</span>
									</td>
									<td class="py-2 pr-4 whitespace-nowrap text-muted-foreground">{x.ms === null ? '—' : `${x.ms} ms`}</td>
									<td class="max-w-sm py-2 text-muted-foreground" title={x.motivo ?? ''}>
										<span class="line-clamp-2">{x.motivo ?? (x.ok ? 'Entregado' : '—')}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>

	<div class="flex justify-end">
		<Button data-testid="cerrar-historial" onclick={onCerrar}>Cerrar historial</Button>
	</div>
</div>
