# ADR-0010 — Versionado y upgrade (compatibilidad, `doctor` version-drift, `dai sync`)

- **Estado:** propuesto
- **Fecha:** 2026-07-09
- **Decide:** lead / arquitecto de la metodología

## Contexto

Un equipo scaffoldea su repo con dai `X.Y.Z`. Después publicamos versiones nuevas
(`2.2`, `2.9`, `3.0`). ¿Qué pasa con su trabajo? ¿Tienen que actualizar el CLI y el
repo? Hoy no hay política escrita ni herramienta de upgrade — el equipo queda a ciegas.

Lo que dai deja en un repo no es una cosa, son **cuatro capas** con impacto distinto
ante un upgrade (y una premisa de fondo: dai **da herramientas, no obliga** — MANIFIESTO
Art. 14, "la ceremonia se agrega cuando duele, no antes"):

| Capa | Qué es | Naturaleza |
|---|---|---|
| **CLI** | el binario `dai` (npm global) | por máquina/dev |
| **Copias scaffoldeadas** | skills, constitución (`CLAUDE.md`/rules), templates, PR template | **caché derivable**, commiteado por repo |
| **OpenSpec** | `openspec/` | **herramienta aparte** (@fission-ai/openspec), versionado propio |
| **Dato de trazabilidad** | `implements.yaml` (id, version, **`ac_hash`**) | el **contrato** (ADR-0001, ADR-0004) |

Solo la última capa, si cambia, **invalida trabajo hecho**. Por eso el principio rector
es: **dai no obliga a actualizar** — `doctor` avisa, el equipo decide cuándo.

## Decisión

### 1. La compatibilidad la comunica el semver (formaliza `RELEASING.md`)

- **patch / minor** (`2.0` → `2.2` → `2.9`): el **contrato NO cambia**. Todo lo hecho
  sigue válido; `dai check` da igual que antes. Upgrade **opcional** (fixes/features).
- **major** (`2.x` → `3.0`): puede cambiar el algoritmo del `ac_hash` o el schema del
  `implements.yaml`. Requiere **migración**.

**Invariante duro:** *dentro de una línea major, `ac_hash(input)` es estable* — el hash
que calcula `2.0` es idéntico al de `2.9` para la misma US. Es lo que vuelve seguros a
los minors. Se blinda con **golden vectors de `ac_hash` en CI que NO pueden cambiar
dentro de una major** (romperlos = obligado a bumpear major).

### 2. Las copias son caché derivable, no algo que se mantiene a mano

Las skills/constitución/templates del repo son **copias** de lo que trae el CLI. Una
copia vieja **sigue funcionando** (una skill/constitución vieja es un prompt válido).
No se editan a mano en el repo: se **regeneran** (mismo espíritu que "la cobertura se
deriva"). La fuente de verdad es la versión del CLI.

OpenSpec queda **fuera de alcance**: es otra herramienta con su propio upgrade
(`openspec`), dai solo la instala/inicia. `dai sync` **no** toca OpenSpec.

### 3. `.dai/VERSION` = provenance del scaffold

`dai init` ya estampa con qué versión se scaffoldeó el repo. Es el marcador para
detectar drift entre el repo y el CLI instalado.

### 4. `dai doctor` chequea version-drift

Compara `.dai/VERSION` (repo) contra la versión del CLI instalado y reporta:

| Situación | Mensaje |
|---|---|
| iguales | ✓ al día |
| CLI > repo, **misma major** | ℹ️ refresh disponible (skills/constitución de `vX`, CLI `vY`). `dai sync` cuando quieras — **opcional, nada roto** |
| CLI **major** > repo | ⚠️ cambio mayor: puede tocar el contrato. Ver `MIGRATION.md`/CHANGELOG antes; `dai sync` + `dai migrate` si aplica |
| CLI < repo | ⚠️ tu repo se scaffoldeó con una versión más nueva que tu CLI — actualizá el CLI |

### 5. `dai sync` — refresco **aditivo** de las copias (comando nuevo)

Re-genera skills, constitución (bloque `<!-- dai:start/end -->`), templates y PR
template **a la versión del CLI**, **aditivo e idempotente**. Reusa la maquinaria del
init aditivo: `upsertBlock` (constitución), `mergeEnv` (`.env`/`.env.example`),
`reconcileGitignore`. **No pisa** lo del proyecto (constitución propia, config). Respeta
el `--for` ya presente en el repo y actualiza `.dai/VERSION`.

- Flags: `--dry-run` (qué cambiaría, sin tocar), `--for` (override de asistentes).
- Es **opt-in**: lo corre el equipo cuando quiere.
- Relación con `dai install`: `sync` = `install --local . --force` **consciente de la
  constitución + templates + `.dai/VERSION`**, con reporte de drift. Se puede
  implementar como extensión/alias de `install`, pero el verbo explícito comunica mejor
  la intención (refrescar un repo ya inicializado).

### 6. Majors: `dai migrate` + `MIGRATION.md` + nota BREAKING

Cuando un major cambia el contrato, se provee migración — p. ej. re-derivar y
re-estampar los `ac_hash` en masa (un `link-us --resync` para todos los
`implements.yaml`). Documentado en `MIGRATION.md`, marcado **BREAKING** en el CHANGELOG.
Los majors son **raros y bien soportados**.

### 7. Future-proofing del schema (enmienda menor a ADR-0004)

Estampar `schema: <n>` en el `implements.yaml` para que un futuro `dai migrate` sepa de
qué versión de schema migrar. Se puede **diferir** hasta que un major lo necesite, pero
conviene reservar el campo desde ya.

## Consecuencias

- ✅ El **número de versión comunica el radio de explosión**: el equipo sabe si un
  upgrade es seguro sin leer diffs.
- ✅ Upgrades **opt-in** — respeta el ADN (dai no obliga). `doctor` avisa, el equipo
  decide.
- ✅ Las copias son caché → `dai sync` las refresca sin miedo (aditivo, no pisa).
- ✅ **Reusa** la maquinaria aditiva ya construida y testeada (`upsertBlock`/`mergeEnv`/
  `reconcileGitignore`, v0.3.0) — costo de implementación bajo.
- ⚠️ Obliga a **golden vectors de `ac_hash` en CI** inmutables dentro de una major —
  disciplina de release.
- ⚠️ `dai sync` debe ser **estrictamente aditivo/idempotente**; un bug ahí pisaría
  trabajo (mismo riesgo que tuvo el `init` — ya mitigado y testeado).
- ⚠️ Hay que comunicar que `dai sync` **no** actualiza OpenSpec (upgrade aparte).

## Alternativas consideradas

- **Forzar re-scaffold/upgrade en cada versión** — descartado: viola el ADN (dai no
  obliga); rompería la adopción. dai es como git: no te dicta cómo trabajar.
- **No versionar el scaffold (sin drift check)** — descartado: sin provenance no se
  puede avisar; el equipo queda a ciegas.
- **Mantener las copias a mano** — descartado: contradice "la cobertura se deriva"; las
  copias son caché, la fuente es el CLI.
- **`dai sync` destructivo (pisar y re-copiar)** — descartado: pisaría la constitución
  propia del proyecto. Debe ser aditivo (lección del `init`, v0.3.0).
- **Meter todo en `dai install --force`** — posible; pero `sync` como verbo explícito +
  reporte de drift comunica mejor la intención. Se implementa como extensión de
  `install`.
