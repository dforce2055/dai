---
name: dai-review
description: "Revisa una Pull/Merge Request de un repo remoto (GitHub o GitLab) de forma consciente de la metodología dai y deja un REVIEW INLINE en español: un comentario de resumen más un comentario anclado a cada archivo:línea, clasificado low/medium/high. Corre `dai check` (¿la US está atrasada?), valida el Definition of Done, hace el review de código (correctitud + calidad), escribe un review.json, lo valida contra el diff con `dai forge review --dry-run` (descarta las líneas que el modelo inventó), TE MUESTRA EL PREVIEW Y ESPERA TU OK, y recién entonces postea con `dai forge review --yes`. Nunca postea sin aprobación explícita: sale con tu nombre y tu token, sin badge de bot. Hay modo desatendido para reviews simples (--yes --min-severity --min-confidence), pero se pide, no es el default. Invocar como /dai-review <URL-de-la-PR o número>. Usar en el paso 6 de SCRUM-CON-IA (code review), antes de que un partner humano firme."
---

# dai-review — review de PR consciente de la metodología

Es el **primer pase** del paso 6 (code review). No reemplaza al partner humano: le
saca el ruido para que firme lo que importa ([Art. 5](../../docs/MANIFIESTO.md#art-5) del manifiesto). Funciona igual
en **GitHub y GitLab**.

## El reparto: tú traes el criterio, el CLI hace lo mecánico

No compones markdown y lo posteas. Escribes un **`review.json`** y el CLI lo valida y lo
postea (ADR-0002 / [ADR-0016](../../docs/adr/0016-review-inline.md)):

```
tú (criterio)          →  .dai/reviews/<n>.json   →  dai forge review (mecánico)
hallazgos + severidad     el humano lo edita          valida vs. el diff, filtra, postea
```

Ese archivo **es la puerta humana**: es diff-eable, editable a mano y auditable, y no ata
el flujo a ningún asistente. No hay TUI que aprender.

**Por qué el CLI y no tú directamente:** `dai forge review` verifica que cada `path:line`
**exista de verdad en el diff** antes de salir a la red. Inventar números de línea es el
error más común de un LLM revisando código, y el forge responde `422` sin decir cuál
falló. El CLI lo caza antes.

### Cómo postear (elige la primera disponible)

1. **`dai forge review <ref> --from <archivo> --yes`** — la forma. Review inline:
   resumen + un comentario por línea. Usa `GITHUB_TOKEN`/`GITLAB_TOKEN` de `.env.dai` o `.env`.
2. **MCP del forge / `dai forge comment`** — fallback si no hay token, o si necesitas
   dejar un comentario suelto sin anclar. Pierdes el inline y la validación.

> **Auth:** git (traer el diff) usa **SSH**; postear usa **token del forge** (postear no
> se puede por SSH). Cero contraseñas.

## Input

- **Ref de la PR/MR:** URL completa o solo el número (con el remoto git configurado).
- Si no viene, intenta inferirla de la branch actual; si no, pedila.

## Proceso

1. **Resolver la PR** — `dai forge pr <ref>` (o el MCP) para título, descripción, branch.
2. **Traer el diff** — `git fetch` + `git diff <base>...<branch>` (local, por SSH). No
   dependas de la API para el diff.
3. **Chequeos de metodología (mecánicos, deterministas):**
   - `dai check` → ¿la US quedó **atrasada** (ac_hash) respecto de la viva?
   - ¿existe `implements.yaml`? (si es un PR de producto, es obligatorio)
   - **Definition of Done** (`templates/definition-of-done.md`): cuenta cuántos ítems cumple.
4. **Review de código (criterio, no mecánico):** busca
   - 🔴 **high** — errores de correctitud: bugs, casos borde, seguridad.
   - 🟡 **medium** — riesgo real pero no roto: contratos que mienten, races, deuda que muerde.
   - 🔵 **low** — calidad: reuso, simplicidad, nombres.
   - ✅ Lo que está **bien** (refuerza lo bueno) → va en `good`.
5. **Escribir el `review.json`** en `.dai/reviews/<número-de-PR>.json` (ver el schema abajo).
   Cada hallazgo va anclado a `path` + `line` **del diff que trajiste en el paso 2** —
   no de tu memoria del archivo.
6. **Validar sin postear** — `dai forge review <ref> --from .dai/reviews/<n>.json --dry-run`.
   Te dice qué se postea, qué se filtra y qué se **descarta por no apuntar al diff**. Si
   hay descartados, corregí el `path`/`line` y repetí. **No pases al paso 7 con descartados
   que puedas arreglar.**
7. **Mostrarlo y esperar el OK.** Mostrá el preview **entero** y preguntá: _"¿lo posteo
   así, lo edito, o lo descarto?"_ **Frená ahí.** Si te piden cambios (bajar una severidad,
   borrar un hallazgo, reescribir un texto), editás el JSON y volvés a mostrarlo. Sin un
   "sí" explícito **en este turno**, no se postea. Un "sí" de una PR anterior no cuenta.
8. **Postear** — `dai forge review <ref> --from .dai/reviews/<n>.json --yes`. Confirmá el link.

## El `review.json`

```json
{
  "us": "ABC-482",
  "version": "v1",
  "checkStatus": "✅ al día",
  "dod": "4/5",
  "summary": "Prosa breve: el juicio general del PR. Es el cuerpo del review.",
  "good": ["Algo real y específico que está bien."],
  "findings": [
    {
      "path": "src/checkout.ts",
      "line": 42,
      "side": "RIGHT",
      "severity": "high",
      "confidence": 0.9,
      "body": "El hallazgo, en prosa. Qué está mal, por qué, y qué harías."
    }
  ]
}
```

| campo | obligatorio | qué |
|---|---|---|
| `path` | sí | ruta **relativa a la raíz del repo**, tal cual sale en el diff |
| `line` | sí | línea **del lado que declares**; tiene que ser parte del diff |
| `side` | no (`RIGHT`) | `RIGHT` = archivo nuevo · `LEFT` = línea borrada |
| `severity` | sí | `low` \| `medium` \| `high` |
| `confidence` | no (`1`) | 0–1. **Sé honesto**: por debajo de `--min-confidence` el hallazgo no se postea y queda listado como suprimido. Es lo que hace usable el modo desatendido. |
| `body` | sí | el hallazgo, en prosa. Sin `**High**` ni emoji: lo pone el CLI. |

## Modo desatendido

Para reviews simples que no necesitan supervisión, el humano puede pedirlo explícito:

```bash
dai forge review <ref> --from <archivo> --yes --min-severity medium --min-confidence 0.8 --max-comments 10
```

Es una **excepción que se pide**, no el default. Sin `--yes` no se postea nada, nunca.
Y el `--yes` lo tipea el humano: la skill no lo agrega por su cuenta.

## Cuatro cortes duros

1. **No aprobar.** La skill **comenta**, no firma la aprobación. Eso es de un humano.
   `dai forge review` postea siempre con `event: COMMENT`, nunca `APPROVE` — ni siquiera
   en desatendido. No es configurable.
2. **No postear sin OK.** El review sale **con el token del humano y con su nombre**
   (`GITHUB_TOKEN`/`GITLAB_TOKEN` son suyos): el forge lo atribuye a él como usuario, sin
   badge de bot, así que en la PR de un compañero es indistinguible de haberlo escrito a
   mano. Publicar un juicio sobre el código de otro, firmado por alguien que no lo leyó,
   es tan grave como aprobar sin mirar. **El paso 7 no es opcional**, y pesa más que
   antes: un review con 6 comentarios inline firmados por alguien es mucho más que un
   comentario suelto.
3. **Las líneas se sacan del diff, no de la memoria.** Inventar un `path:line` es el
   error más común de un LLM revisando código. El CLI lo caza y lo descarta, pero un
   hallazgo descartado es un hallazgo perdido: si el paso 6 marca descartes, **arreglalos**
   en vez de postear igual.
4. **Hallazgos concretos.** Nada de "mejorar la calidad" en abstracto: archivo, línea,
   y el porqué. Si no es accionable, no va.

> **Por qué el corte 2 existe:** esta skill posteaba directo. El Art. 5 estaba bien
> leído en la letra —no clickeaba Approve— y mal puesto en la práctica: te dejaba
> firmar en público un review que nunca viste. Que salga bueno era suerte, no diseño.

## Relación con el modelo

- Es el paso 6 de [`SCRUM-CON-IA.md`](../../docs/SCRUM-CON-IA.md).
- Se apoya en `dai check` (ADR-0003) y en el forge adapter (`dai forge`, ADR-0002:
  lo mecánico en el CLI, la inteligencia en la skill).
- El review inline y el contrato del `review.json`: [ADR-0016](../../docs/adr/0016-review-inline.md).
- El formato estándar hace que todos los reviews del equipo se lean igual.
