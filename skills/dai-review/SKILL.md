---
name: dai-review
description: "Revisa una Pull/Merge Request de un repo remoto (GitHub o GitLab) de forma consciente de la metodología dai, y deja un comentario estándar en español con errores y mejoras. Corre `dai check` (¿la US está atrasada?), valida el Definition of Done, hace el review de código (correctitud + calidad), compone el comentario estándar, TE LO MUESTRA Y ESPERA TU OK, y recién entonces lo postea — vía el MCP del forge si está disponible, o vía `dai forge comment` (token) si no. Nunca postea sin aprobación explícita: sale con tu nombre y tu token. Invocar como /dai-review <URL-de-la-PR o número>. Usar en el paso 6 de SCRUM-CON-IA (code review), antes de que un partner humano firme."
---

# dai-review — review de PR consciente de la metodología

Es el **primer pase** del paso 6 (code review). No reemplaza al partner humano: le
saca el ruido para que firme lo que importa ([Art. 5](../../docs/MANIFIESTO.md#art-5) del manifiesto). Funciona igual
en **GitHub y GitLab**.

## Las dos caras (cómo postea el comentario)

Mismo comentario estándar, dos formas de dejarlo (elige la disponible, en este orden):

1. **MCP del forge** — si hay un MCP de GitHub/GitLab conectado, postea por ahí.
2. **CLI con token** — si no, `dai forge comment <ref> --body-file <archivo>`. Usa
   `GITHUB_TOKEN`/`GITLAB_TOKEN` del `.env` (token scopeado, **nunca** contraseña).

> **Auth:** git (traer la branch) usa **SSH**; comentar la PR usa **token del forge**
> (comentar no se puede por SSH). Cero contraseñas.

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
   - 🔴 **Errores** de correctitud (bugs, casos borde, seguridad).
   - 🟡 **Mejoras** de calidad (reuso, simplicidad, eficiencia).
   - ✅ Lo que está **bien** (refuerza lo bueno).
5. **Componer el comentario estándar** (ver formato abajo).
6. **Mostrarlo y esperar el OK.** Imprimí el comentario **entero**, tal cual va a salir,
   y preguntá: _"¿lo posteo así, lo edito, o lo descarto?"_ **Frená ahí.** Si te piden
   cambios, aplicalos y volvé a mostrarlo. No hay atajo: sin un "sí" explícito en este
   turno, no se postea. Un "sí" de una PR anterior no cuenta para esta.
7. **Postear** por MCP o `dai forge comment`. Confirmar el link al comentario.

## El comentario estándar

Es el mismo que emite `renderReviewComment` del CLI — respeta esta forma:

```markdown
## 🤖 dai-review

**US:** `ABC-482` @ v1 · `dai check`: ✅ al día
**Definition of Done:** 4/5

### 🔴 Errores (correctitud)
- <hallazgo concreto con archivo:línea>

### 🟡 Mejoras (calidad, reuso, simplicidad)
- <sugerencia concreta>

### ✅ Lo que está bien
- <algo real y específico>

---
_Revisión asistida por dai. La aprobación la firma un humano (Art. 5 del manifiesto)._
```

## Tres cortes duros

1. **No aprobar.** La skill **comenta**, no firma la aprobación. Eso es de un humano.
2. **No postear sin OK.** El comentario sale **con el token del humano y con su nombre**
   (`GITHUB_TOKEN`/`GITLAB_TOKEN` son suyos): en la PR de un compañero figura como si lo
   hubiera escrito él. Publicar un juicio sobre el código de otro, firmado por alguien
   que no lo leyó, es tan grave como aprobar sin mirar. El paso 6 no es opcional.
3. **Hallazgos concretos.** Nada de "mejorar la calidad" en abstracto: archivo, línea,
   y el porqué. Si no es accionable, no va.

> **Por qué el corte 2 existe:** esta skill posteaba directo. El Art. 5 estaba bien
> leído en la letra —no clickeaba Approve— y mal puesto en la práctica: te dejaba
> firmar en público un review que nunca viste. Que salga bueno era suerte, no diseño.

## Relación con el modelo

- Es el paso 6 de [`SCRUM-CON-IA.md`](../../docs/SCRUM-CON-IA.md).
- Se apoya en `dai check` (ADR-0003) y en el forge adapter (`dai forge`, ADR-0002:
  lo mecánico en el CLI, la inteligencia en la skill).
- El comentario estándar hace que todos los reviews del equipo se lean igual.
