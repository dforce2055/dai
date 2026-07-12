# ADR-0012 — `dai upgrade` (self-update del CLI)

- **Estado:** aceptado
- **Fecha:** 2026-07-12
- **Decide:** lead / arquitecto de la metodología

## Contexto

dai tiene **dos cosas versionadas e independientes**: el **CLI** (el paquete npm
global, una copia por dev) y el **scaffold del repo** (`.dai/`, skills, `.dai/VERSION`,
compartido y commiteado). El drift entre ambos ya se **detecta** (`versionDrift`,
ADR-0010) y `dai doctor`/`dai version` imprimen el estado.

Pero actualizar el **CLI** era **manual**: cuando el detector veía el CLI atrasado,
imprimía el texto `npm i -g @dforce2055/dai` para que el dev lo copiara y corriera a
mano. No había comando. Fricción repetida, y un detector que empujaba a algo que no
existía como acción de dai.

Escenario típico: un dev vuelve el lunes con el CLI en v0.2.0 y ya salió v0.5.0.
Tiene que actualizar su CLI (y después traer el repo con `git pull`, que el
mantenedor ya sincronizó).

## Decisión

Agregamos **`dai upgrade`** (alias `update`): **self-update del CLI global** a la
última versión publicada en el registry.

- **Scope: solo el CLI.** Corre `npm i -g <name>@latest` (el `<name>` sale de
  `package.json`, robusto si cambia el scope). `--check` solo informa; `--dry-run`
  muestra el comando sin correrlo.
- **NO toca el repo.** Tras actualizar, **reporta** el drift del scaffold (`reportDrift`)
  pero **no corre `dai sync`**. El `sync` queda como acto **explícito del mantenedor**:
  un dev con CLI viejo que sincronizara **degradaría** el `.dai/` del repo, y sincronizar
  desde cada máquina genera commits en conflicto.
- **El núcleo es puro y testeado** (`planUpgrade` en `lib/semver.mjs`): decide
  `up-to-date | ahead | upgrade`. El I/O (`npm view` / `npm i -g`) es la cáscara del
  comando, no se unit-testea (mismo criterio que el `fetch`).

## Consecuencias

- **Más fácil:** un comando cierra el loop de "CLI atrasado" en vez de copiar un hint.
  La separación de roles queda nítida: **`upgrade` = tu CLI** (self-update),
  **`sync` = el repo** (mantenedor, commiteado).
- **Se acepta pagar:** depende del **registry** (es online; en redes cerradas —ADR-0006—
  falla con mensaje claro y fallback al `npm i -g` manual). Asume **npm** como package
  manager del global (no pnpm/yarn/volta/asdf); si el install falla, deriva al comando
  manual. No auto-sincroniza el repo (a propósito).

## Alternativas consideradas

- **Auto-correr `dai sync` tras el upgrade** — descartado: un dev degradaría el repo con
  un CLI viejo y sincronizar desde cada máquina genera conflictos. El `sync` es del
  mantenedor.
- **Pinnear dai como devDependency por-repo** (sin global → sin drift, alineado en
  `npm install`) — descartado como default: dai se diseñó **global y zero-dep para redes
  cerradas** (ADR-0006), y no todos los repos son npm. Queda como opción del consumidor,
  no del método.
- **No hacer nada** (dejar el hint manual) — descartado: fricción repetida sobre una
  acción que el propio detector ya recomendaba.
