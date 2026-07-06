<!-- dai usa su propia PR template. Detalle: templates/pull-request.md -->

## Descripción

<!-- Qué hace este PR y por qué (2–4 líneas). -->

## Cambios

- [ ] …

## Testing

- [ ] `npm test` en verde (48+ tests)
- [ ] Sin dependencias nuevas de runtime (cero-dep)
- [ ] Probado a mano el comando afectado (si aplica)

## Documentación

- [ ] README/docs al día (si cambió comportamiento)
- [ ] ADR nuevo en `docs/adr/` (si toca un contrato: `ac_hash`, schema, comandos)

---

## Checklist del Desarrollador

- [ ] Sigue las reglas de [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- [ ] Tests por la interfaz pública; sobreviven a un refactor.
- [ ] Sin secretos en el diff (ADR-0007).

## Checklist del Aprobador

- [ ] Entiendo el propósito e impacto del cambio.
- [ ] Verifiqué calidad y cobertura de tests.
