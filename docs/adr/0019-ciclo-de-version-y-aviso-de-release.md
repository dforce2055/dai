# ADR-0019 — El ciclo de versión: manifiesto de US, dos mitades con una firma en el medio, y el aviso como evento

- **Estado:** aceptado
- **Fecha:** 2026-09-09
- **Decide:** lead / arquitecto de la metodología

## Contexto

Hay equipos —grandes y medianos, no solo los desprolijos— que **no arman ramas de release
ni etiquetan versiones**. Desplegar a producción se vuelve un ejercicio de memoria: hay que
acordarse de qué ramas componen la funcionalidad y mergearlas a la rama de producción una
por una, en el momento del despliegue.

Eso tiene tres consecuencias, y las tres se ven en repos reales:

1. **Se despliega una combinación que nunca se probó.** Cada orden de merge produce un
   árbol distinto; el que llega a producción no existió en ningún ambiente antes.
2. **No se puede contestar qué hay en cada ambiente.** Ni qué funcionalidades comprende.
   Cuando algo falla a las tres de la mañana, no hay a qué volver.
3. **Se cuelan funcionalidades que no estaban listas**, porque la selección de qué va se
   hace rama por rama y a mano.

dai ya sabía atar una User Story a su código (`implements.yaml`) y a su commit
(`dai stamp`). Lo que faltaba era el último eslabón: atar la US a la **versión desplegada**.
Sin eso, la trazabilidad llega hasta la PR y se corta justo donde el negocio pregunta.

## Decisión

### 1. dai aporta el manifiesto, no la estrategia de branching

La estrategia de ramas la elige cada equipo, y dai no opina: es una herramienta, no un
mandato. Lo que dai aporta es el eje que ya es suyo, extendido un paso:

```
implements.yaml   →   commit   →   PR   →   VERSIÓN   →   AMBIENTE
   (ADR-0004)        (ADR-0005)          ←── esto es lo nuevo ──→
```

`dai release plan` produce el **manifiesto**: qué User Stories entran entre el último tag y
la rama de integración, en qué estado está cada una, y qué entró **sin** declarar US. Los
otros comandos son formas distintas de publicar ese mismo dato — el CHANGELOG, el tag, el
comentario en cada ticket, el aviso al canal.

**Cómo se resuelve qué US entró:** leyendo los `implements.yaml` tal como estaban en cada
commit del rango, no por el nombre de la rama. El link viaja con el código, así que la
respuesta sobrevive a que la rama se borre y a que el change se archive — que es
exactamente el estado del repo cuando se llega a cortar la versión, días después del merge.

**Alternativa descartada:** deducirlo del nombre de la rama en el commit de merge. Es más
simple y es frágil: desaparece con squash, con rebase, y con cualquier equipo que renombre.
Se conserva solo como señal secundaria, para detectar lo que entró **sin** link.

### 2. El bump se propone; lo firma una persona

dai deriva un piso del tipo de los commits (`feat:` → minor, `!` → major) y **lo dice**: es
una propuesta, no un veredicto. La regla que manda mira el **comportamiento observable**.

La evidencia es de este mismo repo: la versión 0.14.0 salió con cuatro commits `fix:` y era
minor, porque cambió un default que ve quien no configura nada. Cualquier herramienta que
derive la versión de los tipos de commit —semantic-release, standard-version, Conventional
Commits puro— habría cortado un patch equivocado.

**Alternativa descartada:** versionado automático desde los commits. Es precisamente el
pedazo que no hay que automatizar: convierte una decisión de comunicación en un efecto
secundario de cómo alguien tituló un commit.

### 3. El corte son dos comandos, porque hay una firma humana en el medio

```
plan ──▶ [FIRMA: la versión] ──▶ cut ──▶ dai pr ──▶ [FIRMA: merge + publicar]
                                                            │
                                            finish ◀────────┘
```

`cut` **prepara y no habla hacia afuera**: rama de release, número, entrada de CHANGELOG,
commit. Ni push, ni tag, ni PR.

`finish` **cierra después del merge**: tag anotado, release note, back-merge y aviso. Existe
como comando separado porque los dos pasos que más se olvidan cuando la ceremonia se hace a
mano —el release note y el back-merge— viven en esta mitad, la que queda después de la firma.

**Una vez creado el tag, ningún paso posterior aborta.** El tag es la versión: si existe, la
versión existe. Fallar y salir dejaría el corte a medio camino sin decir en qué mitad quedó,
así que cada paso reporta y sigue.

### 4. El tag es la versión; los archivos son espejos

`dai release cut` sube el número en `VERSION` y `package.json` **si existen**, informa cuáles
tocó, y no se planta si no hay ninguno. Un repo .NET o un frontend corporativo versionan
igual de bien sin ninguno de los dos.

El bump de `package.json` es **quirúrgico** —solo la línea de la versión—: reserializar el
JSON reformatea los objetos compactos y llena el diff de la release de ruido que nadie pidió.

### 5. El CHANGELOG lo escribe una persona; dai deja el material

`cut` inserta la entrada con las US del manifiesto **en un comentario HTML** (se ve al
editar, desaparece al renderizar) y las secciones vacías. La prosa no la escribe dai: sabe
*qué* entró, no *por qué importa*.

**Alternativa descartada:** generar el changelog desde los subjects de los commits. Produce
una lista que nadie lee, y encima da la sensación de que el trabajo está hecho.

### 6. Estampar la versión en cada US es opcional, y avisa su alcance

`dai release stamp <v> --env <ambiente>` deja en **cada US del release** un comentario con
versión, app, ambiente y fecha. Con eso el funcional lee el ticket en vez de preguntar, y
una US federada en varios repos acumula sola su matriz (backend en producción, frontend en
pre).

Tres cuidados, porque escribe N veces hacia afuera en tickets de gente distinta:

- **Muestra el alcance real antes de escribir** — cuántos comentarios y en qué tickets,
  descontando los que ya están. Un número inflado enseña a ignorar el aviso.
- **Es idempotente por `(app, versión, ambiente)`**, con una marca en el propio comentario.
  Redesplegar no llena el ticket de repetidos; la misma versión en otro ambiente sí es un
  evento nuevo.
- **Si no puede leer los comentarios, lo dice** en vez de suponer que no estampó. Es la
  misma distinción que ADR-0003 hace entre "no hay US" y "no hubo respuesta"; acá afirmar de
  más se paga en duplicados que nadie puede borrar.

**Decir que no sale con 0.** Para cuando el comando corre, el tag y el release note ya
existen: la versión está hecha. Que un equipo elija no hacer ruido en veinte tickets es una
decisión legítima, no un error a corregir.

### 7. El aviso al canal es un tercer adaptador, y su mensaje tiene estructura sin formato

`DAI_NOTIFY` elige el backend igual que `DAI_PM` elige el tracker: `discord`, `slack`,
`webex`, `telegram`, un `webhook` genérico, o `none` (el default: dai no habla hacia afuera
sin que se lo pidan).

El mensaje es **uno solo para todos los canales**, con estructura —qué salió, quién, cuándo,
qué trae, dónde mirar— y **sin formato**. La distinción es de costo, no estética: la
estructura son saltos de línea y viñetas, y se ve igual en los cinco; el formato son cuatro
dialectos incompatibles (Discord con `**negrita**` y sin links con nombre, Slack con
`*negrita*` y `<url|texto>`, Webex con markdown completo, Telegram con `parse_mode` y el
escapeo de MarkdownV2 que devuelve 400 por un punto suelto). Con esa decisión, el adaptador
es una tabla de cinco líneas en lugar de un módulo de render.

**Las viñetas son las User Stories, no los subjects de los commits.** Un aviso que dice *"se
implementa el conversor de propiedades no serializables"* lo entiende quien escribió el
código; uno que dice *"Checkout sin duplicado"* lo entiende el negocio. Es la misma
distinción entre el QUÉ y el CÓMO que sostiene el método, aplicada al canal.

**El endpoint es la credencial:** quien lo tiene, postea. Vive en `.env.dai` (ADR-0017) y
dai muestra el host, nunca la URL — tampoco en los mensajes de error.

**Qué versión hay en cada ambiente NO vive en el repo.** Un despliegue es un evento, no un
archivo: cambia sin que cambie el código. Guardarlo en un archivo obligaría al CI a
commitear en cada deploy. Su registro es el stamp en el tracker y el release del forge.

### 8. `finish` borra la rama de release que acaba de cerrar

Es el único punto del ciclo donde dai puede **afirmar** que borrarla es seguro: ya está
mergeada en producción, etiquetada y con el back-merge hecho. Si no se hace ahí, se
acumulan — este mismo repo tenía cinco cuando se implementó el comando.

La red de seguridad la pone git, no una suposición: `git branch -d` (minúscula) se niega a
borrar una rama sin mergear. Hay precedente en el CLI: `dai done` ya hace exactamente esto
con la rama de una US.

**Alternativa descartada:** un `dai release cleanup` que borre ramas de release viejas en
masa. dai no las creó, no puede saber si alguien conserva una a propósito, y limpiar ramas
en general no es su dominio. `dai release status` las nombra y deja el comando escrito;
borrarlas es del equipo.

### 9. Lo que dai NO hace

- **No despliega.** Llega hasta el tag y vuelve a aparecer después, estampando. Quién
  despliega es el pipeline.
- **No mergea ni publica.** Son firmas humanas ([Art. 5](../MANIFIESTO.md#art-5)).
- **No impone un modelo de branching.** La rama de release es opcional (`--no-branch`), y
  las dos ramas de vida larga las declara el repo (`DAI_BRANCH_DEV` / `DAI_BRANCH_PROD`).
- **No es un framework de notificaciones.** Avisa eventos de release con su manifiesto.

## Consecuencias

- Un equipo puede contestar, sin reunirse: **qué versión hay en cada ambiente y qué US
  comprende**. Desde el ticket, no desde un Excel.
- El manifiesto expone, antes de cortar, **las US atrasadas** y **lo que entró sin link** —
  la última pantalla donde eso se puede ver.
- El ciclo funciona igual con rama de release (ventana de estabilización) y sin ella (tag
  directo desde integración), así que dai no fuerza a nadie a cambiar de estrategia para
  ganar trazabilidad.
- Aparecen dos variables nuevas de config (`DAI_NOTIFY`, `DAI_NOTIFY_WEBHOOK`, más
  `DAI_NOTIFY_CHAT_ID` solo para Telegram) y dos métodos nuevos en el adaptador de PM
  (`comment`, `listComments`), que cualquier backend nuevo tiene que implementar para
  soportar el estampado de versión.
- La skill `/dai-release` conduce el ciclo pero **no recalcula nada**: narra lo que dicen
  los comandos. Si la skill y el CLI se contradicen, gana el CLI.
