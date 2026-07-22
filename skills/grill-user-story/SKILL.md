---
name: grill-user-story
description: "Interroga a un PO o analista funcional para producir una User Story funcional y testeable siguiendo el formato del modelo de trazabilidad — o pule una US vaga existente. Se queda a nivel funcional/usuario y se niega a derivar en diseño técnico o a emitir una US con criterios no testeables. Al terminar la PUBLICA en el tracker configurado del repo (Jira o ClickUp, según DAI_PM de su .env.dai o .env): si la US es NUEVA la crea (MCP o `dai publish`); si YA tiene key la actualiza con `dai edit-us --no-editor`, que valida el formato y pregunta si sube el spec_version antes de pisar nada. Sin MCP ni token, deja un .md con el mismo formato para copiar y pegar. Invocar como /grill-user-story, opcionalmente con un título, un ID/URL del tracker, y/o una US rústica existente. Usar antes de opsx:propose, o cuando alguien dice \"necesito una US\", \"convierte esto en una US como corresponde\", o \"esta historia está muy vaga\"."
---

# grill-user-story

Producir una buena User Story **por interrogación, no por generación**. Es la puerta de entrada funcional del pipeline de specs (el QUÉ): su salida alimenta `opsx:propose` del lado técnico. Trabaja **solo a nivel usuario/solución** — el grill técnico ocurre después, en el `design.md` del dev.

Llena [templates/user-story.md](templates/user-story.md). El formato completo y su racional viven en [../../templates/formato-us.md](../../templates/formato-us.md) — es la única fuente de verdad de la forma. Nunca reescribas el formato inline.

## Por qué el formato importa (modelo de trazabilidad)

Esta US es el **QUÉ linkeable**. El `implements.yaml` del repo la va a referenciar por su **ID del tracker**, y `dai stamp` la usa para estampar cobertura. Por eso la salida DEBE tener:
- **ID** = el ticket del tracker (`ABC-###` en Jira, `86xxxx` en ClickUp) — identidad estable.
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

## Tres cortes duros (no negociables)

1. **Cortar en lo técnico.** Si la charla deriva a tablas, endpoints, migraciones o elección de framework, frenar: "eso es diseño, no ahora". La US nombra *qué necesita el usuario*, nunca *cómo se construye*.
2. **Cortar en lo no testeable.** Nunca emitir un criterio que no pueda volverse un test. "El usuario tiene una buena experiencia" se rechaza. "Un carrito vacío no se puede finalizar" se acepta — funcional y verificable. Empujar cada AC hasta que sea observable.
3. **Publicar, no pedir.** Si el tracker está configurado (`DAI_PM=jira|clickup` con token en `.env.dai` o `.env`), **dejá la US publicada tú**. **Nunca** cierres pidiéndole al usuario que te "pase el ID/URL del ticket" como si ya existiera, ni que copie y pegue el markdown al navegador. Dos caminos según si la US ya tiene key:
   - **No tiene key → la CREÁS** (MCP o `dai publish`).
   - **Ya tiene key → la ACTUALIZÁS con `dai edit-us <ID> --no-editor`**, nunca pisando el ticket a mano por MCP. El comando valida el formato antes de escribir, muestra qué cambia y pregunta si sube el `spec_version` — controles que por MCP no existen.

## Proceso

0. **Detectar el tracker (SIEMPRE, antes de nada).** Lee la config de dai del repo y observa `DAI_PM`. **Está en `.env.dai` o en el `.env` del equipo: mirá los dos.** dai carga ambos, y si una clave está en los dos gana `.env.dai` (ADR-0017). Un repo que tiene todo en `.env` funciona igual — no hace falta migrar nada:
   - `DAI_PM=jira` → publicas en **Jira** (base: `DAI_JIRA_BASE_URL`), vía el MCP de Atlassian/Jira.
   - `DAI_PM=clickup` → publicas en **ClickUp**, vía el MCP de ClickUp.
   - `DAI_PM=md` (o sin config) → no hay tracker: dejas la US como `.md`.
   **No asumas el tracker** — depende de la config. Si no hay `.env.dai` ni `.env`, pregunta cuál usa el equipo.
1. **Resolver inputs.** Obtener título e ID del tracker (si existe). Si se refina, leer la US y anotar — para uno mismo — qué secciones del formato faltan o están flojas: rol genérico ("el usuario"), falta el "para", sin flujo de excepción, solución prefijada, ACs vagos.
2. **Grillar, un eje por vez.** No tirar un cuestionario — preguntar, escuchar, profundizar, y seguir. Cubrir en orden:
   - **Título** — corto, **3 a 6 palabras**, nombra la capacidad (de ahí sale la branch). Si el título es una frase larga, acórtalo: el detalle va en la descripción, no en el título. Ej: "Confirmar acciones con consecuencias", no "Confirmación deliberada antes de ejecutar acciones con consecuencias".
   - **Quién** — el usuario/rol real. Rechazar "el usuario"; conseguir el actor concreto.
   - **Job-to-be-done** — qué intenta lograr de verdad, y el *por qué* (el "para").
   - **Flujos** — happy path primero, después alternativos, después excepciones: "¿qué pasa cuando no es válido / no está permitido / está vacío?"
   - **Criterios de aceptación** — convertir cada flujo en una condición funcional y testeable, en Gherkin. Aplicar el corte #2 acá, fuerte.
   - **Fuera de scope** — qué NO hace esta historia (mata el scope creep más adelante).
3. **Chequeo de tamaño (INVEST).** Si los flujos y ACs desbordan y la historia se dispersa, es demasiado grande para una sola US. No seguir empujando: **promoverla a una épica** con `/grill-epic` (que la parte en varias US independientes) y después volver acá para grillar cada US hija. Una US que no entra en un sprint es la señal de que hay una épica adentro.
4. **Dejar la US en el tracker (PASO OBLIGATORIO, ver abajo).** No termines con "¿la guardo y/o disparo el siguiente paso?": el trabajo de esta skill **incluye dejar la US publicada** en el tracker (con su key), no solo redactarla. Si la US ya existía, actualizarla cuenta como publicarla.

## Salida — dejar la US en el tracker (según `DAI_PM`), con fallback a .md

La US se produce UNA vez con el formato de `../../templates/formato-us.md`. Lo que cambia es **dónde va** y **si se crea o se actualiza**.

> **Primero: ¿la US ya tiene key?**
> - **No** (nació en esta sesión) → **CREAR** — pasos 1–4 de abajo.
> - **Sí** (el usuario trajo `ABC-482`, o vos la creaste antes en esta misma charla) →
>   **ACTUALIZAR** — saltá a *"Si la US ya existe"*.

### Si la US es nueva (crear)

1. **Armar la US** completa: metadata de trazabilidad (`ID`, `spec_version: v1`, autor, repos esperados) + historia + contexto + casos de uso + criterios Gherkin + fuera de scope + reglas + dependencias + métricas.
2. **Publicar en el tracker que dice `DAI_PM`:**
   - **Jira** (`DAI_PM=jira`): vía el MCP de Atlassian, crear/actualizar el issue en `DAI_JIRA_BASE_URL` — título (summary), descripción, y los **criterios bajo un heading `## Criterios de aceptación`** (es lo que `dai` hashea). El issue devuelve el key (`ABC-###`).
   - **ClickUp** (`DAI_PM=clickup`): vía el MCP de ClickUp, crear/actualizar la tarea con los criterios en la descripción, bajo el mismo heading. Devuelve el task ID.
   - Confirmar al usuario con el link al ticket publicado.
   - **Importante:** los criterios SIEMPRE van bajo `## Criterios de aceptación` en la descripción — así `dai link-us`/`check` los encuentran, sin importar el tracker.
3. **Fallback SIN MCP → publicar con el CLI (`dai publish`):**
   - Si NO hay MCP del tracker conectado (pero sí `DAI_PM=jira|clickup` + token en `.env.dai` o `.env`):
     escribe la US como `.md` (formato `formato-us.md`) y publícala con el comando:
     **`dai publish <ruta-del-md>`** → crea el issue/tarea vía REST y devuelve el key.
     (Jira necesita además `DAI_JIRA_PROJECT` — la clave del **proyecto**,
     `PROJ`, no la de un ticket.)
   - **Si la US pertenece a una épica:** `dai publish <us.md> --parent <KEY-de-la-épica>`.
   - **Si el proyecto exige campos propios** (típico en Jira corporativo): van con
     `--field alias=valor`, repetible. Los alias son los de `.dai/jira-fields.json`, y
     `dai doctor` te dice cuáles hay. Si el valor cambia según la US (p. ej. una
     clasificación Mejora/Corrección), **pregúntaselo a la persona** durante el
     interrogatorio — no lo elijas tú, es una decisión de negocio.
     Ej.: `dai publish us.md --parent PROJ-42 --field clasificacion=Corrección`
   - Si tampoco hay token (o `DAI_PM=md`): deja solo el `.md` para que la persona lo
     pegue a mano en el tracker. Avisa el motivo.
   - El contenido es **idéntico** en los tres caminos (MCP / `dai publish` / manual).
4. **Si `dai publish` falla, para y reporta el error tal cual.** No improvises una llamada
   a la API del tracker por fuera, ni bajes la verificación TLS para pasar un proxy: el
   atajo publica igual, pero el `## Criterios de aceptación` puede quedar mal formado y
   **el link QUÉ↔CÓMO se rompe en silencio**. Si el error nombra un campo obligatorio que
   falta, decláralo en `.dai/jira-fields.json` (molde en `.dai/templates/`) y reintenta.
### Si la US ya existe (refinar) — `dai edit-us`

Cuando la US **ya tiene key**, el trabajo no es crearla sino **pisarla con la versión
refinada**. Eso NO se hace por MCP ni editando el ticket en el navegador: se hace con

```bash
dai edit-us <ID> --us <ruta-del-md> --no-editor
```

Escribí la US refinada al `.md` y pasáselo. `--no-editor` es lo que hace que el comando
sirva desde una skill: no abre `$EDITOR` (vos ya editaste), pero **conserva todo lo demás**.

Qué te da ese camino, que por MCP no existe:

1. **Valida el formato antes de escribir.** Frena si falta el `# Título`, la sección
   `## Criterios de aceptación`, o si está vacía — las tres cosas sin las cuales no hay
   `ac_hash` y el link QUÉ↔CÓMO se rompe. Y **avisa** si un criterio no es Gherkin
   completo o se metió en el CÓMO. Si frena, **arreglá el `.md` y reintentá**: no busques
   otra vía para publicar igual, el chequeo está para eso.
2. **Muestra qué cambia** en el tracker (título, cuántos criterios, `ac_hash`) antes de
   tocarlo.
3. **Pregunta si sube el `spec_version`** — y esta pregunta **es de la persona, no tuya**:
   - **material** (un criterio nuevo, una regla distinta) → sube `v1` → `v2`, y los repos
     que implementaron `v1` se marcan **atrasados** solos.
   - **editorial** (typo, redacción más clara) → se queda en `v1`, nadie se marca atrasado.

   Con `--yes` el comando asume material y sube la versión. **No pongas `--yes` sin
   preguntar**: marcar repos como atrasados de más entrena al equipo a ignorar los ⚠️.
   Preguntale al PO cuál de las dos es, y recién entonces corré con `--bump` o `--no-bump`.
4. **Re-estampa el `ac_hash`** del `implements.yaml` si el repo ya implementaba esa US,
   para que `dai check` no la marque atrasada por la propia edición.

Usá **`--dry-run` primero** para mostrarle el preview a la persona, y corré en firme
recién cuando lo apruebe. Si el backend es `md` (sin tracker), el mismo comando actualiza
el `.md` canónico.

> Si preferís no traer nada del tracker porque ya tenés la US entera escrita,
> `dai update-us <ID> --us <md>` es el mismo camino sin el paso de bajarla.

5. **Estado.** Dejar la US en `pulida`. Ofrecer que el dev siga con `dai link-us <ID>` → `opsx:propose` (lado técnico).

## Hand-off

La US terminada es el input de `opsx:propose`, que produce las capas técnicas (`design.md`, `specs/`, `tasks.md`) y donde el dev declara el link con la skill `link-us`. El grill técnico —modelo de datos, roles, migraciones— ocurre ahí, con un dev o arquitecto, no acá.
