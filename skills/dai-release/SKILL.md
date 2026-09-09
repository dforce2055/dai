---
name: dai-release
description: "Conduce el ciclo de versión de un repo con dai, paso a paso y confirmando cada uno: el manifiesto de qué entra (qué User Stories, cuáles atrasadas, qué se coló sin US), la versión que corresponde, el corte de la release, la redacción del CHANGELOG, el cierre con tag + release note + back-merge, y —opcional— el aviso a cada US de en qué versión y ambiente salió más la notificación al canal del equipo. Se apoya en `dai release plan/cut/done/stamp/status`: NO recalcula nada por su cuenta, narra lo que el CLI dice. Frena en las dos firmas humanas (aprobar la versión; mergear y publicar) y nunca las salta. Invocar como /dai-release, opcionalmente con la versión. Usar cuando alguien dice 'cortemos una versión', 'hay que sacar release', 'promover a producción' o 'qué entra en la próxima'."
---

# dai-release — conducir el ciclo de versión

Un release tiene doce pasos, dos de ellos son firmas humanas, y los dos que más se olvidan
están **después** de la firma — el release note y el back-merge. Nadie los recuerda todos, y
por eso se hacen mal. Esta skill los conduce.

## El reparto: el CLI sabe, tú contás

No calculás el manifiesto ni derivás la versión. Los comandos ya lo hacen, igual con
Claude, con Copilot o sin ningún asistente ([ADR-0002](../../docs/adr/0002-agnostico-del-asistente.md)):

```
dai release plan --json   →   vos   →   la persona decide
qué entró, en qué estado      lo contás     firma o corrige
```

**Nunca inventes el contenido del manifiesto.** Si `dai release plan` no lista una US, esa
US no entró — aunque la recuerdes del chat. Si el CLI y tu memoria no coinciden, gana el CLI
y lo decís en voz alta.

Lo que sí es tuyo, porque ningún comando puede hacerlo:

1. **Proponer el bump mirando el comportamiento.** El CLI lo deriva de los tipos de commit
   y lo dice: es un piso, no un veredicto. Vos leés el diff. Si algo mueve un default,
   agrega un flag o cambia lo que ve quien no configura nada, **es minor aunque todo sea
   `fix:`** — le pasó a este mismo repo en la 0.14.0, cuatro commits `fix:` que eran minor.
2. **Escribir el CHANGELOG.** El CLI deja el material (las US) y las secciones vacías. La
   prosa la escribís vos: dai sabe *qué* entró, no *por qué importa*.
3. **Ver lo que falta.** Una US atrasada en el manifiesto, una branch que entró sin link,
   el back-merge de la release anterior que nunca se hizo.
4. **Frenar en las firmas.** Y saber que después de la firma quedan pasos pendientes.

## Antes de empezar

Corré `dai release status`. Te dice dónde está el repo en el ciclo y evita el error más
común: cortar una versión cuando la anterior quedó a medio cerrar.

## El ciclo

```
 plan ──▶ [FIRMA 1: la versión] ──▶ cut ──▶ CHANGELOG ──▶ dai pr
                                                            │
                              [FIRMA 2: merge + publicar] ◀──┘
                                        │
                                        ▼
                        done ──▶ stamp (opcional) ──▶ aviso (opcional)
```

### 1 · El manifiesto — `dai release plan`

Corré `dai release plan` y **contá lo que dice**, no lo que esperabas que dijera:

- cuántas US entran y cuáles;
- **cuáles están ATRASADAS** — el QUÉ cambió después de implementarlas, así que esta
  versión las llevaría sin cubrir el criterio nuevo. Nombralas una por una;
- **qué branches entraron sin US y sin prefijo exento** — es la última pantalla donde eso
  se puede ver antes de que quede adentro de una versión;
- el bump propuesto y su justificación.

Si hay US atrasadas o branches huérfanas, **preguntá antes de seguir**: *"¿cortamos igual,
o querés resolver esto primero?"* No decidas vos. Cortar con una US atrasada es legítimo
—a veces el criterio nuevo va en la próxima— pero tiene que ser una decisión, no un
descuido.

### 2 · La versión — FIRMA HUMANA

Proponé la versión **con tu propio análisis del comportamiento**, no repitiendo el bump del
CLI. Decí explícitamente si coincidís con él o no, y por qué:

> El CLI propone `patch` (solo hay commits `fix:`). Yo propongo **minor**: el default de
> `dai pr` cambió, y quien actualice sin leer el changelog lo va a notar. ¿Vamos con 0.15.0?

**Esperá el sí.** Sin confirmación explícita en este turno, no sigas. Un "dale" de un
release anterior no cuenta.

### 3 · Cortar — `dai release cut <X.Y.Z>`

Mostrá el preview del comando y confirmá antes de correrlo con `--yes` (o dejá que pregunte
él). Crea la branch de release, sube el número en los archivos que el repo espeja, escribe
la entrada del CHANGELOG y commitea. **No habla hacia afuera:** ni push, ni tag, ni PR.

Si el repo trabaja sin branch de release (todo sale de la rama de integración), es
`--no-branch`. Preguntá cuál es el flujo si no está claro; no lo asumas.

### 4 · El CHANGELOG — tu parte

`cut` deja la entrada con el material en un comentario y las secciones vacías. **Escribila.**
Mirá cómo están escritas las entradas anteriores del repo y seguí esa voz. Si el repo no
tiene ninguna, el estándar es:

- abrí con **qué estaba mal o qué cambia**, en una o dos frases, para alguien que no siguió
  el desarrollo;
- cada ítem explica **por qué importaba**, no qué archivos se tocaron;
- repartí las US del comentario en las secciones que correspondan y **borrá el comentario**.

Un changelog que solo lista commits no lo lee nadie. Si no sabés por qué un cambio importa,
**preguntá** — es exactamente la información que solo tiene una persona.

Después, commiteá el CHANGELOG y abrí la PR con `dai pr`. La base sale sola del mapa de
ramas: una branch `release/` va contra la rama de producción y pide confirmación explícita.

### 5 · Merge y publicación — FIRMA HUMANA

**Acá parás.** Mergear la PR y publicar (npm, un deploy, lo que este repo use) lo hace una
persona. Si el repo tiene un `RELEASING.md`, leelo y decí los pasos exactos que le tocan.

Decí claramente que **el ciclo no terminó**: falta el tag, el release note y el back-merge.
Es justo acá donde se abandonan los releases hechos a mano.

### 6 · Cerrar — `dai release done <X.Y.Z>`

Después del merge. Tag anotado, release note en el forge, back-merge a integración y aviso
al canal. Cada paso reporta por separado: **si falla la release note, el tag ya existe** —
decilo, no lo tapes.

También **borra la rama de release** que cerró: ya está mergeada, etiquetada y con el
back-merge hecho. Si git se niega, es porque tiene commits que no llegaron a producción —
decilo, no lo tapes con `--keep-branch`.

### 7 · Estampar — `dai release stamp <X.Y.Z> --env <ambiente>` · OPCIONAL

Cuando la versión llega a un ambiente. Le deja a **cada US del release** un comentario
diciendo en qué versión y ambiente salió, y con eso el funcional lee el ticket en vez de
preguntar.

**Antes de correrlo, avisá el alcance en voz alta**: *"esto va a escribir N comentarios en
N tickets, que puede tocar a varias personas del equipo, y no se deshace"*. El comando
muestra el detalle y confirma; tu trabajo es que nadie llegue a esa pantalla sin saber qué
va a pasar.

**Si dicen que no, seguí adelante.** No es un error ni hay que insistir: la versión ya está
hecha. Decí una vez qué se pierde (el ticket no va a registrar en qué versión salió) y
ofrecé la alternativa: *"¿preferís que solo avise al canal?"*. Muchos equipos no quieren
hacer ruido en veinte tickets, y es una decisión legítima.

### 8 · El aviso al canal · OPCIONAL

Sale solo con `done` y con `stamp` si el repo declaró `DAI_NOTIFY`. Mostrá el mensaje
exacto antes de mandarlo. Si el repo no lo declaró y el equipo quiere avisar, `dai release
notify --test` prueba el canal antes de depender de él.

## Reglas que no se negocian

- **No mergeás, no publicás, no desplegás.** Esas son firmas humanas
  ([Art. 5](../../docs/MANIFIESTO.md#art-5) del manifiesto).
- **No inventás el manifiesto ni la versión.** El manifiesto sale del CLI; la versión la
  firma una persona.
- **No escribís un CHANGELOG que no entendés.** Preguntá.
- **No estampás sin avisar el alcance**, y un "no" se acepta sin insistir.
- **No cierres el ciclo sin el release note y el back-merge.** Son los dos que se olvidan.
- **Nada de datos de terceros** en el CHANGELOG, el release note ni el aviso: ni nombres de
  empresas, ni de personas ajenas al repo, ni URLs corporativas. Si el material que tenés a
  mano los trae, traducilos.

## Cuando algo no cierra

- **El tracker no responde** → el manifiesto sale igual con `--no-network`, diciendo que no
  pudo verificar. Es preferible a no tener manifiesto; decilo al contarlo.
- **`done` falla a mitad de camino** → mirá qué reportó cada paso. Si el tag salió, la
  versión existe: lo que falta es la nota o el back-merge, y se completan a mano.
- **El repo no tiene VERSION ni package.json** → normal. El tag es la versión; `cut` lo dice.
- **No hay tags todavía** → el manifiesto arranca desde el principio del repo. Es correcto.
