# Paso 5 — Smoke: el flujo entero, verde

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## En qué consiste en detalle

Antes de cerrar la US, se corre un **smoke end-to-end**: ejercita el flujo completo
—happy path + los guards principales— para confirmar que no se rompió nada grueso.
No reemplaza a los tests unitarios (paso 4); los complementa a nivel sistema.

```
✓ happy path → resultado esperado
✓ guard 1 → rechazado como corresponde
✓ guard 2 → rechazado como corresponde
SMOKE OK
```

## Herramientas

- Skills de smoke por dominio (p. ej. `smoke-<módulo>`), armadas por el equipo.

## Qué firma el humano

El dev **confirma que el escenario refleja el uso real**. Un smoke que no toca el
flujo que importa da falsa confianza.

## Antipatrones

- **Smoke manual** que se olvida o se saltea bajo presión → automatizarlo (idealmente
  en el pipeline, ver retro).
- **Smoke que no ejercita los guards** → pasa en verde y esconde el bug.
- **Confundir smoke con suite completa** → el smoke es grueso y rápido, a propósito.
