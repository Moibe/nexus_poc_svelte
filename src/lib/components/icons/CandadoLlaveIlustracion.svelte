<script lang="ts">
	/**
	 * La ilustración de «Revisa tu correo» (Figma, HU010, «Recuperar contraseña 5»): un candado con una llave en un
	 * círculo azul claro. Está DIBUJADA A MANO a partir de la captura que compartió QA, no exportada: el conector de
	 * Figma estaba sin cuota (2026-10-20). Cuando se pueda bajar el original (node `303:4946`), se reemplaza aquí.
	 */
	let { class: clase = '' }: { class?: string } = $props();
</script>

<svg class={clase} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
	<defs>
		<linearGradient id="cl-fondo" x1="80" y1="0" x2="80" y2="160" gradientUnits="userSpaceOnUse">
			<stop stop-color="#d6e3fc" />
			<stop offset="1" stop-color="#eaf0fd" />
		</linearGradient>
		<linearGradient id="cl-cuerpo" x1="87" y1="62" x2="87" y2="124" gradientUnits="userSpaceOnUse">
			<stop stop-color="#ffffff" />
			<stop offset="1" stop-color="#e3ebfb" />
		</linearGradient>
		<linearGradient id="cl-hueco" x1="96" y1="90" x2="96" y2="112" gradientUnits="userSpaceOnUse">
			<stop stop-color="#1b3fb8" />
			<stop offset="1" stop-color="#2563eb" />
		</linearGradient>
	</defs>
	<circle cx="80" cy="80" r="78" fill="url(#cl-fondo)" />
	<!-- argolla -->
	<path d="M63 66V47a17 17 0 0 1 34 0v19" stroke="#c0d3f7" stroke-width="9" />
	<!-- cuerpo del candado -->
	<rect x="46" y="62" width="11" height="62" fill="#b6cbf3" />
	<rect x="57" y="62" width="59" height="62" fill="url(#cl-cuerpo)" />
	<!-- los cinco cuadritos de abajo -->
	<rect x="46" y="129" width="10" height="9" rx="1" fill="#d3e0f9" />
	<rect x="60" y="129" width="10" height="9" rx="1" fill="#8fb0ef" />
	<rect x="74" y="129" width="10" height="9" rx="1" fill="#8fb0ef" />
	<rect x="88" y="129" width="10" height="9" rx="1" fill="#8fb0ef" />
	<rect x="102" y="129" width="10" height="9" rx="1" fill="#8fb0ef" />
	<!-- ojo de la cerradura -->
	<circle cx="96" cy="84" r="6" fill="#12307a" />
	<path d="M92 89h8l3.5 23h-15z" fill="url(#cl-hueco)" />
	<!-- llave -->
	<circle cx="29" cy="74" r="11" stroke="#1f56d8" stroke-width="4.5" />
	<path d="M40 78.5 93 94" stroke="#1f56d8" stroke-width="4.5" stroke-linecap="square" />
	<path d="M70 87.5l2.5 11M80 90.5l2.5 11M89 93l2 10" stroke="#1f56d8" stroke-width="4" stroke-linecap="square" />
</svg>
