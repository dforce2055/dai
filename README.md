# dai — Desarrollo Asistido por IA

[![CI](https://github.com/dforce2055/dai/actions/workflows/ci.yml/badge.svg)](https://github.com/dforce2055/dai/actions/workflows/ci.yml)
[![license: GPL-3.0](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![sitio](https://img.shields.io/badge/sitio-dforce2055.github.io%2Fdai-6366f1.svg)](https://dforce2055.github.io/dai/)
<!-- El badge de npm se agrega tras `npm publish` (snippet en RELEASING.md):
[![npm](https://img.shields.io/npm/v/@dforce2055/dai.svg)](https://www.npmjs.com/package/@dforce2055/dai)
-->


> **dai ayuda a los equipos a desarrollar software en menos tiempo y con más calidad** —
> sacándose de encima la burocracia para enfocarse en lo que importa: pensar, documentar
> y construir. La IA acelera; dai mantiene el control y la trazabilidad.

## Qué es y qué resuelve

Desarrollar con IA es rápido, pero sin método el código se desconecta del *por qué* se
escribió, aparece el **vibe coding**, y el *qué* (negocio) se mezcla con el *cómo*
(técnica). **dai es una metodología asistida por IA** que ataca eso combinando tres piezas:

- **🖥️ El CLI `dai`** — un comando para cada fase del desarrollo (definir, linkear,
  verificar, revisar, publicar). Mantiene atado el requerimiento al código, del principio
  al fin.
- **🧩 OpenSpec** — convierte el *qué* en un *cómo* (diseño + tareas) con ayuda de agentes
  de IA, sin que nadie escriba la burocracia técnica a mano.
- **🤖 La IA** — para debatir, analizar, conectarse a tus herramientas por **MCP** (Jira,
  ClickUp, GitHub, Gitlab) y automatizar el papeleo, para que te enfoques en documentar y construir.

Juntas hacen que la IA potencie tu desarrollo **sin perder el control**: todo lo que se
construye queda linkeado a por qué se construyó, y **la máquina te avisa sola** cuando algo
se desincroniza. Del solo developer a un equipo entero de desarrollo — el mismo método, con Claude o Copilot.

## Cómo funciona (3 ideas)

- **Separa el QUÉ del CÓMO**, con dueños distintos, linkeados ida y vuelta.
- **El link se autora una sola vez** (en el código, `implements.yaml`); la cobertura inversa
  se **genera**, nunca se mantiene a mano.
- **`@version` = número + hash de criterios**: cuando el QUÉ cambia, los CÓMO atrasados se
  marcan **solos**.

## Quickstart

Requiere **Node ≥ 18** (el CLI no tiene dependencias). Elige tu rol:

### 🟡 Como analista funcional — quiero crear historias o épicas

Trabajas en tu asistente (Claude Desktop / Copilot en el IDE), no en la terminal. Una vez,
deja las skills disponibles:

```bash
npm i -g @dforce2055/dai        # el CLI
dai install                     # skills de IA → tu Claude (Desktop y Code)
```

Y después, en el chat del asistente, según lo que tengas:

```text
/grill-user-story               # una historia → te interroga y la publica en el tracker
/grill-epic                     # algo grande → una épica partida en varias US
/doc-to-backlog <PDF/Word>      # un documento de análisis → backlog candidato de épicas + US
/grill-intent                   # (opcional) Gate 0: ¿es el problema correcto, antes de escribir?
```

> Las skills **te interrogan** hasta que la historia es testeable (nunca inventan
> requerimientos: los sacan a preguntas), y la **publican en el tracker** que configuraste
> (`DAI_PM` en el `.env`): por el **MCP** de Jira/ClickUp si está conectado, o con
> **`dai publish <us.md>`** si no (crea el issue vía token). Tú respondes y decides.

### 🔵 Como dev — tengo una US y voy a implementarla

Una vez, preparas el repo:

```bash
npm i -g @dforce2055/dai
cd mi-repo && dai init          # bootstrap: skills + tracker + OpenSpec + PR template
# completa el token del tracker en .env  (o DAI_PM=md para probar sin credenciales)
dai doctor                      # verifica que todo quedó en su lugar
```

Y por cada US, el ciclo completo:

```bash
dai link-us <ID>                # trae la US del tracker → branch + implements.yaml
```
```text
/opsx:explore  →  /opsx:propose # exploras la solución y armas el diseño + tareas
/opsx:apply  ·  /tdd            # implementas con tests primero → genera los commits
```
```bash
dai check                       # ¿tu código sigue al día con la US?  ✅ / ⚠️ atrasado
# revisas tu propio código + smoke test local antes de la PR
dai pr --assignee <compañero>   # crea la PR precargada y se la asigna a un compañero
```
```text
/dai-review <PR>                # tu compañero deja un review estándar; un humano aprueba
```
```bash
dai stamp                       # al mergear: estampa la cobertura en el tracker
```

## Cómo usarlo — el flujo, paso a paso

Guía completa con salidas reales en [`docs/PROBAR.md`](docs/PROBAR.md); un caso narrado en
[`docs/EJEMPLO-END-TO-END.md`](docs/EJEMPLO-END-TO-END.md). Resumen:

| # | Fase | Cómo | Quién |
|---|---|---|---|
| 1 | **Instalar el CLI** | `npm i -g @dforce2055/dai` (o `npm link` en dev) · `dai --version` | dev |
| 2 | **Bootstrap del repo** | `dai init` → `.dai` + Claude/Copilot + config + PR template | dev/lead |
| 3a | **Definir el QUÉ** | `/grill-user-story` (una US) · `/grill-epic` (algo grande) · `/doc-to-backlog` (un doc) — te interrogan hasta una US testeable | PO / analista |
| 3b | **Publicar la US** | la skill la sube al tracker vía **MCP**, o con **`dai publish <us.md>`** (crea el issue vía token, sin MCP) → devuelve el key | PO / IA |
| 4 | **Linkear la US** | `dai link-us <ID>` → branch + `openspec/changes/<id>/implements.yaml` | dev |
| 5 | **Verificar / listar** | `dai check` (¿al día?) · `dai ls` (qué implementa el repo) | dev |
| 6 | **Resincronizar** *(si el PO editó la US)* | `dai link-us <ID> --resync` | dev |
| 7 | **Diseñar el CÓMO** | en el asistente: `/opsx:explore` → `/opsx:propose` → design + tasks | dev + IA |
| 8 | **Implementar** | `/opsx:apply` → implementa la US con TDD y genera los commits | dev + IA |
| 9 | **Code review propio** | revisas tu implementación (correctitud + calidad) antes de la PR | dev |
| 10 | **Smoke test** | pides al agente un smoke local del flujo | dev + IA |
| 11 | **Crear la PR** | `dai pr` → pregunta la branch base, arma el texto, lo muestra, confirma, pushea y crea la PR/MR | dev |
| 12 | **Review de un partner** | skill `/dai-review <PR>` deja un comentario estándar; un humano aprueba | partner |
| 13 | **Merge + estampar** | al mergear: `dai stamp` → cobertura inversa en el tracker | dev / CI |
| 14 | **Cerrar la US** | `dai done` → vuelve a la base, actualiza y borra la branch local (si está mergeada) | dev |

> **Paso 3b (publicar):** el MCP crea el issue interactivamente; `dai publish` necesita el
> token del tracker en `.env` (Jira además `DAI_JIRA_PROJECT`, ClickUp `DAI_CLICKUP_LIST_ID`).
>
> **Paso 7 (OpenSpec):** `dai init` te ofrece instalarlo **e inicializarlo** solo. Si los
> comandos `/opsx:*` no aparecen en el asistente, reinicia el IDE (se cargan al arrancar).
>
> **Paso 11 (PR):** necesita un remoto git (`origin`) y `gh`/`glab` autenticado. Sin remoto,
> dai no crea la PR (te deja el texto listo igual).

## Comandos

| Comando | Qué hace |
|---|---|
| `dai init [<repo>]` | scaffolder interactivo del repo. Flags: `--for claude\|copilot\|both` (asistente, ver arriba) · `--pm md\|jira\|clickup` (tracker) · `--openspec` |
| `dai install [--global \| --local <repo>] [--force] [--dry-run]` | instala/actualiza las skills de IA en Claude. `--force` re-copia aunque ya existan (para **actualizar** tras una nueva versión). Ej: `dai install --local . --force` (este repo) · `dai install --global --force` (tu Claude) |
| `dai publish <us.md>` | crea la US en el tracker (Jira/ClickUp/md) desde un `.md` y devuelve el key. Es el fallback del MCP para publicar sin el asistente |
| `dai link-us <ID> [--us <md>]` | crea branch + `implements.yaml`; sin `--us` trae la US del tracker |
| `dai link-us <ID> --resync` | re-estampa el `ac_hash` contra la US viva (tras un ⚠️ de check) |
| `dai check` | compara tu código vs la US viva → ✅ al día / ⚠️ atrasado (exit code = gate de PR) |
| `dai ls [--json]` | lista las US que implementa el repo + su link al tracker |
| `dai pr [--assignee u] [--base b] [--draft] [--yes]` | crea TU PR/MR precargada: pregunta la branch base (default `main`), muestra el texto y confirma antes de publicar |
| `dai stamp` | estampa la cobertura inversa en el tracker (branch + commit-ancla) |
| `dai done [--base main] [--force]` | cierra la US: vuelve a la base, `fetch --prune` + `pull`, y borra la branch local **si está mergeada** (chequeo estricto; `--force` la borra igual). Redes: no estar en la base, sin cambios sueltos, sin commits sin pushear |
| `dai forge comment <ref> --body-file <f>` · `dai forge pr <ref>` | comentar / leer una PR/MR (GitHub/GitLab) |
| `dai ac-hash <us.md>` | calcula el hash de los criterios de aceptación de una US |
| `dai doctor` · `dai docs <dest>` · `dai --version` | diagnóstico del entorno · copiar la doc · versión |

Skills (se invocan en el asistente): `/doc-to-backlog` · `/grill-intent` · `/grill-epic` · `/grill-user-story` · `/link-us` ·
`/tdd` · `/dai-review`. Config del tracker (`md`\|`jira`\|`clickup`) y tokens: en `.env` —
ver [`.env.example`](.env.example). Auth (SSH + tokens): [ADR-0007](docs/adr/0007-modelo-de-autenticacion.md).

## El flag `--for` — ¿para qué asistente preparo el repo?

`dai init` genera los archivos que hacen que las skills de IA (`grill-user-story`,
`link-us`, etc.) estén disponibles en tu asistente. `--for` elige **para cuál**:

| Valor | Genera | Elígelo si… |
|---|---|---|
| `--for claude` | `.claude/skills/` + `CLAUDE.md` | tu equipo usa **Claude** (Code / Desktop) |
| `--for copilot` | `.github/prompts/*.prompt.md` + `.github/copilot-instructions.md` | tu equipo usa **GitHub Copilot** (en VS Code / JetBrains) |
| `--for both` *(default)* | **ambos** | equipo **mixto** (unos con Claude, otros con Copilot) |

- Es **aditivo, no destructivo**: los dos conjuntos conviven sin pisarse (viven en
  carpetas distintas). La **misma** skill se transforma al formato de cada asistente.
- Si ejecutas `dai init` sin flag, te lo pregunta de forma interactiva.
- **No afecta el CLI:** `dai link-us` / `check` / `stamp` funcionan igual con cualquier
  `--for` (o ninguno) — el flag solo prepara la **invocación de skills** en el asistente.
- Ante la duda, `--for both`: cubre a todo el equipo y no cuesta nada.

## Lo que obtienes en tu repo

Después de `dai init` (con `--for both`):

```
mi-repo/
├── CLAUDE.md                       · Constitución del proyecto (auto-cargada por Claude)
├── .env                            · configurado con tu tracker (gitignored, completa el token)
├── .claude/skills/                 · Las skills, locales al repo (el equipo las hereda)
│   └── doc-to-backlog · grill-intent · grill-epic · grill-user-story · link-us · tdd · dai-review
├── .github/
│   ├── copilot-instructions.md     · La constitución, auto-inyectada en cada chat de Copilot
│   ├── prompts/*.prompt.md         · Las mismas skills, generadas en formato Copilot
│   └── pull_request_template.md    · Molde de PR/MR atado al link
└── .dai/
    ├── templates/                  · formato-us · epica · DoR · DoD · adr · pull-request
    └── governance/                 · branch-naming · ci-rules

Al trabajar se suma:
└── openspec/changes/<id>/          · implements.yaml (el link) + proposal · design · tasks
```

### Dónde se invocan las skills (por asistente)

Las skills se invocan en el asistente — **no en todas sus superficies** (límite del asistente, no de dai):

| Asistente / superficie | ¿Skills? | Mecanismo |
|---|---|---|
| **Claude Desktop** | ✅ | `~/.claude/skills/` (global) — sin IDE ni consola |
| **Claude Code** | ✅ | `~/.claude/skills/` + `.claude/skills/` del repo |
| **Copilot en VS Code / JetBrains** | ✅ | los `.github/prompts/*.prompt.md` |
| **Copilot CLI** | ✅ | custom agents |
| **Copilot app standalone / github.com chat** | ❌ | los prompt files son solo-IDE |

El analista sin IDE cierra con **Claude Desktop**; con Copilot necesita **VS Code o el Copilot
CLI**. El CLI `dai` corre en cualquier terminal, con cualquier asistente o ninguno.

## Se adapta a cualquier escala

**Un protocolo invariante** para, sólo developer, equipos chicos y grandes,
una misma ceremonia. **N1** (un dev, todo local) → **N2** (equipo + tracker) → **N3**
(muchos repos, CI que estampa). Cada capa se agrega cuando es necesario, no antes.
El dev que lo usa en un equipo chico, está listo para usarlo en equipos grandes distribuidos.

## Por dónde empezar a leer

1. **[`docs/MANIFIESTO.md`](docs/MANIFIESTO.md)** — la ley: 4 valores + 15 artículos. 5 minutos.
2. **[`docs/SCRUM-CON-IA.md`](docs/SCRUM-CON-IA.md)** — tu Scrum de siempre, en 10 pasos con IA.
3. **[`docs/EJEMPLO-END-TO-END.md`](docs/EJEMPLO-END-TO-END.md)** — el golden path sobre una US real.
4. **[`docs/METODOLOGIA.md`](docs/METODOLOGIA.md)** — el detalle del protocolo y el porqué.

Además: [`docs/glosario.md`](docs/glosario.md) · guías por rol ([`po`](docs/guias/po.md) ·
[`dev`](docs/guias/dev.md) · [`lead`](docs/guias/lead.md)) · [decisiones (ADRs)](docs/adr/) ·
[landing](index.html).

## Qué hay en la caja (el paquete dai)

```
dai/
├── cli/            🖥️  el binario `dai` (Node, cero dependencias) + su suite de tests
├── docs/           📖  la metodología: MANIFIESTO · METODOLOGIA · SCRUM-CON-IA · EJEMPLO ·
│                       glosario · guias/ · detalle/ (10 pasos) · adr/ (0001–0007)
├── templates/      🧩  los moldes (formato-us · epica · DoR · DoD · adr · pull-request)
├── skills/         🤖  doc-to-backlog · grill-intent · grill-epic · grill-user-story · link-us · tdd · dai-review
├── governance/     🛡️  branch-naming · ci-rules
├── index.html      📊  landing autocontenido (la historia); publicable por GitHub Pages
└── manifest.yaml · VERSION · install.sh (shim) · .env.example
```

## Licencia

**GPLv3** (`GPL-3.0-or-later`) — ver [`LICENSE`](LICENSE). Software libre: puedes verlo,
auditarlo, modificarlo y redistribuirlo; si distribuyes una versión modificada, tiene que
quedar también libre. *Libre no es gratis*: se puede cobrar por uso, soporte o desarrollo.
Detalle en [ADR-0006](docs/adr/0006-distribucion-y-licencia.md).

> **Ayúdanos a mejorar dai** 🌱 — es software libre y una **metodología viva**: se hace mejor
> con la comunidad. Si te sirve, cuenta tu experiencia, reporta lo que falle y propón mejoras.
> Toda contribución al método o a la herramienta es bienvenida. Empieza por
> [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Agradecimientos

dai se apoya en ideas y aprendizajes de la comunidad. En particular, gracias a
**[Matt Pocock](https://github.com/mattpocock)** por su aporte con las *skills* y por su
[canal de YouTube](https://www.youtube.com/@mattpocockuk) explicándolas — su trabajo nos ayudó
a construir esta herramienta.

Seguridad: [`SECURITY.md`](SECURITY.md) · Conducta: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
