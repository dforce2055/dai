# Paso 3 — Rama: atar el código al QUÉ desde el commit uno

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## En qué consiste en detalle

El dev empieza la implementación **atándola al QUÉ**: la branch y el `implements.yaml`
salen del mismo ID del tracker, así el link no puede quedar mal tipeado.

## Herramientas

```bash
dai link-us ABC-482 --us us.md
# → branch  feature/ABC-482-<slug>
# → openspec/changes/<change>/implements.yaml  (con el ac_hash ya calculado)
```

- Convención de rama: [`branch-naming.md`](../../governance/branch-naming.md).
- Schema del link: [ADR-0004](../adr/0004-ubicacion-y-schema-implements.md).
- El `ac_hash` lo calcula `dai ac-hash` ([ADR-0001](../adr/0001-contrato-ac-hash.md)).

## Qué firma el humano

El dev **elige qué US toma**. El resto es mecánico y determinista (el CLI), no
criterio humano — por eso el key **no se tipea a mano** ([Art. 8](../MANIFIESTO.md#art-8), Art. 9).

## Antipatrones

- **Tipear el key en la branch o el yaml a mano** → error que rompe la trazabilidad.
- **Branch sin `implements.yaml`** en trabajo de producto → no hay link.
- **Escribir la cobertura inversa a mano** → se deriva con `dai stamp` (Art. 10).
- **Una branch para varias US** → una US = una capacidad = un `implements.yaml`.
