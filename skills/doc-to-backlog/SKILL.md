---
name: doc-to-backlog
description: "Toma un documento de análisis (PDF, Word, o un archivo en Drive/SharePoint/ClickUp vía MCP) y produce un BACKLOG CANDIDATO — un mapa de épicas y User Stories propuestas — para que el funcional lo priorice y lo valide. NO emite US ni épicas finales: extrae candidatos marcados \"sin validar\" y hace handoff de cada sobreviviente a grill-epic / grill-user-story (modo refinar). Es la puerta de entrada del caso \"llegué con un documento y quiero sacar el backlog\". Invocar como /doc-to-backlog con el path o el link del documento. Usar antes de grill-epic / grill-user-story cuando el input es un doc grande."
---

# doc-to-backlog

Convierte un **documento de análisis** en un **backlog candidato** (épicas + US), para
arrancar el trabajo funcional cuando el input no es una idea suelta sino un PDF/Word con
todo el proyecto adentro.

Llena [templates/backlog-candidato.md](templates/backlog-candidato.md) — es la única
fuente de verdad de la forma del mapa. Nunca lo reescribas inline.

## El principio que NO se negocia

**El documento SIEMBRA el grilling, no lo reemplaza.** Un doc tienta a "genera 40 US de
una" — eso es vibe coding de requerimientos: salen US que nadie validó, de features que
quizás nadie necesita. Por eso esta skill **no publica nada final**: produce **candidatos**,
el humano prioriza, y recién ahí cada ítem pasa por su grill ([Art. 4](../../docs/MANIFIESTO.md#art-4) y Art. 5).

## Input

- **El documento:** path a un PDF/Word local, o un link a Drive/SharePoint/ClickUp
  (traelo por **MCP** si está conectado). Claude lee PDFs de forma nativa.
- Si no viene, pedirlo.

## Proceso — 3 fases

### ① Extraer (la IA lee)

1. Leer el documento entero.
2. Armar el **mapa de candidatos**: las **épicas** que el doc sugiere, y bajo cada una,
   las **US candidatas**. Cada ítem con un título corto y una línea de qué cubre.
3. **Anotar la procedencia:** de qué sección/página del doc salió cada candidato (para
   poder trazar de vuelta al análisis).
4. Marcar TODO como **`sin validar`**. Es una hipótesis, no un backlog final.

### ② Triage (el humano decide)

5. Presentar el mapa y **frenar**: el doc es un **menú, no un mandato**. Pedir al
   funcional que **priorice y corte** — qué entra, qué queda para después, qué se
   descarta. No todo lo que está en el doc hay que construirlo.
6. Para lo dudoso, sugerir pasar por `/grill-intent` (Gate 0): ¿este ítem resuelve un
   problema real, o está en el doc "por las dudas"?

### ③ Routear (cada sobreviviente a su grill)

7. **No grillar todo de golpe.** Empezar por la **rebanada priorizada** (las 1–3 épicas o
   US más importantes), no las 40 (Art. 14).
8. Handoff, en modo **refinar** (el doc pre-llena, el grill cubre solo los huecos):
   - épica candidata → `/grill-epic` (con el fragmento del doc como fuente)
   - US candidata (suelta) → `/grill-user-story`
9. Recién en ese paso se publica en el tracker, testeable y linkeable (`dai link-us`).

## Dos cortes duros

1. **No emitir US/épicas finales desde el doc.** Solo candidatos. Lo final sale del grill,
   con el humano respondiendo. Si te descubres "completando" criterios que el doc no dice,
   detente: eso lo define el funcional en el grill.
2. **No ahogar.** Un doc de 60 páginas puede sugerir 50 ítems. Prioriza y entrega la
   rebanada de arriba; el resto queda en el mapa candidato, listo para más tarde.

## Relación con el modelo

- **Es la puerta de entrada** del caso bulk. Reemplaza "idea suelta" por "doc" como fuente.
- **Abajo:** `grill-epic` (épicas) y `grill-user-story` (US) toman cada candidato y lo
  vuelven artefacto válido. `grill-intent` desafía el problema de los dudosos.
- **No toca el link:** el `implements.yaml` y el `ac_hash` viven a nivel US, mucho después
  (`dai link-us`). Esta skill solo prepara el QUÉ.
