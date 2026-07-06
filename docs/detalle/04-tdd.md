# Paso 4 — TDD: test primero, en vertical slices

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## El paso al 100%

El CÓMO se construye con **test primero**, un comportamiento a la vez:

```
RED   → escribes UN test que falla (un criterio de aceptación)
GREEN → el código mínimo para que pase
REFACTOR → limpias, con los tests en verde
```

*Vertical slices* (un test → una implementación → repetir), **no** horizontal
(todos los tests, después todo el código).

## Herramientas

- Skill [`tdd`](../../skills/tdd/SKILL.md) — el loop red-green-refactor y qué es un
  buen test.

## Qué firma el humano

El dev **decide qué comportamientos importa testear** (no se testea todo) y revisa
cada slice. La IA escribe el test como spec ejecutable, el dev valida.

## Antipatrones

- **Horizontal slicing** (todos los tests juntos) → tests de la *forma imaginada*, no
  del comportamiento real.
- **Testear lo interno** (mocks de colaboradores, métodos privados) → el test se rompe
  al refactorizar aunque el comportamiento no cambió. Testea por la **interfaz pública**.
- **Codear primero, testear "si queda tiempo"** → vibe coding (Art. 7).
- **Refactorizar en rojo** → primero llega a verde.
