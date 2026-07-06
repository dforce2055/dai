# Paso 9 — Sprint Review / Demo

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## El paso al 100%

Se muestra lo terminado al PO y stakeholders. La aceptación es **contra los criterios
de aceptación de la US** — que ya eran tests (paso 4). Si el QUÉ evolucionó mientras
tanto, el `@version` lo gritó antes (`dai check` en ⚠️), así que **no hay sorpresas**
del tipo "esto no era lo que pedí".

## Herramientas

- Los criterios Gherkin de la US como guion de la demo.
- `dai check` para confirmar que lo demostrado está **al día** con la US vigente.

## Qué firma el humano

El **PO acepta o rechaza** (Art. 5). La demo la corre una persona.

## Antipatrones

- **Demostrar contra una US atrasada** → aceptás algo que ya no es lo pedido.
- **Criterios que no eran tests** → la demo se vuelve subjetiva ("a mí me anda").
- **Descubrir el drift en la demo** → tenía que haber saltado con `dai check` antes.
