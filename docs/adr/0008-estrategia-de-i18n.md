# ADR-0008 — Estrategia de internacionalización (i18n)

- **Estado:** propuesto
- **Fecha:** 2026-07-06
- **Decide:** lead / arquitecto de la metodología

## Contexto

`dai` nació y se escribió **en español**. Para su difusión —el README es lo primero que
se ve en npm y GitHub, y el público de open source es mayoritariamente anglófono— hace
falta una versión en **inglés**. Pero traducir un proyecto tiene trampas: superficies muy
distintas (docs, landing HTML, mensajes del CLI, skills que son prompts), y el riesgo de
que las traducciones **se desincronicen** del original con cada cambio.

Dos cosas juegan a favor: (1) el tono ya es **español neutro internacional** (se sacó el
voseo y los modismos a propósito), que traduce limpio; y (2) `dai` puede **dogfood-earse**
—usar un agente para traducir de forma consistente— si se le fija la terminología.

La decisión es cómo estructurar el i18n para que sea **mantenible** y no genere drift.

## Decisión

Adoptamos un modelo de **fuente única + traducciones derivadas**, por superficie:

1. **Fuente de verdad: el español.** Se escribió primero y es el canónico. Cada archivo
   traducido lleva una nota — *"Translation of the Spanish source; if they diverge, the
   Spanish wins."* — igual que METODOLOGIA marca a los HTML como vistas derivadas.

2. **Estructura de carpetas.** `docs/es/` (fuente) y `docs/en/` (traducción). En la raíz,
   `README.es.md` + `README.en.md`, y `README.md` con un **selector de idioma** arriba
   (`🇪🇸 Español · 🇬🇧 English`). El landing: una versión por idioma o un toggle en la página.

3. **CLI: locale por variable, catálogo cero-dependencias.** El idioma sale de
   `DAI_LANG` (default `es`; si no, se puede inferir de `LANG`). Los strings viven en un
   catálogo (`cli/lib/i18n.mjs`, objeto `{ es, en }`) accedido por una función `t(key,…)`.
   Sin librería de i18n — fiel al ethos de cero dependencias (ADR-0006).

4. **Skills: se generan en el idioma elegido.** `dai init --lang en|es` copia la variante
   del `SKILL.md`. La IA ya es multilingüe; solo cambia el idioma de las instrucciones.

5. **Glosario de términos ES→EN fijo.** Para que la terminología no varíe entre archivos:
   QUÉ→WHAT, CÓMO→HOW, estampar→stamp, trazabilidad→traceability, atrasado→stale, etc. Es
   el insumo que guía la traducción (humana o asistida).

6. **Implementación por fases** (no todo de una): (1) README + landing en inglés · (2) docs
   core (MANIFIESTO, METODOLOGIA, glosario, EJEMPLO, guías) · (3) CLI i18n + skills · (4) el
   resto (detalle/, ADRs, templates). Se prioriza por alcance, no por completitud.

## Consecuencias

- ✅ Alcance internacional con el README/landing en inglés (fase 1) sin reescribir todo.
- ✅ Regla anti-drift clara: una sola fuente de verdad; las traducciones nunca "ganan".
- ✅ El CLI localiza sin sumar dependencias; `DAI_LANG` es opt-in (default español).
- ✅ La terminología queda estable entre superficies gracias al glosario ES→EN.
- ⚠️ Doble mantenimiento: cada cambio en un `.md` fuente obliga a re-traducir su par. Se
  mitiga traduciendo con un agente + el glosario, y aceptando *lag* temporal en `en/`.
- ⚠️ El CLI necesita un refactor de strings (de literales a `t(key)`) — es mecánico pero toca
  muchos puntos; se hace de una sola vez.
- ⚠️ Hay que decidir, al implementar, si el `README.md` raíz redirige (selector) o **es** una
  de las lenguas (npm muestra el `README.md` — probablemente convenga inglés ahí).

## Alternativas consideradas

- **Un framework de docs con i18n (Docusaurus / VitePress / mkdocs)** — descartado por ahora:
  aporta i18n y versionado, pero cambia todo el setup de docs (hoy markdown plano + un HTML
  autocontenido) y suma tooling/dependencias pesadas para un proyecto en `0.x`. Reconsiderable
  si la doc crece mucho.
- **Inglés como fuente de verdad** — descartado: el contenido se authoró en español; invertir
  la fuente ahora duplicaría el riesgo de error justo en el material canónico (manifiesto,
  metodología). El español queda como fuente hasta que haya razón fuerte para migrar.
- **Traducción automática sin glosario ni fuente fija** — descartado: garantiza drift
  terminológico (el mismo término traducido distinto en cada archivo) y pérdida de la
  precisión del método. La traducción se ancla a un glosario y a una fuente única.
