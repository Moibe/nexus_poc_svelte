# Pendientes y desviaciones respecto a Figma

Inventario de todo lo que **no** corresponde uno a uno con el archivo de Figma
(`NexusDoc | 1er MVP | web.2026_v0.0.1`), con el motivo de cada caso.

Sirve para dos cosas: que la revisión del UX sepa qué mirar y qué ignorar, y que
nadie "arregle" más adelante una decisión que se tomó a propósito.

Última actualización: **2026-08-26**.

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
| Etiqueta **"Finalizar"** | Pie del paso 3 del wizard | El paso 3 es un placeholder y no se sabe qué dice su pie en el diseño. Sin una etiqueta y sin habilitar el botón, la única salida del wizard era la X y se veía roto. |
| **PNG** en el dropzone | Panel "Carga documental" | El frame dice `PDF, DOCX, XLSX, JPG, JPEG, TIFF`. Se agregó PNG porque **el 17% del corpus real de INEs del usuario son PNG** (93 de 548 archivos): una sexta parte de los documentos no se podía ni subir. **Esto cambia texto visible del frame** — es el caso que más conviene que el UX actualice. |
| **Tarjeta clicable** para retomar un tipo documental, con flecha a la derecha | Biblioteca | El frame tiene ahí un botón de 82×38 (de HU038) y un ícono de menú; sin ellos no había forma de abrir un tipo ya guardado. Hacer clicable la fila completa no agrega elementos nuevos que revisar, y la flecha es la misma que ya usa el renglón "Biblioteca" del sidebar. |
| Texto **"Sin campos configurados"** | Tarjeta de la Biblioteca | Desde que el tipo documental se guarda al salir del paso 1, puede existir sin ningún campo. Un "0 campos" suelto se lee como que algo salió mal. |
| Estado **"En cola"** | Filas de la Bandeja de preparación | Las lecturas de archivo se serializaron para no cargar N archivos completos a memoria a la vez. Una barra de progreso en 0% se ve trabada; "En cola" dice la verdad. |

## 3. Fidelidad pendiente por cuota de Figma

El conector de Figma tiene límite mensual de llamadas en asiento de lectura, y
se agotó el 2026-08-26. Estas partes se construyeron con la **estructura** del
volcado local (`.figma/page-905-23164.metadata.txt`) pero **sin ver los
píxeles**:

- **Biblioteca poblada** (`1077:65410`). De ahí salen el título "Modelos
  documentales agregados", la tarjeta por modelo (682×72) y la etiqueta
  "Administrador". El espaciado, tipografía fina y el contenido exacto de la
  tarjeta quedan pendientes de una pasada.
- **Submenú del sidebar** bajo "Biblioteca". El frame tiene un `listado` (282×38)
  con `space`, `line` y `submenu` — o sea una lista anidada con línea vertical,
  un renglón por modelo. **No se construyó**: sin ver el diseño había que
  inventar demasiado.

## 4. Pantallas del wizard sin construir

- **Paso 3 · "Propiedades de campo"** (`1060:61283` describe el paso). Hoy es un
  placeholder. Es donde deberían capturarse los valores permitidos de un campo de
  tipo `Lista` — o sea `catalog_value` (2.3 del diccionario), que hoy nada
  captura.
- **HU038 · Activar versión para producción**. Mientras no exista, todo tipo
  documental guardado queda en estado `borrador` y nada se activa. Es coherente
  con el diccionario: activar exige validar que todo campo `required` tenga
  mapeo (regla de integridad #3 de la sección 2.6).
- **HU039-041 · Calibración de campos extraídos**. Es la pantalla donde se
  marcaría el `transform` del mapeo. Ver la nota de la sección 2.6b en
  `nexus_back/docs/solicitudes-dba.md`: ahí hay una **tensión con la
  inmutabilidad** que conviene resolver en el diseño antes de construirla.

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
