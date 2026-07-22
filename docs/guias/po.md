# Guía del PO / funcional

> Tu trabajo en una frase: **defines el QUÉ y el porqué. Nunca el CÓMO.**
> Trabajas donde ya trabajas (el gestor de proyectos), nunca entras al código.

## Lo que eres dueño

- El **contenido funcional** de cada US: el problema, el usuario, el valor.
- Los **criterios de aceptación** (qué tiene que cumplirse para aceptar).
- La **prioridad** y el **spec_version** (subes la versión cuando el QUÉ cambia).
- La **aceptación** en la demo.

## Lo que NO tocas

- Tablas, endpoints, framework, arquitectura → eso es el CÓMO, del dev.
- El código, las ramas, el `implements.yaml`.
- El "cómo se construye". Si te metes ahí, detente: no es tu terreno ([Art. 1](../MANIFIESTO.md#art-1)).

## Tu día a día

1. **Nace una idea — o llega un documento** → creas el ticket en el gestor (nace con ID,
   aunque sea vago). Si en cambio partes de un **documento de análisis** (PDF, Word),
   `/doc-to-backlog` lo convierte en un **backlog candidato** de épicas + US para que
   priorices y valides. Y si algo es **demasiado grande** para una sola US,
   `/grill-epic` lo parte en varias.
2. **Pulir el QUÉ** → ejecutas `/grill-user-story`. La IA te **interroga** hasta que
   la US es testeable (INVEST + Gherkin) y la publica en el gestor. La IA no
   inventa requerimientos: te los saca a preguntas. Tú respondes y decides.
3. **Gate 0** → ejecutas `/grill-intent` sobre la US ya formada. La IA te desafía el
   *problema*: ¿es el correcto? ¿quién lo sufre? ¿qué pasa si no lo hacemos? Un veredicto
   válido es *"no lo construyas"* — eso es el gate haciendo su trabajo (Art. 4).
4. **Verificas el [DoR](../../templates/definition-of-ready.md)** → antes de que entre al sprint, la US cumple el
   [`definition-of-ready.md`](../../templates/definition-of-ready.md).
5. **Editas una US que ya existe** → `dai edit-us ABC-482`. La **baja del gestor**, te la
   abre en tu editor, **valida el formato** cuando guardas, te muestra qué cambia y
   recién ahí la sube. Ver [Cuando el QUÉ cambia](#cuando-el-que-cambia) abajo.
6. **Demo** → aceptas o rechazas contra los mismos criterios que ya eran tests.

## Cuando el QUÉ cambia {#cuando-el-que-cambia}

Un criterio que faltaba, una regla que aparece a mitad del sprint. La US **vive en el
gestor**, no en un `.md` que alguien tiene que acordarse de sincronizar — así que dai la
trae, te deja editarla y la devuelve:

```bash
dai edit-us ABC-482
```

1. **Baja** la US del gestor (Jira / ClickUp) a un `.md`.
2. **La abre** en tu `$EDITOR`. Escribes en markdown, con el
   [molde canónico](../../templates/formato-us.md) delante.
3. **Valida el formato** al guardar: que tenga título, que tenga criterios, y que cada
   criterio sea Gherkin completo (`Dado / Cuando / Entonces`). Si algo no da, **te
   devuelve al editor** — no te tira lo escrito.
4. **Te muestra qué cambia** allá arriba: título, cuántos criterios, el `ac_hash`.
5. **Te pregunta si subir el `spec_version`** — y esta es la decisión tuya, no de dai:

   | Tu cambio | Respondes | Qué pasa |
   |---|---|---|
   | Un criterio nuevo, una regla distinta (**material**) | `s` → `v1` → `v2` | los repos que implementaron `v1` se marcan **atrasados** solos |
   | Un typo, redacción más clara (**editorial**) | `n` → se queda en `v1` | nadie se marca atrasado |

   dai no puede distinguir las dos cosas mirando el hash: sabe *que* cambió, no *si
   importa*. Eso lo sabes tú.
6. **Confirmas** y recién ahí escribe en el gestor. Sin confirmación no se toca nada.

> **`--dry-run`** te muestra todo el preview sin escribir. Úsalo la primera vez.

Solo dos cosas te **frenan**: que la US no tenga título, o que no tenga criterios. Sin
criterios no hay `ac_hash`, y sin `ac_hash` la US no se puede linkear a ningún repo — no
es una regla de estilo, es lo que sostiene la trazabilidad. Todo lo demás (un criterio
que no es Gherkin, un título largo) es un **aviso**: dai te lo dice y sigue.

## La trampa a evitar

**Criterios no testeables.** *"El usuario tiene una buena experiencia"* no es un
criterio: no se puede volver un test. La skill te va a frenar ahí — déjala. Un buen
criterio es *"un carrito vacío no se puede finalizar"* (Art. 3).

## Lo que ganas

Cuando cambias el QUÉ (subes a `v2`), **todos los repos que implementaron la versión
vieja se marcan atrasados solos**. No tienes que perseguir a nadie: el `@version` lo
grita (Art. 11). Y ves en el ticket quién ya lo implementó, sin preguntar — lo puso
el CI (Art. 10).

## Tus herramientas

- `/doc-to-backlog` — un documento (PDF/Word) → backlog candidato de épicas + US
- `/grill-epic` — algo grande → una épica partida en varias US
- `/grill-user-story` — una US funcional y testeable
- `/grill-intent` — Gate 0: desafía el problema de la US antes del spec
- `dai edit-us <ID>` — traes una US del gestor, la editas, dai valida y la devuelve
- el gestor de proyectos
- [`definition-of-ready.md`](../../templates/definition-of-ready.md)
