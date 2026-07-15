# ADR-0014 — Copilot lee SKILL.md nativo (Agent Skills)

- **Estado:** aceptado
- **Fecha:** 2026-07-15
- **Decide:** lead / arquitecto de la metodología
- **Modifica:** [ADR-0002](0002-agnostico-del-asistente.md) (la capa 3 del adaptador de Copilot)

## Contexto

La ADR-0002 definió tres capas: contenido portable (los `SKILL.md`), un CLI determinista
y **adaptadores generados** por asistente. Para Copilot ese adaptador era
`skillToPrompt()` → `.github/prompts/<nombre>.prompt.md`, porque los prompt files eran
el único mecanismo que Copilot tenía. De ahí salía su consecuencia registrada: *"el
analista sin IDE cierra con Claude Desktop"*, ya que los prompt files son solo-IDE.

**Eso dejó de ser cierto.** En diciembre de 2025 GitHub adoptó **Agent Skills**, el
estándar abierto de `SKILL.md` — el mismo formato que dai ya usa como fuente. Hoy la
[documentación oficial](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
dice, literal:

> "Agent skills work with Copilot cloud agent, Copilot code review, the GitHub Copilot
> CLI, the GitHub Copilot app, and agent mode in Visual Studio Code and JetBrains IDEs."

Con rutas estándar: **`.github/skills`**, `.claude/skills` o `.agents/skills` por repo;
**`~/.copilot/skills`** o `~/.agents/skills` personales. El frontmatter requerido es
`name` + `description` — exactamente lo que `validateSkill()` ya exige.

Lo descubrimos con un analista funcional real que no lograba que Copilot viera sus
skills. Tres fallas encadenadas, todas nuestras:

1. **`dai skills install` las dejaba en `~/.claude/skills`.** Esa ruta es válida como
   skill personal *en VS Code*, pero **no** en el Copilot CLI ni en la app, que solo
   miran `~/.copilot/skills`. El CLI encima warneaba *"Copilot no tiene skills
   instalables"* — falso desde diciembre.
2. **`skillToPrompt()` perdía los `templates/`.** Solo leía el `SKILL.md`, así que
   `grill-user-story/templates/user-story.md` nunca viajaba y el prompt quedaba con un
   link roto. Copilot, en cambio, *"automatically discovers all of the files in the
   skill's directory"*.
3. **La conversión borraba el `name:`** (había un test afirmándolo como correcto), que
   en Agent Skills es **requerido** y es lo que define el `/comando`.

## Decisión

**El adaptador de Copilot se elimina: dai le entrega el `SKILL.md` tal cual.**

- **`dai init --for copilot`** → `.github/skills/<nombre>/` como **copia cruda** (igual
  que Claude), con sus `templates/` adentro. Ya no genera `.github/prompts/`.
- **`dai skills install --for copilot`** → `~/.copilot/skills/` (global) o
  `.github/skills/` (local). Copilot **sí** tiene skills instalables.
- **`skillToPrompt()` se borra.** Queda `stalePromptFiles()`: `dai init` **elimina los
  `.prompt.md` que generó dai** en versiones previas — si no, cada `/comando` aparecería
  duplicado, con una copia vieja y sin templates. Solo borra los suyos; los prompt files
  propios del equipo no se tocan.
- **`dai doctor` chequea Copilot** y, sobre todo, **solo reporta los asistentes que el
  repo realmente usa**. Antes listaba los tres siempre: quien configuraba uno veía 14
  warnings de los otros dos y leía "está todo roto" cuando estaba todo bien.
- **Cada asistente conserva SU directorio** (`.claude/skills`, `.github/skills`,
  `.cursor/skills`), aunque Copilot sepa leer los tres. La simetría es predecible y
  mantiene la capa 3 de la ADR-0002 donde sigue haciendo falta (Cursor).

## Consecuencias

- **La conclusión de la ADR-0002 sobre el analista sin IDE queda revocada.** Un
  funcional puede cerrar el ciclo con **Copilot CLI o la app de Copilot**, sin VS Code.
  La tabla del README se corrige: la única superficie sin skills es el chat de
  github.com.
- **Los `templates/` de las skills llegan a Copilot por primera vez.**
- **El frontmatter pasó a tener un lector estricto, y eso destapó un defecto viejo.**
  Nuestro `parseFrontmatter` es un regex, no YAML: se tragaba cualquier cosa. Y la
  conversión que borramos hacía `JSON.stringify(description)`, que citaba el valor —
  o sea que **estaba tapando el bug sin querer**. Al entregar el `SKILL.md` crudo, lo
  lee un parser YAML real, y `doc-to-backlog` y `grill-epic` **fallaron al cargar**: sus
  descripciones tenían un `: ` suelto (*"…épicas finales: extrae…"*, *"…nivel
  funcional/alcance: define…"*) que YAML interpreta como el arranque de un mapa. Las dos
  skills que más necesita un analista funcional, invisibles.
  Se citan las descripciones de las 7, y **`validateSkill` ahora valida que `name` y
  `description` sean escalares YAML válidos** — el molde de `templates/skill.md` también
  cita por defecto. La lección general: **un adaptador que "arregla" el input esconde el
  defecto en la fuente**. Mientras convertíamos, el `SKILL.md` inválido era nuestro
  secreto; entregándolo crudo, el contrato es real y hay que cumplirlo.
- **Menos código, no más:** se borra una transformación y su test. La capa 3 de la
  ADR-0002 sigue siendo la decisión correcta — lo que cambió es que Copilot dejó de
  necesitarla, no que la idea estuviera mal. Cuando el formato de una skill es un
  estándar abierto, el mejor adaptador es ninguno.
- **Riesgo asumido:** un repo con `--for all` tendrá el mismo skill en `.claude/skills`
  y `.github/skills`, y Copilot mira ambos. El estándar exige `name` único, así que
  esperamos deduplicación por nombre; si en la práctica duplica, se resuelve entonces.
- **Migración:** `dai init` es idempotente y limpia solo. Un repo viejo se pone al día
  con `dai init --for copilot` (o `dai sync`).

## Alternativas descartadas

- **Mantener los `.prompt.md` "por compatibilidad".** Duplicaría cada `/comando` con una
  copia peor. Copilot soporta skills en todas sus superficies desde enero; sostener el
  camino viejo es sostener el bug.
- **Escribir solo `.claude/skills` y que Copilot lo levante** (lo hace: *"if you've
  already set up skills for Claude Code in the `.claude/skills` directory, Copilot will
  pick them up automatically"*). Rompe la simetría del adaptador y sorprende: pedir
  `--for copilot` y no tener nada de Copilot en el repo es un mal contrato.
