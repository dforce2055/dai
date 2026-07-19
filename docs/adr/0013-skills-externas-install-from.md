# ADR-0013 — `dai skills install --from` (skills externas por-stack)

- **Estado:** aceptado
- **Fecha:** 2026-07-14
- **Decide:** lead / arquitecto de la metodología

## Contexto

dai distribuye **sus** skills (las bundleadas: `grill-*`, `link-us`, `tdd`, …) e
instala/convierte para Claude, Cursor y Copilot. Pero los equipos tienen skills
**propias de su stack** (.NET, Java, Rust, …) que hoy no tienen lugar: o las copian
a mano por repo (duplicación, sin conversión a los 3 asistentes), o las meten en el
paquete dai — que **rompe el ADN**: dai es agnóstico del stack, opina solo en su
dominio (trazabilidad/distribución), no sobre *qué* dicen tus skills.

Falta una forma de que dai **convierta e instale** skills externas, sin volverse
dueño ni gatekeeper de ellas.

## Decisión

Agregamos **`dai skills install --from <git-url|npm:pkg|path>[#ref]`**: instala skills
**externas** desde un repo/dir/paquete (con estructura `skills/<nombre>/SKILL.md`, la misma
de dai), **convertidas para los 3 asistentes** (Claude copia · Cursor `skillToCursor`
· Copilot `skillToPrompt` → `.github/prompts/`).

- **Tres fuentes:** un **git URL** (`github.com/org/skills[#ref]` → clone), un **path
  local**, o un **paquete npm** (`npm:@scope/pkg[@version]` → `npm pack` a un temp,
  respetando el `.npmrc` del cwd, así resuelve registries privados con scope). Es común
  distribuir skills como paquete npm (una org publica sus componentes + skills juntas);
  materializarlo a mano era fricción de más.

- **`dai skills` es el namespace canónico** de las operaciones de skills, consistente
  con `dai forge <verb>`. `dai skills install` (sin `--from`) instala las de dai;
  **`dai install` queda como alias** silencioso (backward-compatible).
- **Self-service, one-off, sin registro.** No hay autorización central ni persistencia:
  no existe `.dai/sources`, dai **no lleva registro** de qué repos usan skills externas.
  El equipo las suma **bajo su propio criterio**.
- **`dai sync` NO las toca** — sigue siendo **solo** de las skills de dai. Si el equipo
  actualiza sus skills, re-corre `--from`.
- **Colisión** con una skill built-in de dai → **warn + skip** (no se pisa la
  metodología; renombran, p. ej. `tdd-dotnet`).

## Consecuencias

- **Más fácil:** cada equipo suma sus skills por-stack sin tocar dai ni pedir permiso,
  y las escribe **una vez** (dai las sirve a Claude/Cursor/Copilot). El namespace
  `dai skills` deja lugar a crecer (`skills list`, …) sin comandos sueltos.
- **Se acepta pagar:** es **one-off** (dai no mantiene esas skills al día; re-corrés
  `--from`). **Sin registro** → dai no sabe qué repos tienen skills externas, a
  propósito: cero gatekeeping, bajo riesgo del equipo. Las fuentes remotas dependen de
  git/red/npm, y la **auth se delega en la herramienta** (git: SSH o credential helper;
  npm: el `.npmrc` del repo — dai no autentica): *si puedes `git clone` o `npm pack` la
  fuente, dai instala desde ahí*.

## Alternativas consideradas

- **Persistido (`.dai/sources`) + integrado a `dai sync`** — descartado: obliga a dai a
  **registrar y mantener** fuentes externas (gatekeeping que el equipo no quiere), y
  acopla `dai sync` —que debe ser solo de dai— a repos ajenos.
- **Meter las skills de stack en el paquete dai** — descartado: rompe el ADN (dai
  agnóstico del stack).
- **Comando suelto `dai install --from` sin namespace** — descartado: `dai skills <verb>`
  es más claro y consistente con `dai forge <verb>`; `dai install` queda como alias.
