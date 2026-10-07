<script lang="ts">
	/**
	 * Bandera de México para el selector de idioma de las pantallas de acceso.
	 * Las tres franjas solas son idénticas a la de Italia; lo que la distingue
	 * es el escudo al centro. A 16 px no se puede dibujar el águila, así que va
	 * su silueta: el águila café sobre el nopal verde, en la franja blanca.
	 */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 21 14" class={className} aria-hidden="true">
	<rect width="7" height="14" fill="#006847" />
	<rect x="7" width="7" height="14" fill="#ffffff" />
	<rect x="14" width="7" height="14" fill="#ce1126" />
	<!-- escudo: nopal y águila -->
	<path d="M8.6 9.4c.6.7 1.2 1 1.9 1s1.3-.3 1.9-1" fill="none" stroke="#006847" stroke-width=".6" stroke-linecap="round" />
	<ellipse cx="10.5" cy="8.1" rx="1.1" ry=".8" fill="#4a7d2a" />
	<path d="M9.4 7.2c.2-1.4 1-2.4 1.9-2.6.4 0 .7.3.6.7l-.4.3.6.3c-.1.6-.6 1.1-1.3 1.3z" fill="#7a4b1e" />
	<circle cx="11.6" cy="4.9" r=".35" fill="#7a4b1e" />
</svg>
