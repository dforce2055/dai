---
name: link-us
description: Del lado del dev — crea la branch desde el link de la User Story en Jira SIN margen de error y genera el archivo implements.yaml con el link a la US (id + version + ac_hash). Es la que hace que el link QUÉ↔CÓMO sea correcto por construcción, sin que el dev tipee el key a mano. Invocar como /link-us ABC-### (o con la URL del ticket de Jira). Usar al arrancar la implementación de una US, antes o junto con opsx:explore / opsx:propose.
---

# link-us

Arranca la implementación de una User Story **atándola al QUÉ desde el primer commit**. El dev no escribe el key de Jira a mano en ningún lado: la branch y el `implements.yaml` salen los dos del mismo ID, así el link no puede quedar mal tipeado.

Es la contraparte técnica de `grill-user-story`: donde esa produce el QUÉ (en Jira), esta abre el CÓMO (en el repo) ya linkeado.

## Input

- **ID o URL de la US en Jira** — `ABC-###` o el link completo. Es lo único obligatorio.
- Si no viene, pedirlo. Validar el formato del key antes de seguir; si no matchea `ABC-\d+`, frenar y avisar.

## Proceso

1. **Resolver el key.** Extraer `ABC-###` del argumento (acepta key crudo o URL). Este key es la **única fuente** de todo lo que sigue — no re-tipearlo.
2. **Traer la US (si se puede).**
   - Si hay **MCP de Jira/Atlassian** o **token** (`JIRA_BASE_URL` + `JIRA_TOKEN`): traer título, `spec_version` y el bloque de **criterios de aceptación**.
   - Calcular `ac_hash` = hash del bloque de criterios normalizado (whitespace colapsado, orden estable).
   - Si no hay acceso a Jira: pedir al dev el título y la `spec_version`, o leer un `.md` local de la US; dejar `ac_hash` como `pendiente` con un aviso de que el CI lo completará.
3. **Crear la branch, sin margen de error.**
   - Nombre: `feature/ABC-###-<slug>` donde `<slug>` sale del título (minúsculas, sin acentos, `-` como separador).
   - Base según convención del repo (`main` o `develop`). Verificar que la branch no exista ya.
   - No permitir crear la branch si el key no fue validado en el paso 1.
4. **Generar el link.** Crear `openspec/changes/<change-id>/implements.yaml` a partir de [templates/implements.yaml](templates/implements.yaml), completando `id`, `version`, `ac_hash`, `repo` y `autor`. Dejar `introduces` para que el dev liste las capacidades técnicas nuevas.
5. **Hand-off.** Ofrecer seguir con `opsx:explore` → `opsx:propose` para armar el change (proposal/design/tasks) sobre la branch ya creada y linkeada.

## Guardrails (por qué esta skill existe)

- **El key nunca se tipea a mano** en la branch ni en el `implements.yaml`: ambos derivan del argumento validado. Elimina el error de tipeo que rompe la trazabilidad.
- **Sin `implements.yaml`, no hay link** — y el CI del repo falla el PR si falta. Esta skill garantiza que exista desde el arranque.
- **El link apunta del CÓMO al QUÉ** (`implements: ABC-###`), nunca al revés. La cobertura inversa la genera el CI, no esta skill.

## Relación con el modelo

- `grill-user-story` → produce el QUÉ en Jira (`ABC-###`).
- **`link-us`** → abre el CÓMO en el repo, ya atado a ese `ABC-###`.
- El CI → al mergear, estampa en Jira "implementado por &lt;repo&gt; @&lt;version&gt; ✓".
- El CD → al desplegar, reporta en qué ambiente (dev/test/pre/prod) quedó viva esa versión.
