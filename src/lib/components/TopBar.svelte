<script lang="ts">
	import { page } from '$app/state';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Users from '@lucide/svelte/icons/users';

	const navItems = [
		{ href: '/', label: 'Inicio', icon: LayoutGrid },
		{ href: '/usuarios', label: 'Usuarios', icon: Users }
	];
</script>

<header class="sticky top-0 z-40 border-b border-border bg-white">
	<div class="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
		<a href="/" class="flex items-center gap-2.5">
			<span class="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
				<LayoutGrid class="size-4" />
			</span>
			<span class="text-base font-semibold text-foreground">NexusDoc AI</span>
		</a>

		<nav class="flex items-center gap-1">
			{#each navItems as item (item.href)}
				{@const active = item.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(item.href)}
				<a
					href={item.href}
					class={[
						'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
						active
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'
					]}
				>
					<item.icon class="size-4" />
					{item.label}
				</a>
			{/each}
		</nav>
	</div>
</header>
