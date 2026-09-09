# Guía de releases — por qué versionar, y cómo hacerlo sin ceremonia inútil

> En una frase: **desplegar tiene que ser desplegar algo que ya existía y que ya se probó,
> no armarlo en el momento.** Todo lo demás de esta guía sale de ahí.

Esta guía es el *porqué*. Si ya lo tienes claro y solo quieres los comandos, ve al
[tutorial del ciclo completo](../tutoriales/ciclo-de-release).

## El problema, tal como se ve por dentro

Hay equipos que no arman ramas de release ni etiquetan versiones. Cuando llega el momento
de subir a producción, alguien se sienta a recordar qué ramas componen la funcionalidad y
las va mergeando a la rama de producción, una por una.

Eso falla de tres formas distintas, y las tres duelen:

1. **Se despliega algo que nunca se probó.** Cada orden de merge produce un árbol distinto.
   El que llega a producción no existió en ningún ambiente antes de ese momento.
2. **Nadie puede decir qué hay en producción.** Ni qué funcionalidades comprende. Y cuando
   algo se rompe de noche, no hay un punto conocido al que volver.
3. **Se cuelan cosas que no estaban listas**, porque la selección se hace rama por rama, a
   mano y con prisa.

Si te suena, el resto de la guía es para ti.

## Lo que hay que separar, porque no es lo mismo

La trampa habitual es intentar resolver los tres problemas con un solo mecanismo —
normalmente "armemos una rama de release". En realidad son tres:

| Problema | Se resuelve con |
|---|---|
| **Trazabilidad** — qué código hay en cada ambiente | identidad inmutable: un **tag** y un artefacto |
| **Selección** — qué funcionalidades van | lo que está integrado, más *feature flags* |
| **Estabilización** — arreglar sin frenar el desarrollo | **la rama de release**, y solo esto |

La rama de release resuelve el tercero. Si tu equipo no necesita una ventana de
estabilización, es ceremonia sin beneficio.

## Las dos reglas que valen más que cualquier estrategia de ramas

### 1. Construye una vez, promueve el artefacto

Promover a producción es **desplegar el mismo binario/imagen/paquete** que ya pasó por
test, con otra configuración. No es reconstruir desde otra rama.

Si en cada ambiente vuelves a construir, probaste una cosa y desplegaste otra. Es el fallo
más profundo del modelo "una rama por ambiente": el mismo commit produce artefactos
distintos, y las ramas divergen en silencio cuando alguien olvida un *back-merge*.

### 2. Desplegar no es lanzar

Que el código esté en producción no obliga a que la funcionalidad esté visible. Un *feature
flag* separa las dos cosas, y con eso desaparece el motivo real por el que se cuelan cosas a
medias: ya no hace falta retener el código para retener la funcionalidad.

Si algo llega a la rama de integración a medio hacer, ninguna rama de release lo va a
salvar: vas a terminar sacando cosas *de* la release, que es la misma enfermedad al revés y
más difícil de revertir. El control real es doble: **nada se integra si no es desplegable**
(el gate de `dai check --ci`) y lo desplegable-pero-no-lanzable va detrás de un flag.

## Los dos modelos, y la pregunta que elige

**Modelo A — tronco y tag.** Una sola rama de vida larga. Ramas cortas (uno o dos días) con
PR y gate de CI. Cada integración produce un artefacto; promover a producción es desplegar
ese artefacto y etiquetar el commit exacto. Los *hotfix* salen del tag que está en
producción, se etiquetan y se reintegran.

**Modelo B — tronco y rama de release.** Igual que A, pero al cortar se crea
`release/X.Y.Z` desde integración. Solo entran correcciones, y siempre **arregladas primero
en integración y llevadas a la release** — nunca al revés, que es como se pierde el
*back-merge*. Se etiqueta, se despliega, y **la rama se borra**: una rama de release que
sobrevive a su release es un fork. (`dai release done` la borra solo; `dai release status`
avisa de las que quedaron de antes.)

> **La pregunta que decide:** ¿cuántos días pasan entre "dejamos de agregar" y "está en
> producción"? Menos de un día → modelo A, la rama sería ceremonia. Varios días con
> desarrollo en paralelo (QA de regresión, comité de cambios, ventana fija de despliegue) →
> modelo B, y ahí la rama se gana su lugar.

Nota incómoda pero honesta: la investigación de entrega de software encuentra que los
equipos de alto desempeño tienen **ramas de vida corta y pocas ramas de larga vida**. Una
rama de release que vive semanas correlaciona con peor desempeño, no mejor. Si tu ventana se
alarga, conviene preguntarse si es porque hay menos que entregar o porque cada release
duele — la segunda es un síntoma a atacar, no una razón para espaciar más.

## Qué versión poner

Depende de quién consume tu software:

- **Una librería, un SDK, un paquete**: **semver**. El número comunica compatibilidad a
  quien depende de ti, y eso es un contrato.
- **Una aplicación interna** que nadie consume como dependencia: semver puede volverse
  teatro — vas a discutir en reunión si algo es *minor* o *patch* para un número que no le
  comunica nada a nadie. Ahí lo que necesitas es identidad **inequívoca y ordenada**
  (`2026.09.1`, o un secuencial) más un manifiesto de qué contiene. El valor está en el
  manifiesto, no en el número.

Sea cual sea el esquema, **la decisión es de una persona**. dai propone un piso mirando los
tipos de commit y lo dice; la regla que manda mira el **comportamiento observable**. Un
cambio que mueve un valor por omisión es *minor* aunque todos los commits digan `fix:`.

## Qué aporta dai

dai no elige tu estrategia de ramas: eso es tuyo. Lo que aporta es el eslabón que falta en
la trazabilidad.

```
User Story  →  implements.yaml  →  commit  →  PR  →  VERSIÓN  →  AMBIENTE
                                                     └── esto es lo que agrega ──┘
```

Con eso, preguntas que hoy requieren una reunión se contestan desde el ticket:

- **¿Qué entra en la próxima versión?** → `dai release plan`, que además muestra las US
  cuyos criterios cambiaron después de implementarlas y lo que se coló sin declarar US.
- **¿Esto ya está en producción?** → el comentario en la propia User Story, con versión,
  aplicación, ambiente y fecha.
- **¿Dónde estamos en el ciclo?** → `dai release status`, que también avisa si quedó un
  *back-merge* pendiente.

Y dos límites deliberados: **dai no despliega** (llega hasta el tag y vuelve a aparecer
después, estampando) y **no mergea ni publica** — esas son firmas humanas.

## Cómo lo adopta un equipo sin que se abandone en dos sprints

1. **Declara tus dos ramas de vida larga** en el `.env.dai` y deja de discutirlo:
   `DAI_BRANCH_DEV` (la que integra) y `DAI_BRANCH_PROD` (la que va a producción). Con eso,
   `dai pr` deduce la base del tipo de rama y avisa cuando apuntas a producción.
2. **Etiqueta la próxima versión aunque el proceso todavía sea manual.** El tag es lo que te
   da el punto de retorno; todo lo demás se puede agregar después.
3. **Corre `dai release plan` antes de cada corte, y léelo en voz alta en la reunión.** Es
   donde aparecen las sorpresas mientras todavía se pueden arreglar.
4. **Empieza a estampar solo en producción.** Si estampar en todos los ambientes hace
   demasiado ruido, con producción alcanza para contestar la pregunta que más se hace.
5. **Deja el aviso al canal para el final.** Es lo que hace visible el cambio para el resto
   de la organización, y conviene encenderlo cuando el ciclo ya funciona.

## Preguntas frecuentes

**No usamos npm y no tenemos `package.json`. ¿Sirve igual?**
Sí. El tag es la versión; los archivos son espejos opcionales. dai actualiza los que
reconoce, dice cuáles tocó, y no se detiene si no hay ninguno.

**Nuestra rama principal despliega a producción.**
Decláralo en `DAI_BRANCH_PROD`. dai marcará esa base en el previo de la PR y pedirá una
confirmación explícita antes de proponer un merge hacia ahí.

**¿Y si no queremos llenar los tickets de comentarios?**
No estampes. La versión ya está hecha cuando llegas a ese paso: `dai release stamp` es
opcional y decir que no no rompe nada. Muchos equipos prefieren avisar solo al canal.

**¿Cada cuánto conviene sacar una versión?**
Tan seguido como el equipo tolere sin dolor. Si la respuesta a "¿por qué no más seguido?" es
*"no hay tanto que entregar"*, está bien. Si es *"porque cada release cuesta"*, eso es lo que
hay que arreglar — y espaciar los releases lo empeora, porque agranda el lote.
