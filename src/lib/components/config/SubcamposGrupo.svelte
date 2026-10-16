<script lang="ts">
	/**
	 * Los campos de un GRUPO (2026-10-16, pedido para las actas constitutivas): un dato que no es un valor suelto sino una fila de
	 * varios —un accionista = nombre + acciones + monto—. No está en el Figma: se hizo con los mismos componentes y la misma
	 * medida que el formulario de campos del paso 2, y está anotado en `docs/pendientes-ux.md`.
	 *
	 * Edita DIRECTO el `campo` que recibe (es estado reactivo del asistente): agregar, quitar y teclear cambian `campo.subcampos`.
	 * Con `soloLectura` solo los muestra, como fichas: así se ven en el paso 3 y en una alta nueva, donde los campos ya agregados
	 * no se editan (para cambiar algo se quita el campo y se vuelve a agregar, igual que con cualquier otro).
	 *
	 * Lo que falta para poder guardar el grupo lo dice `problemaDelGrupo` (el mismo que usa `campoCompleto`), en una línea bajo
	 * las filas: sin él, «Guardar» estaría apagado sin explicación.
	 */
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import Minus from '@lucide/svelte/icons/minus';
	import AlertCircle from '@lucide/svelte/icons/circle-alert';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		TIPOS_DE_SUBCAMPO,
		agregarSubcampo,
		problemaDelGrupo,
		quitarSubcampo,
		subcampoDuplicado,
		type CampoBorrador
	} from '$lib/state/configuracion.svelte';

	let { campo, soloLectura = false }: { campo: CampoBorrador; soloLectura?: boolean } = $props();

	const etiquetaTipo = (valor: string) => TIPOS_DE_SUBCAMPO.find((t) => t.value === valor)?.label;
	const problema = $derived(problemaDelGrupo(campo));
</script>

<div class="mt-6 rounded-xl border border-border bg-muted/30 p-4" data-testid="subcampos-grupo">
	<p class="text-sm font-medium text-foreground">Campos del grupo</p>
	<p class="mt-1 text-xs text-muted-foreground">
		Cada fila del documento (un accionista, un cargo…) trae estos campos juntos.
		{#if campo.cardinalidad === 'multiple'}
			Como el grupo se repite, el documento puede traer varias filas.
		{:else}
			El grupo aparece una sola vez en el documento.
		{/if}
	</p>

	{#if soloLectura}
		{#if campo.subcampos.length === 0}
			<p class="mt-3 text-xs text-muted-foreground">Este grupo no tiene campos.</p>
		{:else}
			<ul class="mt-3 flex flex-wrap gap-2">
				{#each campo.subcampos as sub (sub.id)}
					<li
						data-testid="subcampo-ficha"
						class="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
					>
						<span class="font-medium">{sub.nombre}</span>
						<span class="text-muted-foreground">
							· {etiquetaTipo(sub.tipoDato) ?? sub.tipoDato} · {sub.obligatorio ? 'obligatorio' : 'opcional'}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<div class="mt-4 flex flex-col gap-3">
			{#each campo.subcampos as sub, i (sub.id)}
				{@const repetido = subcampoDuplicado(sub.nombre, campo.subcampos, sub.id)}
				<div
					data-testid="subcampo"
					class="grid items-start gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.5fr)_auto_auto]"
				>
					<div class="space-y-1">
						<div class="relative">
							<Input
								bind:value={sub.nombre}
								placeholder="Nombre del campo"
								aria-label={`Nombre del campo ${i + 1} del grupo`}
								aria-invalid={repetido}
								data-testid="subcampo-nombre"
								class={repetido ? 'pr-9' : undefined}
							/>
							{#if repetido}
								<AlertCircle
									class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-destructive"
								/>
							{/if}
						</div>
						{#if repetido}
							<p class="text-xs text-destructive">Ya hay un campo con este nombre en el grupo.</p>
						{/if}
					</div>

					<Select.Root type="single" value={sub.tipoDato} onValueChange={(v) => (sub.tipoDato = v)}>
						<Select.Trigger
							class="w-full"
							aria-label={`Tipo del campo ${i + 1} del grupo`}
							data-testid="subcampo-tipo"
						>
							{etiquetaTipo(sub.tipoDato) ?? 'Tipo de dato'}
						</Select.Trigger>
						<Select.Content>
							{#each TIPOS_DE_SUBCAMPO as tipo (tipo.value)}
								<Select.Item value={tipo.value} label={tipo.label} />
							{/each}
						</Select.Content>
					</Select.Root>

					<Input
						bind:value={sub.descripcion}
						placeholder="Descripción (opcional)"
						aria-label={`Descripción del campo ${i + 1} del grupo`}
						data-testid="subcampo-descripcion"
					/>

					<label class="flex h-8 items-center gap-2 text-xs text-muted-foreground">
						<Checkbox
							checked={sub.obligatorio}
							onCheckedChange={(v) => (sub.obligatorio = v === true)}
							aria-label={`El campo ${i + 1} del grupo es obligatorio`}
							data-testid="subcampo-obligatorio"
						/>
						Obligatorio
					</label>

					<button
						type="button"
						aria-label={`Quitar el campo ${i + 1} del grupo`}
						data-testid="subcampo-quitar"
						class="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100"
						onclick={() => quitarSubcampo(campo, sub.id)}
					>
						<Minus class="size-4" />
					</button>
				</div>
			{/each}
		</div>

		<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
			<p class="text-xs text-muted-foreground" data-testid="problema-grupo">{problema ?? ''}</p>
			<Button
				variant="link"
				class="h-auto gap-1.5 p-0 text-primary"
				data-testid="agregar-subcampo"
				onclick={() => agregarSubcampo(campo)}
			>
				<CirclePlus class="size-4" />
				Agregar campo al grupo
			</Button>
		</div>
	{/if}
</div>
