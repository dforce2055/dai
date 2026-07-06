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
| **Federación (dos niveles)** | Nivel 1 = índice central chico. Nivel 2 = detalle en cada repo, resuelto on-demand. |
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
| **Change** | La unidad de trabajo de OpenSpec (proposal + design + tasks + specs). |
| **Vertical slice** | Un test → una implementación → repetir. Lo opuesto a "todos los tests, después todo el código". |
| **Smoke** | Escenario end-to-end que verifica que el flujo grueso no se rompió. |

## Los principios

| Término | Qué es |
|---|---|
| **HITL (Human-in-the-loop)** | La IA asiste; la persona decide y firma. Los rituales de coordinación son humanos. |
| **Vibe coding** | Improvisar código sobre una idea vaga. Lo que el método prohíbe (Art. 7). |
| **Colapso de roles** | Cuando una persona es PO y dev: los gates se aligeran, el link no desaparece. |
| **Nivel de ceremonia (N1/N2/N3)** | El dial de plomería: solo/compacto/federado. El protocolo no cambia; la maquinaria sí. |

## Los roles

| Término | Qué es |
|---|---|
| **PO / funcional** | Dueño del QUÉ. Ver `guias/po.md`. |
| **Dev / ingeniero** | Dueño del CÓMO y del link. Ver `guias/dev.md`. |
| **Lead / SM / arquitecto** | Custodio de las invariantes y del nivel de ceremonia. Ver `guias/lead.md`. |
