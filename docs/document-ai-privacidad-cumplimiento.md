# Document AI: privacidad, uso de datos y cumplimiento regulatorio

Investigación hecha el **2026-09-03** en respuesta a una duda de negocio antes de
conectar el tagging de "Ejemplo documental" (few-shot/fine-tuning) con la API
real de Google Cloud Document AI: ¿la información de INEs/IDs y pólizas viaja
"tal cual" a Google?, ¿qué dice su política de privacidad?, ¿qué scopes/reglas
aplican?, ¿esto nos mantiene dentro de las normas que se le exigen a Grupo CSI
como empresa?

Este documento separa dos cosas a propósito, y esa separación es la razón de
ser del documento:

- **Hechos del lado de Google** — verificables, citados con URL oficial
  (`cloud.google.com` / `docs.cloud.google.com` únicamente), con un nivel de
  confianza explícito.
- **La determinación de cumplimiento de Grupo CSI** — si estos hechos
  satisfacen la LFPDPPP, el aviso de privacidad de CSI, o las reglas
  sectoriales de CNSF/CNBV, es una decisión legal/de cumplimiento que le toca
  al equipo de CSI, no algo que este documento (ni Claude) pueda certificar.

No es una recomendación de "sí adelante" ni de "no lo hagan" — es el inventario
de hechos sobre el que esa decisión se debe tomar.

---

## 1. ¿Los datos viajan "tal cual"? — Residencia y procesamiento regional

**No existe región de Document AI en México ni en Latinoamérica.** Las
ubicaciones soportadas (`docs.cloud.google.com/document-ai/docs/regions`) son:

- Multi-región: `us` (Estados Unidos), `eu` (Unión Europea)
- Región única (acceso limitado, requiere solicitud): Mumbai, Singapur,
  Sídney, Londres, Fráncfort, **Montreal** (la más cercana a México)

Cualquier INE o póliza procesada con Document AI sale de México, como mínimo
hacia EE. UU. o la UE. Existe una región general de Google Cloud en Querétaro
(`northamerica-south1`, desde diciembre 2024), pero **no hay evidencia de que
Document AI esté disponible ahí** — son cosas distintas y fáciles de confundir.
_Confianza: alta._

**Hallazgo más importante para el procesador "ine" que ya existe**: las
release notes oficiales de Document AI (enero 2026,
`docs.cloud.google.com/document-ai/docs/release-notes`) dicen textualmente,
para las versiones de procesador que usan el foundation model de Gemini
("Custom Extractor with GenAI" — el tipo del procesador "ine" actual, según lo
confirmado en sesiones anteriores: sus 10 versiones son `googleManaged: true`,
zero-shot, nunca entrenadas):

> "This processor version uses the Vertex AI Gemini global endpoint and is
> not compliant with Data Residency (DMZ) standards."

Es decir: aunque el procesador esté configurado como `us`, este tipo
específico de procesador puede enrutar la solicitud globalmente de todos
modos. La garantía general de residencia (ver más abajo) **no aplica** a este
tipo de procesador. _Confianza: alta — cita directa y vigente (enero 2026)._

Garantía general (para procesadores que sí la respetan): los Service Specific
Terms de GCP (`cloud.google.com/terms/service-terms`, sección "AI/ML Data
Location", lista completa en `cloud.google.com/terms/data-residency`)
comprometen que, para los servicios de AI/ML listados ahí, Google almacena
**y procesa** los datos únicamente en la multi-región configurada — no solo el
endpoint de la API vive ahí. _Confianza: media-alta (no se pudo extraer la
tabla completa verbatim, solo fragmentos indexados consistentes en dos
búsquedas independientes)._

**Acción sugerida**: confirmar con el equipo técnico qué tipo exacto de
procesador Document AI usan hoy para el INE (clásico OCR/Form Parser vs.
GenAI/Gemini) — de eso depende si la excepción de residencia aplica.

## 2. Entrenamiento — ¿Google usa los documentos para mejorar sus modelos generales?

**No**, y Document AI tiene su propia página de seguridad dedicada (no
depende de "heredar" el compromiso de Vertex AI/Gemini, que es una promesa
distinta y separada):

> "Google does not use any of your content (such as documents and
> predictions) for any purpose except to provide you with the Document AI
> service." / "we never use customer data to train our Document AI models."
> — `docs.cloud.google.com/document-ai/docs/security`

Respaldado contractualmente por la cláusula **"Training Restriction"** de los
Service Specific Terms de GCP: Google no entrena ni ajusta ningún modelo con
Customer Data sin instrucción previa del cliente. Esta cláusula cubre toda la
plataforma (Customer Data en general), no solo productos de IA generativa.
_Confianza: alta en la sustancia; media en el número exacto de sección del
contrato — no se pudo extraer el texto completo de esa sección en esta
investigación, solo confirmarlo vía fragmentos indexados que citan el texto
verbatim._

**Llamada síncrona `:process`** (la que usa la integración actual del
proyecto): el documento se procesa **en memoria**, cifrado en tránsito, y
**no se persiste a disco**. No hay retención. _Confianza: alta, cita directa._

## 3. El caso pendiente de construir — Dataset / few-shot / fine-tuning

Este es el mecanismo que se planeaba conectar (`dataset.importDocuments` +
`TrainProcessorVersion`) y donde queda la laguna documental más relevante:

- **No existe una frase oficial única** que garantice que el modelo resultante
  del fine-tuning de un cliente es exclusivo de su proyecto y nunca se mezcla
  con modelos compartidos de Google. La conclusión de que sí es exclusivo se
  sostiene por inferencia razonable (la misma promesa general de "no
  entrenamos con tu contenido" + la cláusula de Training Restriction + el
  diseño del Dataset como recurso del propio proyecto del cliente) pero
  **no por una cita textual dedicada**. _Confianza: media._
  - **Recomendación concreta**: dado que serían INEs (datos de identidad),
    pedir esta confirmación **por escrito** al equipo de cuenta de Google
    Cloud antes de subir cualquier documento real al Dataset, en vez de
    apoyarse solo en la documentación pública.
- **Retención de los documentos del Dataset**: hay una posible contradicción
  sin resolver en la documentación oficial. El Dataset está diseñado para
  persistir hasta que el cliente lo borre manualmente
  (`dataset.batchDeleteDocuments`), pero otra página
  (`docs.cloud.google.com/document-ai/docs/training-overview`) dice que
  "training data saved in Cloud Storage expire after a two-day retention
  period" sin aclarar si eso aplica a los documentos del Dataset mismo o solo
  a artefactos temporales de una corrida de entrenamiento específica. No se
  resolvió por inferencia — es zona gris real que conviene verificar con
  Google o de forma empírica (entrenar, esperar 2+ días, confirmar si los
  documentos siguen listables vía API). _Confianza: media, ambigüedad
  señalada explícitamente._
- **Human-in-the-Loop** (revisión humana de documentos) está **deprecado
  desde el 16 de enero de 2024** — probablemente no sea un vector de riesgo
  activo para un proyecto nuevo como este, aunque no se confirmó con cita
  textual quién exactamente queda en el pool de revisores para procesadores
  antiguos que ya lo tuvieran habilitado. _Confianza: alta en que está
  deprecado; baja en el detalle operativo de HITL en sí._
- No quedó claro si el Custom Extractor con foundation model (el tipo de
  "ine") está formalmente clasificado como "Generative AI Service" bajo la
  Generative AI Prohibited Use Policy de GCP, o si sigue bajo los términos
  propios (más simples) de Document AI — no encontrado explícitamente en
  ninguna de las dos investigaciones. _Confianza: baja._

## 4. Certificaciones de cumplimiento y cifrado

- Document AI aparece **nombrado explícitamente** (no como "Google Cloud en
  general") en la tabla oficial de servicios cubiertos por: **ISO 27001,
  27017, 27018, SOC 1, SOC 2, SOC 3, PCI DSS**, y Penetration Testing Report.
  (`cloud.google.com/security/compliance/services-in-scope`) _Confianza: alta._
- Document AI (y Document AI Warehouse) está cubierto **explícitamente por el
  BAA de HIPAA** (`cloud.google.com/terms/hipaa-baa`, listado nombrado en
  "Covered Products"). _Confianza: alta._
- **ISO 27701** (privacidad/PII processor) existe a nivel de toda la
  plataforma, pero no se encontró confirmación producto-por-producto para
  Document AI específicamente. _Confianza: baja para el nivel de producto._
- Cifrado en **tránsito** (TLS) y **en reposo por default** (llaves
  administradas por Google), ambos confirmados. _Confianza: alta._
- **CMEK** (llave propia del cliente vía Cloud KMS) disponible específicamente
  para Document AI (`docs.cloud.google.com/document-ai/docs/cmek`), con dos
  matices importantes:
  - Una vez creado un procesador, **no se puede cambiar** su configuración de
    cifrado (CMEK vs. llave de Google) — es una decisión permanente por
    procesador.
  - El procesamiento **batch** usa una llave efímera durante el paso
    transitorio en disco, no la CMEK directamente en ese momento.
  - La llave de KMS debe estar en la **misma ubicación** que el procesador.

## 5. Transferencias internacionales y LFPDPPP — lo más relevante para CSI como empresa mexicana

- El DPA de Google Cloud (`cloud.google.com/terms/data-processing-addendum`,
  sección 4.1 "Roles of the Parties") confirma textualmente:

  > "Google is a processor and Customer is a controller or processor, as
  > applicable, of Customer Personal Data."

  Esto equivale conceptualmente al "encargado del tratamiento" de la LFPDPPP
  (Art. 3), pero el DPA está redactado en terminología derivada de GDPR y
  **no cita la ley mexicana en ningún momento**. _Confianza: alta en la cita;
  la equivalencia legal exacta con la LFPDPPP no está confirmada por Google,
  es una lectura conceptual._

- Google **sí** construye mecanismos de transferencia país-específicos cuando
  el marco regulatorio lo amerita — ya lo hizo para **Brasil**
  (`cloud.google.com/sccs/br-c2p`, cláusulas contractuales aprobadas por la
  ANPD para la LGPD). **Para México no existe nada equivalente**: ni SCC ni
  apéndice dedicado. El Apéndice 3 del DPA ("Specific Privacy Laws") cubre
  UE, Reino Unido, Suiza, California/CCPA, Turquía e Israel — **México no
  aparece**. _Confianza: media — el fetch directo del Apéndice 3 se truncó
  varias veces; la ausencia se basa en fragmentos indexados, no en lectura
  línea por línea del documento completo. Recomendación: que legal de CSI
  descargue el DPA completo en PDF y confirme directamente._

- **Sí existe documentación sectorial específica de México**, directamente
  relevante porque CSI procesa pólizas de seguro:
  - `cloud.google.com/security/compliance/cnsf-mexico` — mapeo de
    cumplimiento entre los requisitos de la CNSF (Comisión Nacional de
    Seguros y Fianzas) / LISF / CUSF para outsourcing de TI en aseguradoras y
    los productos/contratos de Google.
  - `cloud.google.com/security/compliance/cnbv-mexico` — análoga para la CNBV
    (regulador bancario/valores); menciona que la región de Querétaro ayuda a
    cumplir el marco contractual de la CNBV manteniendo residencia local de
    datos — **pero eso es de la plataforma en general, no confirmado para
    Document AI**, que no tiene región en México (ver sección 1).
  - Ninguna de las dos páginas se pudo leer verbatim completo (la herramienta
    de extracción las truncó); el contenido citado viene de resúmenes de
    búsqueda, no de lectura directa. _Confianza: media en el contenido citado,
    alta en que las páginas existen con esas URLs. Recomendación: que legal de
    CSI las abra directamente en el navegador — parecen el recurso más
    directamente aplicable a su giro (seguros) de todo lo encontrado._

**Conclusión honesta**: el marco de transferencias internacionales de Google
Cloud es, en su núcleo contractual, genérico/global — el mismo DPA aplica a
todos los países salvo que exista un apéndice específico. México/LFPDPPP no
tiene uno documentado públicamente, a diferencia de Brasil. Lo que sí existe
es un mapeo regulatorio sectorial (CNSF/CNBV) que responde una pregunta
relacionada pero distinta ("cómo cumplir con outsourcing de TI regulado"), no
directamente la de "mecanismo de transferencia internacional de datos
personales".

## 6. Qué es un hecho de Google y qué le toca decidir a CSI

Lo de arriba son hechos del lado de Google, verificables y citados. Lo que
**no** se puede responder solo con documentación pública de Google:

- Si esto satisface lo que exige la LFPDPPP y su Reglamento para transferir
  datos personales (incluyendo datos de identificación oficial) fuera de
  México sin consentimiento adicional del titular.
- Si el aviso de privacidad de CSI ya contempla o necesita mencionar esta
  transferencia a EE. UU./UE.
- Si el mapeo de cumplimiento de CNSF es suficiente para el tipo de dato que
  CSI maneja específicamente (identidad + pólizas), y si el DPA de Google está
  formalmente ejecutado por CSI.
- Si la excepción de residencia de los procesadores GenAI/Gemini (sección 1)
  cambia el análisis de riesgo para el procesador "ine" en particular.

Esas cuatro son determinaciones legales/de cumplimiento del equipo de CSI, no
algo que este documento certifique.

## Recomendaciones concretas, en orden

1. Confirmar qué tipo exacto de procesador Document AI usa hoy el flujo del
   INE (clásico vs. GenAI/Gemini) — condiciona si aplica la excepción de
   residencia de la sección 1.
2. Que el equipo legal de CSI lea completo el Apéndice 3 del DPA (PDF
   descargable) y las páginas `cnsf-mexico` / `cnbv-mexico` directamente.
3. Antes de subir cualquier INE real al Dataset de few-shot: pedir
   confirmación por escrito a Google (vía el equipo de cuenta) de que el
   modelo fine-tuneado resultante es exclusivo del proyecto de CSI.
4. Con esas tres respuestas, decidir si se retoma la integración programática
   del tagging de "Ejemplo documental" hacia Document AI, y qué disparará el
   envío real (esto último sigue pendiente de definición explícita del
   usuario, según lo acordado: el switch "Ejemplo documental" hoy solo marca
   "estoy listo" localmente, sin ningún envío detrás).

## Fuentes citadas

Todas `cloud.google.com` / `docs.cloud.google.com`:

- `docs.cloud.google.com/document-ai/docs/security`
- `docs.cloud.google.com/document-ai/docs/regions`
- `docs.cloud.google.com/document-ai/docs/release-notes`
- `docs.cloud.google.com/document-ai/docs/cmek`
- `docs.cloud.google.com/document-ai/docs/create-dataset`
- `docs.cloud.google.com/document-ai/docs/training-overview`
- `docs.cloud.google.com/document-ai/docs/ce-with-genai`
- `docs.cloud.google.com/document-ai/docs/reference/rest/v1beta3/projects.locations.processors.dataset/importDocuments`
- `docs.cloud.google.com/gemini/docs/discover/data-governance`
- `cloud.google.com/blog/products/ai-machine-learning/google-cloud-unveils-ai-and-ml-privacy-commitment`
- `cloud.google.com/terms/service-terms`
- `cloud.google.com/terms/data-residency`
- `cloud.google.com/terms/data-processing-addendum`
- `cloud.google.com/terms/hipaa-baa`
- `cloud.google.com/security/compliance/services-in-scope`
- `cloud.google.com/security/compliance/hipaa`
- `cloud.google.com/security/compliance/iso-27701`
- `cloud.google.com/security/compliance/eu-scc`
- `cloud.google.com/sccs/br-c2p`
- `cloud.google.com/security/compliance/cnsf-mexico`
- `cloud.google.com/security/compliance/cnbv-mexico`
