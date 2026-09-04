# Pendientes y desviaciones respecto a Figma

Inventario de todo lo que **no** corresponde uno a uno con el archivo de Figma
(`NexusDoc | 1er MVP | web.2026_v0.0.1`), con el motivo de cada caso.

Sirve para dos cosas: que la revisión del UX sepa qué mirar y qué ignorar, y que
nadie "arregle" más adelante una decisión que se tomó a propósito.

Última actualización: **2026-09-04** (un tipo documental puede tener VARIAS instancias de documento de ejemplo, cada una con sus propios recortes por campo).

---

## 1. Retirado por no estar en el diseño

Cosas que se construyeron, funcionaban, y se quitaron para que la revisión del UX
vea la pantalla limpia. Todas son recuperables: el código de soporte sigue ahí.

| Qué | Dónde | Cuándo | Cómo devolverlo |
|---|---|---|---|
| Sección **"Campos extraídos"** — cada campo extraído con su valor y confianza individual | Modal "Detalle de documento" | 2026-08-25 | `camposDe()` sigue intacto en `$lib/types/ine`. Recuperar el bloque del historial y volver a importarlo con su `$derived`. Hay una nota en el propio componente. |
| ~~Botón de **eliminar** un tipo documental~~ | Biblioteca del Módulo de configuración | 2026-08-26 | **RECONSTRUIDO el 2026-09-02**, a pedido explícito — ver la sección 2b de abajo. |
| **×** para quitar una tarjeta de campo | Paso 2 del wizard | 2026-08-26 | Ya no aplica: al rehacer el paso 2 conforme al frame real, el diseño trae su propio botón de quitar en "Campos agregados". |

## 1b. Retirado por decisión explícita, no por diseño

A diferencia de la tabla de arriba, esto no se quitó por fidelidad al frame: se
construyó completo, funcionaba, y se retiró el **mismo día** (2026-09-01) a
pedido directo del usuario.

| Qué | Dónde | Por qué se retiró | Cómo devolverlo |
|---|---|---|---|
| Bloqueo de edición de un modelo **activo** (candado + "Crear nueva versión") | Wizard del Módulo de configuración | Se probó una versión que abría el wizard en solo lectura, con un candado explicando por qué y un botón invitando a crear una versión nueva. El usuario pidió lo contrario: que picar la tarjeta de un modelo activo **no haga nada**, sin explicación ni invitación — "estoy seguro que en el futuro agregaré edición", pero no todavía. | `crearNuevaVersion()` sigue en `$lib/state/configuracion.svelte`, sin usar, documentada. El guardia que hace el no-op vive en `abrirTipoDocumental()` de `ConfigSheet.svelte` (compara `tipo.estado === 'activo'` y sale). Para recuperar la UI: `git show d35287b` tiene el diseño completo (candado ámbar, wizard de solo lectura en los tres pasos, relabel "Publicar cambios"), revertido en el commit siguiente. |

En el frame `1077:65410` ese lugar lo ocupan un botón de 82×38 y un ícono de menú
de 24×24. Ese botón pertenece a **HU038** ("Activar versión de Configuration
Table para producción"), que todavía no se construye, así que sigue sin saberse
si su menú incluye "eliminar" o no — es una pregunta distinta de la de abajo, que
ya quedó resuelta para el menú que SÍ existe.

## 2b. Agregado por decisión explícita, no por diseño

Mismo espíritu que la sección 1b, pero al revés: esto no viene de ningún frame,
se agregó porque se pidió.

| Qué | Dónde | Cuándo | Detalle |
|---|---|---|---|
| Pantalla **"Calibración de campos extraídos"**, detrás de "Ejemplo documental" | Nueva `vista === 'calibracion'` del módulo | 2026-09-02 | "Ejemplo documental" dejó de ser un interruptor (`DropdownMenu.SwitchItem`) con efecto propio y pasó a ser una `DropdownMenu.Item` que navega aquí (`abrirCalibracion`). El interruptor que se sigue viendo en el menú es puramente decorativo: refleja `tipo.ejemploDocumental` pero ya no se toca desde ahí. **Sin frame de Figma** — se construyó leyendo una captura compartida, así que el detalle fino (tipografía, espaciado exacto) queda pendiente de una pasada si aparece el link. Alcance de ESA iteración, a petición explícita: el árbol izquierdo ("Lista de campos documentales") se puebla con los campos REALES del tipo documental (nombre + hijos); el lado derecho ("Configurar ejemplos de extracción") era una réplica ESTÁTICA de la captura, con "Cargar ejemplo documental" deshabilitado — **eso cambió el mismo día, ver la fila del modal de recorte abajo.** "Guardar configuración" SIGUE deshabilitado, sin nada real detrás todavía. `alternarEjemploDocumental()` sigue en el módulo de estado, sin usar (`crearNuevaVersion()`, en cambio, DEJÓ de estarlo — ver la fila de "Crear nueva versión" abajo). |
| Renglón **"Editar"**, arriba de "Crear nueva versión" | Menú `⋮` de la tarjeta | 2026-09-02 | Habilitado SOLO mientras el tipo documental sigue en borrador (nunca se activó, no existe su Custom Extractor). Hace lo mismo que picarle a la tarjeta: llama a `abrirTipoDocumental(tipo.id)`. En cuanto el modelo pasa a activo se deshabilita — a propósito, para no abrir una puerta trasera al mismo problema que resolvió el no-op de la sección 1b: editar un modelo activo puede divergir de Document AI en silencio. Cuando está deshabilitado, un tooltip (`$lib/components/ui/tooltip`, agregado con la CLI de shadcn-svelte) explica por qué al pasar el mouse — a diferencia del no-op de picarle a la tarjeta activa, aquí SÍ se pidió explicación explícita. |
| Renglón **"Crear nueva versión"**, habilitado | Menú `⋮` de la tarjeta | 2026-09-02 | El REVERSO exacto de "Editar": habilitado SOLO cuando el tipo ya está activo. Llama a `iniciarNuevaVersion`, que reactiva `crearNuevaVersion()` —construida el 2026-09-01, sin usar hasta ahora— para regresar el tipo a borrador (conservando campos y `procesadorId` VIEJO) y reabrir el wizard. El procesador nuevo no nace aquí: nace al publicar desde la tarjeta ("Activar", que en este caso republica). El back (`activar_tipo_documental`) recibe ahora `version` (la ya publicada) y crea SIEMPRE un Custom Extractor propio para la siguiente — nunca adopta el de la versión anterior, que se queda viva en Document AI sin tocarse (ni se deshabilita ni se borra, a petición explícita). Verificado end-to-end contra GCP real (`probar-nueva-version.py`) y en navegador (`probar-nueva-version-ui.mjs`): dos publicaciones del mismo tipo crean procesadores distintos, un doble clic de la MISMA publicación no duplica. |
| **"Campos agregados" editables** en modo edición | Paso 2 del wizard | 2026-09-02 | Desde que existe el paso 2 (frame `1067:62363`), un campo ya agregado se veía como `Input readonly` — "la edición no existe en el diseño; para cambiar algo se quita y se vuelve a agregar" (comentario original). Eso se queda IGUAL para una alta nueva (`altaEnCurso === true`). Pero al reabrir un tipo YA guardado —"Editar" o "Crear nueva versión", ambos ponen `altaEnCurso = false`— el nombre pasa a un `Input` real (`bind:value`) y el tipo de dato a un `Select` real, con la misma detección de nombre duplicado que ya tenía el formulario de captura de arriba (contra los demás campos, no contra sí mismo). El mensaje de "¿Quitar este campo?" también se ajustó: ya no dice "no se pueden editar" cuando sí se puede. |
| ~~Modal **"Cargar ejemplo documental"** (subir + recortar, un archivo por campo)~~ | `CargarEjemploDocumental.svelte`, detrás del botón del mismo nombre en "Calibración" | 2026-09-02, **partido en dos el 2026-09-04** | **Sin frame de Figma** — construido desde una captura compartida. Sube UN archivo (PDF o imagen; se agregó `pdfjs-dist` para renderizar la página 1 de un PDF en un `<canvas>`, importado DINÁMICO para no cargarlo cuando nadie sube un PDF) y permite dibujar/mover/redimensionar un rectángulo de recorte sobre el documento — todo en coordenadas porcentuales del contenedor, para que sobreviva al zoom. Al soltar el recorte todavía no dispara OCR ni ningún menú propio —eso queda para la siguiente conversación—, pero **desde el mismo día SÍ se puede guardar**: un botón "Guardar" aparece junto a "Cancelar" mientras el modo recorte está activo (deshabilitado hasta que hay un rectángulo real dibujado), y persiste las 4 coordenadas en `tipo.recortesEjemplo`, indexado por **nombre** del campo — a propósito NO por `campo.id`, que `leerCampo()` regenera en cada lectura de la Biblioteca (para que dos pestañas escribiendo no choquen); guardar por id dejaba el recorte huérfano en cuanto la página se recargaba una sola vez, medido con una prueba que recarga entre guardar dos campos distintos. El nombre ya es único dentro de un tipo documental (`nombreCampoDuplicado` lo exige), así que sirve de llave estable sin inventar nada nuevo — el único costo es que renombrar un campo (modo edición) huerfana su recorte, un caso mucho más raro que "alguien refrescó la página". Guardar CIERRA el modal (cambio pedido el 2026-09-03) y regresa a la lista de "Calibración" de la que salió — es la confirmación, no hay un toast aparte (mismo criterio que "Guardar configuración" del wizard). Cerrar el modal (la X) limpia todo; reabrirlo siempre arranca en el dropzone, nunca con el archivo de la vez anterior. Verificado en navegador contra el build de PRODUCCIÓN además del dev server, por la fragilidad conocida del worker de pdfjs-dist entre bundlers. **Este componente ya no existe** — ver la fila "Documento de ejemplo compartido" más abajo, que lo reemplaza por completo.

**"Guardar" ahora muestra su resultado (2026-09-03, mismo día, ronda aparte):** ya NO persiste solo las 4 coordenadas — recorta los píxeles REALES dentro del rectángulo (de un `<canvas>` para PDF, de un `<img>` para imagen; ambos ya cargados para cuando existe un recorte que guardar, así que el corte es síncrono, sin esperar nada) y los exporta como PNG en base64 (`EjemploGuardado.imagenDataUrl`) junto con metadata del archivo (`nombre`, `tipo`, `tamanoBytes`, vía el helper `formatearTamano` ya existente en `bandeja.svelte.ts`). A propósito NO se muestra ningún texto extraído ni "detectado por OCR": en este punto nunca corrió ningún OCR sobre el documento, así que un texto ahí sería inventar un resultado que no existe — la imagen sí es honesta, es solo prueba visual de qué se seleccionó. En Calibración, un campo con ejemplo guardado muestra una tarjeta de archivo (mismo lenguaje visual que `DocumentoRow.svelte`: icono + nombre + "tipo · tamaño" + botón de quitar) y la imagen del recorte debajo; "Cargar ejemplo documental" se deshabilita mientras tanto — para reemplazarlo hay que quitarlo primero con la X de la tarjeta (sin confirmación: rehacer un recorte cuesta segundos). Esto **resuelve** el pendiente de arriba sobre reabrir con un recorte ya guardado: ese caso ya no es alcanzable desde la UI. El archivo ORIGINAL no se conserva completo — sería demasiado para localStorage y no hace falta, basta con el recorte ya hecho. **Migración**: un `recortesEjemplo` con la forma vieja (`{x,y,w,h}` suelto, de antes de este cambio) ya no valida y se descarta en silencio al leer la Biblioteca — no hay forma de reconstruir la imagen que falta a partir de solo 4 coordenadas, y no hay datos de producción en juego todavía. **Incidente real el mismo día**: la primera versión fijó `pdfjs-dist@6`, que exige Node ≥22 — el server de CSI corre Node 20.19.5, así que `npm ci` murió ahí con `EBADENGINE` y el despliegue nunca reinició PM2. El webhook respondió 200 igual (solo confirma que el script arrancó, no que terminó bien), así que el front se quedó sirviendo el build viejo en silencio durante varios minutos hasta que se diagnosticó vía el log de `webhook-central` en el servidor. Se fijó `pdfjs-dist@4.10.38` (exige Node ≥20 nada más) — de paso esa versión tampoco carga la CVE de ejecución de JS arbitraria de `pdfjs-dist@5.6.83–6.2.107` (GHSA-hq66-cqwq-w95j), relevante porque este modal renderiza justo el tipo de archivo que esa CVE explota. Lección para la próxima dependencia nueva: verificar el HASH del bundle servido después de desplegar, no solo que el hook respondió 200. **La metadata del archivo (nombre/tipo/tamaño) que aquí vivía por CAMPO se movió a nivel de TIPO documental el 2026-09-04** — ver la fila siguiente. |
| **Documento de ejemplo compartido por todos los campos** (cambio grande) | `CargarDocumentoEjemplo.svelte` (sube) + `RecortarEjemploCampo.svelte` (recorta), reemplazan a `CargarEjemploDocumental.svelte` | 2026-09-04, a pedido explícito | Antes cada campo subía su PROPIO archivo para recortar sobre él — si un mismo documento probaba tres campos, había que subirlo tres veces. Ahora el botón **"Cargar ejemplo documental" se movió arriba de la lista de campos** (uno solo por tipo documental) y sube el documento UNA vez a `tipo.documentoEjemplo` (`DocumentoEjemploCompartido`: nombre/tipo/tamaño + `dataUrl`, el documento ya renderizado como raster — PNG del `<canvas>` si era PDF, el archivo tal cual si ya era imagen). Cada campo, debajo, tiene su propio botón **"Recortar"** (ya no dice "Cargar ejemplo documental" — ya no carga nada) que abre `RecortarEjemploCampo` directo sobre ese mismo documento, sin dropzone ni PDF de por medio: siempre es un `<img>`. El resultado por campo (`EjemploGuardado`) perdió su `documento` propio — esa metadata ahora vive una sola vez, arriba. **Ambos niveles se deshabilitan igual que antes** mientras ya haya algo que quitar primero: el botón de arriba con `documentoEjemplo` puesto, el de cada campo con su `ejemplo` ya guardado — en los dos casos con un botón rojo de basura al lado (réplica del Figma compartido) además del círculo rojo "−" de la tarjeta de archivo. **Quitar el documento compartido es DESTRUCTIVO en cascada** (`borrarDocumentoEjemploCompartido`): vacía también TODOS los recortes por campo, porque un recorte solo guarda sus 4 coordenadas y la imagen ya cortada, no una referencia a su documento de origen — sin ese documento esas coordenadas no significan nada recuperable. Quitar el recorte de UN campo (`borrarRecorteEjemplo`) no toca el documento ni los demás campos. Sin confirmación en ningún caso, mismo criterio que siempre: rehacer esto cuesta segundos. **Migración**: la forma vieja de `EjemploGuardado` (con `documento` propio, del 2026-09-03) ya no valida contra `esEjemploValido` y se descarta en silencio — mismo costo aceptado que la migración anterior, sin datos de producción en juego. **El modo recorte arranca YA ACTIVO al entrar** (mismo día, ronda aparte, a pedido explícito): antes había que picar "Recortar" antes de poder dibujar sobre el documento; ahora `modoRecorte` nace en `true` y se reinicia a `true` (no a `false`) cada vez que el modal se cierra, así que el primer clic sobre el documento ya dibuja el rectángulo. El botón "Recortar" sigue existiendo como toggle, por si se quiere apagar el modo sin cerrar el modal. **Con un recorte ya guardado, "Recortar" (deshabilitado) + el botón rojo de basura se reemplazaron por un solo ícono de "Editar"** (lápiz, cuadro `bg-primary/10`, réplica del Figma compartido): reabre el mismo modal de recorte sobre el documento compartido, y guardar SOBREESCRIBE el recorte anterior — `guardarRecorteEjemplo` ya hacía eso, así que "editar" y "recortar de nuevo" son la misma operación por debajo. **Vuelve el botón de basura, mismo día, ronda aparte**: junto al lápiz de "Editar" hay de nuevo un botón rojo que llama a `borrarRecorteEjemplo()` — a diferencia de la versión anterior (retirada horas antes en esta misma tabla), esta vez SÍ pasa por una confirmación (`ConfirmarAccion`, "¿Quitar este recorte?"), porque dejar un campo sin recorte asignado es una decisión más deliberada que simplemente rehacerlo (que ya cubre "Editar" sin pasar por aquí). Quitar el recorte de UN campo así sigue sin tocar el documento compartido ni los demás campos — solo `borrarDocumentoEjemploCompartido` (sin confirmación, ver arriba) se lleva todo de un golpe. **"Editar" precarga el rectángulo YA GUARDADO** (mismo día, ronda aparte, a pedido explícito): antes reabrir con "Editar" arrancaba igual que un recorte nuevo, en blanco, sin mostrar lo que ya había. Ahora `RecortarEjemploCampo` recibe un prop `recorteExistente` (el `.recorte` del `ejemplo` de ese campo, o `null` la primera vez) y un `$effect` en la transición `false→true` de `abierto` precarga el rectángulo con esas coordenadas — se puede guardar sin tocar nada (conserva lo mismo) o arrastrar/redimensionar para ajustarlo. El efecto lee `recorteExistente` dentro de `untrack()` a propósito: solo debe dispararse al ABRIR, nunca mientras el modal ya está abierto (evita que un recálculo de esa prop pise un rectángulo que el usuario esté arrastrando en ese momento). **El botón de basura del documento compartido se deduplicó y ahora también confirma** (mismo día, ronda aparte, a pedido explícito): vivía en DOS lugares con la misma función — junto a "Cargar ejemplo documental" y en la tarjeta del archivo — se dejó solo el de la tarjeta, con ícono de basura (ya no el círculo "−"), y pasa por la misma `ConfirmarAccion` que el recorte por campo ("¿Quitar el documento de ejemplo?"), con el mensaje advirtiendo que se lleva los recortes de TODOS los campos. La nota de "sin confirmación en ningún caso" de arriba ya no aplica a ninguno de los dos botones de basura de esta fila — ambos confirman ahora. **El rectángulo ya dibujado siempre se pudo REPOSICIONAR arrastrando su cuerpo** (`iniciarMover`, desde el 2026-09-03) — lo que faltaba, y se agregó a pedido explícito el 2026-09-04, era la señal visual: sin `cursor-move` no era obvio que ya funcionaba. Redimensionar por las esquinas sigue intacto, sin tocarse. **Un tipo documental puede tener VARIAS instancias de documento de ejemplo** (cambio grande, mismo día, tercera ronda, a pedido explícito: "varias instancias... a cada uno hacerle sus recortamientos") — el modelo pasó de "un documento compartido por todo el tipo" a `documentosEjemplo: DocumentoEjemploInstancia[]`, cada una con su propio `id` y sus propios recortes en `recortesPorDocumento[idDocumento][nombreCampo]`. En la UI, arriba de la lista de campos hay un selector de chips (uno por instancia ya subida) + un "+" para agregar otra — el botón CON TEXTO "Cargar ejemplo documental" solo se muestra mientras no hay ninguna instancia todavía (más descubrible que un "+" suelto en una lista vacía); en cuanto existe al menos una, se vuelve el ícono compacto. Subir una instancia nueva la deja SELECCIONADA de inmediato (`CargarDocumentoEjemplo` ahora acepta un `onGuardado(idDocumento)`), sin un clic aparte para elegirla. Los campos de abajo SIEMPRE recortan sobre la instancia seleccionada — cambiar de chip cambia qué recorte se ve por campo, y son completamente independientes entre instancias (el mismo campo puede tener un recorte distinto en cada una, o ninguno). Quitar una instancia (`borrarDocumentoEjemplo`, con la misma confirmación de antes) solo se lleva SUS recortes, no los de las demás; si la instancia borrada era la seleccionada, la selección salta a la primera que quede (o a ninguna). **Migración**: el formato viejo de un solo documento (de esta misma mañana) no tiene `id` ni es un arreglo, así que se descarta en silencio al leer la Biblioteca — mismo costo aceptado que las migraciones anteriores de esta pantalla. |
| ~~**"Listar versiones anteriores"**, junto a "Modelos documentales agregados"~~ | Columna derecha de la Biblioteca | 2026-09-02, **retirado el 2026-09-03** | **Sin frame de Figma.** Se construyó como un link junto al título que revelaba tarjetas de solo lectura debajo de la tarjeta vigente. Nunca llegó a verse en producción (el usuario reportó el botón vecino "Cargar ejemplo documental" como el síntoma, pero el link en sí tampoco apareció) y, en vez de depurar por qué, se pidió redirigir la funcionalidad al renglón "Historial de versiones" del menú `⋮` — ver la fila nueva de abajo, que reemplaza a esta por completo. Requirió agregar `historialVersiones` y `activadoEn` a `TipoDocumentalGuardado` — **hoy la app no guardaba ningún rastro de una versión reemplazada** (el `procesadorId` viejo simplemente se sobreescribía) — y ese modelo de datos SÍ sigue vigente, solo cambió quién lo lee. Un tipo que ya se re-publicó ANTES de este cambio no tiene cómo recuperar ese historial retroactivamente; desde ahora sí queda. El detalle fino de CÓMO se archiva —por qué no basta con leer `tipo.campos` en el momento en que el back responde— está en el comentario de `versionEnEdicion` en `configuracion.svelte.ts`: para cuando `activarTipoDocumental` se entera del éxito, los campos ya se sobreescribieron con lo recién editado, así que `crearNuevaVersion()` toma la foto ANTES de tocar nada. |
| Renglón **"Historial de versiones"**, habilitado | Menú `⋮` de la tarjeta | 2026-09-03, **cambiado de modal a en línea el mismo día** | Réplica del frame `1077:66342` (header "Historial de versiones" + X, cuerpo con ícono + "Modelos documentales" + descripción, una tarjeta por versión anterior: ícono, nombre, `{N campos} · {vertical} · v{versión} · Publicada el {fecha}`, insignia "Inactivo"), pero **sin diálogo**: el primer intento lo abría como modal flotante con overlay; se pidió el mismo contenido desplegado EN LÍNEA, justo debajo de la tarjeta del tipo documental, sin tapar el resto de la Biblioteca. Picar el renglón alterna (toggle): vuelve a picarlo y se oculta; la X del panel hace lo mismo. Las tarjetas de versión llevan borde punteado — el mismo lenguaje visual que ya tenía el link retirado de arriba para marcarlas de solo lectura. Habilitado con el mismo criterio que "Crear nueva versión" (`tipo.historialVersiones.length > 0`). El subtítulo de cada tarjeta sustituye la "Precisión X%" del frame por "N campos" — la precisión no existe como dato real, mismo desajuste ya aceptado para la tarjeta vigente (sección 4b de abajo), no una desviación nueva. |
| Renglón **"Borrar" / "Archivar"**, con confirmación | Menú `⋮` de la tarjeta, debajo de "Eventos" | 2026-09-02 (agregado), **redefinido el mismo día** | Es UN solo renglón que cambia de texto y de comportamiento según el estado — nunca los dos a la vez. Ver el detalle abajo: se retiró la versión original ("Borrar funciona igual para un borrador que para un modelo activo") en la misma sesión en que se agregó, a pedido explícito. |
| **Al menos un campo para avanzar** | Paso 2 → 3 del wizard | 2026-09-03, **revierte una decisión previa** | Antes "Guardar y agregar propiedades" dejaba avanzar sin ningún campo a propósito (comentario original: "exigir al menos uno aquí dejaría atrapado a quien creó el tipo sin campos"). Se pidió lo contrario: un tipo documental sin campos no tiene nada que activar ni que mapear, así que ahora el botón exige que quede al menos uno — ya agregado, o completo en el formulario de captura y listo para que `continuar()` lo agregue solo (ese caso ya existía, no es nuevo). Mientras no se cumple, aparece un aviso ("Agrega al menos un campo de extracción...") en el mismo lugar donde iría "Campos agregados". El estado vacío del paso 3 ("Todavía no hay campos que configurar", sección 2 de abajo) sigue vivo pero ya no se alcanza por el flujo normal — solo saltando por el sidebar tras quitar todos los campos ya en el paso 3. |
| **"Guardar" ya no deja el formulario abierto; "Agregar campo" lo reabre** | Formulario de captura, paso 2 del wizard | 2026-09-03 | Antes el botón decía "Agregar otro campo" y hacía DOS cosas a la vez: guardaba el campo Y dejaba el formulario listo (en blanco) para el siguiente — ambiguo, según lo pedido. Ahora "Guardar" hace SOLO lo primero: guarda el campo en la lista y OCULTA el formulario. En su lugar aparece un botón "Agregar campo" (círculo con `+`, mismo lenguaje visual que el círculo rojo de "Quitar") que lo vuelve a mostrar en blanco. El formulario arranca VISIBLE en una alta nueva (sin campos, nada más que mostrar) y OCULTO al retomar un tipo que ya trae campos (Editar / Crear nueva versión) — las tres puertas de entrada al wizard (`nuevoTipoDocumental`, `abrirTipoDocumental`, `iniciarNuevaVersion`) fijan `mostrarFormularioCampo` explícitamente según corresponda. Quitar el último campo NO reabre el formulario solo: se queda oculto con "Agregar campo" disponible, sin caso especial. |

**Diseño vigente** (el original, descrito más abajo por completo en la
sub-sección "Retirado", quedó obsoleto el mismo día que se escribió):

- **Tipo en BORRADOR** (nunca activado): el renglón dice **"Borrar"** — rojo,
  destructivo (`variant="destructive"`, ícono `Trash2`). Borra el registro de
  la Biblioteca de verdad, sin dejar rastro. Si ese borrador tuviera además un
  `procesadorId` real (hoy no alcanzable desde la UI — solo un borrador nacido
  de la futura `crearNuevaVersion()` podría tenerlo, ver sección 1b — el
  diálogo lo advierte y el borrado también destruye el Custom Extractor en
  Document AI, irreversible).
- **Tipo ACTIVO**: el renglón dice **"Archivar"** — neutral, sin rojo
  (`ConfirmarAccion` ganó una prop `variante="neutral"` para esto: ícono
  `Info` azul en vez de `TriangleAlert`, botón de confirmar en `variant="default"`
  en vez de `"destructive"`). Llama a `archivarTipoDocumental()`, que:
  - **NO** toca Document AI en absoluto — el Custom Extractor sigue vivo tal
    cual, sin llamar a `disable` ni a nada.
  - **NO** borra el registro de `localStorage` — solo le cambia `estado` a
    `'archivado'`.
  - Saca el tipo del árbol y de las tarjetas: `tiposEnBiblioteca` (un
    `$derived` en `ConfigSheet.svelte`) filtra `estado !== 'archivado'` en
    TODOS los puntos que antes leían `tiposDocumentales` directo para
    renderizar.

  Motivo del cambio: borrar un modelo activo destruye un recurso real de GCP
  sin vuelta atrás, y para "solo quitarlo de la vista" eso es demasiado
  costoso. Archivar es la vía segura para ese caso — **hoy no hay pantalla de
  "Archivados"** para verlos ni un `desarchivarTipoDocumental()` para volver;
  se agregan cuando se pidan. El registro no se pierde, solo deja de listarse.

El orden de borrado real (para el caso "Borrar" con procesador) sigue
deliberado: se borra primero en **Google**, y solo si eso funciona se borra de
la Biblioteca. Al revés, un fallo en Document AI dejaría un procesador
huérfano sin ningún registro local que lo señale — nadie volvería a saber que
existe para limpiarlo. Con este orden, un fallo deja el tipo documental
intacto y se puede reintentar sin duplicar nada (el borrado en Document AI ya
es idempotente: si el procesador no existe, `eliminar_procesador` lo trata
como éxito).

<details>
<summary>Diseño original de "Borrar" (retirado el mismo día, 2026-09-02)</summary>

El primer diseño de "Borrar" era un único renglón siempre presente, para
cualquier estado: para un modelo activo, borraba la Biblioteca Y el Custom
Extractor en Document AI, con el diálogo advirtiendo "irreversible". Se
retiró a pedido explícito el mismo día: destruir un procesador real solo para
sacarlo de la vista era una consecuencia demasiado grave para lo que se
pedía, y "Archivar" (arriba) la resuelve sin tocar Google.

</details>



## 2. Sigue en la app y NO está en el diseño

Pendientes de que el UX decida. Se dejaron porque quitarlos empeora la pantalla,
no porque se hayan colado.

| Qué | Dónde | Por qué se dejó |
|---|---|---|
| **Vista previa real de la imagen** | Modal de detalle | Figma dibuja un ícono de archivo de relleno. Ver la credencial real es la diferencia entre revisar y adivinar. Para PDF sí se queda el ícono: renderizarlo exigiría un visor. |
| Renglón **"Versión del modelo"** | Modal de detalle, sección OCR | Figma llega hasta "Calidad de la lectura". Se agregó porque `engine_version` es lo que da reproducibilidad, y ya nos mordió una vez: en producción estuvo sin fijar y devolvía un campo menos. |
| **Avisos de error y de `quality_alert`** | Modal de detalle | **El más importante de esta lista.** Sin ellos, un documento que falló se ve idéntico a uno que salió bien. Es la diferencia entre una pantalla que informa y una que miente por omisión. |
| **PNG** en el dropzone | Panel "Carga documental" | El frame dice `PDF, DOCX, XLSX, JPG, JPEG, TIFF`. Se agregó PNG porque **el 17% del corpus real de INEs del usuario son PNG** (93 de 548 archivos): una sexta parte de los documentos no se podía ni subir. **Esto cambia texto visible del frame** — es el caso que más conviene que el UX actualice. |
| **Tarjeta clicable** para retomar un tipo documental, con flecha a la derecha | Biblioteca | El frame tiene ahí un botón de 82×38 (de HU038) y un ícono de menú; sin ellos no había forma de abrir un tipo ya guardado. Hacer clicable la fila completa no agrega elementos nuevos que revisar, y la flecha es la misma que ya usa el renglón "Biblioteca" del sidebar. |
| Texto **"Sin campos configurados"** | Tarjeta de la Biblioteca | Desde que el tipo documental se guarda al salir del paso 1, puede existir sin ningún campo. Un "0 campos" suelto se lee como que algo salió mal. |
| **Enter** agrega el valor en "Agregar listado" | Paso 3, campos tipo Lista | Teclear diez valores sin poder usar Enter es innecesariamente lento. No está en el frame, pero tampoco lo contradice. |
| Aviso **"Ese valor ya está en el listado."** | Paso 3, campos tipo Lista | El frame no muestra validación ahí. Se agregó por consistencia con la de nombres de campo: dos valores iguales en un catálogo no significan nada, y deshabilitar el botón sin decir por qué confunde. |
| **"Obligatorio" marcado por default** en campos nuevos | Paso 2 del wizard | Cambio pedido. El frame lo dibuja desmarcado. Coincide con los datos: 15 de los 19 campos activos del procesador de INE están marcados "Obligatoria una vez". Solo aplica a campos nuevos — un campo ya guardado como opcional conserva su valor. |
| La **X del header sube un nivel** en vez de cerrar siempre | Wizard del Módulo de configuración | Cambio pedido: desde el wizard regresa a la Biblioteca; desde la Biblioteca sí cierra. Antes sacaba hasta el Home — dos niveles de golpe. |
| **Escape y el clic fuera** hacen lo mismo que la X | Wizard del Módulo de configuración | Cambio pedido: que los tres gestos de salida coincidan. Antes Escape y el clic fuera cerraban del todo mientras la X subía un nivel — la misma inconsistencia que se acababa de quitar, por otra puerta. Nada se pierde: el borrador ya se persiste solo. Se hizo con `onEscapeKeydown` / `onInteractOutside` interceptados en `Sheet.Content`. Al terminar el paso 3 el módulo tampoco cierra ya: cae en la Biblioteca, como pide el diseño del aviso de confirmación. |
| Botón **"Regresar"** en vez de **"Cancelar registro"** | Pie del wizard | Cambio pedido: retrocede un paso en lugar de salir. En el paso 1 regresa a la Biblioteca, que es la pantalla de la que se viene. Se repintó en **verde** (`text-green-600`, el mismo `--exito/exito-2` que usan "Listo" y "En configuración" en el sidebar). En el frame es rojo, pero ahí decía "Cancelar registro" y el rojo señalaba una acción destructiva; "Regresar" no lo es. |
| **Títulos de paso navegables** (subrayado al pasar el cursor) | Sidebar del wizard | El frame los dibuja como texto inerte. Se volvieron clicables a pedido explícito, y solo los ya visitados. El subrayado en hover es la única señal visual que se agregó; el UX puede querer otra. |
| **Aviso de confirmación al terminar el alta** | Pie del Módulo de configuración | Cambio pedido, con captura del diseño. Es el primer aviso de CONFIRMACIÓN del proyecto —los dos que ya había (nombre de campo duplicado, valor repetido) son de validación—, el primer degradado y la primera región `aria-live`. Tres cosas que conviene que el UX mire: **(a) ubicación** — el frame lo pone debajo del modal, a unos dos tercios del ancho; aquí el panel es de altura completa, así que va al pie de la columna de contenido, alineado con "Modelos documentales agregados" (verificado: x=795 los dos). **(b) no se auto-oculta** — el frame no dibuja botón de cerrar ni nada que sugiera un temporizador; muere al navegar. **(c) solo se anuncia el ALTA** — al retomar un modelo y volver a guardarlo no aparece, porque "Nuevo tipo documental agregado." se contradiría con una lista que no creció. Si se quiere confirmar también la edición, hace falta copy propio. |
| **"Activar" crea el Custom Extractor real** | Tarjeta de la Biblioteca | Desde el 2026-08-28 el botón hace la operación de verdad: crea (o adopta) el procesador del tipo documental en Document AI vía el back, le sube el esquema armado desde los campos del wizard, y solo si Google respondió marca el estado. El procesador nace en zero-shot: extrae leyendo solo el esquema, sin entrenar. Lo que aún NO se valida es la regla de integridad #3 de la §2.6 (que todo campo `required` tenga mapeo) — eso necesita la base. |
| **Texto de la insignia: "Activo"** | Tarjeta de la Biblioteca | Es una **suposición**. El frame `1077:66268` la dibuja como `Badges` de 59×22, pero es una instancia de componente y el volcado no trae su texto. **Confirmar con el UX.** |
| ~~No se construyó "Validando configuración…"~~ | Tarjeta de la Biblioteca | **CONSTRUIDO el 2026-08-28**, cuando dejó de ser mentira: ahora sí hay trabajo detrás (tres llamadas a Google, una con polling). Aparece mientras la activación está en vuelo. |
| **Aviso rojo de activación fallida** | Pie del Módulo de configuración | Gemelo del aviso verde, sobre el frame `Alert error` (`1077:65797`, 684×94) cuyos píxeles no se pudieron ver (cuota de Figma): espeja el diseño del verde en paleta roja. El cuerpo muestra el error real del back, no un "algo salió mal" genérico. |
| **"Eventos" sigue deshabilitado a secas** | Menú `⋮` de la tarjeta | Es el único de los cuatro renglones sin nada construido detrás: necesita `config_version` y su propia bitácora. "Crear nueva versión" (2026-09-02) e "Historial de versiones" (2026-09-03) ya se habilitaron condicionalmente — ver sus filas en la sección 2b — así que en el frame los cuatro se ven activos, pero solo queda uno realmente atenuado sin condición que lo encienda. |
| ~~"Ejemplo documental" siempre se ve apagado, con tooltip "Activar"~~ | Menú `⋮` de la tarjeta | Construido y **retirado el mismo día** (2026-09-03): revertía el criterio anterior forzando el switch siempre apagado, sin importar `tipo.ejemploDocumental`, con un tooltip "Activar" puramente informativo. Se retiró horas después a pedido explícito — ver la fila de abajo ("estoy listo"), que lo reemplaza por completo. Lo único que sobrevive de ese intento es la solución técnica del tooltip: necesitó `pointer-events-none!` (con el modificador `!important` de Tailwind v4) porque `TooltipPrimitive.Content` de bits-ui fija `pointer-events: auto` como estilo INLINE (para que el tooltip mismo se pueda hacer hover, un requisito de accesibilidad) — un inline style le gana a una clase normal sin importar el orden, así que sin el modificador el tooltip abierto se interponía entre el mouse y el renglón y se tragaba el clic (confirmado con `elementFromPoint` de Playwright). Esa misma solución se reutiliza en el switch funcional de abajo. |
| **"Ejemplo documental" es un switch funcional: "estoy listo"** | Menú `⋮` de la tarjeta | 2026-09-03, mismo día que el intento de arriba | Vuelve a reflejar y alternar `tipo.ejemploDocumental` de verdad (`alternarEjemploDocumental()`, que llevaba desde el 2026-09-02 sin usarse). Significado nuevo, explícito: es una marca LOCAL y reversible de "estoy listo" — a propósito **no dispara ningún envío todavía** ("por ahora nada más que eso", palabras del pedido); qué lo va a disparar queda pendiente de que se defina en otra conversación. El switch y el resto del renglón quedan independientes: picar el switch alterna la marca sin navegar (`stopPropagation()` evita que también dispare el `onSelect` del `Item`, verificado con Playwright que el menú ni siquiera se cierra), picar el texto/ícono navega a Calibración sin tocar el switch. El tooltip cambia según el estado (“Marcar como listo” / “Quitar la marca de listo”) y es honesto sobre el límite: apagar el switch NO va a deshacer nada que ya se haya enviado a Document AI el día que ese envío exista — es solo la marca local la que se quita. |
| **La lista arranca VACÍA; el árbol selecciona** | Biblioteca | Cambio pedido (2026-08-28, segunda iteración): por default no se lista ningún modelo — la tarjeta aparece al picar su rama en el árbol. Picarla de nuevo, o picar "Biblioteca" (el padre), vacía de nuevo. La rama seleccionada va en el color primario con `aria-pressed`. El vacío lleva una línea de pista ("Selecciona un modelo en la Biblioteca…") para no leerse como falla. Retomar el modelo quedó SOLO en la tarjeta. La selección es efímera (el wizard y el cierre la limpian) con UNA excepción: al terminar un alta, el recién guardado queda seleccionado para que el aviso verde conviva con SU tarjeta — que es lo que muestra el diseño. |
| **El eje del árbol queda segmentado** con varios modelos | Submenú de la Biblioteca | Fidelidad literal al frame, no una decisión: la línea vertical vive DENTRO del renglón (`line`, y=8, h=22 en una fila de 38), así que con N modelos salen N tramos de 22px separados por huecos de 16px, en vez de un eje continuo. Con un solo modelo las dos lecturas son idénticas y no hay con qué desempatar. **Conviene que el UX confirme** cuál quería: continuo es el idioma habitual de un árbol. |
| Estado vacío **"Todavía no hay campos que configurar"** | Paso 3 | El frame siempre muestra campos. **Ya no se llega aquí por el flujo normal** (ver "Al menos un campo para avanzar" en la sección 2b, 2026-09-03): el botón "Guardar y agregar propiedades" del paso 2 exige que quede al menos un campo. Sigue vivo porque el sidebar salta a cualquier paso ya visitado sin pasar por ese botón — llegar al 3 con campos, volver al 2, quitarlos todos, y picar "3." desde el sidebar todavía lo alcanza. |
| Estado **"En cola"** | Filas de la Bandeja de preparación | Las lecturas de archivo se serializaron para no cargar N archivos completos a memoria a la vez. Una barra de progreso en 0% se ve trabada; "En cola" dice la verdad. |

| Placeholder **"Ingresa un valor de ejemplo"** | Campo "Valor de estructura", paso 2 | El screenshot del frame muestra un valor real (`POL-2026-00045871`), no un placeholder. Se eligió uno neutral siguiendo el patrón de los otros ("Ingresa nombre de campo") en vez de hardcodear un ejemplo de seguros en un campo genérico. |

## 3. Fidelidad pendiente por cuota de Figma

El conector de Figma tiene límite mensual de llamadas en asiento de lectura, y
se agotó el 2026-08-26. Estas partes se construyeron con la **estructura** del
volcado local (`.figma/page-905-23164.metadata.txt`) pero **sin ver los
píxeles**:

- **Biblioteca poblada** (`1077:65410`). De ahí salen el título "Modelos
  documentales agregados", la tarjeta por modelo (682×72) y la etiqueta
  "Administrador". El espaciado, tipografía fina y el contenido exacto de la
  tarjeta quedan pendientes de una pasada.
- **Campo "Valor de estructura"** del paso 2. NO aparece en el volcado local
  (`grep` de "estructura" da cero): se agregó al archivo de Figma después del
  2026-08-24, cuando se tomó el volcado, y la cuota ya estaba agotada para pedir
  el frame. Se implementó leyendo un screenshot: renglón propio, solo la columna
  izquierda, sin asterisco. Su ancho exacto y el placeholder quedan pendientes de
  verificar contra el frame.
- **El input de "Agregar listado" tiene un chevron (▾) en el frame**, lo que
  sugiere un desplegable de catálogos predefinidos además del texto libre. Se
  implementó como campo de texto, porque el placeholder ("Ingresa un listado
  personalizado") y el comportamiento visible en las capturas apuntan a que se
  teclea. Si la intención era un combobox con listas ya existentes, falta esa
  fuente de datos.
- **Indentación del panel del acordeón** (paso 3). El frame tiene un `line` de
  22px que ata visualmente el contenido con su encabezado. Se aproximó con un
  borde izquierdo, pero sin poder comparar píxeles no está confirmado.
- ~~**Submenú del sidebar** bajo "Biblioteca"~~ — **CONSTRUIDO el 2026-08-28**
  (frame `listado`, `1077:65481`). El usuario aportó la captura que faltaba. La
  geometría se reprodujo al pixel y está verificada por prueba automatizada: eje
  del árbol en x=44 (justo donde empieza el texto "Biblioteca", no su ícono),
  fila de 38px, tramo vertical de 22px, guion de 11.5px, etiqueta en x=63.5.

## 4. Pantallas del wizard sin construir

- ~~**Paso 3 · "Propiedades de campo"**~~ — **CONSTRUIDO el 2026-08-27**
  (frame `1070:62364`): acordeón de campos con umbral de confianza, regla de
  transformación, cardinalidad y obligatorio. Dos cosas quedan pendientes ahí:
  - **`Obligatorio` aparece en el paso 2 Y en el paso 3.** El diseño lo dibuja en
    ambas pantallas. Se enlazó a la MISMA propiedad, así que cambiarlo en una lo
    cambia en la otra — es la única lectura que no produce dos verdades. Vale
    confirmarlo con el UX.
  - ~~Los valores permitidos de un campo de tipo `Lista` siguen sin capturarse~~
    — **RESUELTO el 2026-08-27**: al elegir "Lista" aparece la sección "Agregar
    listado" con sus chips removibles. Son `catalog_value` (2.3 del diccionario),
    una fila por valor.
- **HU038 · Activar versión para producción** — **la tarjeta se construyó el
  2026-08-28**: botón "Activar" (82×38), insignia del estado activado (59×22) y
  menú `⋮` (259×208, cuatro renglones de 235×46), todo con la geometría del
  frame verificada por prueba automatizada. Lo que **falta** es lo que hay
  detrás: la validación real al activar (regla de integridad #3 de la §2.6, que
  exige que todo campo `required` tenga mapeo, y que vive en el back), el
  versionado `config_version` del que cuelgan "Crear nueva versión" e
  "Historial de versiones", y la bitácora de "Eventos".
- **HU039-041 · Calibración de campos extraídos**. Es la pantalla donde se
  marcaría el `transform` del mapeo. Ver la nota de la sección 2.6b en
  `nexus_back/docs/solicitudes-dba.md`: ahí hay una **tensión con la
  inmutabilidad** que conviene resolver en el diseño antes de construirla.

## 3b. Bug corregido de paso

Al construir el aviso salió un camino de **pérdida de datos silenciosa** que ya
existía: en el paso 3 el botón está siempre habilitado, y desde el sidebar se
salta a cualquier paso ya visitado. Bastaba con borrar el nombre en el paso 1,
picar el título del 3 y "Guardar configuración": el borrador se destruía, la
biblioteca conservaba el nombre viejo, y no aparecía ni aviso ni error.
Reproducido en el navegador antes de tocar nada.

Ahora, si no hay nombre, no se limpia nada y se devuelve al paso 1 — donde vive
el campo que falta y donde el pie ya está deshabilitado hasta llenarlo, así que
la pantalla lo explica sola sin inventar un mensaje que el diseño no tiene.

## 4b. Desajustes detectados y NO corregidos

Salieron al leer el volcado del frame `1077:65410` mientras se construía el
submenú. No se tocaron porque nadie los pidió, pero están verificados:

- **El subtítulo de la tarjeta no coincide.** El frame dice
  `Seguro de Autos | Precisión 0%`; la app dice `1 campo · Seguros`. Son dos
  datos distintos: el frame muestra vertical + precisión del modelo, la app
  muestra cuántos campos lleva. La precisión todavía no existe como dato.
- **El botón "Nuevo tipo documental" está `hidden="true"`** en el frame de la
  biblioteca poblada (`1077:65431`), donde vive al pie del sidebar. La app lo
  pinta en el cuerpo, bajo la lista. Sin él no habría forma de crear el segundo
  modelo.

*(La etiqueta "Administrador" salía también en esta lista. Se quitó el
2026-08-28, junto con la flecha, al construirse el botón "Activar" y el menú `⋮`
que el frame pone en ese mismo sitio.)*

## 5. Correcciones de fidelidad ya aplicadas

Para que no se vuelvan a "corregir" al revés:

- El sidebar del wizard decía **"Completado"**; el frame dice **"Listo"**
  (`1060:61194`). Venía de implementar el paso 1, cuando ese estado no se veía en
  ninguna pantalla y no había contra qué contrastarlo.
- El modal de detalle pintaba **dos X encimadas**: `Sheet.Content` trae la suya
  por default además de la del header. Se apagó con `showCloseButton={false}`.
- La confianza se mostraba con **un decimal**, lo que imprimía `100.0%` para un
  valor de `99.98`. Ahora son dos, que es además la precisión real que devuelve
  el back.
