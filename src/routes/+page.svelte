<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ConfigSheet from '$lib/components/config/ConfigSheet.svelte';
	import CloudUpload from '@lucide/svelte/icons/cloud-upload';
	import Clock from '@lucide/svelte/icons/clock';
	import Settings from '@lucide/svelte/icons/settings';

	let configOpen = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let files = $state<FileList | null>(null);
</script>

<svelte:head><title>NexusDoc AI — Inicio</title></svelte:head>

<p class="text-sm text-muted-foreground">NexusDoc AI / Inicio</p>

<div class="mt-2 flex items-start justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold text-foreground">
			Bienvenido al centro operativo de NexusDoc AI
		</h1>
		<p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
			Administra los conectores de integración utilizados para el procesamiento inteligente de tus
			documentos.
		</p>
	</div>
</div>

<Card.Root class="mt-8">
	<Card.Header class="flex items-center justify-between">
		<div>
			<Card.Title>Carga documental</Card.Title>
			<Card.Description>Iniciar la ingesta y procesamiento de documentos</Card.Description>
		</div>
		<Button variant="outline" size="icon" onclick={() => (configOpen = true)}>
			<Settings />
			<span class="sr-only">Configurar tipos documentales</span>
		</Button>
	</Card.Header>
	<Card.Content>
		<div
			class="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/40 px-6 py-12 text-center"
		>
			<span class="flex size-11 items-center justify-center rounded-full border border-border bg-background">
				<CloudUpload class="size-5 text-muted-foreground" />
			</span>
			<p class="font-medium text-foreground">
				Arrastra y suelta tus documentos aquí o selecciona archivos desde tu equipo
			</p>
			<p class="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPG, JPEG, TIFF | Max 20 MB</p>
			<input
				bind:this={fileInput}
				bind:files
				type="file"
				multiple
				class="hidden"
				accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.tiff"
			/>
			<Button variant="outline" size="sm" onclick={() => fileInput?.click()}>Buscar archivos</Button>
			{#if files && files.length > 0}
				<p class="text-xs text-muted-foreground">{files.length} archivo(s) seleccionado(s)</p>
			{/if}
		</div>
	</Card.Content>
</Card.Root>

<div class="mt-8 flex flex-col items-center gap-3 py-10 text-center">
	<span class="flex size-11 items-center justify-center rounded-full border border-border bg-card">
		<Clock class="size-5 text-muted-foreground" />
	</span>
	<p class="font-medium text-foreground">Tu área de carga está lista</p>
	<p class="max-w-md text-sm text-muted-foreground">
		Agrega documentos para iniciar el procesamiento, la validación inteligente dentro de NexusDoc.
	</p>
</div>

<ConfigSheet bind:open={configOpen} />
