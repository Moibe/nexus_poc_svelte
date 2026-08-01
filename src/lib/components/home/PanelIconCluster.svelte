<script lang="ts">
	import FileIcon from '$lib/components/icons/FileIcon.svelte';
	import ImageIcon from '$lib/components/icons/ImageIcon.svelte';
	import DocIcon from '$lib/components/icons/DocIcon.svelte';
</script>

<div class="relative h-[50px] w-[84px] shrink-0" aria-hidden="true">
	<div
		class="absolute top-4 left-0 flex size-8 -rotate-[18deg] items-center justify-center rounded-lg border border-border bg-card"
	>
		<FileIcon />
	</div>
	<div
		class="absolute top-0 left-[39px] flex size-8 rotate-30 items-center justify-center rounded-lg border border-border bg-card"
	>
		<ImageIcon />
	</div>
	<div
		class="absolute top-[17px] left-[52px] flex size-8 rotate-2 items-center justify-center rounded-lg border border-border bg-card"
	>
		<DocIcon />
	</div>
</div>
