# Paso 1 — Refinamiento: de la idea vaga a la US testeable

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## En qué consiste en detalle

El PO llega con una idea (a veces un ticket de una línea). Antes de escribir specs,
la IA hace dos cosas, en orden:

1. **Pulido** (`grill-user-story`) — interroga hasta que la US es **testeable por
   construcción** (INVEST + Gherkin) y la publica en el tracker.
2. **Gate 0** (`grill-intent`) — con la US ya formada, desafía el *problema* detrás
   (no la solución). Veredicto: `a-spec` (seguir), `reframe` (el problema real es otro)
   o `descartar` (no vale la pena ahora). Un "no lo construyas" es un éxito del gate,
   no una falla.

## Cuando la US ya existe y hay que editarla

El refinamiento no termina cuando la US entra al sprint: aparece un criterio que faltaba,
o una regla que nadie había dicho. `dai edit-us <ID>` cierra ese ciclo sin copiar y pegar:
baja la US del tracker, la abre en el editor del PO, **valida el formato** (título +
criterios + Gherkin completo), muestra qué cambia, pregunta si el cambio es **material**
(sube `spec_version`, los repos atrasados se marcan solos) o **editorial** (no sube nada),
y recién con la confirmación escribe.

Si el que refina es el **dev** —un criterio que aparece escribiendo el test— es el mismo
camino por la otra puerta: `dai update-us <ID>` empuja el `us.md` del change, con el mismo
preview y la misma confirmación ([ADR-0018](../adr/0018-alcance-de-stamp-y-gate-de-ci.md)).

## Herramientas

- `/grill-user-story` → US en formato [`formato-us.md`](../../templates/formato-us.md),
  publicada en Jira/ClickUp (o `.md` de fallback).
- `/grill-intent` → `openspec/intents/<fecha-slug>/intent.md`
- `dai edit-us <ID>` → trae la US del tracker, la editas, dai valida el formato y la devuelve.
- Gate de entrada: [`definition-of-ready.md`](../../templates/definition-of-ready.md).

## Qué firma el humano

El PO **responde y decide**. La IA no inventa requerimientos: los saca a preguntas
([Art. 4](../MANIFIESTO.md#art-4)). El PO es dueño del contenido funcional.

## Antipatrones

- **US vaga** ("como usuario quiero un botón") → no pasa el pulido.
- **Criterio no testeable** ("buena experiencia") → se rechaza (Art. 3).
- **Solución prefijada** en la US (endpoints, tablas) → eso es CÓMO, va después (Art. 1).
- **Saltearse el Gate 0** → se construye lo que no había que construir.
