# ADR-0001 — El contrato del `ac_hash`

- **Estado:** aceptado
- **Fecha:** 2026-07-03
- **Decide:** lead / arquitecto de la metodología

## Contexto

El `@version` del link ([Art. 11](../MANIFIESTO.md#art-11) del manifiesto) es lo que hace que un cambio del QUÉ
marque solo a los CÓMO atrasados. Ese mecanismo depende del `ac_hash`: un hash de
los criterios de aceptación. Hasta ahora el `ac_hash` figuraba como "autogenerado"
pero ninguna skill ni CI lo calculaba de verdad — con lo cual el versionado era
decorativo. Sin un algoritmo definido, dos problemas: un typo dispararía un falso
atraso, y distintas implementaciones (skill vs CI) podrían calcular hashes distintos.

Y un tercero, más profundo: **el QUÉ muta después de publicarse, y no siempre por la
skill.** Un PO edita un criterio a mano en Jira. Si el `ac_hash` se calculara **una
sola vez** (al publicar la US), quedaría stale ante esa edición y la detección de
atrasos se rompería en silencio — justo el pecado que la metodología existe para
evitar. Por lo tanto el hash **no puede ser un evento de autoría**: tiene que
re-derivarse de la US viva en el momento de la verificación.

## Decisión

### El algoritmo (una sola implementación: `dai ac-hash`)

1. Tomar el bloque **Criterios de aceptación** de la US.
2. **Normalizar**: remover marcado editorial (checkboxes, viñetas, numeración,
   etiquetas `AC-N`, énfasis, headings) y colapsar todo el whitespace. Objetivo: que
   un cambio *editorial* no cambie el hash.
3. Hashear el texto normalizado con **SHA-256**, truncado a 8 hex (`7f3a9c2e`).
4. El **orden** de los criterios es significativo: reordenar cambia el hash (por eso
   el formato de US pide orden estable). No se ordena en la normalización.

Existe **una sola** implementación canónica: el comando `dai ac-hash` (CLI, cero
dependencias). Nadie más calcula el hash: todos lo **invocan**. En particular, una
skill (un LLM) **nunca** computa el hash por su cuenta — sería no determinista y
daría distinto al CI (ver ADR-0002: lo mecánico vive en el CLI).

### Los tres momentos (y quién es la autoridad)

| Momento | Quién | Qué hace con el hash |
|---|---|---|
| **Publicar la US** | `grill-user-story` → invoca `dai ac-hash` | *(opcional)* muestra/embebe el hash de nacimiento (v1). **Conveniencia, no verdad.** |
| **Implementar** | `link-us` → invoca `dai ac-hash` | estampa en `implements.yaml` el hash que el CÓMO **declara** implementar. |
| **Verificar** | CI / indexador → `dai ac-hash` sobre la US **viva** | re-deriva y **compara** con `implements.yaml`. Distinto → ⚠️ atrasado. |

**La única fuente de verdad de la detección es el tercer momento**: el CI re-deriva el
hash leyendo la US como está *ahora*, no una copia estampada en el pasado. Los otros
dos son declaraciones/cortesías.

### El artefacto-QUÉ (matiz de niveles)

La detección exige un **artefacto-QUÉ con identidad estable y criterios testeables**,
no necesariamente una US publicada en un tracker. En N3/N2 es la US en Jira/ClickUp;
en N1 es el `proposal.md` de OpenSpec (los niveles de ceremonia N1/N2/N3 — dev solo /
equipo compacto / organización grande — están en el [glosario](../glosario.md)). El `ac_hash` se calcula igual sobre cualquiera
de los tres — no forzamos tracker externo donde el Art. 14 dice no adelantar
complejidad.

## Consecuencias

- ✅ El versionado deja de ser decorativo: los atrasos se detectan solos.
- ✅ Cambios editoriales (typos, reformatos) **no** disparan falsos atrasos.
- ✅ Una edición manual de la US en Jira **sí** se detecta, porque el CI re-deriva del
  vivo — no depende de que alguien vuelva a correr una skill.
- ⚠️ La **normalización** es crítica: una sola implementación (`dai ac-hash`), y el CI
  debe usar exactamente ese binario/lógica, nunca reimplementarlo. Es lo más testeado.
- ⚠️ Reordenar criterios **sí** cambia el hash — por eso el formato de US pide orden
  estable. Es una obligación nueva para el PO.
- ⚠️ El CI necesita **leer la US viva** (API de Jira/ClickUp o el `.md`) para
  re-derivar. Ese es el punto donde el link toca la distribución (ver METODOLOGIA §7).

## Alternativas consideradas

- **Calcular el hash en `grill-user-story` al publicar (una vez)** — descartado: la US
  muta después, fuera de la skill; el hash estampado quedaría stale y la detección se
  rompería en silencio. La skill puede *invocar* `dai ac-hash` como cortesía, pero no
  es la autoridad.
- **Que la skill (LLM) compute el hash** — descartado: no determinista, daría distinto
  al CI. Lo mecánico va al CLI (ADR-0002).
- **Hash del texto crudo (sin normalizar)** — descartado: cualquier typo dispararía un
  falso atraso, y el ruido mataría la confianza en el ⚠️.
- **Solo `spec_version` manual, sin hash** — descartado: depende de que la persona se
  acuerde de bumpear; el hash detecta aunque se olvide (el número comunica, el hash
  detecta).
