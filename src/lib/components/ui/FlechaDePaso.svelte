<script lang="ts">
	/**
	 * La flecha » animada que señala el paso al que se llega (2026-11-20, Moibe: «cada que lleguemos a un nuevo paso ponme las flechitas animadas
	 * señalándolo, como las que tengo en buzzword-agentes-ui»; es su `subtab-arrow-indicator`, con el color de marca de aquí): un » en negritas, con brillo,
	 * que se mece 4 px hacia lo que señala cada 1.2 s. Con «reducir movimiento» se queda quieta. La usan el asistente de tipos documentales
	 * (`ModuloConfiguracion`) y el alta de un proceso (`NuevoProceso`).
	 *
	 * `alMargen` (lo normal): se pinta a la IZQUIERDA de su contenedor, que debe ser `relative`, sin empujar nada; sin él va en línea, antes de lo que señala.
	 *
	 * Centrado (Moibe, mismo día: «un poquito más centradas para que se alineen con ese título»): la caja de la flecha mide `alto` (la altura de la línea que
	 * señala) y `desfase` la sube o baja. Medido con las métricas de Plus Jakarta Sans: en una caja de alto L el centro de la tinta del » cae en L/2 + 1.5 px,
	 * y el de las mayúsculas de un texto de 14 px en línea de 20 px, en 9.5 px; de 16 px en línea de 24 px, en 12 px. De ahí los -2 px (14 px) y -1.5 px (16 px).
	 */
	let {
		alMargen = true,
		alto = 20,
		desfase = -2,
		class: clase = ''
	}: { alMargen?: boolean; alto?: number; desfase?: number; class?: string } = $props();
</script>

<span
	class="flecha {alMargen ? 'al-margen' : 'en-linea'} {clase}"
	style="line-height: {alto}px; top: {desfase}px"
	aria-hidden="true"
	data-testid="flecha-de-paso">»</span
>

<style>
	.flecha {
		display: inline-block;
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--primary);
		text-shadow: 0 0 8px color-mix(in oklab, var(--primary) 45%, transparent);
		animation: flecha-de-paso 1.2s ease-in-out infinite;
		pointer-events: none;
		user-select: none;
	}
	.al-margen {
		position: absolute;
		right: 100%;
		margin-right: 0.4rem;
	}
	.en-linea {
		position: relative;
		margin-right: 0.4rem;
	}
	@keyframes flecha-de-paso {
		0%,
		100% {
			transform: translateX(0);
			opacity: 0.85;
		}
		50% {
			transform: translateX(4px);
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.flecha {
			animation: none;
		}
	}
</style>
