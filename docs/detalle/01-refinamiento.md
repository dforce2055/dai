# Paso 1 — Refinamiento: de la idea vaga a la US testeable

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## El paso al 100%

El PO llega con una idea (a veces un ticket de una línea). Antes de escribir specs,
la IA hace dos cosas, en orden:

1. **Gate 0** (`grill-intent`) — desafía el *problema*, no la solución. Veredicto:
   `a-spec` (seguir), `reframe` (el problema real es otro) o `descartar` (no vale la
   pena ahora). Un "no lo construyas" es un éxito del gate, no una falla.
2. **Pulido** (`grill-user-story`) — interroga hasta que la US es **testeable por
   construcción** (INVEST + Gherkin) y la publica en el tracker.

## Herramientas

- `/grill-intent` → `openspec/intents/<fecha-slug>/intent.md`
- `/grill-user-story` → US en formato [`formato-us.md`](../../templates/formato-us.md),
  publicada en Jira/ClickUp (o `.md` de fallback).
- Gate de entrada: [`definition-of-ready.md`](../../templates/definition-of-ready.md).

## Qué firma el humano

El PO **responde y decide**. La IA no inventa requerimientos: los saca a preguntas
([Art. 4](../MANIFIESTO.md#art-4)). El PO es dueño del contenido funcional.

## Antipatrones

- **US vaga** ("como usuario quiero un botón") → no pasa el pulido.
- **Criterio no testeable** ("buena experiencia") → se rechaza (Art. 3).
- **Solución prefijada** en la US (endpoints, tablas) → eso es CÓMO, va después (Art. 1).
- **Saltearse el Gate 0** → se construye lo que no había que construir.
