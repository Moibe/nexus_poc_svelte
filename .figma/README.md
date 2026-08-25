# Referencias de Figma

Volcados locales del archivo de Figma, guardados a propósito.

El conector de Figma tiene **cuota mensual** (asiento de lectura). Cada
`get_metadata` de una página completa es una llamada, así que el volcado se
guarda aquí y las búsquedas posteriores se hacen contra el archivo local en vez
de gastar otra.

| Archivo | Qué es |
|---|---|
| `page-905-23164.metadata.txt` | Página "Sprint 3" completa: IDs, nombres, posiciones y tamaños de cada nodo. Sirve para localizar frames sin llamar a Figma. |
| `hu001-106-pipeline.png` | Frame `905:50130` — el Home DESPUÉS de correr el pipeline: bandeja vacía, documentos en el tercer panel. |
| `detalle-documento.png` | Frame `905:49554` — modal "Detalle de documento" (HU032, evaluar calidad del OCR). |

Los frames del flujo de pipeline viven en la sección `925:50550`
("HU032 | Evaluar calidad del OCR"):

- `905:49776` — HU001 | 105, el Home con la bandeja poblada (el "antes")
- `905:50130` — HU001 | 106, el "después"
- `905:49554` — el modal de detalle

Para leer el volcado sin abrirlo entero, filtrar por indentación: las secciones
van a 2 espacios y sus frames directos a 4.
