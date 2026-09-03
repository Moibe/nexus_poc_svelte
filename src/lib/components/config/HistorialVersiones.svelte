<script lang="ts">
	import CancelSquareIcon from '$lib/components/icons/CancelSquareIcon.svelte';
	import SetupIcon from '$lib/components/icons/SetupIcon.svelte';
	import FolderClock from '@lucide/svelte/icons/folder-clock';
	import {
		etiquetaVersion,
		etiquetaVertical,
		type TipoDocumentalGuardado
	} from '$lib/state/configuracion.svelte';
	import { formatearFecha } from '$lib/state/bandeja.svelte';

	let {
		tipo,
		onCerrar
	}: {
		tipo: TipoDocumentalGuardado;
		onCerrar: () => void;
	} = $props();
</script>

<!--
	Frame de Figma `1077:66342` ("Historial de versiones"). Primera versión
	(2026-09-03) lo abría como diálogo flotante; se pidió el MISMO contenido
	pero EN LÍNEA, bajo la tarjeta del tipo documental, sin overlay que tape
	el resto de la Biblioteca — el cambio es solo de contenedor. Las tarjetas
	de versión usan borde punteado por el mismo motivo que las tenía el
	primer intento de esta función (ver "Retirado por decisión explícita" en
	pendientes-ux.md): son de solo lectura, sin botones ni menú.
	Réplica fiel salvo el subtítulo de cada versión: el frame dice
	"{vertical} | Precisión 0%" — la precisión no existe como dato real (mismo
	desajuste ya aceptado para la tarjeta vigente, documentado en
	pendientes-ux.md), así que aquí también se cambia por "{N campos} · {vertical}".
-->
<div
	data-testid="historial-versiones"
	class="mt-3 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm"
>
	<div class="flex items-center gap-3 border-b border-border px-6 py-4">
		<h3 class="flex-1 text-sm font-normal text-muted-foreground">Historial de versiones</h3>
		<button
			type="button"
			aria-label="Ocultar historial de versiones"
			class="flex size-6 shrink-0 items-center justify-center text-[#475569] transition-colors hover:text-foreground"
			onclick={onCerrar}
		>
			<CancelSquareIcon />
		</button>
	</div>

	<div class="p-6">
		<div class="flex items-center gap-3">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
			>
				<FolderClock class="size-5" />
			</span>
			<div class="min-w-0">
				<h2 class="text-lg font-medium text-foreground">Modelos documentales</h2>
				<p class="text-sm text-muted-foreground">
					Accede al historial de modelos documentales para revisar versiones anteriores,
					conocer su estado y mantener la trazabilidad de cada configuración.
				</p>
			</div>
		</div>

		<div class="mt-6 flex flex-col gap-3">
			{#each tipo.historialVersiones as version (version.version)}
				<div
					class="flex items-center gap-4 rounded-xl border border-dashed border-border bg-background px-4 py-3"
				>
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
					>
						<SetupIcon class="size-4" />
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-medium text-foreground">
							{tipo.nombre}
						</span>
						<span class="mt-1 block truncate text-xs text-muted-foreground">
							{version.campos.length === 0
								? 'Sin campos configurados'
								: `${version.campos.length} ${version.campos.length === 1 ? 'campo' : 'campos'}`}
							{#if etiquetaVertical(tipo.vertical)}
								· {etiquetaVertical(tipo.vertical)}
							{/if}
							· v{etiquetaVersion(version.version)} · Publicada el {formatearFecha(
								new Date(version.publicadoEn)
							)}
						</span>
					</span>
					<span
						class="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
					>
						<span class="size-1.5 rounded-full bg-muted-foreground"></span>
						Inactivo
					</span>
				</div>
			{/each}
		</div>
	</div>
</div>
