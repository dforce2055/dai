---
name: grill-user-story
description: Interroga a un PO o analista funcional para producir una User Story funcional y testeable siguiendo el formato del modelo de trazabilidad — o pule una US vaga existente. Se queda a nivel funcional/usuario y se niega a derivar en diseño técnico o a emitir una US con criterios no testeables. Al terminar, PUBLICA la US en Jira si hay MCP/token; si falla, deja un .md con el mismo formato para copiar y pegar. Invocar como /grill-user-story, opcionalmente con un título, un ID/URL de Jira, y/o una US rústica existente. Usar antes de opsx:propose, o cuando alguien dice "necesito una US", "convertí esto en una US como corresponde", o "esta historia está muy vaga".
---

# grill-user-story

Producir una buena User Story **por interrogación, no por generación**. Es la puerta de entrada funcional del pipeline de specs (el QUÉ): su salida alimenta `opsx:propose` del lado técnico. Trabaja **solo a nivel usuario/solución** — el grill técnico ocurre después, en el `design.md` del dev.

Llená [templates/user-story.md](templates/user-story.md). El formato completo y su racional viven en [../../templates/formato-us.md](../../templates/formato-us.md) — es la única fuente de verdad de la forma. Nunca reescribas el formato inline.

## Por qué el formato importa (modelo de trazabilidad)

Esta US es el **QUÉ linkeable**. El `implements.yaml` del repo la va a referenciar por su **ID de Jira**, y el CI la usa para estampar cobertura. Por eso la salida DEBE tener:
- **ID** = el ticket de Jira (`ABC-###`) — identidad estable.
- **spec_version** = `v1` al nacer.
- **Criterios de aceptación en Gherkin** — es el bloque que se hashea (`ac_hash`); tienen que ser estables y testeables.
- **Autor** = quién la definió.

## Inputs (cualquier combinación, por argumento o preguntando)

- **Título** — nombre corto de la historia.
- **ID / URL de Jira** — si ya existe el ticket, para preservar el seam con el PM.
- **Fuente**:
  - *Desde cero* — solo un título o idea. Grillar desde 0.
  - *Refinar existente* — una US vaga ya escrita (texto pegado o path de archivo). Leerla primero, diagnosticar qué falta contra el formato, y grillar solo los huecos — no re-preguntar lo que ya está claro.

Si no viene nada, pedir título y si hay un borrador existente.

## Dos cortes duros (no negociables)

1. **Cortar en lo técnico.** Si la charla deriva a tablas, endpoints, migraciones o elección de framework, frenar: "eso es diseño, no ahora". La US nombra *qué necesita el usuario*, nunca *cómo se construye*.
2. **Cortar en lo no testeable.** Nunca emitir un criterio que no pueda volverse un test. "El usuario tiene una buena experiencia" se rechaza. "Un carrito vacío no se puede finalizar" se acepta — funcional y verificable. Empujar cada AC hasta que sea observable.

## Proceso

1. **Resolver inputs.** Obtener título e ID de Jira (si existe). Si se refina, leer la US y anotar — para uno mismo — qué secciones del formato faltan o están flojas: rol genérico ("el usuario"), falta el "para", sin flujo de excepción, solución bakeada, ACs vagos.
2. **Grillar, un eje por vez.** No tirar un cuestionario — preguntar, escuchar, profundizar, y seguir. Cubrir en orden:
   - **Quién** — el usuario/rol real. Rechazar "el usuario"; conseguir el actor concreto.
   - **Job-to-be-done** — qué intenta lograr de verdad, y el *por qué* (el "para").
   - **Flujos** — happy path primero, después alternativos, después excepciones: "¿qué pasa cuando no es válido / no está permitido / está vacío?"
   - **Criterios de aceptación** — convertir cada flujo en una condición funcional y testeable, en Gherkin. Aplicar el corte #2 acá, fuerte.
   - **Fuera de scope** — qué NO hace esta historia (mata el scope creep río abajo).
3. **Chequeo de tamaño (INVEST).** Si los flujos y ACs desbordan y la historia se dispersa, es demasiado grande para una sola US. No seguir empujando: **promoverla a una épica** con `/grill-epic` (que la parte en varias US independientes) y después volver acá para grillar cada US hija. Una US que no entra en un sprint es la señal de que hay una épica adentro.
4. **Emitir + publicar** (ver abajo).

## Salida — publicar en Jira, con fallback a .md

La US se produce UNA vez con el formato de `../../formato-us.md`. Lo que cambia es **cómo se entrega**:

1. **Armar la US** completa: metadata de trazabilidad (`ID`, `spec_version: v1`, autor, repos esperados) + historia + contexto + casos de uso + criterios Gherkin + fuera de scope + reglas + dependencias + métricas.
2. **Intentar publicar en Jira:**
   - Si hay un **MCP de Jira/Atlassian** conectado, o un **token de acceso** disponible (p. ej. `JIRA_BASE_URL` + `JIRA_TOKEN`), crear o actualizar el ticket: título, descripción, y los **criterios de aceptación** en su campo. Guardar `spec_version` (custom field o etiqueta) y el autor. El ticket devuelve/usa el key `ABC-###` como identidad del QUÉ.
   - Confirmar al usuario con el link al ticket publicado.
3. **Fallback (si no hay MCP/token o la publicación falla):**
   - Escribir un archivo `.md` con **exactamente el mismo formato** (el de `formato-us.md`), listo para que el analista **copie y pegue en Jira a mano**.
   - Avisar claramente: *"No pude publicar en Jira (motivo: sin token / sin MCP / error X). Acá está el `.md` con el formato idéntico para copiar y pegar."*
   - El contenido de los dos caminos es **idéntico** — la única diferencia es que uno lo sube solo y el otro lo pega una persona.
4. **Estado.** Dejar la US en `pulida`. Ofrecer pasarla a `opsx:propose` (lado técnico) como próximo paso.

## Hand-off

La US terminada es el input de `opsx:propose`, que produce las capas técnicas (`design.md`, `specs/`, `tasks.md`) y donde el dev declara el link con la skill `link-us`. El grill técnico —modelo de datos, roles, migraciones— ocurre ahí, con un dev o arquitecto, no acá.
