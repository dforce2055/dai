<!--
  DEFINITION OF DONE (DoD) · dai
  ─────────────────────────────────────────────────────────────────
  El contrato de cierre del CÓMO: cuándo una implementación está
  realmente terminada. Cubre los pasos 4–7 de SCRUM-CON-IA.

  Es configurable por organización (sobre todo el ítem de despliegue),
  pero los ítems de trazabilidad y tests NO se negocian.
-->

# Definition of Done — ¿la implementación está terminada?

> "Terminada" no es "compila". Es testeable, trazable, revisada y con el estado
> derivado, no reportado a mano.

## Checklist

### Tests (TDD)
- [ ] Cada criterio de aceptación tiene su **test** y está **verde**. *(Art. 3)*
- [ ] Los tests verifican por la **interfaz pública**, no espían lo interno.
- [ ] El **smoke** end-to-end del flujo pasa.

### Trazabilidad (el link)
- [ ] Existe `implements.yaml` con `id`, `version` y `ac_hash`. *(Art. 9)*
- [ ] El **`ac_hash` coincide** con el de la US vigente (no se implementó una versión atrasada). *(Art. 11)*
- [ ] La rama sigue la convención (`feature/ABC-###-<slug>`) → ver `governance/branch-naming.md`.

### Revisión
- [ ] Pasó el **primer pase de IA** (`code-review`): sin problemas de correctitud.
- [ ] Un **partner aprobó** el PR/MR (en N1, auto-review honesto). *(Art. 5, Art. 15)*
- [ ] Cumple los estándares del repo (lint, tipos, convenciones).

### Cierre
- [ ] El change se promovió (`opsx:apply` → `opsx:archive`) si aplica.
- [ ] El **CI estampó la cobertura** en el gestor (no la escribió una persona). *(Art. 10)*
- [ ] La US quedó en estado **implementada**.

## Configurable: ¿"done" incluye desplegado?

Cada organización define hasta dónde llega su DoD:

| | El DoD termina en… |
|---|---|
| **N1 / N2** | mergeado + cobertura estampada. El deploy es aparte. |
| **N3** | mergeado + **desplegado en el ambiente acordado** (p. ej. `test`), con el CD reportando la versión viva por ambiente. |

> **Implementación ≠ despliegue.** El CI dice "el repo implementó `@v3`"; el CD dice
> "`@v3` está viva en `pre`". El DoD elige cuál de los dos es el corte de "terminado".
