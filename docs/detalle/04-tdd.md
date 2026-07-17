# Paso 4 — Implementación: el agente construye con TDD (`/opsx:apply`)

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## En qué consiste en detalle

El CÓMO **lo implementa el agente** con `/opsx:apply`: aplica las tareas que salieron de
`opsx:propose`, escribiendo **test primero**, un comportamiento a la vez:

```
RED   → el agente escribe UN test que falla (un criterio de aceptación)
GREEN → el código mínimo para que pase
REFACTOR → limpia, con los tests en verde
```

*Vertical slices* (un test → una implementación → repetir), **no** horizontal
(todos los tests, después todo el código). Se verifica por la **interfaz pública**.

## Herramientas

- **`/opsx:apply`** — el paso donde el agente implementa las tareas del change.
- Skill [`tdd`](../../skills/tdd/SKILL.md) — la disciplina que `/opsx:apply` sigue: el
  loop red-green-refactor y qué es un buen test.

## Qué firma el humano

El agente escribe el test y el código; el **dev decide qué comportamientos importa
testear** (no se testea todo), valida cada slice, y **es responsable del resultado — no
la IA** ([Art. 7](../MANIFIESTO.md#art-7)). Ese es el antídoto del vibe coding: la
revisión minuciosa de lo que produjo el agente (paso 6, code review propio).

## Antipatrones

- **Aceptar lo que sale sin revisarlo** → vibe coding con otra cara. El agente propone;
  el dev responde por el código.
- **Horizontal slicing** (todos los tests juntos) → tests de la *forma imaginada*, no
  del comportamiento real.
- **Testear lo interno** (mocks de colaboradores, métodos privados) → el test se rompe
  al refactorizar aunque el comportamiento no cambió. Testea por la **interfaz pública**.
- **Codear primero, testear "si queda tiempo"** → vibe coding ([Art. 7](../MANIFIESTO.md#art-7)).
- **Refactorizar en rojo** → primero llega a verde.
