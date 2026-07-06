# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Versionado semver
(ver `VERSION`).

## [0.1.0] — no publicado

Primera versión: metodología completa + CLI de trazabilidad, probado end-to-end contra
ClickUp y Jira Cloud.

### Metodología
- Manifiesto (constitución: 4 valores + 15 artículos), METODOLOGIA (protocolo invariante
  + dial de niveles N1/N2/N3), SCRUM-CON-IA (los 10 pasos, con `detalle/`), EJEMPLO
  end-to-end, glosario, guías por rol (PO/dev/lead), landing autocontenido (`index.html`).
- 7 ADRs: `ac_hash`, agnóstico del asistente, detección/estampado como comandos,
  ubicación+schema del `implements.yaml`, superficie de comandos, distribución+licencia,
  modelo de autenticación.

### Templates y governance
- `formato-us`, `epica`, `definition-of-ready`, `definition-of-done`, `adr`,
  `pull-request`, hook `commit-msg`; `branch-naming`, `ci-rules`, `commit-convention`.

### Skills (para Claude y Copilot, generadas por `dai init`)
- El QUÉ: `doc-to-backlog` (un doc → backlog candidato), `grill-intent` (Gate 0),
  `grill-epic` (épicas), `grill-user-story` (la US — detecta el tracker del `.env` y publica).
- El CÓMO: `link-us`, `tdd`, `dai-review`.

### CLI (`dai`, Node, cero dependencias)
- **Definir el QUÉ:** `publish` (crea la US en el tracker desde un `.md`).
- **Trazabilidad:** `link-us` (+ `--resync`), `check`, `stamp`, `ls`, `ac-hash`.
- **PR y cierre:** `pr` (crea la PR precargada), `forge` (comentar/leer PR en GitHub/GitLab),
  `done` (cierra la US: vuelve a la base, actualiza y borra la branch).
- **Setup:** `init` (scaffolder interactivo: asistente + tracker + OpenSpec), `install`,
  `docs`, `doctor`.
- Adaptador de tracker: `md`, `jira` (ADF, Jira Cloud), `clickup`. Auth por SSH (git) +
  token scopeado (forge/tracker), nunca contraseñas.
- **87 tests** (`node --test`), cero dependencias de runtime.

### Distribución y comunidad
- Licencia **GPLv3**. Publicable en npm (scopeado); `install.sh` como shim de git-clone.
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `.editorconfig`, `.nvmrc`,
  `.gitattributes`, templates de PR/issue, CI de GitHub Actions (Node 18/20/22).
- Tests de las rutas de red (jira/clickup/forge) con `fetch` mockeado. Sin links rotos;
  `files` de npm sin tests ni secretos.

[0.1.0]: https://github.com/dforce2055/dai/releases/tag/v0.1.0
