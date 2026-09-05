# Document AI: flujo real de etiquetado, entrenamiento y despliegue

Investigación hecha el **2026-09-05** en respuesta a una duda de negocio: en la
consola real de Google Cloud Document AI, cuando subo un documento y hago
recortes/anotaciones manuales, ¿eso se guarda solo o hay que apretar algún
botón?, y una vez etiquetado, ¿el modelo aprende solo o hace falta otra acción?
Sirve como analogía directa para decidir a qué botón(es) de NexusDoc AI debe
mapearse cada paso real de Google, antes de conectar nada de verdad.

Mismo criterio que en
[`document-ai-privacidad-cumplimiento.md`](document-ai-privacidad-cumplimiento.md):
solo hechos verificables citados con URL oficial (`cloud.google.com` /
`docs.cloud.google.com`), con nivel de confianza explícito y las ambigüedades
declaradas en vez de asumidas.

---

## Resumen: son tres acciones explícitas separadas, ninguna automática

| Paso real de Google | Acción que lo dispara | ¿Automático? |
|---|---|---|
| 1. Etiquetar un documento | Botón **"Mark as Labeled"** | No |
| 2. Entrenar una versión | **"Train new version" → "Start training"** (o "Create new version" en GenAI) | No, y tarda horas |
| 3. Desplegar la versión entrenada | Checkbox de **Deploy** + (opcional) elegir **Default version** | No |

Ninguno de los tres ocurre como efecto secundario del anterior. Es una cadena
de decisiones manuales de principio a fin.

---

## 1. Etiquetar (≈ nuestros "recortes") no se guarda solo

El paso explícito para completar el etiquetado de un documento es un botón
"Mark as Labeled" — dibujar el cuadro delimitador por sí solo no basta:

> *"Select Mark as Labeled when you have finished annotating the document."*
> — [docs.cloud.google.com/document-ai/docs/custom-classifier](https://docs.cloud.google.com/document-ai/docs/custom-classifier)
> _Confianza: alta_

Esto aplica también a documentos auto-etiquetados por una versión previa del
procesador (zero-shot) o con "suggested labels": cada etiqueta sugerida se
confirma individual con un clic en una marca de verificación, y el documento
completo sigue sin poder usarse para entrenar/probar hasta el "Mark as
Labeled":

> *"To use the suggested labels, hold the pointer over each label in the side
> panel, and select the check mark to confirm the label is correct."*
> — [.../ce-mechanisms](https://docs.cloud.google.com/document-ai/docs/ce-mechanisms) — _alta_

> *"You can't train or up-train on auto-labeled documents, or use them in the
> test set, without marking them as labeled."*
> — [.../label-documents](https://docs.cloud.google.com/document-ai/docs/label-documents) — _alta_

Después de ese clic, el cambio se refleja en el panel de gestión del dataset
(contador de documentos etiquetados):

> *"On the Manage Dataset tab, the Document panel shows that one document has
> been labeled."* — mismo dominio, `/custom-classifier` — _alta_

**Ambigüedades declaradas** (no hay cita oficial que las resuelva):
- Qué pasa si cierras la pestaña o navegas a otro documento **sin** dar "Mark
  as Labeled" — no se confirma si el trazo se pierde o queda guardado pero sin
  confirmar.
- Si el propio trazo del cuadro se persiste en el backend al dibujarlo
  (autoguardado por anotación), o si solo vive en el estado de la sesión del
  navegador hasta esa acción explícita.

---

## 2. Entrenar es una acción totalmente aparte — y tarda horas

Etiquetar el 100% del dataset no dispara entrenamiento. Siempre hace falta una
acción explícita adicional:

> *"On the Train tab, click View Label Stats and verify your test and training
> set. [...] Click Train new version. [...] Click Start training and wait for
> your new processor version to be trained and evaluated."*
> — [.../training-overview](https://docs.cloud.google.com/document-ai/docs/training-overview) — _alta_

Para el flujo de Custom Extractor con GenAI (el recomendado por Google), el
paso equivalente es: pestaña **Build** → **Create new version** dentro del
cuadro "Fine-tuning":

> *"Select the Build, then Create new version. Enter a name and select
> Create."* — [.../ce-with-genai](https://docs.cloud.google.com/document-ai/docs/ce-with-genai) — _alta_

Esa misma página distingue explícitamente "Fine-tuning" (ajustar un modelo
foundation, recomendado) de "Train a custom model" (modelo convencional
no-GenAI) — ambas son opciones que el usuario elige al entrenar, ninguna
ocurre sola. El usuario puede dejar los parámetros por default o ajustar
"Training steps" (100–400) y "Learning rate multiplier" (0.1–10) — pero ojo:
esos rangos están confirmados **del lado de la API** (`TrainProcessorVersion`,
campo `foundationModelTuningOptions`), no como una afirmación de que un campo
específico de alguna UI mapee 1:1 a ellos.

Y esto no es cuestión de segundos ni minutos:

> *"Each fine-tuning may take hours to complete (depending on system load, not
> fine-tuning job size) and will time out at 72 hours."*
> — [.../ce-with-genai](https://docs.cloud.google.com/document-ai/docs/ce-with-genai) — _alta_

> *"To reduce development cycle friction, schedule fine-tuning jobs to account
> for this time. For example, at end of day Friday or staggered days for
> different processors."* — misma página — _alta_

**Ambigüedad declarada:** ese rango de "horas, timeout a 72h" está confirmado
para el camino GenAI/fine-tuning. La documentación del modelo custom clásico
(no-GenAI) no da ningún número concreto, solo dice "espera a que termine".

---

## 3. Desplegar — el paso que faltaba en la investigación anterior

Una versión recién entrenada **no queda usable de inmediato** solo por
existir:

> *"After creating a new processor version with Document AI, you will need to
> deploy it before you can process documents with this version."*
> — [.../manage-processor-versions](https://docs.cloud.google.com/document-ai/docs/manage-processor-versions) — _alta_

La API define un enum `State` explícito para esto (`STATE_UNSPECIFIED`,
`DEPLOYED`, `DEPLOYING`, `UNDEPLOYED`, `UNDEPLOYING`, `CREATING`, `DELETING`,
`FAILED`, `IMPORTING`). Una versión nace `UNDEPLOYED`:

> *"UNDEPLOYED | The processor version is not deployed and cannot be used for
> processing."*
> — [referencia REST de ProcessorVersion](https://docs.cloud.google.com/document-ai/docs/reference/rest/v1/projects.locations.processors.processorVersions#ProcessorVersion) — _alta_

Para desplegarla, en la consola hay que marcar un checkbox en la pestaña
"Manage Versions" (o "Deploy & use"):

> *"In the processor's Manage Versions (or Deploy & use) tab, select the
> checkbox next to the processor version you want to deploy."*
> — `/manage-processor-versions` — _alta_

Y aparte existe el concepto de **versión default** (la que se usa cuando una
llamada a `process()` no especifica versión) — promoverla a default es
también una acción explícita, no automática:

> *"A processor's default version specifies the version that is used to
> process documents when you don't specify a specific version."* — _alta_

> *"In the processor's Manage Versions (or Deploy & use) tab, in the Default
> version dropdown menu, choose a version of the processor that you want to
> use as the default version."* — _alta_

Hay una restricción notable: no se puede cambiar el estado de despliegue de
versiones pretrained ni de la que ya es la default actual:

> *"You cannot change the deployment status for pretrained processor versions
> or the current default version."* — _alta_

**Ambigüedades declaradas:**
- No se confirmó con cita textual si la consola muestra las etiquetas
  literales "Deployed"/"Undeployed" como badge visible al usuario — esas
  etiquetas solo están confirmadas del lado de la referencia REST de la API,
  no de una descripción de la interfaz misma.
- No hay una oración en prosa que diga "la versión default se asigna
  automáticamente a la pretrained inicial al crear un processor nuevo" — solo
  se infiere indirectamente de un ejemplo de respuesta JSON, no es una
  afirmación normativa de la documentación.

---

## La analogía con NexusDoc AI (estado actual, nada construido todavía)

| Paso real de Google | Dónde estaría en NexusDoc AI hoy |
|---|---|
| Dibujar bounding box | Hacer un recorte en el modal de calibración |
| **Mark as Labeled** (explícito, por documento) | No existe — el recorte se guarda al cerrar el modal, pero no hay un "este documento ya quedó listo" |
| **Train new version → Start training** (explícito, horas) | El switch "Ejemplo documental" + el modal de recomendación — hoy solo cambian una bandera local (`ejemploDocumental`), sin disparar nada real |
| **Deploy → Default version** (explícito, tras entrenar) | No existe ni el concepto todavía en la UI |

Es decir: hoy la app tiene, a lo mucho, el equivalente visual del paso 2 (sin
conexión real), y los pasos 1 y 3 —marcar un documento como listo para
entrenar, y desplegar/promover una versión ya entrenada— ni siquiera tienen
representación en la interfaz. Esto es consistente con lo que ya se dejó
explícitamente pendiente: el disparo real hacia Document AI del switch
"Ejemplo documental" sigue sin definirse ("yo más tarde te diré que lo
provocará"). Esta investigación es solo la referencia de cómo se ve el
original de Google, para cuando se decida a qué botón(es) de la app mapear
cada uno de los tres pasos.

## Fuentes

- https://docs.cloud.google.com/document-ai/docs/custom-classifier
- https://docs.cloud.google.com/document-ai/docs/label-documents
- https://docs.cloud.google.com/document-ai/docs/ce-mechanisms
- https://docs.cloud.google.com/document-ai/docs/training-overview
- https://docs.cloud.google.com/document-ai/docs/ce-with-genai
- https://docs.cloud.google.com/document-ai/docs/manage-processor-versions
- https://docs.cloud.google.com/document-ai/docs/reference/rest/v1/projects.locations.processors.processorVersions/train
- https://docs.cloud.google.com/document-ai/docs/reference/rest/v1/projects.locations.processors.processorVersions#ProcessorVersion
