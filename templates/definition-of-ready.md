<!--
  DEFINITION OF READY (DoR) · dai
  ─────────────────────────────────────────────────────────────────
  El contrato del gate ENTRE el QUÉ y el CÓMO: cuándo una User Story
  está lista para entrar a un sprint / ser implementada.

  Lo verifica una persona (y la IA puede pre-chequearlo). Si un ítem
  no se cumple, la US NO entra: vuelve a grill-user-story o grill-intent.
  Es la contracara del Definition of Done.
-->

# Definition of Ready — ¿la US está lista para implementarse?

> Una US que no cumple esto no se planifica. No es burocracia: es lo que evita
> arrancar a codear sobre un QUÉ vago (Art. 7 — no vibe coding).

## Checklist

### Identidad y forma (linkeable)
- [ ] Tiene **ID estable** (ticket del gestor, p. ej. `ABC-###`). *(Art. 8)*
- [ ] Tiene **`spec_version`** (`v1` al nacer).
- [ ] Tiene **autor** identificado.
- [ ] Sigue el formato canónico (`templates/formato-us.md`).

### Problema validado (Gate 0)
- [ ] Pasó `grill-intent`: el **problema** fue desafiado y el veredicto es `a-spec`.
- [ ] Se sabe **quién** siente el dolor (un rol concreto, no "el usuario").
- [ ] Se sabe el **costo de no hacerlo** (por qué ahora).

### Criterios testeables
- [ ] Los **criterios de aceptación** están en **Gherkin** (Dado/Cuando/Entonces).
- [ ] **Cada** criterio puede volverse un **test**. *(Art. 3 — testeable o no existe)*
- [ ] Ningún criterio menciona tablas, endpoints ni framework (eso es CÓMO).

### Alcance y contexto
- [ ] Hay **flujos**: happy path + al menos una excepción.
- [ ] Está explícito el **fuera de scope**.
- [ ] Las **dependencias** (otras US, sistemas, decisiones) están listadas.

### Tamaño (INVEST)
- [ ] Es **chica**: entra en un sprint. Si desborda, se **parte** antes de entrar.
- [ ] Es **independiente**: no depende de otra US a medias.

## Regla de calibración por nivel

- **N1 (dev solo):** el DoR se auto-verifica; el `proposal.md` de OpenSpec hace de US.
  Igual se exige: criterios testeables + fuera de scope. Lo demás se aligera.
- **N2 (equipo compacto):** DoR completo, verificado por el que agarra la US.
- **N3 (federado):** DoR completo + firma del PO + Gate 0 formal registrado.

> El link no se negocia; la ceremonia alrededor sí (Art. 13, Art. 15).
