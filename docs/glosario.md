# Glosario — el vocabulario común de dai

> Si el equipo no nombra las cosas igual, no puede razonar junto. Este es el
> vocabulario **del método**. Cada proyecto además mantiene su **glosario de
> dominio** (los términos del negocio) — son cosas distintas: este define *cómo
> trabajamos*, el otro define *sobre qué*.

## Los dos lados

| Término | Qué es |
|---|---|
| **QUÉ** | El requerimiento funcional: qué hay que hacer y por qué. Dueño: PO/funcional. |
| **CÓMO** | La implementación técnica: cómo se construye. Dueño: dev/ingeniero. |
| **US (User Story)** | La unidad del QUÉ. Formato canónico en `templates/formato-us.md`. |
| **Criterio de aceptación (AC)** | Condición testeable en Gherkin (Dado/Cuando/Entonces). Si no es un test en potencia, no es un AC. |
| **Capacidad** | La unidad de linkeo: una US entera. El link es a este nivel, no por AC. |

## El link y la trazabilidad

| Término | Qué es |
|---|---|
| **Link (QUÉ↔CÓMO)** | La relación entre un requerimiento y su implementación. |
| **`implements`** | La declaración `implements: <id>@<version>` en el código. El **único** link autorado a mano. |
| **`implements.yaml`** | El archivo, en el change del repo, que contiene ese link. Lo genera `link-us`. |
| **Trazabilidad inversa / cobertura** | El mapa "quién implementó este QUÉ". **Se genera, nunca se escribe.** |
| **Índice / router** | La tabla central que dice qué ID vive en qué repos. Es un router, **no un almacén**: no guarda el detalle. |
| **Federación (dos niveles)** | Cómo se guarda la trazabilidad a escala: Nivel 1 = índice central chico; Nivel 2 = detalle en cada repo, resuelto on-demand. *(Es un eje distinto de los niveles de ceremonia N1/N2/N3: acá "nivel" es dónde vive el dato, no el tamaño del equipo.)* |
| **Matriz de trazabilidad** | La vista "repo × versión × estado (al día / atrasado)". Derivada, no mantenida a mano. |

## El versionado

| Término | Qué es |
|---|---|
| **`spec_version`** | Número legible (`v1`, `v2`…). Lo sube la persona para **comunicar** un cambio del QUÉ. |
| **`ac_hash`** | Hash del bloque de criterios normalizado. Lo calcula la máquina para **detectar** cambios. |
| **`@version`** | El par `spec_version + ac_hash`. Lo que hace que un cambio del QUÉ marque solo a los CÓMO atrasados. |
| **Atrasado (⚠️)** | Un CÓMO cuyo `ac_hash` ya no coincide con el de la US vigente. |

## El proceso

| Término | Qué es |
|---|---|
| **Gate 0** | El desafío al *problema* antes de escribir spec (`grill-intent`). Puede terminar en "no lo construyas". |
| **DoR (Definition of Ready)** | El contrato de cuándo una US puede entrar a implementarse. |
| **DoD (Definition of Done)** | El contrato de cuándo el CÓMO está terminado. |
| **PR / MR (Pull / Merge Request)** | La unidad revisable del CÓMO. En dai lleva **dos activos**, y el review cubre ambos: (1) la **implementación** (el código) y (2) el **spec trazable** (el `implements.yaml` con el link a la US y el `@version` verificado). Sin el segundo, el CI bloquea el PR. Template en `../templates/pull-request.md`. |
| **Change** | La unidad de trabajo de OpenSpec (proposal + design + tasks + specs). |
| **ADR (Architecture Decision Record)** | El registro de una decisión estructural: contexto, decisión, consecuencias. Chico e **inmutable** — si algo cambia, se escribe uno nuevo que supersede al viejo. Template en `../templates/adr.md`; los de dai, en [`adr/`](adr/). |
| **TDD (Test-Driven Development)** | Escribir el test **antes** que el código: RED (test que falla) → GREEN (código mínimo) → REFACTOR. En dai cada AC se vuelve un test (skill `tdd`); es el antídoto del vibe coding. |
| **Vertical slice** | Un test → una implementación → repetir. Lo opuesto a "todos los tests, después todo el código". |
| **Smoke** | Escenario end-to-end que verifica que el flujo grueso no se rompió. |

## La maquinaria (CI/CD)

| Término | Qué es |
|---|---|
| **CI (Integración Continua)** | La automatización que corre en cada *push* / PR: compila, corre los tests y valida el repo. **En dai**, el CI ejecuta `dai check` como *gate* del PR (valida que el link exista y que el `ac_hash` coincida con la US viva) y, al mergear, `dai stamp` (estampa la cobertura inversa en el tracker — nadie la escribe a mano). Qué valida, en [`governance/ci-rules.md`](../governance/ci-rules.md). |
| **CD (Despliegue Continuo)** | La automatización que lleva la versión a los ambientes (`dev` / `test` / `pre` / `prod`) y reporta a cuál llegó. **En dai**, el CD alimenta la **matriz repo × ambiente**: *implementado ≠ desplegado* — el CI dice "el repo implementó `@v3`", el CD dice "`@v3` está viva en `pre`". |
| **CI/CD** | Juntos, la "plomería" que **blinda** el método sin depender de que la gente se acuerde (enforcement, no vigilancia). En dai es **opcional** (ADR-0003): aparece sobre todo en **N3** (organización grande). En **N1/N2** los mismos comandos (`dai check`, `dai stamp`) corren a mano o por un git-hook — la trazabilidad es idéntica; solo cambia **quién** los dispara. dai **no trae** su propio CI/CD: se apoya en el pipeline que la organización ya tenga. |

## Los principios

| Término | Qué es |
|---|---|
| **SDD (Spec-Driven Development)** | El paradigma donde la **especificación maneja el código**, no al revés: primero el QUÉ (US) y el diseño, después la implementación. dai —con OpenSpec— es SDD; lo opuesto al *code-first* y al vibe coding. |
| **PRD / SRS** | El documento monolítico de requisitos (*Product Requirements Document* / *Software Requirements Specification*). **dai no usa uno**: descompone el QUÉ en épica + US testeables (unidades linkeables y hasheables). Si ya tienes un PRD, `doc-to-backlog` lo **ingiere** y lo vuelve backlog — dai consume el documento, no te obliga a mantenerlo. |
| **HITL (Human-in-the-loop)** | La IA asiste; la persona decide y firma. Los rituales de coordinación son humanos. |
| **Vibe coding** | Improvisar código sobre una idea vaga. Lo que el método prohíbe (Art. 7). |
| **Colapso de roles** | Cuando una persona es PO y dev: los gates se aligeran, el link no desaparece. |
| **Nivel de ceremonia (N1/N2/N3)** | Los tres niveles de "plomería" según el tamaño del equipo. **N1** — un dev solo, todo local, sin herramientas externas. **N2** — equipo compacto, con tracker (Jira/ClickUp) + `implements.yaml`. **N3** — organización grande, federada: muchos repos, equipos separados, CI que estampa. El protocolo QUÉ↔CÓMO es **el mismo** en los tres; solo cambia la maquinaria. Detalle en [METODOLOGIA §3](METODOLOGIA.md). |

## Los roles

| Término | Qué es |
|---|---|
| **PO / funcional** | Dueño del QUÉ. Ver `guias/po.md`. |
| **Dev / ingeniero** | Dueño del CÓMO y del link. Ver `guias/dev.md`. |
| **Lead / SM / arquitecto** | Custodio de las invariantes y del nivel de ceremonia. Ver `guias/lead.md`. |
