<script lang="ts">
	/**
	 * La cáscara de las pantallas de acceso (Sprint 1): la mitad izquierda con el
	 * logo arriba, el selector de idioma a la derecha, el contenido al centro y
	 * el pie "© 2026 Grupo CSI"; la mitad derecha, la ilustración.
	 *
	 * DESVIACIÓN CONSCIENTE: el diseño lleva a la derecha una fotografía de
	 * carpetas azules (y otra de cristales, en el cambio de contraseña). No
	 * tenemos esos archivos —bajarlos del Figma gasta cuota del conector y no
	 * son nuestros—, así que va un panel con degradado de la marca y unas
	 * carpetas dibujadas. Cuando UX entregue las imágenes, se cambian aquí.
	 *
	 * El selector de idioma es solo visual: la app está en español y no hay
	 * i18n. Se deja porque está en todas las pantallas del flujo.
	 */
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	import logo from '$lib/assets/nexus-logo.png';
	import BanderaMexico from '$lib/components/icons/BanderaMexico.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen bg-background">
	<div class="flex w-full flex-col lg:w-[52%]">
		<header class="flex items-center justify-between px-8 py-6 lg:px-14">
			<a href="/acceso/iniciar-sesion" class="flex items-center" aria-label="NexusDoc AI">
				<img src={logo} alt="NexusDoc AI" class="h-7 w-auto" />
			</a>
			<button
				type="button"
				class="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground"
				aria-label="Idioma: Español"
			>
				<BanderaMexico class="h-3 w-[18px] rounded-[2px] ring-1 ring-black/10" />
				(ES) Español
				<ChevronDown class="size-3.5 text-muted-foreground" />
			</button>
		</header>

		<main class="flex flex-1 items-center px-8 py-6 lg:px-14">
			<div class="mx-auto w-full max-w-[420px]">
				{@render children()}
			</div>
		</main>

		<footer class="px-8 py-6 lg:px-14">
			<p class="text-center text-[11px] text-muted-foreground">© 2026 Grupo CSI. Todos los derechos reservados.</p>
		</footer>
	</div>

	<aside
		class="relative hidden overflow-hidden bg-[#0b1a5e] lg:block lg:w-[48%]"
		aria-hidden="true"
	>
		<div class="absolute inset-0 bg-gradient-to-br from-[#4268fb] via-[#1f44d8] to-[#061140]"></div>
		<!-- Carpetas: la idea de la fotografía del diseño, en formas planas. -->
		{#each [0, 1, 2, 3, 4, 5] as i (i)}
			<div
				class="absolute rounded-t-[28px] border border-white/25 bg-white/10 backdrop-blur-[1px]"
				style="left: {6 + i * 9}%; top: {18 + i * 7}%; width: 78%; height: 120%; transform: skewY(-10deg); opacity: {0.35 + i * 0.1};"
			></div>
		{/each}
		<div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#061140] to-transparent"></div>
	</aside>
</div>
