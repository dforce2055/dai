# ADR-0002 — La metodología es agnóstica del asistente de IA

- **Estado:** aceptado
- **Fecha:** 2026-07-03
- **Decide:** lead / arquitecto de la metodología

## Contexto

Las skills están hoy empaquetadas como **skills de Claude Code** (`SKILL.md` en
`.claude/skills/`). Pero los equipos usan asistentes distintos: una organización usa
**GitHub Copilot** (nadie usa Claude), otra usa **Claude Code**. Si atamos la
metodología a un asistente, dejamos afuera a media empresa — y contradecimos el
principio rector "sin importar la herramienta de abajo" (Art. 2), que ya aplicamos a
las herramientas de spec (OpenSpec/Swagger/yml). Falta aplicarlo **una capa más
arriba**: el asistente de IA.

## Decisión

Aplicamos el mismo principio al asistente. Una "skill" se separa en tres capas:

1. **Contenido portable** — la lógica de interrogación, el formato, los cortes. Se
   escribe **una sola vez**, neutral al asistente. Es la fuente de verdad.
2. **Acciones deterministas = CLI `dai`** — todo lo mecánico (crear rama,
   scaffoldear `implements.yaml`, calcular `ac_hash`, indexar cobertura) vive en el
   **CLI**, no en la inteligencia del asistente. `dai link-us ABC-###` anda igual
   con Claude, con Copilot, o sin ningún asistente. Es la forma más agnóstica de
   garantizar comportamiento determinista: el asistente solo lo **invoca**.
3. **Adaptadores por asistente (delgados, generados)** — de la Capa 1 se emiten los
   wrappers finos de cada asistente:
   - **Claude Code** → `SKILL.md` en `.claude/skills/`.
   - **Copilot** → `.github/prompts/*.prompt.md` + `.github/copilot-instructions.md`
     (este último auto-inyecta el manifiesto en cada chat del repo).

El instalador elige el target: `dai init --for claude` | `--for copilot` | `--for both`.
Mismo método, misma CLI, distinto wrapper. **`--for` es aditivo, no destructivo**: los
adaptadores coexisten en el mismo repo (viven en carpetas distintas —
`.claude/skills/` y `.github/prompts/`— y no se pisan). Un equipo mixto (unos con
Copilot, otros con Claude) versiona los dos y cada quien usa el suyo. Como lo mecánico
vive en el CLI, el **output es idéntico** sin importar qué asistente lo disparó: misma
rama, mismo `implements.yaml`, mismo `ac_hash`. El repo queda consistente aunque el
equipo esté mezclado.

| Capacidad | Naturaleza | Claude Code | Copilot |
|---|---|---|---|
| `grill-intent`, `grill-user-story` | interrogación (prompt puro) | `SKILL.md` | `*.prompt.md` |
| `link-us`, `ac-hash`, `coverage` | acción mecánica | wrapper → `dai <cmd>` | prompt/CLI → `dai <cmd>` |
| el manifiesto y las reglas | contexto siempre presente | `CLAUDE.md` / `project.md` | `.github/copilot-instructions.md` |

## Consecuencias

- ✅ La misma metodología corre en una organización con Copilot y en una factory con
  Claude — "un protocolo, distinta plomería" aplicado al asistente.
- ✅ Lo mecánico se vuelve **más confiable**: un CLI determinista no alucina.
- ✅ Los docs (`MANIFIESTO`, `METODOLOGIA`, guías, glosario) ya eran 100% agnósticos:
  la dualidad solo toca la capa `skills/`.
- ⚠️ Hay que **construir el CLI `dai`** con los subcomandos mecánicos (hoy esa lógica
  está descrita dentro de las skills de Claude). Es trabajo nuevo.
- ⚠️ Las capacidades de agente difieren: los prompts puros portan limpio; las
  acciones se apoyan en el CLI. Copilot en modo agente puede correr el CLI; en modo
  chat, el dev lo corre a mano.
- ⚠️ **Límite de superficie de Copilot (verificado):** los `.github/prompts/*.prompt.md`
  se invocan **solo en VS Code / Visual Studio / JetBrains** (o, como custom agents, en
  el **Copilot CLI**). **No** en la app standalone de Copilot ni en el chat de
  github.com. Claude, en cambio, lee `~/.claude/skills/` tanto en **Claude Code** como
  en **Claude Desktop**. Consecuencia: el analista funcional "sin IDE" cierra con Claude
  Desktop; con Copilot necesita VS Code o el Copilot CLI. Es un límite de Copilot, no de
  dai — el CLI `dai` corre igual en cualquier terminal.
- ⚠️ Los wrappers se **generan**, no se mantienen a mano — si no, driftean (la misma
  regla de oro del link).

**Estado de implementación:** `dai init` es un **scaffolder interactivo** (estilo
`create-vue`): pregunta asistente (`--for claude|copilot|both`) y gestor
(`--pm md|clickup|jira`), genera los adaptadores (`.claude/skills/` + `CLAUDE.md`;
`.github/prompts/*.prompt.md` + `.github/copilot-instructions.md`, transformando los
`SKILL.md` con `cli/lib/bootstrap.mjs`), deja un `.env` configurado, y cierra con
próximos pasos. **OpenSpec:** se detecta; si falta, se **ofrece instalarlo**
(`npm i -g @fission-ai/openspec@latest` + `openspec init`) — no se bundlea (Art. 2).
Con flags o sin TTY corre no-interactivo (defaults `both`/`md`, OpenSpec solo con `--openspec`).

## Alternativas consideradas

- **Mantener skills separadas por asistente a mano** — descartado: drift garantizado
  al primer cambio (viola Art. 9/Art. 10 aplicados al propio paquete).
- **Atarse solo a Claude** — descartado: deja afuera a la organización que usa
  Copilot, que es justo uno de los dos casos que el método debe soportar.
- **Meter toda la lógica mecánica en el asistente (sin CLI)** — descartado: no es
  portable y es menos confiable (el asistente puede alucinar un paso determinista).
