# ADR-0017 — La config de dai vive en `.env.dai`, no en el `.env` del equipo

- **Estado:** aceptado
- **Fecha:** 2026-07-18
- **Decide:** lead / arquitecto de la metodología

## Contexto

dai guarda su config y sus secretos (token del tracker, email, plantilla de URL) en
variables de entorno, y hasta ahora las escribía en el `.env` del repo, con la premisa de
que ese `.env` está **gitignored** (por eso `dai init` lo agregaba al `.gitignore` y el
loader avisaba "NUNCA commitees tokens").

Esa premisa se rompe en muchas empresas: **versionan el `.env`** como política (mismas
variables públicas para todo el equipo y el CI). Pasó de verdad en un repo de frontend
corporativo: el `.env` estaba trackeado con `VITE_*` públicas, y `dai init`

1. le **inyectaba** sus claves `DAI_*` a un archivo compartido del equipo, y
2. le agregaba `.env` al `.gitignore` — inútil, porque git no ignora un archivo ya
   trackeado, y encima confuso (parece que lo protege y no lo hace).

El día que un dev completara `DAI_JIRA_TOKEN` en ese `.env` versionado, git lo marcaba
para commit: **un secreto a un empujón de filtrarse** al historial del repo corporativo.

## Decisión

dai deja de tocar el `.env` del equipo. Toda su config vive en archivos **propios**:

| Archivo | Versionado | Quién lo maneja | Contenido |
|---|---|---|---|
| `.env` | según el equipo | el equipo | dai **no lo escribe**; solo lo **lee** (compat) |
| `.env.dai` | **no** (gitignored) | cada dev | config + secretos de dai (token, email) |
| `.env.dai.example` | sí | dai / el equipo | plantilla: mismas claves, valores vacíos |

- **`dai init`** crea `.env.dai` (real, ignorado) y `.env.dai.example` (plantilla
  versionada), de forma aditiva, y **nunca** modifica `.env`/`.env.example`.
- **`reconcileGitignore`** ignora `.env.dai` (su archivo), **no** `.env`: el `.env` del
  equipo es del equipo, y muchas orgs lo versionan a propósito. `.env.dai.example` no
  matchea el patrón exacto `.env.dai`, así que se versiona sin negación extra.
- **El loader** (`loadDaiEnv`) lee `.env.dai` **y** `.env`. Precedencia:
  **entorno (shell/CI) > `.env.dai` > `.env`**. Se logra cargando `.env.dai` primero,
  porque el loader es "primero-gana". Seguir leyendo `.env` mantiene compatibilidad con
  repos previos que tienen los `DAI_*` ahí — no se rompe nada.

## Consecuencias

- **A favor:** dai no ensucia ni pone en riesgo un archivo compartido del equipo. El
  secreto vive en un archivo que git ignora de verdad (no trackeado). Funciona igual en
  equipos que versionan el `.env` y en los que no. Los repos viejos siguen andando (se
  lee `.env`).
- **En contra:** una convención más de archivos (`.env.dai`, `.env.dai.example`) que
  documentar. Un repo que ya tenía `DAI_*` en un `.env` gitignored puede migrarlos a
  `.env.dai` cuando quiera; no es urgente, porque el loader sigue leyendo `.env`.
- **Vite:** el nombre `.env.dai` solo lo cargaría Vite con `vite --mode dai` (raro), y
  las claves de dai no llevan prefijo `VITE_`, así que nunca van al bundle del cliente.

## Alternativas descartadas

- **Destrackear el `.env`** (`git rm --cached`): rompe la convención del equipo y les saca
  del control de versiones las `VITE_*` públicas que comparten a propósito.
- **Secreto solo por variable de shell:** anda hoy (el loader no pisa el entorno), pero
  obliga a `source` en cada sesión: fricción para todo el equipo, sin plantilla que guíe.
- **Seguir usando `.env` y forzar el `.gitignore`:** es justo lo que fallaba — inerte
  sobre un archivo ya trackeado, y peligroso el día que alguien escribe el token.
