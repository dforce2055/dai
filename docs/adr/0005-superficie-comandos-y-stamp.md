# ADR-0005 — Superficie de comandos del CLI y contenido del stamp

- **Estado:** aceptado
- **Fecha:** 2026-07-03
- **Decide:** lead / arquitecto de la metodología

## Contexto

Los ADR-0001/0003/0004 definieron el hash, el modelo de detección y el schema del
`implements.yaml`. Falta congelar **qué comandos** expone `dai` para la trazabilidad
y **qué estampa** exactamente `dai stamp` en el tracker (que es el router de Nivel-1,
§2.5, y por lo tanto debe llevar links a la implementación).

## Decisión

### Superficie de comandos de trazabilidad

| Comando | Acceso | Qué hace |
|---|---|---|
| `dai ac-hash <us>` | local | calcula el hash de criterios (ADR-0001). |
| `dai ls [--json]` | **local, offline** | escanea `**/implements.yaml`, lista las US que implementa el repo + su link al tracker. Base de los otros dos. |
| `dai check` | lee la US viva | `ls` + trae la US + compara hashes → al día / ⚠️ atrasado. Exit ≠ 0 si atraso (gate de PR). |
| `dai stamp` | escribe al tracker | `ls` + trae la US + **escribe la cobertura** (inversa, [Art. 10](../MANIFIESTO.md#art-10)). |

`check` y `stamp` se construyen sobre `ls` (un solo lugar descubre y parsea).

### Contenido del stamp (el router necesita links)

`dai stamp` escribe en el ticket, por cada repo/change que lo implementa:

```
repo:    <nombre>   → <repo web url>
branch:  <branch>   → <branch url>     ← link principal (legible)
commit:  <sha>      → <commit url>     ← ANCLA durable (sobrevive al borrado de branch)
version: <v> (<ac_hash>)  → ✅ al día | ⚠️ atrasado
autor:   <dev>
```

**Los links se derivan de git, sin API del forge ni `--pr`:**
- repo/branch/commit salen de `git remote get-url origin` + `git rev-parse`.
- La URL web es **específica del forge** (GitHub `/tree/` `/commit/`; GitLab `/-/tree/`
  `/-/commit/`; Bitbucket `/src/` `/commits/`): `dai` mapea forge→esquema por el host
  del remoto.

**Branch + commit-ancla:** la branch es el link legible, pero se borra al mergear; el
commit es permanente. Guardar los dos evita que el router quede en 404.

## Consecuencias

- ✅ Trazabilidad completa sin API del forge ni flags manuales: todo se deriva de git.
- ✅ El router (§2.5) siempre tiene un link vivo (el commit) → nunca dead-link.
- ✅ `dai ls` es offline y read-only → sirve de base barata para todo lo demás.
- ⚠️ Construir la URL web es forge-específico → lógica a testear (SSH/HTTPS, 3 forges).
- ⚠️ `dai stamp` (write) y `dai check` (read US viva) dependen del **adaptador de PM**
  (decisión abierta #3). Hasta que exista, `stamp --format md` emite el bloque para
  pegar a mano (mismo fallback que `grill-user-story`).

## Alternativas consideradas

- **Link a la PR/MR** — descartado: no es derivable localmente sin API del forge, y en
  modo distribuido genera fricción (`--pr`). La branch+commit se derivan de git solo.
- **Solo la branch** — descartado: la branch se borra al mergear → 404. El commit es la
  ancla durable.
- **Solo el commit** — viable pero menos legible; la branch le da contexto humano.
  Guardamos los dos.
