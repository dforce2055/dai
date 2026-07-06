<!--
  FORMATO DE ÉPICA · dai
  ─────────────────────────────────────────────────────────────────
  Una épica es un bloque grande de valor de negocio que se parte en
  varias User Stories. Es funcional y de alto nivel: define el ALCANCE,
  no el detalle ni el CÓMO.

  La épica NO se implementa directamente: agrupa. Las US que la componen
  son las que viajan por el flujo (grill-intent → grill-user-story → ...).
  El link QUÉ↔CÓMO vive a nivel US, no de épica.
-->

# 🔗 Metadata

| Campo | Valor |
|-------|-------|
| **ID** | `ABC-###` (épica en el gestor) |
| **Autor** | quién la definió |
| **Estado** | `abierta` \| `en curso` \| `cerrada` |
| **US que la componen** | `ABC-###`, `ABC-###` … _(se completa a medida que se parten)_ |

---

# <Título de la épica>

Orientado a la capacidad de negocio grande. Una frase.

## Objetivo de negocio

Qué resultado de negocio persigue esta épica. Por qué importa ahora. 2–4 líneas.

## Alcance

Qué entra y qué **no** entra en esta épica. El límite grueso que después las US
respetan.

- **Dentro** — <capacidades que sí cubre>
- **Fuera** — <lo que explícitamente queda para otra épica>

## User Stories (partición)

Lista viva de las US en las que se parte. Cada una es independiente y cabe en un
sprint (INVEST). No es el detalle: es el índice.

- [ ] `ABC-###` — <título corto de la US>
- [ ] `ABC-###` — <título corto de la US>

## Métricas de éxito

Cómo sabremos que la épica agregó valor (indicadores de negocio, no de construcción).

- <métrica observable>

## Dependencias y riesgos

- <otra épica / sistema / decisión que tiene que existir antes o en paralelo>

<!--
  REGLA: si una "US" no cabe en un sprint, probablemente sea una épica y haya que
  partirla. Si una "épica" no se puede partir en US independientes, probablemente
  sea una sola US grande. El corte es el sprint.
-->
