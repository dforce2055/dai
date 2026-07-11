# Autoría humana — quién firma el código de dai

> El código de `dai` lo **autora y revisa una persona**. Un agente puede ayudarte a
> escribirlo, pero el commit lo firmas tú: con tu identidad, y sin dejar al agente
> como co-autor. No es una postura sobre cómo trabajas — es una regla de contribución
> de **este repo**, y un check la blinda, sin depender de que nadie "se acuerde"
> (mismo espíritu que [`ci-rules.md`](ci-rules.md) y [`commit-convention.md`](commit-convention.md)).

## La regla

Ningún commit que entre a `dai` puede tener un **agente o bot** como:

- **author** — quien escribió el cambio,
- **committer** — quien lo registró, ni
- **`Co-authored-by:`** — un co-autor en el mensaje.

Concretamente se rechazan identidades de asistentes de código (Cursor, GitHub
Copilot, Claude, Devin, Codeium, Windsurf, … y cualquier `…[bot]`). La lista es
editable en [`scripts/no-agent-authors.sh`](../scripts/no-agent-authors.sh).

## Por qué

- **La persona firma ([Art. 5](../docs/MANIFIESTO.md#art-5)).** El código que entra a
  `dai` es una decisión de una persona que lo entiende y se hace responsable. Un
  commit firmado por un agente diluye ese "alguien responde por esto".
- **No vibe coding ([Art. 7](../docs/MANIFIESTO.md#art-7)).** El aporte no es "lo que
  salió del chat": es un cambio que revisaste, entendiste y hiciste tuyo.
- **Higiene del historial.** El grafo de *Contributors* del repo se arma con
  author/committer/co-author. Un trailer de agente mete al bot como contribuidor —
  y sacarlo después obliga a reescribir historia.

## Distinción importante (no es scope de la metodología)

Esto **no** dice cómo debes usar agentes en *tus* proyectos. La metodología es
agnóstica de la herramienta de abajo ([Art. 2](../docs/MANIFIESTO.md#art-2)): usa los
agentes como quieras. Esta regla gobierna **la contribución al repo de dai**, igual
que el naming de ramas o la convención de commits. Por eso vive en `governance/` y
**no** se publica como parte de las plantillas de la metodología.

## Cómo cumplirla

Si un agente te ayudó con un cambio: **revísalo, apropiate de él y commitealo con tu
identidad**, sin el trailer `Co-authored-by`. Configura tu identidad una vez:

```bash
git config user.name  "Tu Nombre"
git config user.email "tu@email"
```

## Cómo se blinda

Dos capas, un solo script ([`scripts/no-agent-authors.sh`](../scripts/no-agent-authors.sh),
cero dependencias):

| Capa | Qué | Cuándo |
|---|---|---|
| **Hook local** | [`.githooks/commit-msg`](../.githooks/commit-msg) valida el commit en curso (`--pending`). | Al commitear, si activaste `git config core.hooksPath .githooks`. Es opt-in y salteable — feedback temprano, no barrera. |
| **CI (el gate)** | El job `authorship` de [`ci.yml`](../.github/workflows/ci.yml) valida todos los commits del PR (`--range`). | En cada PR. Como *required check* **bloquea el merge**. No es salteable. |

El hook avisa temprano; el CI es la barrera real. El commit siempre es de una persona
antes de que un mantenedor lo firme ([`CONTRIBUTING.md`](../CONTRIBUTING.md)).
