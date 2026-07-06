# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Versionado semver
(ver `VERSION`).

## [0.1.0] — no publicado

Primera versión del paquete.

### Metodología
- Manifiesto (constitución: 4 valores + 15 artículos), METODOLOGIA (protocolo
  invariante + dial de niveles N1/N2/N3), SCRUM-CON-IA (los 10 pasos, con `detalle/`),
  EJEMPLO end-to-end (carrito de compras), glosario, guías por rol (PO/dev/lead).
- 7 ADRs: `ac_hash`, agnóstico del asistente, detección/estampado como comandos,
  ubicación+schema del `implements.yaml`, superficie de comandos+stamp, distribución
  y licencia, modelo de autenticación.

### Templates y governance
- `formato-us`, `epica`, `definition-of-ready`, `definition-of-done`, `adr`,
  `pull-request`; `branch-naming`, `ci-rules`.

### Skills
- El QUÉ: `doc-to-backlog` (un PDF/Word → backlog candidato de épicas+US),
  `grill-intent` (Gate 0), `grill-epic` (épicas), `grill-user-story` (la US).
- El CÓMO: `link-us`, `tdd`, `dai-review`.

### CLI (`dai`, Node, cero dependencias)
- Trazabilidad: `ac-hash`, `ls`, `link-us`, `check`, `stamp`, `forge` (GitHub/GitLab).
  `link-us` trae la US del adaptador (sin `--us`); keys agnósticos de tracker.
- Instalación: `install` (global/local), `init --for claude|copilot|both`
  (bootstrap del repo: `.dai` + adaptadores de asistente, ADR-0002 capa 3), `docs`, `doctor`.
- Adaptador de PM: backends `md`, `jira`, `clickup`.
- 48 tests (`node --test`).

### Distribución
- Licencia GPLv3. Publicable en npm (scopeado). `install.sh` como shim de git-clone.

### Calidad y comunidad
- Auditoría end-to-end: se corrigió el parseo de flags (los booleanos como
  `--global`/`--force` consumían el argumento siguiente → `--dry-run` podía quedar
  ignorado), y se robusteció `slugify` (escape unicode en los diacríticos).
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `.editorconfig`, `.nvmrc`,
  `.gitattributes`, templates de PR/issue, y CI de GitHub Actions (Node 18/20/22).
- Sin links rotos; `files` de npm sin tests ni secretos.
- Tests de las rutas de red (jira/clickup/forge) con `fetch` mockeado: URL, auth,
  método, body, mapeo de respuesta y manejo de errores (404/no-ok). **64 tests.**

[0.1.0]: #
