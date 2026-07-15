---
name: grill-epic
description: "Interroga a un PO o analista funcional para producir una ÉPICA bien formada — un bloque grande de valor de negocio que se parte en varias User Stories — siguiendo el template del método. O toma una US que resultó demasiado grande y la promueve a épica. Se queda a nivel funcional/alcance: define el objetivo de negocio y la partición en US, NUNCA criterios de aceptación (esos viven en cada US) ni diseño técnico. Al terminar, publica la épica en Jira/ClickUp (o deja un .md) y hace handoff de cada US hija a grill-user-story. Invocar como /grill-epic, opcionalmente con un título, un ID/URL del tracker, o una US grande a promover. Usar cuando algo es demasiado grande para una sola US."
---

# grill-epic

Producir una **épica** por interrogación, no por generación. Una épica es un **bloque
grande de valor de negocio** que se parte en varias User Stories. Es el nivel de
arriba de la US: define el **alcance**, no el detalle.

Llena [templates/epica.md](../../templates/epica.md) — es la única fuente de verdad de
la forma. Nunca reescribas el formato inline.

## Qué es (y qué NO es) una épica

- **Es** un contenedor: agrupa US que juntas entregan una capacidad grande.
- **No se implementa directamente** — las US que la componen son las que viajan por el
  flujo (`grill-user-story` → `dai link-us` → …). El link QUÉ↔CÓMO vive a nivel US.
- **No tiene criterios de aceptación** — esos son de cada US. La épica tiene objetivo
  de negocio, alcance y métricas de éxito.

## Inputs (cualquier combinación)

- **Título** — nombre corto de la épica.
- **ID / URL del tracker** — si ya existe el ticket.
- **Fuente:**
  - *Desde cero* — solo una idea grande. Grillar desde 0.
  - *Promover una US* — una US que resultó demasiado grande (viene de `grill-user-story`).
    Leerla, y usar su contenido como material para la partición.

## Dos cortes duros (no negociables)

1. **Cortar en los criterios de aceptación.** Si la charla deriva a definir ACs
   testeables, frenar: "eso es de cada US, no de la épica". La épica define *qué
   capacidades* entran, no *cómo se verifica cada una*.
2. **Cortar en lo técnico.** Endpoints, tablas, arquitectura → es diseño, va mucho
   después. La épica es puro negocio de alto nivel.

## Proceso

1. **Resolver inputs.** Título e ID del tracker. Si se promueve una US, leerla.
2. **Grillar, un eje por vez.** Preguntar, escuchar, profundizar. Cubrir en orden:
   - **Objetivo de negocio** — qué resultado grande persigue, y *por qué ahora*.
   - **Alcance** — qué entra y qué **no** entra (el límite grueso que las US respetan).
   - **Partición en US** — el eje central: partir la épica en **User Stories
     independientes**, cada una con valor propio y que quepa en un sprint (INVEST).
     Nombrar cada una con un título corto. No detallar los criterios acá.
   - **Métricas de éxito** — indicadores de negocio de la épica entera.
   - **Dependencias y riesgos** — qué tiene que existir antes o en paralelo.
3. **Chequeo de tamaño (al revés que en la US).**
   - Si la "épica" **no se puede partir** en US independientes, probablemente sea **una
     sola US grande** — devolverla a `grill-user-story`, no forzar una épica.
   - Si una US hija sigue siendo enorme, puede ser una **sub-épica** — raro; primero
     revisar si el corte está bien.
4. **Emitir + publicar** (ver abajo).

## Salida — publicar + handoff a las US

1. **Armar la épica** con el formato de `templates/epica.md`: metadata (`ID`, autor,
   estado, US que la componen) + objetivo + alcance (in/out) + lista de US + métricas +
   dependencias.
2. **Publicar en el tracker.** **No asumas el tracker: lee `DAI_PM` del `.env` primero.**
   Tres caminos, mismo contenido:
   - **Con MCP** (`jira` → MCP de Atlassian · `clickup` → MCP de ClickUp): crea el ticket
     de épica; las US hijas se crean como tickets vinculados (o quedan listadas).
   - **Sin MCP, con token** (`DAI_PM=jira` + token en `.env`): escribe la épica como `.md`
     y publícala con **`dai publish <epica.md> --issuetype Epic`**. Devuelve el key. Si el
     proyecto exige campos propios, van con `--field alias=valor` (los declarados en
     `.dai/jira-fields.json`; `dai doctor` te los lista). Después, cada US hija se cuelga
     con `dai publish <us.md> --parent <KEY-de-la-épica>`.
   - **Sin token** (o `DAI_PM=md`): deja el `.md` para pegar a mano, y avisa el motivo.
   - Si `dai` falla, **para y reporta el error tal cual**. No improvises una llamada a la
     API del tracker por fuera: publicaría igual pero rompería el link en silencio.
3. **Handoff.** Ofrecer pasar **cada US hija** por `/grill-user-story` para convertirla
   de "título en la lista" a US testeable con criterios. Ese es el paso que las hace
   linkeables (`dai link-us`).

## Relación con el modelo

- **Arriba:** `grill-intent` puede desafiar el *problema* de la épica antes de armarla.
- **Abajo:** cada US de la partición pasa por `grill-user-story` → `dai link-us`.
- El link QUÉ↔CÓMO y el `ac_hash` viven **a nivel US**, nunca de épica (la épica agrupa,
  no se implementa).
