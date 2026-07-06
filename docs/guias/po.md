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

1. **Nace una idea** → creas el ticket en el gestor (nace con ID, aunque sea vago).
2. **Gate 0** → ejecutas `/grill-intent`. La IA te desafía el *problema*: ¿es el
   correcto? ¿quién lo sufre? ¿qué pasa si no lo hacemos? Un veredicto válido es
   *"no lo construyas"* — eso es el gate haciendo su trabajo (Art. 4).
3. **Pules el QUÉ** → ejecutas `/grill-user-story`. La IA te **interroga** hasta que
   la US es testeable (INVEST + Gherkin) y la publica en el gestor. La IA no
   inventa requerimientos: te los saca a preguntas. Tú respondes y decides.
4. **Verificas el DoR** → antes de que entre al sprint, la US cumple el
   `definition-of-ready.md`.
5. **Demo** → aceptas o rechazas contra los mismos criterios que ya eran tests.

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

`/grill-intent` · `/grill-user-story` · el gestor de proyectos · `definition-of-ready.md`
