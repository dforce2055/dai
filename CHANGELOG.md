# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Versionado semver
(ver `VERSION`).

## [No publicado]

**El primer analista funcional real usó dai contra un Jira corporativo, y encontró el
hueco entre "anda en mi Jira de juguete" y "anda en el de una empresa".**

### Agregado
- **Campos propios de Jira**, declarados por issuetype en `.dai/jira-fields.json` (o
  `DAI_JIRA_FIELDS_FILE`) con nombre humano, forma, default y opciones válidas. dai valida
  **antes** de llamar a la red: un typo da `'Mejraa' no es opción de 'clasificacion' —
  válidas: Mejora | Corrección`, no un 400 críptico. El valor se elige por US con
  `dai publish us.md --field clasificacion=Corrección` (repetible), porque la clasificación
  cambia según la historia y un default fijo publicaría todas iguales ([ADR-0015](docs/adr/0015-jira-corporativo.md)).
- `dai publish --parent <KEY>` — cuelga la US de su épica (antes `createUS` nunca mandaba
  `parent`, así que las US quedaban sueltas).
- `dai publish --issuetype <T>` — **`grill-epic` gana su fallback por CLI**: hasta ahora, sin
  MCP, una épica quedaba en un `.md` para pegar a mano.
- **Diagnóstico de TLS**: un fallo de certificado ahora enseña `NODE_EXTRA_CA_CERTS` (el caso
  típico es el proxy corporativo: Node no usa el trust store del sistema) y explica por qué
  `NODE_TLS_REJECT_UNAUTHORIZED=0` no es una alternativa — apaga la verificación entera y por
  ahí viaja tu token.
- **Constitución**: dos reglas nuevas para todos los asistentes — no bajar la seguridad para
  avanzar, y parar y avisar si el CLI no llega en vez de improvisar la llamada por fuera.

### Cambiado
- **Copilot lee `SKILL.md` nativo** ([ADR-0014](docs/adr/0014-copilot-agent-skills.md)).
  `dai init --for copilot` genera `.github/skills/` (copia cruda, **con los `templates/`**) en
  vez de `.github/prompts/*.prompt.md`, y borra los prompts viejos de dai para que no dupliquen
  cada `/comando`. Los prompt files propios del equipo no se tocan.
- **`dai skills install --for copilot` ya existe** → `~/.copilot/skills/`. Antes warneaba
  *"Copilot no tiene skills instalables"*: era cierto hasta que GitHub adoptó Agent Skills, y
  por eso una skill "instalada global" no le aparecía a nadie que usara la app o el CLI de
  Copilot (`~/.claude/skills` solo lo mira VS Code).
- **`dai doctor` reporta solo los asistentes que el repo usa.** Antes listaba los tres siempre:
  quien configuraba uno veía 14 warnings de los otros dos y leía "está todo roto". Ahora
  también chequea Copilot, valida `DAI_JIRA_PROJECT` y que el archivo de campos parsee.
- **Un flag repetido acumula** (`--field a=1 --field b=2`) en vez de que gane el último en
  silencio.

### Arreglado
- **`doc-to-backlog` y `grill-epic` no cargaban en Copilot.** Sus descripciones tenían un `: `
  suelto (*"…épicas finales: extrae…"*), que un parser YAML lee como el arranque de un mapa y
  descarta la skill entera — justo las dos que más necesita un analista funcional. El defecto
  siempre estuvo en la fuente: lo tapaban nuestro `parseFrontmatter` (que es un regex, no YAML)
  y la conversión a `.prompt.md` (que citaba el valor al serializarlo). Ahora las 7
  descripciones van citadas, **`validateSkill` valida que `name` y `description` sean escalares
  YAML válidos**, y el molde de `templates/skill.md` cita por defecto.
- `DAI_JIRA_PROJECT=PROJ-42` (la clave de un **ticket**, el error de config más común) daba
  un 400 de Jira que no lo explicaba. Ahora falla **antes de la red**, con los dos caminos:
  `DAI_JIRA_PROJECT=PROJ`, o `--parent PROJ-42` si querías colgarla de esa épica.

### Quitado
- `skillToPrompt()` y el adaptador `.github/prompts/` de Copilot. Cuando el formato de una
  skill es un estándar abierto, el mejor adaptador es ninguno.

## [0.7.0] — 2026-07-14

**dai es el distribuidor de skills de cualquier stack, sin opinar sobre su contenido.**

### Agregado
- `dai skills install` — namespace de skills (`dai install` queda como alias). Con
  `--from <git-url|path>[#ref]` instala **skills externas** por-stack (.NET, Java,
  Rust…) desde un repo git (público o privado por SSH) o un path local, convertidas
  para los 3 asistentes (Claude/Cursor/Copilot).
  Self-service, one-off, sin registro; `dai sync` no las toca ([ADR-0013](docs/adr/0013-skills-externas-install-from.md)).
  Valida el contrato mínimo (`SKILL.md` con `name` + `description`) y saltea con aviso
  las malformadas; molde en [`templates/skill.md`](templates/skill.md). No valida el contenido.

## [0.6.0] — 2026-07-12

Self-update del CLI y blindaje de autoría del repo.

### Agregado
- `dai upgrade` (alias `update`): actualiza el CLI global a la última publicada
  (`npm i -g …@latest`), con `--check` y `--dry-run`. No toca el repo: reporta el
  drift del scaffold pero deja el `dai sync` explícito del mantenedor (ADR-0012).

### Interno
- Guard de autoría: rechaza commits autorados/co-autorados por agentes de IA
  (check de CI `authorship` + hook local + `governance/human-authorship.md`).
- Eliminado `.mailmap` (ya no cumplía función).
- **111 tests** (+1: `planUpgrade`).

## [0.5.0] — 2026-07-10

**`archive` en el flujo** ([ADR-0011](docs/adr/0011-archive-gate-de-aprobacion.md)): cerrar el CÓMO
del lado de las specs canónicas, atado a la aprobación de la PR.

### Agregado
- **`dai archive [<change>]`**: funde los delta specs del change en las specs canónicas
  (`openspec/specs/`) y lo archiva. Lo corre el **aprobador** de la PR, en la branch, al aprobar
  (el fold viaja en la PR → elude la base protegida). Detecta el change activo por su `implements.yaml`
  o le pasás el nombre; envuelve `openspec archive --yes` (mecánico → comando, no skill). Flag `--skip-specs`.

### Cambiado
- **`dai check` y `dai ls` saltean `openspec/changes/archive/`**: un change shippeado ya no genera
  ⚠️ de drift falso ni aparece en el listado. `discoverImplements` acepta `includeArchived` (default
  `true`); `check`/`ls` lo pasan `false`. `stamp`/`done` mantienen el default (lo necesitan post-merge).

### Interno
- **110 tests** (+1 desde 0.4.0: filtro `includeArchived`).

## [0.4.0] — 2026-07-10

**Versionado y upgrade** ([ADR-0010](docs/adr/0010-versionado-y-upgrade.md)): mantené tu repo al
día con el CLI sin pisar nada. Las copias scaffoldeadas (skills, constitución, templates) son un
caché derivable — ahora la máquina te avisa cuando quedaron atrás y las refresca sola.

### Agregado
- **`dai sync`**: refresca skills, constitución, templates y PR template a la versión del CLI —
  **aditivo** (conserva tu `CLAUDE.md` propio vía bloque delimitado), sin tocar el `.env` ni OpenSpec.
  Detecta los asistentes del repo o acepta `--for`; `--dry-run` muestra qué cambiaría.
- **`dai doctor` · version-drift**: compara `.dai/VERSION` (scaffold del repo) vs el CLI y avisa con
  color + `⬆️` (misma major → refresh opcional con `dai sync`; major distinta → revisar migración;
  repo más nuevo → actualizar el CLI).
- **`dai version`**: además de la versión, muestra el estado de drift si estás en un repo con dai
  (chequeo liviano). `dai --version` fuera de un repo dai queda limpio (solo la versión).
- **`lib/semver.mjs`** (comparación de versiones, cero dependencias).

### Interno
- **Golden vectors de `ac_hash`**: pineados como inmutables dentro de la línea major — blindan el
  contrato ([ADR-0001](docs/adr/0001-contrato-ac-hash.md)) que hace seguros a los minors/patches y a `dai sync`.
- **109 tests** (+4 desde 0.3.1: semver ×3, golden vectors ×1).

> Diferido a un futuro major (ya diseñado en el ADR-0010): `dai migrate` + `MIGRATION.md` y estampar
> `schema:` en el `implements.yaml`.

## [0.3.1] — 2026-07-10

Pulido de la experiencia de `dai init` y `dai link-us`, y un ejemplo de US listo para probar.

### Corregido
- **`dai init` · `.env.example`**: ahora refleja el `--pm` elegido — incluye todas las claves del
  tracker (con el `..._TOKEN`), en vez del template genérico `md`. Antes, al elegir jira/clickup,
  el `.env.example` quedaba con `DAI_PM=md` y sin el token.
- **`dai init` · `--for` con espacio**: mensaje claro cuando `--for claude, cursor` (con espacio) hace
  que la shell parta la lista y un token de asistente caiga como `<repo>` ("no existe el directorio: cursor").
- **`dai link-us` · `dai ac-hash`**: mensaje accionable cuando la US no tiene sección
  'Criterios de aceptación' — sugiere agregarla o correr `/grill-user-story <ID>`.

### Agregado
- **`templates/formato-us.md`**: ejemplo de US copy-paste al final (con criterios testeables) para
  probar el flujo en 30 segundos, con o sin tracker (`dai ac-hash` / `dai link-us --us … --dry-run`).

### Interno
- **105 tests** (+1 desde 0.3.0: `isAssistantToken`).

## [0.3.0] — 2026-07-08

`dai init` ahora es **aditivo**: no pisa la configuración de un repo funcional. Más
robustez en el parser de `.env` y en `doctor`, y nuevas buenas prácticas agnósticas en
la constitución.

### Cambiado
- **`dai init` es aditivo y no destructivo** sobre un repo con config existente:
  - `.env` / `.env.example`: mergea solo las claves de dai que faltan (no reescribe lo del proyecto).
  - `CLAUDE.md` / `copilot-instructions.md`: inserta la constitución como bloque delimitado
    (`<!-- dai:start/end -->`), idempotente — conserva la constitución previa del proyecto.
  - `.gitignore`: reconcilia para versionar skills y comandos (`.claude/skills/`, `.claude/commands/`),
    dejando fuera solo lo personal (`settings.local.json`); quita ignores "broad" (`.claude/`, `CLAUDE.md`)
    que los escondían.
- **Constitución**: nuevas reglas agnósticas (verificar el comportamiento ≠ que compile, la IA confirma
  antes de construir, docs vivas) + sección "Buenas prácticas (agnósticas)". Tono "tú" neutro.

### Corregido
- **Parser de `.env`** (`env.mjs`): recorta el comentario inline en valores sin comillas — un token con
  `# ...` al lado ya no rompe el header `Authorization` (error de ByteString).
- **`dai doctor`**: enumera solo directorios; ya no lista `.DS_Store` como skill.

### Interno
- **104 tests** (+11 desde 0.2.0: `mergeEnv`, `upsertBlock`, `reconcileGitignore`, parser de `env.mjs`).
- El sitio (`index.html`, `onboarding.html`) sale del paquete npm (`files[]`) — es capa visual del repo/web.
- Nueva página de onboarding del dev (`onboarding.html`) en el sitio de GitHub Pages.

## [0.2.0] — 2026-07-08

Soporte para **Cursor** como asistente y un `--for` combinable. Incluye la **primera
contribución de la comunidad** 🎉 (@sermati).

### Agregado
- **Adaptador de Cursor** ([ADR-0009](docs/adr/0009-adaptador-cursor.md), aporte de la
  comunidad): `dai init` / `install` / `doctor` soportan Cursor — generan
  `.cursor/skills/*/SKILL.md` y `.cursor/rules/dai-constitution.mdc` (regla always-on) desde
  la misma fuente `skills/*/SKILL.md`.
- **`--for` combinable**: acepta subconjuntos de asistentes (`--for claude,cursor`,
  `--for copilot`), además de `both` (Claude+Copilot) y `all` (los tres). Nuevo
  `parseAssistants()` en `args.mjs`.

### Cambiado
- **Default de `dai init` = `all`** (Claude + Copilot + Cursor) — deja el repo listo para
  cualquier asistente.
- El mensaje de "próximos pasos" de `dai init` apunta a la **URL online** de la guía
  `PROBAR.md` (antes una ruta local que el usuario instalado no encontraba).

### Interno
- **93 tests** (+6 desde 0.1.1: `skillToCursor`, `constitutionCursorRule`, `parseAssistants`).

## [0.1.1] — 2026-07-06

Solo documentación y metadata — **el CLI no cambia** (mismo `ac_hash`, mismo protocolo).

### Cambiado
- `homepage` del paquete → el sitio de GitHub Pages (`dforce2055.github.io/dai`).
- Badge de npm activado en el README (tras el primer publish).
- Conteo de tests corregido en `RELEASING.md` (48 → 87).

## [0.1.0] — 2026-07-06

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

[0.7.0]: https://github.com/dforce2055/dai/releases/tag/v0.7.0
[0.6.0]: https://github.com/dforce2055/dai/releases/tag/v0.6.0
[0.5.0]: https://github.com/dforce2055/dai/releases/tag/v0.5.0
[0.4.0]: https://github.com/dforce2055/dai/releases/tag/v0.4.0
[0.3.1]: https://github.com/dforce2055/dai/releases/tag/v0.3.1
[0.3.0]: https://github.com/dforce2055/dai/releases/tag/v0.3.0
[0.2.0]: https://github.com/dforce2055/dai/releases/tag/v0.2.0
[0.1.1]: https://github.com/dforce2055/dai/releases/tag/v0.1.1
[0.1.0]: https://github.com/dforce2055/dai/releases/tag/v0.1.0
