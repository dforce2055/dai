# ADR-0004 — Ubicación y schema del `implements.yaml`

- **Estado:** aceptado
- **Fecha:** 2026-07-03
- **Decide:** lead / arquitecto de la metodología

## Contexto

El `implements.yaml` es el **único registro autorado** del link QUÉ↔CÓMO ([Art. 9](../MANIFIESTO.md#art-9)).
Para que `link-us` lo scaffoldee y `dai check`/`stamp` lo parseen, hay que congelar
**dónde vive** y **qué campos tiene**. Es la decisión abierta #4 de METODOLOGIA §7.

Dos requisitos duros (Art. 9): vive **en el repo de código** y está **versionado por
git** — así el `ac_hash` estampado viaja con el commit y el link es revisable en el PR.

## Decisión

### Ubicación

- **Co-localizado con la unidad de trabajo** (una US = una capacidad entera = un
  `implements.yaml`). Default usando OpenSpec: `openspec/changes/<change-id>/implements.yaml`.

El `implements.yaml` vive **junto a los artefactos de OpenSpec** del change, no aparte:

```
openspec/
└── changes/
    └── finalizar-compra/          # el change = el CÓMO (una US = una capacidad entera)
        ├── proposal.md            # opsx:propose · qué se propone y por qué
        ├── design.md              # opsx:propose · el diseño técnico
        ├── tasks.md               # opsx:propose · las tareas (se implementan con TDD)
        ├── specs/                 # opsx:propose · las deltas de spec
        │   └── carrito/
        │       └── spec.md
        └── implements.yaml        # ★ dai link-us · el link QUÉ↔CÓMO (id + @version + ac_hash)
```

Los tres primeros los genera **OpenSpec** (`opsx:propose`); el `implements.yaml` lo agrega
**dai** (`link-us`) en la misma carpeta. Al archivar, el change entero (incluido el
`implements.yaml`) se mueve a `openspec/changes/archive/` y **sigue contando** para la cobertura.

- **Tool-agnóstico por descubrimiento (Art. 2):** `dai` **no** hardcodea la ruta de
  OpenSpec. Hace un glob de `**/implements.yaml` (excluyendo `node_modules`, `dist`,
  etc.). Un equipo con Swagger u otra herramienta lo pone donde quiera y `dai` lo
  encuentra.
- **Incluye archivados:** el glob abarca `openspec/changes/archive/**` — un change
  archivado sigue vivo en el código, así que **cuenta** para la cobertura.
- **La lista de "qué implementa el repo" es derivada**, no un manifiesto a mano: se
  arma escaneando los `implements.yaml` co-localizados (Art. 10).

### Schema

```yaml
change: finalizar-compra          # identidad del CÓMO (nombre local del change/spec).
                                 # Explícito, NO derivado del path → sobrevive al archivado.
repo:   frontend            # repo donde vive.

implements:                      # FORWARD: qué QUÉ cumple este change (capacidad entera).
  - id: ABC-482                 #   ticket de Jira/ClickUp (identidad del QUÉ). No se tipea: lo pone link-us.
    version: v1                  #   spec_version de la US al implementar (nº legible).
    ac_hash: 7f3a9c2e            #   snapshot del hash de criterios (lo calcula `dai ac-hash`).

introduces:                      # specs técnicas nuevas que crea este change (opcional).
  - guard-carrito-vacio

autor: D. Force (dev)            # quién implementa.
```

- `change` y `repo` son obligatorios y hacen el registro **auto-contenido**: `dai stamp`
  puede reportar "ABC-482 ← frontend/finalizar-compra @v1" sin parsear rutas.
- `implements` es una lista (un change podría cumplir más de un QUÉ, aunque el default
  es uno — capacidad entera, §2.6).
- El link es **dirigido CÓMO→QUÉ**; la inversa (QUÉ→CÓMO en Jira) la deriva `dai stamp`.

## Consecuencias

- ✅ `link-us` tiene molde exacto para generar; `check`/`stamp` tienen contrato para
  parsear.
- ✅ Registro auto-contenido → robusto al archivado y a mover carpetas.
- ✅ Independiente de OpenSpec: la ubicación es convención, el descubrimiento es glob.
- ⚠️ El glob debe excluir directorios ruidosos (`node_modules`, `dist`, `vendor`) para no
  escanear de más.
- ⚠️ Si un repo tuviera dos `implements.yaml` con el mismo `change`, es un error a
  detectar (identidad duplicada).

## Alternativas consideradas

- **Un manifiesto único en la raíz (`.dai/implements.yaml`)** — descartado: archivo
  compartido que todos editan (conflictos de merge), y pierde la co-localización que
  hace el diff del PR revisable.
- **Derivar la identidad del CÓMO del path de la carpeta** — descartado: se rompe al
  archivar/mover; mejor un campo `change` explícito.
- **Registrar el mapping también a mano en Jira** — descartado: sería un tercer
  registro que se desincroniza; la inversa se deriva (Art. 10).
