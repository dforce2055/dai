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

## Estado medido — 2026-09-10

El ADR sigue en **propuesto**; esto es el relevamiento que hace falta para poder ejecutarlo,
tomado al auditar la convención de naming después de la 0.15.0.

### Cuánto es el trabajo de la fase 3 (CLI)

| Superficie | Volumen |
|---|---|
| `ok()` / `info()` / `warn()` / `fail()` en `cli/dai.mjs` | 348 llamadas |
| `process.stdout.write` con texto en `cli/dai.mjs` | 99 |
| `cli/lib/help.mjs` (es **todo** texto al usuario) | 524 líneas |
| `throw new Error(...)` / `fail(...)` en `cli/lib/` | 67 |

Del orden de **mil literales**. Es mecánico, pero confirma lo que el ADR ya anticipaba: se
hace de una sola vez, no a pedazos. El ciclo de release (0.15.0) le sumó volumen: los
comandos nuevos, su ayuda y el manifiesto son texto al usuario de punta a punta.

### Lo que ya está resuelto y no hay que rehacer

- **Los identificadores del código están en inglés** (auditado y corregido en la 0.15.x). El
  refactor de i18n toca strings, no nombres.
- **Las salidas de máquina ya usan claves en inglés**: el manifiesto de `dai release plan
  --json` y el payload del webhook genérico.
- **El glosario ES→EN de §5 ya existe** y se usó: `atrasado → stale` fue el término que se
  aplicó al renombrar `counts.atrasadas`.

### La decisión de contrato que falta tomar, y su costo real

`coverageStatus()` devuelve valores **en español** —`"al-dia"`, `"atrasado"`, `"sin-us"`,
`"sin-respuesta"`— y esos valores **salen por `--json`**: son parte de la API que puede estar
parseando el CI de alguien.

Lo interesante es que el costo interno de cambiarlos es **casi cero**: ya están separados de
lo que se muestra (`statusLabel()` los traduce a `✅ al día` y compañía), así que el i18n de
la *presentación* no necesita tocarlos. La única razón para renombrarlos es que una API en
inglés se lea en inglés.

Entonces la decisión es puramente de contrato, y hay tres caminos:

1. **Dejarlos.** Son un enum opaco; el consumidor los compara, no los lee. Costo cero,
   inconsistencia visible en cada `--json`.
2. **Renombrarlos en una major** (`up-to-date`, `stale`, `no-story`, `unreachable`). Limpio,
   pero obliga a una major solo por esto.
3. **Emitir los dos** por un tiempo (`status` en inglés + `status_es` deprecado), y sacar el
   viejo en la próxima major. Es el camino habitual para no romper, y el que menos duele si
   ya hay alguien parseando.

No se decide acá: se decide **junto con** la fase 3, porque hacer dos cambios de la salida
`--json` en versiones distintas es peor que hacer uno solo.

### Recomendación de orden

Mantener el orden del ADR y **no empezar por el CLI**. Un CLI traducido con un README en
español no lo encuentra nadie: lo que abre la herramienta a usuarios anglófonos es la fase 1
(README + landing), porque es lo que se ve en npm y en GitHub. La fase 3 recién rinde cuando
ya hay alguien de habla inglesa llegando.

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
