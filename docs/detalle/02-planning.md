# Paso 2 — Planning: derivar el CÓMO desde la US

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## El paso al 100%

El equipo elige qué US entran al sprint (prioridad + capacidad). Para cada una, el
dev corre OpenSpec sobre la US: `opsx:explore` (entiende specs + código) y luego
`opsx:propose`, que **genera** el `design.md`, el `tasks.md` y las deltas de
`specs/`. El dev valida y ajusta — no acepta a ciegas.

## Herramientas

- `opsx:explore` → mapa de specs y código relevante.
- `opsx:propose` → `proposal.md` + `design.md` + `tasks.md` + `specs/`.

## Qué firma el humano

El **equipo** decide capacidad y prioridad. El **dev** valida el design y las tareas
propuestas — son suyas, nacen del CÓMO (Art. 1), no bajadas desde arriba.

## Antipatrones

- **Tareas inventadas por fuera del que implementa** → pierden sentido técnico.
- **Estimar a ciegas** una US que no cumple el DoR → primero se pule (paso 1).
- **US demasiado grande** que no entra en el sprint → se parte (INVEST), no se fuerza.
- **Aceptar el design generado sin leerlo** → el dev es responsable del CÓMO.
