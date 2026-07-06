<!-- Plantilla canónica de historia de usuario · Modelo de Trazabilidad QUÉ↔CÓMO.
     Funcional y de alto nivel: sin tecnología. La llena la skill grill-user-story.
     Formato completo y su racional en ../../formato-us.md (fuente de verdad de la forma). -->

# 🔗 Metadata de trazabilidad

| Campo | Valor |
|-------|-------|
| **ID** | `ABC-###` |
| **spec_version** | `v1` |
| **Autor** | `<PO / analista>` |
| **Estado** | `borrador` |
| **Repos esperados** | `<frontend, bff, backend — opcional>` |

# <título de la historia>

## Historia

Como <rol / tipo de usuario concreto, nunca "el usuario">
quiero <capacidad o resultado>
para <valor / por qué>.

## Contexto / Problema

Por qué esto importa ahora. Qué duele hoy sin esta funcionalidad.

## Casos de uso

Flujos a nivel usuario — qué hace la persona y qué responde el sistema. Sin tecnología.

- **Happy path** — <el usuario hace X, obtiene Y>
- **Alternativo** — <variación esperada del flujo>
- **Excepción** — <qué pasa cuando algo no es válido, no está permitido, o está vacío>

## Criterios de aceptación

Gherkin (Dado / Cuando / Entonces). Cada uno tiene que poder convertirse en un test.
Este bloque es lo que se hashea (ac_hash) — orden estable, sin tecnología.

- [ ] **AC-1** — Dado <precondición>, cuando <acción>, entonces <resultado observable>
- [ ] **AC-2** — Dado <...>, cuando <...>, entonces <...>

## Reglas de negocio

- <invariante / límite / restricción de dominio>

## Fuera de scope

- <lo que esta historia explícitamente NO hace>

## Dependencias

- <ABC-### / sistema / decisión previa>

## Métricas de éxito

- <indicador de negocio observable>

## Preguntas abiertas

- <lo que necesita una decisión antes de implementar>
