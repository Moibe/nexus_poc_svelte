# Document AI: identificar el tipo de documento (Classifier / Splitter)

Investigación hecha el **2026-09-06** en respuesta a una pregunta de requerimiento:
¿identificar QUÉ TIPO de documento se subió (INE, pasaporte, póliza...) es algo
que Document AI ya resuelve, o es algo que hay que construir aparte? Sirve
como referencia antes de decidir si/cómo se conecta esta pieza a NexusDoc AI —
**no se ha construido nada de esto todavía**, es solo la investigación.

Mismo criterio que los otros documentos de esta carpeta: solo hechos
verificables citados con URL oficial (`cloud.google.com` / `docs.cloud.google.com`),
con nivel de confianza explícito.

---

## 1. Sí existe, y es un procesador APARTE del que ya usamos

Todo lo construido hasta ahora en NexusDoc AI (tipos documentales + campos +
recortes) alimenta un **Custom Extractor** — un tipo de procesador de Document
AI. La identificación del TIPO de documento es un procesador **distinto**,
llamado **Custom Document Classifier**:

> *"This processor identifies classes of documents from a user-defined set of
> classes."*
> — [docs.cloud.google.com/document-ai/docs/custom-classifier](https://docs.cloud.google.com/document-ai/docs/custom-classifier)
> _Confianza: alta_

Y la propia documentación describe el orden típico del flujo — clasificar
PRIMERO, extraer DESPUÉS, con el resultado de uno alimentando al otro:

> *"You typically would use a custom classifier on documents that are
> different types, then use the identification to pass the documents to an
> extraction processor."* — _alta_

**Confirmado también que son recursos separados a nivel de API**, no una
opción dentro del mismo procesador — cada uno tiene su propio tipo:

| Función | Tipo de procesador (API) |
|---|---|
| Clasificar | `CUSTOM_CLASSIFICATION_PROCESSOR` |
| Extraer campos (lo que ya usamos) | `CUSTOM_EXTRACTION_PROCESSOR` |

_Fuente: [docs.cloud.google.com/document-ai/docs/processors-list](https://docs.cloud.google.com/document-ai/docs/processors-list) — confianza alta._

**Implicación concreta para NexusDoc AI:** hoy la app no tiene ningún paso de
"adivinar el tipo" — el usuario elige el tipo documental a mano ANTES de subir
cualquier ejemplo. Para que la identificación fuera automática, haría falta
crear y configurar un Classifier aparte, y agregar un paso previo real al
flujo: **subir → clasificar → elegir el Extractor correspondiente a ese tipo
→ extraer campos**. Nada de esto existe todavía en la app.

## 2. ¿Necesita entrenamiento propio, o funciona "de fábrica"?

Depende de la versión del modelo — hay dos caminos documentados:

- **v1.5 (con un modelo foundation de Gemini de fondo) funciona SIN entrenar
  nada**, solo dándole las categorías que quieres — esto es "zero-shot":

  > *"This pre-trained model can be used without prior training. It supports
  > zero-shot classification."* — _alta_

  > *"Tip: v1.5 uses Generative AI, you can use it out of the box without
  > training."* — _alta_

  > *"Pretrained model: Use the pretrained generative AI foundation model to
  > quickly classify documents with your supplied labels."* — _alta_

- También se puede **entrenar con tus propios ejemplos etiquetados** si se
  quiere más precisión — mismo patrón de "Mark as Labeled" + "Train new
  version" ya documentado en `document-ai-flujo-etiquetado-entrenamiento.md`
  para el Extractor:

  > *"To train this new processor, you must create a dataset with training
  > and testing data."* — _alta_

## 3. El primo del Classifier: Custom Document Splitter

Relevante porque ya aparece, sin que nadie lo haya pedido explícitamente
todavía en esta conversación, en el propio diccionario de datos de
`nexus_back` (ver memoria `nexusdoc_modelo_datos.md`): la tabla `document` es
DISTINTA de `file` por **"HU-042/HU-043: clasificación y segmentación"**, con
campos `segment_index`, `page_start`/`page_end` y `classification_confidence`
— exactamente lo que describe este procesador:

> *"Custom splitter is designed to split composite documents (documents made
> up of multiple classes) into a number of single class documents by
> identifying each logical document. Custom splitters can split and classify
> multiple documents within a single file. For example, the Splitter will
> provide the page numbers of a driver's license, paystub, tax form, and bank
> statement within a single file."*
> — [docs.cloud.google.com/document-ai/docs/custom-splitter](https://docs.cloud.google.com/document-ai/docs/custom-splitter)
> _Confianza: alta_ (recuperada vía una síntesis de búsqueda, no un fetch
> directo del texto crudo — pendiente verificar palabra por palabra si se
> vuelve relevante para una decisión concreta)

Ojo con un detalle: el Splitter identifica DÓNDE empieza y termina cada
documento lógico dentro del archivo (página por página), pero **no separa
físicamente el archivo por ti** — solo entrega los límites.

Si el caso real de NexusDoc AI es "un archivo subido puede traer VARIOS
documentos juntos" (ej. un PDF con INE + póliza escaneados en el mismo
archivo), el que aplicaría es el **Splitter+Classifier**, no el Classifier
simple (que asume que cada archivo ya es UN solo documento a clasificar).

## 4. Ambigüedad declarada

- El detalle del Splitter (sección 3) se obtuvo de un resumen de búsqueda, no
  de un `WebFetch` directo a la página — antes de tomar una decisión de
  arquitectura sobre esto, vale la pena volver a verificar esa cita palabra
  por palabra contra la página cruda.
- No se investigó todavía el costo/latencia de correr un Classifier o
  Splitter+Classifier como paso adicional antes del Extractor, ni cómo se
  vería esto en el diagrama de HU-042/HU-043 que ya existe en
  `nexus_back/docs/`.

## Fuentes

- https://docs.cloud.google.com/document-ai/docs/custom-classifier
- https://docs.cloud.google.com/document-ai/docs/custom-splitter
- https://docs.cloud.google.com/document-ai/docs/processors-list
- https://docs.cloud.google.com/document-ai/docs/splitters
