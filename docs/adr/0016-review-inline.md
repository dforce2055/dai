# ADR-0016 — Review inline: el `review.json` como puerta humana, y el CLI como validador

- **Estado:** aceptado
- **Fecha:** 2026-07-17
- **Decide:** lead / arquitecto de la metodología

## Contexto

`dai-review` dejaba **un comentario al final del hilo** de la PR con todos los hallazgos
en una lista. El reviewer humano tenía que leer "`src/checkout.ts:42` — el guard falla
abierto", abrir el archivo, buscar la línea, y reconstruir el contexto a mano. Por cada
hallazgo.

El review de Copilot, con todos sus defectos, hace algo mejor: deja **un comentario
anclado a cada `archivo:línea`**, clasificado `Low`/`Medium`/`High`, más un resumen
arriba. El hallazgo aparece **al lado del código del que habla**.

Técnicamente el gap era chico y estaba en un solo lugar: `dai forge comment` postea al
endpoint de **issues** (el hilo). El review inline es otro endpoint. No hacía falta una
arquitectura nueva.

Pero al abrirlo aparecieron tres problemas que sí son de diseño:

1. **El modelo inventa líneas.** Un LLM revisando código produce `path:line` que no
   existen en el diff con una facilidad pasmosa. El forge responde `422` sin decir cuál
   de los seis comentarios falló, y en GitHub el review es atómico: **un hallazgo
   inventado tira los cinco buenos**.
2. **La skill posteaba sin gate** (ver 0.8.2). Con un comentario suelto ya era grave.
   Con seis comentarios inline **firmados con el token del humano** —el forge los
   atribuye a él como usuario, sin badge de bot— pesa mucho más.
3. **"Desatendido" no puede significar "sin criterio".** Hacía falta una forma de que un
   review simple salga solo sin que eso implique postear cualquier cosa.

## Decisión

### 1. El contrato es un archivo, y ese archivo es la puerta humana

La skill deja de componer markdown y escribe un **`review.json`** en `.dai/reviews/<n>.json`.
El CLI lo valida y lo postea.

```
skill (criterio)        →  .dai/reviews/22.json  →  dai forge review (mecánico)
hallazgos + severidad      el humano lo edita        valida vs. diff, filtra, postea
```

Es la [ADR-0002](0002-agnostico-del-asistente.md) aplicada al review: el criterio es de
la skill, lo determinista es del CLI.

**Por qué un archivo y no una TUI.** Evaluamos [hunk](https://github.com/modem-dev/hunk),
que resuelve esto con una sesión interactiva en la terminal donde el humano navega los
hunks y el agente le anota comentarios. Lo bueno de robar es el **contrato**: el agente
emite un lote estructurado y la publicación es un paso aparte. Lo que no robamos es la
TUI: construirla es un proyecto entero y **ata el flujo a que el humano esté en tu
terminal** — justo lo contrario de la 0002. Un JSON es diff-eable, editable a mano,
auditable, y anda igual en Claude, Copilot o Cursor.

### 2. El CLI valida contra el diff antes de salir a la red

`dai forge review` trae el diff con **git** (local, por SSH — no gasta rate limit ni
depende de la API) y verifica que cada `path:line` **exista de verdad en el hunk**, del
lado declarado. Lo que no apunta al diff **no se postea**.

Esto es lo que más valor tiene del comando, más que postear. Es la diferencia entre un
review que entra y un `422` críptico que se lleva puestos los hallazgos buenos.

### 3. Nada se cae en silencio

Un hallazgo descartado o filtrado **se reporta**: en el preview del CLI y en un
`<details>` del propio resumen posteado. Un tope (`--max-comments`) que corta en silencio
se lee como "revisé todo" cuando no. Si dai suprime algo, lo dice.

### 4. `--yes` explícito; el desatendido es una excepción que se pide

Sin `--yes` no se postea nada, nunca: se muestra el preview y se corta. El modo
desatendido existe —`--yes --min-severity medium --min-confidence 0.8 --max-comments N`—
pero es una **excepción que el humano tipea**, no un default al que se llega por descuido.

`confidence` es lo que lo hace usable: por debajo del umbral el hallazgo no se postea y
queda listado. Es el equivalente honesto del *"Comments suppressed due to low confidence"*
de Copilot.

### 5. `event: COMMENT`, nunca `APPROVE`

Ni siquiera en desatendido, ni por configuración. dai comenta; la aprobación la firma un
humano ([Art. 5](../MANIFIESTO.md#art-5)).

### 6. Cada comentario inline lleva marca de dai

El review sale con el token del humano, así que el forge lo atribuye a él **sin badge de
bot** — a diferencia de Copilot, que postea vía GitHub App y muestra el badge `AI`. Sin
una marca en el cuerpo, el compañero ve seis juicios sobre su código firmados por una
persona, sin forma de saber que los escribió una máquina. Cada comentario cierra con una
línea que lo dice.

## Consecuencias

**A favor**

- El hallazgo aparece al lado del código. El reviewer humano deja de reconstruir contexto.
- El validador de posiciones convierte el error más común del LLM en un descarte legible,
  antes de la red.
- El `review.json` es auditable y editable: el humano puede bajar una severidad o borrar
  un hallazgo sin pelearse con un prompt.
- Sirve igual en GitHub y GitLab, y con cualquier asistente.

**En contra / a asumir**

- **GitLab no es atómico, y no lo podemos fingir.** GitHub postea resumen + N inline en
  un solo `POST` (o entra todo o no entra nada). GitLab necesita 1 nota para el resumen y
  N `discussions` separadas: si la tercera falla, las dos primeras **ya están
  publicadas**. Se mitiga validando todo antes de la primera llamada, pero cuando falla
  igual, el CLI **reporta qué entró y qué no** en vez de prometer una atomicidad que no
  tiene.
- GitLab exige los tres shas de `diff_refs` en cada comentario: `getPR` tuvo que dejar de
  descartarlos.
- Un `review.json` a medio editar no debe commitearse: `dai init` agrega `.dai/reviews/`
  al `.gitignore` del repo (`.dai/` sigue versionándose — ahí vive `jira-fields.json`).

**Fuera de alcance, a propósito**

- **Bloques `suggestion`** (el botón "Apply suggestion"). Son valiosos pero la sintaxis
  difiere entre GitHub y GitLab; el schema queda abierto para sumarlos después.
- **Cuenta bot / GitHub App** para que los reviews salgan marcados como IA como los de
  Copilot. Una cuenta bot es solo **otro token en el `.env`** (cero código); una GitHub
  App sí es trabajo real (JWT + installation token). Es una decisión de operación del
  equipo, no del CLI, y por eso no la cierra esta ADR.
- **La calidad del review en sí.** dai no compite en catálogos de bugs ni reglas: eso no
  es su dominio. Lo suyo es la trazabilidad y que el hallazgo aterrice donde sirve.
