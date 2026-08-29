# Pendientes y desviaciones respecto a Figma

Inventario de todo lo que **no** corresponde uno a uno con el archivo de Figma
(`NexusDoc | 1er MVP | web.2026_v0.0.1`), con el motivo de cada caso.

Sirve para dos cosas: que la revisión del UX sepa qué mirar y qué ignorar, y que
nadie "arregle" más adelante una decisión que se tomó a propósito.

Última actualización: **2026-08-28**.

---

## 1. Retirado por no estar en el diseño

Cosas que se construyeron, funcionaban, y se quitaron para que la revisión del UX
vea la pantalla limpia. Todas son recuperables: el código de soporte sigue ahí.

| Qué | Dónde | Cuándo | Cómo devolverlo |
|---|---|---|---|
| Sección **"Campos extraídos"** — cada campo extraído con su valor y confianza individual | Modal "Detalle de documento" | 2026-08-25 | `camposDe()` sigue intacto en `$lib/types/ine`. Recuperar el bloque del historial y volver a importarlo con su `$derived`. Hay una nota en el propio componente. |
| Botón de **eliminar** un tipo documental | Biblioteca del Módulo de configuración | 2026-08-26 | `eliminarTipoDocumental()` sigue en `$lib/state/configuracion.svelte`, probada. Solo falta el control. |
| **×** para quitar una tarjeta de campo | Paso 2 del wizard | 2026-08-26 | Ya no aplica: al rehacer el paso 2 conforme al frame real, el diseño trae su propio botón de quitar en "Campos agregados". |

**Consecuencia de haber quitado el de eliminar**: hoy un tipo documental guardado
por error **no se puede borrar desde la UI**. Se limpia borrando la llave
`nexusdoc:tipos-documentales:v1` desde las DevTools del navegador.

En el frame `1077:65410` ese lugar lo ocupan un botón de 82×38 y un ícono de menú
de 24×24. Ese botón pertenece a **HU038** ("Activar versión de Configuration
Table para producción"), que todavía no se construye, así que no se sabe si el
menú incluye "eliminar" o no.

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
| **Tres de los cuatro renglones del menú van deshabilitados** | Menú `⋮` de la tarjeta | "Crear nueva versión" y "Eventos" necesitan `config_version` y su bitácora; "Historial de versiones" es un modal entero sin construir (`1077:66342`). En el frame se ven activos. Dejarlos vivos y sin efecto es peor mentira que atenuarlos: se encienden solos el día que haya a dónde ir. |
| **"Ejemplo documental" se recuerda pero no hace nada** | Menú `⋮` de la tarjeta | El interruptor persiste por modelo para no mentir al reabrir el menú. Todavía no hay ejemplo que adjuntar ni a dónde mandarlo. |
| **Las ramas del árbol son clicables** | Submenú de la Biblioteca | En el frame son texto inerte. Se hicieron botones porque retomar el modelo es lo único que puede querer hacerse desde ahí — un árbol de navegación que no navega es un adorno. Hace lo mismo que picar la tarjeta del cuerpo. |
| **El eje del árbol queda segmentado** con varios modelos | Submenú de la Biblioteca | Fidelidad literal al frame, no una decisión: la línea vertical vive DENTRO del renglón (`line`, y=8, h=22 en una fila de 38), así que con N modelos salen N tramos de 22px separados por huecos de 16px, en vez de un eje continuo. Con un solo modelo las dos lecturas son idénticas y no hay con qué desempatar. **Conviene que el UX confirme** cuál quería: continuo es el idioma habitual de un árbol. |
| Estado vacío **"Todavía no hay campos que configurar"** | Paso 3 | El frame siempre muestra campos. Puede quedar vacío porque los campos son opcionales para avanzar; sin esto la pantalla quedaría en blanco sin explicación. |
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
