# ADR-0011 — `archive` es un gate de aprobación (`dai archive`)

- **Estado:** aceptado
- **Fecha:** 2026-07-10
- **Decide:** lead / arquitecto de la metodología

## Contexto

OpenSpec tiene `archive`: cuando un change está completo, **funde sus delta specs** en las
specs canónicas (`openspec/specs/<capability>/spec.md`) y **mueve el change** a
`openspec/changes/archive/`. Pero en el flujo dai (`link-us → propose → apply/tdd → check
→ pr → dai-review → merge → stamp → done`) el `archive` **no tenía lugar**: ni cuándo, ni
quién. Sin eso, las specs vivas del repo quedan desincronizadas de lo shippeado.

Dos preguntas de fondo: **¿quién lo corre?** y **¿en qué momento?**

## Decisión

### `archive` = el acto de aceptar el change en las specs canónicas → lo hace **quien aprueba la PR**

Fundir un change en las specs oficiales es **bendecir** ese cambio. Por eso lo ata a la
**aprobación**, no a la autoría: lo corre **quien aprueba la PR**, no el autor. Es un
**gate de aprobación**, no un paso de cierre del autor (un autor no debería fundir sus
propios cambios en la spec oficial de un equipo).

Ownership por **dial de ceremonia** (N1/N2/N3):

- **N1/N2 — `dai archive` (comando):** el aprobador lo corre **en la branch de la PR** al
  aprobar → funde los deltas + mueve el change + lo deja **sin commitear** para revisarlo →
  lo incluye en la PR → mergea normal. **Resuelve solo el problema de base protegida**: el
  fold viaja dentro de la PR, no hay push directo a `main`.
- **N3 — workflow de CI opt-in** (roadmap): el merge aprobado dispara el `archive` solo.

### `dai archive` es un **comando**, no una skill

Archivar es **mecánico** (detectar el change + `openspec archive <change> --yes`): sin
juicio → va al CLI, como `dai stamp`/`check`/`done` (ADR-0002). `dai-review` es skill
porque revisar código sí requiere juicio; archivar no. `dai archive` **envuelve**
`openspec archive`, detectando el change activo por su `implements.yaml` (reusa
`discoverImplements`); si hay varios, pide el nombre.

### `dai check` y `dai ls` saltean `openspec/changes/archive/`

Un change archivado está **shippeado**: no debe aparecer en `check` (daría un ⚠️ de drift
falso si el PO edita esa US después) ni en `ls`. `discoverImplements` acepta
`includeArchived` (default `true`); `check`/`ls` lo pasan en `false`. **`dai stamp`/`done`/
`archive` mantienen el default** — sí necesitan encontrar el `implements.yaml` (p. ej.
`stamp` post-merge, cuando el change ya se archivó en la branch).

## Consecuencias

- ✅ El `archive` queda **atado a la aprobación** — las specs canónicas reflejan solo lo bendecido.
- ✅ La variante `dai archive` (N1/N2) **elude la base protegida** sin tokens ni CI: el fold entra por la PR.
- ✅ `check`/`ls` dejan de reportar ruido de changes shippeados.
- ✅ Coherente con el ADN: es una **herramienta opcional** (no obliga), mecánica → CLI.
- ⚠️ Edge: en PRs desde **fork**, el aprobador puede no tener push a la branch del autor →
  ahí cae al workflow de CI, o lo corre el autor.
- ⚠️ El **nudge** (que `/dai-review` recuerde archivar al aprobar) y el **workflow de CI**
  quedan como follow-up (roadmap), igual que documentar el paso en `SCRUM-CON-IA`.

## Alternativas consideradas

- **Que lo corra el autor, en el PR** — descartado: fundir en la spec oficial es un acto de
  aprobación; el autor no debería bendecir su propio cambio. Va atado a quien aprueba.
- **Post-merge sobre la base (commit directo)** — descartado como default: choca con branch
  protection (push directo a `main`). Queda para el workflow de CI (con follow-up PR o App token).
- **Una skill `/dai-archive`** — descartado: archivar es mecánico, no necesita un LLM (ADR-0002).
  El comando puede invocarse desde el asistente igual, sin ser skill.
