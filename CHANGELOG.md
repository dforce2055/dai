# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Versionado semver
(ver `VERSION`).

## [0.10.0] — 2026-07-18

**La config de dai deja de vivir en el `.env` del equipo y pasa a un `.env.dai` propio (no
versionado). Resuelve el caso de las empresas que versionan el `.env` como política: dai no
toca ese archivo y guarda sus secretos donde git realmente los ignora. Y `dai init` estrena
una bienvenida con el Sol de Mayo en bloques.**

### Agregado
- **Banner de bienvenida en `dai init`**: el Sol de Mayo de dai en bloques (cuerpo y rayos
  rectos en oro, rayos ondulados en celeste) junto al título, más un preview de lo que se va
  a configurar. Cero dependencias (solo ANSI); degrada a ASCII sin color en no-TTY o con
  `NO_COLOR`.

### Cambiado
- **`dai init` escribe en `.env.dai` + `.env.dai.example`, no en `.env`/`.env.example`**
  ([ADR-0017](docs/adr/0017-env-dai.md)). El `.env` del equipo queda intacto (dai solo lo
  lee). `.env.dai` (secretos) se gitignorea; `.env.dai.example` (plantilla) se versiona.
  En un repo sin `.env`, dai ya no crea uno: es del equipo, no de dai.
- **El loader lee `.env.dai` y `.env`** con precedencia **shell/CI > `.env.dai` > `.env`**.
  Seguir leyendo `.env` mantiene la compatibilidad: los repos que ya tenían los `DAI_*` ahí
  no se rompen.
- **`.gitignore`**: dai ignora `.env.dai` (su archivo), no `.env`. Ya no fuerza un ignore
  sobre un archivo que muchas orgs versionan a propósito.
- Se renombró el `.env.example` del paquete a `.env.dai.example`, y se actualizaron doctor,
  mensajes de init/sync, tutoriales, constitución y README a la nueva convención.

### Interno
- **228 tests** (+4 desde 0.9.0): precedencia de `loadDaiEnv` (shell > `.env.dai` > `.env`),
  compat con `.env`, y sin-archivos. Smokes de `dai init` con y sin `.env` preexistente.

## [0.9.0] — 2026-07-17

**El review de dai deja de ser un comentario al final del hilo y pasa a ser un review
_inline_: un resumen más un comentario anclado a cada `archivo:línea`, clasificado
low/medium/high — como el de Copilot, pero con la puerta humana y la validación que a
Copilot le faltan.**

### Agregado
- **`dai forge review <ref> --from <review.json>`** — review inline en GitHub y GitLab.
  La skill `dai-review` produce un `review.json` (el criterio); el CLI hace lo mecánico
  (ADR-0002): **valida que cada `path:line` exista de verdad en el diff** —traído con git,
  local, por SSH— antes de salir a la red. Inventar líneas es el error más común de un
  LLM revisando código, y el forge responde `422` sin decir cuál falló; en GitHub, que es
  atómico, un hallazgo inventado tira los buenos. Lo descartado y lo filtrado **se
  reportan**, nunca se caen en silencio.
- **Puerta humana explícita.** Sin `--yes` no se postea nada: se muestra el preview y se
  corta. `--dry-run` valida sin postear. Modo desatendido para reviews simples
  (`--yes --min-severity --min-confidence --max-comments`), pero es una **excepción que
  el humano pide**, no un default. El review sale siempre con `event: COMMENT`, nunca
  `APPROVE` — dai comenta, la persona firma ([Art. 5](docs/MANIFIESTO.md#art-5)).
- **Aviso de release en Discord.** Publicar un release de GitHub dispara el workflow
  `discord-release.yml`, que postea al canal vía el secreto `DISCORD_WEBHOOK_URL`. El
  secreto vive en GitHub Actions, nunca en el repo; el workflow no viaja en el paquete
  npm (`.github/` fuera de `files`), así que no le impone notificaciones a nadie que use
  dai. Ver [ADR-0016](docs/adr/0016-review-inline.md).

### Cambiado
- **`getPR` expone `headSha`, `baseRef` y `diffRefs`** — hacían falta para anclar un
  comentario inline (GitHub necesita el sha del head; GitLab exige los tres shas de
  `diff_refs` en cada comentario). `dai init` agrega `.dai/reviews/` al `.gitignore` del
  repo (un review a medio editar no se commitea; `.dai/` sigue versionándose).

### Interno
- **224 tests** (+40): el parser de diff con varios hunks y archivos borrados, el
  descarte de líneas inventadas por lado, los filtros de severidad/confianza/tope, y la
  asimetría GitHub (atómico) vs. GitLab (no atómico: reporta los parciales en vez de
  fingir atomicidad). Probado end-to-end contra una PR real: el comentario quedó inline
  en el archivo, el review salió `COMMENTED`, y el hallazgo alucinado nunca tocó la red.

## [0.8.2] — 2026-07-17

**Dos agujeros que destapó el uso real, y que tienen la misma forma: dai hacía algo
hacia afuera sin que un humano lo viera, o dejaba que otro le pisara lo que había
escrito. El [Art. 5](docs/MANIFIESTO.md#art-5) no se cumple solo con no clickear
Approve.**

### Arreglado
- **`dai-review` posteaba el comentario sin mostrártelo.** La skill componía el review y
  lo publicaba de una: el paso 6 decía *"Postear"* y no había gate. Y el comentario sale
  con **tu token y tu nombre** (`GITHUB_TOKEN`/`GITLAB_TOKEN` son tuyos), así que en la
  PR de un compañero figura como si lo hubieras escrito vos. El corte estaba puesto en el
  lugar equivocado: no aprobar sin humano estaba bien, pero publicar un juicio sobre el
  código de otro, firmado por alguien que no lo leyó, es el mismo problema con otro
  disfraz. Ahora la skill **muestra el comentario entero y espera un OK explícito** en
  ese turno; sin "sí", no se postea. Es el tercer corte duro de la skill.
- **`dai pr` escribía el id de la US disfrazado de link.** Sin `DAI_TRACKER_URL_TEMPLATE`,
  `trackerUrl(id)` devolvía el **id pelado**; como un string es truthy, `composePrBody` lo
  escribía igual y la PR quedaba con `- US: 86abc123` en vez de un enlace, sin un solo
  aviso. Ahora la URL se resuelve por una cadena explícita —template > URL canónica del
  tracker > derivada del backend > `null`— y **si dai no la sabe, avisa y omite la línea
  en vez de mentir** (`lib/tracker-url.mjs`).
- **El bloque de enlaces de `dai pr` no sobrevivía a un edit.** Iba marcado con un
  comentario suelto, así que cualquier agente que reescribiera *"Enlaces relacionados"*
  se lo llevaba puesto sin dejar rastro — pasó en PRs reales. Y el propio template lo
  invitaba: su hint pedía *"US en el tracker, commit ancla, docs, issues"*, o sea justo la
  sección que `dai pr` acababa de llenar. dai se peleaba consigo mismo y ganaba el que
  corría último. Ahora el bloque va **delimitado** (`<!-- dai:links:start … end -->`),
  se **regenera de forma idempotente**, preserva lo que el humano sumó abajo, y el hint
  del template pide solo lo que dai **no** sabe (docs, issues, PRs relacionadas).

### Cambiado
- **dai deduce el link al tracker solo.** Con `DAI_PM=jira` o `=clickup` ya no hace falta
  `DAI_TRACKER_URL_TEMPLATE`: se deriva de la config (`/browse/<KEY>` y
  `/t/<id>`), y `fetchUS` ahora devuelve la **URL canónica** del tracker — en ClickUp, la
  que trae el `team_id`, que no se puede deducir del id. La variable queda como
  **override** para trackers con URL propia. `dai init` dejó de scaffoldearla: era
  contraproducente, porque el template gana sobre la canónica y le tapaba el `team_id`.
  Los `.env` que ya la tienen siguen andando igual (el override sigue ganando).

## [0.8.1] — 2026-07-16

**Primera prueba real en Windows con analistas y devs de una empresa: el ciclo completo
contra un Jira corporativo anduvo, y de paso destapó lo que faltaba pulir para que un
equipo Windows + Copilot + GitLab no se topara con muros.**

### Arreglado
- **`dai sync` crasheaba en repos Copilot** con `ReferenceError: skillToPrompt is not
  defined`. El pase a Agent Skills nativas (0.8.0, [ADR-0014](docs/adr/0014-copilot-agent-skills.md))
  borró `skillToPrompt` y migró `dai init` a `.github/skills/`, pero dejó dos llamadas
  colgadas en el path viejo `.github/prompts/`: `dai sync` y `dai skills install --from`
  (rama Copilot). Ahora ambos copian la skill nativa (`.github/skills/<name>`, con
  `templates/`) igual que `init`, y `sync` **migra** el repo: limpia los `.prompt.md`
  viejos de dai. `dai sync` también detecta Copilot por `.github/skills` (antes solo por
  `.github/prompts`, así que ni veía los repos nuevos). Cubierto por un test de
  integración de `dai sync --for copilot` — el hueco que dejó pasar la regresión.
- **`dai upgrade` (y `dai init --openspec`) fallaban en Windows** con un genérico *"no
  pude consultar el registry (¿sin red?)"* aunque npm anduviera perfecto. En Windows `npm`
  y `openspec` son shims `.cmd`, y desde Node 18.20 / 20.12 / 21.7 (fix de CVE-2024-27980)
  `execFileSync` **se niega a lanzar un `.cmd` sin `shell:true`** — tira `EINVAL`, que dai
  confundía con falta de red. Ahora esos binarios se corren con `shell` en Windows.
- **`dai pr` fallaba el push la primera vez contra un remoto HTTPS corporativo.** El push
  corría con stdin ignorado, así que Git Credential Manager no podía pedir la credencial y
  el push moría en seco — mientras el error real de git quedaba oculto tras un genérico
  *"Command failed"*. Ahora el push hereda stdin (con `GIT_TERMINAL_PROMPT=1`) para que el
  login se pueda completar, **muestra el stderr real de git**, y si aún falla sugiere
  pushear a mano una vez para cachear la credencial.

### Agregado
- **`dai mr` como alias de `dai pr`.** En un shop de GitLab uno tipea "mr" (merge request);
  ahora funciona. Es el mismo comando (detecta el forge y usa `gh`/`glab`), solo más natural.

### Cambiado
- **El diagnóstico de un 400 de `dai publish` ahora coincide con lo que Jira dijo.** Antes
  mandaba SIEMPRE a declarar un campo propio (`customfield_NNNNN` en `.dai/jira-fields.json`),
  aunque el 400 fuera *"Por favor indicar épica…"* — confuso, porque el fix real es
  `--parent`. Ahora la ayuda se elige según el cuerpo del error: regla de épica padre →
  `--parent`, campo obligatorio → `jira-fields.json`, genérico → nombra las dos causas sin
  empujar una sola.
- **`dai pr` explica por qué no pudo crear la PR/MR** en vez de un *"¿instalado y
  autenticado?"*. Si `gh`/`glab` no está instalado (`ENOENT`) lo dice y enlaza la
  instalación + `… auth login` (con `--hostname` para GitLab self-hosted); si falla por
  otra cosa, **imprime el stderr real del forge** (auth vencida, host sin configurar, flag
  desconocido). Era el caso ciego del equipo con GitLab corporativo.
- **El diagnóstico de TLS ofrece primero el camino más simple**: `NODE_OPTIONS=--use-system-ca`
  (Node ≥ 22.15), que usa el trust store del sistema donde el navegador ya confía en la CA
  de la empresa — validado contra el proxy real. `NODE_EXTRA_CA_CERTS` queda como
  alternativa para cualquier versión de Node. (Sigue prohibido `NODE_TLS_REJECT_UNAUTHORIZED=0`.)

### Docs
- **El prerequisito de `dai pr`: `gh`/`glab` instalado y autenticado.** Un callout en la
  sección del dev con el setup one-time del CLI del forge (`gh auth login` /
  `glab auth login --hostname <tu-gitlab>`, con la nota del PATH en Windows tras instalar con
  winget). Era el paso que faltaba documentar — sin el CLI, `dai pr` pushea igual y avisa.
- **README consistente con Copilot nativo.** La tabla de superficies ya decía que Copilot
  carga skills en app / CLI / IDE / cloud (solo el chat de github.com queda afuera), pero el
  resto del README seguía en el modelo viejo: la tabla de `--for`, el árbol del repo y el
  snippet de `dai skills install` hablaban de `.github/prompts/*.prompt.md` y de que "Copilot
  no tiene skills instalables". Corregido a `.github/skills/` nativo — validado con un dev
  corriendo dai en la app de GitHub Copilot desktop.

### Interno
- **161 tests** (+3): integración de `dai sync --for copilot` (regresión + migración del
  layout viejo).
- **Conocido, sin arreglar:** en Windows, tras un `dai publish` con red, puede aparecer al
  salir `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c` — un
  crash de *teardown* de libuv, posterior a toda la salida útil (cosmético). Se investiga.

## [0.8.0] — 2026-07-15

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

### Interno
- **158 tests** (+39 desde 0.7.0): `jira-fields` ×19, `http`/TLS ×7, contrato YAML del
  frontmatter ×7, `assertProjectKey` y el payload de `createUS` ×6.
- **Primera verificación en Windows.** Hasta ahora dai no se había instalado nunca en Windows
  (no hay CI de esa plataforma): se probó el ciclo completo — install, `dai init --for copilot`,
  skills globales en `~/.copilot/skills`, y Copilot cargando las 7. Los campos propios de Jira
  y el diagnóstico de TLS están cubiertos por tests contra un Jira simulado, **todavía no
  contra un Jira corporativo real**.
- `lib/jira-fields.mjs` y `lib/http.mjs` nuevos, cero dependencias (como el resto del CLI).

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

[0.10.0]: https://github.com/dforce2055/dai/releases/tag/v0.10.0
[0.9.0]: https://github.com/dforce2055/dai/releases/tag/v0.9.0
[0.8.2]: https://github.com/dforce2055/dai/releases/tag/v0.8.2
[0.8.1]: https://github.com/dforce2055/dai/releases/tag/v0.8.1
[0.8.0]: https://github.com/dforce2055/dai/releases/tag/v0.8.0
[0.7.0]: https://github.com/dforce2055/dai/releases/tag/v0.7.0
[0.6.0]: https://github.com/dforce2055/dai/releases/tag/v0.6.0
[0.5.0]: https://github.com/dforce2055/dai/releases/tag/v0.5.0
[0.4.0]: https://github.com/dforce2055/dai/releases/tag/v0.4.0
[0.3.1]: https://github.com/dforce2055/dai/releases/tag/v0.3.1
[0.3.0]: https://github.com/dforce2055/dai/releases/tag/v0.3.0
[0.2.0]: https://github.com/dforce2055/dai/releases/tag/v0.2.0
[0.1.1]: https://github.com/dforce2055/dai/releases/tag/v0.1.1
[0.1.0]: https://github.com/dforce2055/dai/releases/tag/v0.1.0
